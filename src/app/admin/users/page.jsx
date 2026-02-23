'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, Shield, User, ArrowUpDown, ArrowUp, ArrowDown, RotateCcw, Ban, CheckCircle, ChevronDown, MoreVertical } from 'lucide-react';
import { adminUsersAPI } from '@/lib/api';
import { ConfirmModal, AlertModal } from '../components';
import styles from '../admin.module.css';

export default function UsersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmModal, setConfirmModal] = useState(null);
  const [alertModal, setAlertModal] = useState({ open: false, title: '', message: '' });
  const [updatingRoleId, setUpdatingRoleId] = useState(null);
  const [banningUserId, setBanningUserId] = useState(null);
  const [roleMenuOpen, setRoleMenuOpen] = useState(null); // ID пользователя, для которого открыто меню
  const roleMenuRef = useRef(null);
  const searchDebounceRef = useRef(null);

  const [limit, setLimit] = useState(() => {
    const saved = localStorage.getItem('admin_users_limit');
    return saved ? parseInt(saved, 10) : 10;
  });

  const MIN_LOADING_MS = 500;
  const lastFetchedPageRef = useRef(null);
  const lastFetchedSortRef = useRef({ sortBy: null, sortOrder: 'asc' });
  
  // Получаем роль текущего пользователя
  useEffect(() => {
    const adminUser = localStorage.getItem('adminUser');
    if (adminUser) {
      try {
        const userData = JSON.parse(adminUser);
        setCurrentUserRole(userData.role);
      } catch (e) {
        // Игнорируем ошибку парсинга
      }
    }
  }, []);
  
  // Инициализируем сортировку из URL параметров
  const [sortBy, setSortBy] = useState(() => {
    const urlSortBy = searchParams.get('sortBy');
    return urlSortBy || null;
  });
  const [sortOrder, setSortOrder] = useState(() => {
    const urlSortOrder = searchParams.get('sortOrder');
    return (urlSortOrder === 'asc' || urlSortOrder === 'desc') ? urlSortOrder : 'asc';
  });

  const handleSort = (field) => {
    const newParams = new URLSearchParams(searchParams);
    let newSortBy, newSortOrder;
    
    if (sortBy === field) {
      // Переключаем порядок сортировки
      newSortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
      newSortBy = field;
    } else {
      // Устанавливаем новое поле сортировки
      newSortBy = field;
      newSortOrder = 'asc';
    }
    
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    
    // Обновляем URL с параметрами сортировки
    newParams.set('sortBy', newSortBy);
    newParams.set('sortOrder', newSortOrder);
    newParams.delete('page'); // Сбрасываем на первую страницу
    setSearchParams(newParams, { replace: true });
  };

  const handleResetSort = () => {
    setSortBy(null);
    setSortOrder('asc');
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('sortBy');
    newParams.delete('sortOrder');
    newParams.delete('page'); // Сбрасываем на первую страницу
    setSearchParams(newParams, { replace: true });
  };

  const fetchUsers = async (page, updateUrl = true) => {
    const start = Date.now();
    setIsLoading(true);
    try {
      const params = { page, limit, search: searchQuery };
      // Для SUPERADMIN можно показать всех, для ADMIN бэкенд сам вернет только USER
      if (currentUserRole === 'SUPERADMIN') {
        params.includeSuperadmin = 'true';
      }
      if (sortBy) {
        params.sortBy = sortBy;
        params.sortOrder = sortOrder;
      }
      const response = await adminUsersAPI.getAll(params);
      setUsers(response.data.items);
      setPagination(response.data.pagination);
      lastFetchedPageRef.current = page;
      
      if (updateUrl) {
        const newParams = new URLSearchParams(searchParams);
        const urlPage = parseInt(newParams.get('page') || '1', 10);
        if (page !== urlPage) {
          if (page === 1) {
            newParams.delete('page');
          } else {
            newParams.set('page', page.toString());
          }
          setSearchParams(newParams, { replace: true });
        }
      }
    } catch (error) {
      setAlertModal({
        open: true,
        title: 'Ошибка',
        message: error.response?.data?.message || 'Не удалось загрузить пользователей',
      });
    } finally {
      const elapsed = Date.now() - start;
      if (elapsed < MIN_LOADING_MS) {
        setTimeout(() => setIsLoading(false), MIN_LOADING_MS - elapsed);
      } else {
        setIsLoading(false);
      }
    }
  };

  // Синхронизируем состояние сортировки с URL параметрами при их изменении
  useEffect(() => {
    const urlSortBy = searchParams.get('sortBy');
    const urlSortOrder = searchParams.get('sortOrder');
    
    // Обновляем состояние только если URL параметры отличаются от текущего состояния
    if (urlSortBy !== sortBy) {
      setSortBy(urlSortBy || null);
    }
    if (urlSortOrder && urlSortOrder !== sortOrder && (urlSortOrder === 'asc' || urlSortOrder === 'desc')) {
      setSortOrder(urlSortOrder);
    }
    // Если в URL нет параметров сортировки, но они есть в состоянии - сбрасываем
    if (!urlSortBy && sortBy !== null) {
      setSortBy(null);
      setSortOrder('asc');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Загружаем данные при изменении страницы в URL или сортировки
  useEffect(() => {
    if (!currentUserRole) return; // Ждем загрузки роли
    
    const urlPage = parseInt(searchParams.get('page') || '1', 10);
    const urlSortBy = searchParams.get('sortBy');
    const urlSortOrder = searchParams.get('sortOrder') || 'asc';
    
    const currentSort = { sortBy: urlSortBy || null, sortOrder: urlSortOrder };
    const shouldRefetch = 
      urlPage !== lastFetchedPageRef.current ||
      currentSort.sortBy !== lastFetchedSortRef.current.sortBy ||
      currentSort.sortOrder !== lastFetchedSortRef.current.sortOrder;
    
    if (shouldRefetch) {
      lastFetchedPageRef.current = urlPage;
      lastFetchedSortRef.current = currentSort;
      fetchUsers(urlPage, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, currentUserRole]);

  useEffect(() => {
    if (!currentUserRole) return; // Ждем загрузки роли
    
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      fetchUsers(1);
    }, 500);
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery, limit, currentUserRole]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      fetchUsers(newPage);
    }
  };

  const handleLimitChange = (newLimit) => {
    setLimit(newLimit);
    localStorage.setItem('admin_users_limit', newLimit.toString());
    // Сбрасываем на первую страницу при изменении limit
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('page');
    setSearchParams(newParams, { replace: true });
    fetchUsers(1, true);
  };

  // Закрытие выпадающего меню при клике вне его
  useEffect(() => {
    if (!roleMenuOpen) return;

    const handleClickOutside = (event) => {
      // Проверяем, что клик был вне меню
      if (roleMenuRef.current && !roleMenuRef.current.contains(event.target)) {
        setRoleMenuOpen(null);
      }
    };

    // Используем click вместо mousedown и без capture phase, чтобы onClick успел сработать
    // Небольшая задержка, чтобы дать время onClick на кнопках меню сработать
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [roleMenuOpen]);

  const handleRoleChangeClick = (user) => {
    setRoleMenuOpen(roleMenuOpen === user.id ? null : user.id);
  };

  const handleRoleSelect = (user, newRole) => {
    if (user.role === newRole) {
      setRoleMenuOpen(null);
      return;
    }

    const roleNames = {
      USER: 'Пользователь',
      ADMIN: 'Администратор',
      SUPERADMIN: 'Суперадминистратор',
    };
    
    // Закрываем меню
    setRoleMenuOpen(null);
    
    // Небольшая задержка перед показом модалки, чтобы меню успело закрыться
    setTimeout(() => {
      setConfirmModal({
        title: `Изменить роль пользователя?`,
        message: `Вы уверены, что хотите изменить роль пользователя "${user.email}" на "${roleNames[newRole]}"?`,
        confirmLabel: 'Изменить',
        cancelLabel: 'Отмена',
        variant: 'default',
        onConfirm: async () => {
          setUpdatingRoleId(user.id);
          try {
            const response = await adminUsersAPI.updateRole(user.id, newRole);
            
            // Если пользователь стал ADMIN и текущий пользователь ADMIN, удаляем его из списка
            // Если пользователь стал USER и текущий пользователь SUPERADMIN, он останется в списке
            if (currentUserRole === 'ADMIN' && newRole !== 'USER') {
              // Админ не должен видеть других админов - удаляем из списка
              setUsers((prev) => prev.filter((u) => u.id !== user.id));
              setPagination((prev) => ({
                ...prev,
                total: Math.max(0, prev.total - 1),
              }));
            } else {
              // Обновляем пользователя в списке
              setUsers((prev) =>
                prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u))
              );
            }
            
            setConfirmModal(null);
            setAlertModal({
              open: true,
              title: 'Успешно',
              message: `Роль пользователя изменена на "${roleNames[newRole]}"`,
            });
            
            // Если нужно, перезагружаем список пользователей
            if (currentUserRole === 'ADMIN' && newRole !== 'USER') {
              // Перезагружаем список, чтобы обновить счетчик
              setTimeout(() => {
                fetchUsers(pagination.page, false);
              }, 500);
            }
          } catch (error) {
            setAlertModal({
              open: true,
              title: 'Ошибка',
              message: error.response?.data?.message || error.message || 'Не удалось изменить роль пользователя',
            });
          } finally {
            setUpdatingRoleId(null);
            setConfirmModal(null);
          }
        },
        onCancel: () => setConfirmModal(null),
      });
    }, 100);
  };

  const handleBanUser = (user) => {
    setConfirmModal({
      title: 'Заблокировать пользователя?',
      message: `Вы уверены, что хотите заблокировать пользователя "${user.email}"?`,
      confirmLabel: 'Заблокировать',
      cancelLabel: 'Отмена',
      variant: 'danger',
      onConfirm: async () => {
        setBanningUserId(user.id);
        try {
          await adminUsersAPI.ban(user.id);
          setUsers((prev) =>
            prev.map((u) => (u.id === user.id ? { ...u, isBanned: true } : u))
          );
          setConfirmModal(null);
          setAlertModal({
            open: true,
            title: 'Успешно',
            message: 'Пользователь заблокирован',
          });
        } catch (error) {
          setAlertModal({
            open: true,
            title: 'Ошибка',
            message: error.response?.data?.message || 'Не удалось заблокировать пользователя',
          });
        } finally {
          setBanningUserId(null);
          setConfirmModal(null);
        }
      },
      onCancel: () => setConfirmModal(null),
    });
  };

  const handleUnbanUser = (user) => {
    setConfirmModal({
      title: 'Разблокировать пользователя?',
      message: `Вы уверены, что хотите разблокировать пользователя "${user.email}"?`,
      confirmLabel: 'Разблокировать',
      cancelLabel: 'Отмена',
      variant: 'default',
      onConfirm: async () => {
        setBanningUserId(user.id);
        try {
          await adminUsersAPI.unban(user.id);
          setUsers((prev) =>
            prev.map((u) => (u.id === user.id ? { ...u, isBanned: false } : u))
          );
          setConfirmModal(null);
          setAlertModal({
            open: true,
            title: 'Успешно',
            message: 'Пользователь разблокирован',
          });
        } catch (error) {
          setAlertModal({
            open: true,
            title: 'Ошибка',
            message: error.response?.data?.message || 'Не удалось разблокировать пользователя',
          });
        } finally {
          setBanningUserId(null);
          setConfirmModal(null);
        }
      },
      onCancel: () => setConfirmModal(null),
    });
  };

  const renderPagination = () => (
    <>
      <div className={styles.paginationLimit}>
        <label htmlFor="limit-select">Показывать:</label>
        <select
          id="limit-select"
          value={limit}
          onChange={(e) => handleLimitChange(parseInt(e.target.value, 10))}
          className={styles.limitSelect}
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>
      {pagination.pages > 1 && (
        <div className={styles.pagination}>
          <button
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
            className={styles.pageBtn}
            aria-label="Предыдущая страница"
          >
            <ChevronLeft size={18} />
          </button>
          {(() => {
            const pages = [];
            const totalPages = pagination.pages;
            const current = pagination.page;
            if (current > 3) {
              pages.push(
                <button key={1} onClick={() => handlePageChange(1)} className={styles.pageBtn}>1</button>
              );
              if (current > 4) pages.push(<span key="ellipsis1" className={styles.ellipsis}>...</span>);
            }
            const start = Math.max(1, current - 2);
            const end = Math.min(totalPages, current + 2);
            for (let i = start; i <= end; i++) {
              pages.push(
                <button key={i} onClick={() => handlePageChange(i)} className={`${styles.pageBtn} ${current === i ? styles.active : ''}`}>{i}</button>
              );
            }
            if (current < totalPages - 2) {
              if (current < totalPages - 3) pages.push(<span key="ellipsis2" className={styles.ellipsis}>...</span>);
              pages.push(<button key={totalPages} onClick={() => handlePageChange(totalPages)} className={styles.pageBtn}>{totalPages}</button>);
            }
            return pages;
          })()}
          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page === pagination.pages}
            className={styles.pageBtn}
            aria-label="Следующая страница"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </>
  );

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getUserDisplayName = (user) => {
    if (user.userInformation?.firstName || user.userInformation?.lastName) {
      return [user.userInformation.firstName, user.userInformation.lastName].filter(Boolean).join(' ') || user.name || user.login;
    }
    return user.name || user.login || user.email;
  };

  const getRoleBadge = (role) => {
    if (role === 'SUPERADMIN') {
      return (
        <span className={`${styles.badge} ${styles.badgeSuccess}`}>
          <Shield size={14} />
          Суперадминистратор
        </span>
      );
    } else if (role === 'ADMIN') {
      return (
        <span className={`${styles.badge} ${styles.badgeSuccess}`}>
          <Shield size={14} />
          Администратор
        </span>
      );
    } else {
      return (
        <span className={`${styles.badge} ${styles.badgeDefault}`}>
          <User size={14} />
          Пользователь
        </span>
      );
    }
  };

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Пользователи</h1>
        <div className={styles.pageHeaderActions}>
          <div className={styles.searchWrap}>
            <input
              type="text"
              placeholder="Поиск пользователей..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
              aria-label="Поиск пользователей"
            />
            <Search size={18} className={styles.searchIcon} aria-hidden />
          </div>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <div className={styles.tableContainer}>
          {isLoading ? (
            <div className={styles.emptyState}>
              <div className={styles.spinner}></div>
              <p>Загрузка...</p>
            </div>
          ) : users.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.icon}><User size={48} /></div>
              <h3>Пользователи не найдены</h3>
              <p>{searchQuery ? 'Попробуйте изменить параметры поиска' : 'Пользователей пока нет'}</p>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th 
                    className={`${styles.sortableHeader}`}
                    onClick={() => handleSort('email')}
                  >
                    <span className={styles.sortHeaderInner}>
                      <span>Email</span>
                      {sortBy === 'email' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} className={styles.sortIconInactive} />
                      )}
                    </span>
                  </th>
                  <th 
                    className={`${styles.sortableHeader}`}
                    onClick={() => handleSort('login')}
                  >
                    <span className={styles.sortHeaderInner}>
                      <span>Логин</span>
                      {sortBy === 'login' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} className={styles.sortIconInactive} />
                      )}
                    </span>
                  </th>
                  <th 
                    className={`${styles.sortableHeader}`}
                    onClick={() => handleSort('name')}
                  >
                    <span className={styles.sortHeaderInner}>
                      <span>Имя</span>
                      {sortBy === 'name' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} className={styles.sortIconInactive} />
                      )}
                    </span>
                  </th>
                  <th 
                    className={`${styles.sortableHeader}`}
                    onClick={() => handleSort('role')}
                  >
                    <span className={styles.sortHeaderInner}>
                      <span>Роль</span>
                      {sortBy === 'role' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} className={styles.sortIconInactive} />
                      )}
                    </span>
                  </th>
                  <th 
                    className={`${styles.sortableHeader}`}
                    onClick={() => handleSort('createdAt')}
                  >
                    <span className={styles.sortHeaderInner}>
                      <span>Дата регистрации</span>
                      {sortBy === 'createdAt' ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} className={styles.sortIconInactive} />
                      )}
                    </span>
                  </th>
                  <th>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Действия</span>
                      {sortBy && (
                        <button
                          onClick={handleResetSort}
                          className={styles.resetSortIconBtn}
                          title="Сбросить сортировку"
                          aria-label="Сбросить сортировку"
                        >
                          <RotateCcw size={14} className={styles.sortIconInactive} />
                        </button>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} style={{ opacity: user.isBanned ? 0.6 : 1 }}>
                    <td>
                      {user.email}
                      {user.isBanned && (
                        <span style={{ marginLeft: '8px', color: '#ef4444', fontSize: '12px' }}>(заблокирован)</span>
                      )}
                    </td>
                    <td>{user.login}</td>
                    <td>{getUserDisplayName(user)}</td>
                    <td>{getRoleBadge(user.role)}</td>
                    <td>{formatDate(user.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', position: 'relative' }}>
                        {/* Кнопки бана/разблокировки - для ADMIN и SUPERADMIN */}
                        {user.role === 'USER' && (
                          <>
                            {user.isBanned ? (
                              <button
                                onClick={() => handleUnbanUser(user)}
                                disabled={banningUserId === user.id}
                                className={styles.iconButton}
                                title="Разблокировать пользователя"
                              >
                                {banningUserId === user.id ? (
                                  <div className={styles.spinnerSmall}></div>
                                ) : (
                                  <CheckCircle size={16} />
                                )}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleBanUser(user)}
                                disabled={banningUserId === user.id}
                                className={`${styles.iconButton} ${styles.iconButtonWarning}`}
                                title="Заблокировать пользователя"
                              >
                                {banningUserId === user.id ? (
                                  <div className={styles.spinnerSmall}></div>
                                ) : (
                                  <Ban size={16} />
                                )}
                              </button>
                            )}
                          </>
                        )}
                        {/* Кнопка изменения роли - только для SUPERADMIN */}
                        {currentUserRole === 'SUPERADMIN' && (
                          <div ref={roleMenuRef} style={{ position: 'relative' }}>
                            <button
                              onClick={() => handleRoleChangeClick(user)}
                              disabled={updatingRoleId === user.id}
                              className={`${styles.iconButton} ${styles.iconButtonSuccess}`}
                              title="Изменить роль пользователя"
                            >
                              {updatingRoleId === user.id ? (
                                <div className={styles.spinnerSmall}></div>
                              ) : (
                                <Shield size={16} />
                              )}
                            </button>
                            {roleMenuOpen === user.id && (
                              <div 
                                className={styles.dropdownMenu}
                                onMouseDown={(e) => {
                                  // Предотвращаем закрытие меню при клике внутри него
                                  e.stopPropagation();
                                }}
                                onClick={(e) => {
                                  // Предотвращаем всплытие клика из меню
                                  e.stopPropagation();
                                }}
                              >
                                <button
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                  }}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleRoleSelect(user, 'USER');
                                  }}
                                  className={`${styles.dropdownItem} ${user.role === 'USER' ? styles.dropdownItemActive : ''}`}
                                  disabled={user.role === 'USER'}
                                >
                                  <User size={14} />
                                  <span>Пользователь</span>
                                  {user.role === 'USER' && <span className={styles.checkmark}>✓</span>}
                                </button>
                                <button
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                  }}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleRoleSelect(user, 'ADMIN');
                                  }}
                                  className={`${styles.dropdownItem} ${user.role === 'ADMIN' ? styles.dropdownItemActive : ''}`}
                                  disabled={user.role === 'ADMIN'}
                                >
                                  <Shield size={14} />
                                  <span>Администратор</span>
                                  {user.role === 'ADMIN' && <span className={styles.checkmark}>✓</span>}
                                </button>
                                <button
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                  }}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleRoleSelect(user, 'SUPERADMIN');
                                  }}
                                  className={`${styles.dropdownItem} ${user.role === 'SUPERADMIN' ? styles.dropdownItemActive : ''}`}
                                  disabled={user.role === 'SUPERADMIN'}
                                >
                                  <Shield size={14} />
                                  <span>Суперадминистратор</span>
                                  {user.role === 'SUPERADMIN' && <span className={styles.checkmark}>✓</span>}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {(pagination.pages > 1 || pagination.total > 0) && (
        <div className={styles.paginationFooter}>
          {renderPagination()}
        </div>
      )}

      <ConfirmModal
        open={!!confirmModal}
        title={confirmModal?.title || ''}
        message={confirmModal?.message || ''}
        confirmLabel={confirmModal?.confirmLabel || 'Подтвердить'}
        cancelLabel={confirmModal?.cancelLabel || 'Отмена'}
        variant={confirmModal?.variant || 'default'}
        onConfirm={confirmModal?.onConfirm || (() => {})}
        onCancel={confirmModal?.onCancel || (() => {})}
      />

      <AlertModal
        open={alertModal.open}
        title={alertModal.title}
        message={alertModal.message}
        onClose={() => setAlertModal({ open: false, title: '', message: '' })}
      />
    </div>
  );
}
