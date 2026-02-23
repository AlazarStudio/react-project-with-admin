'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2, Map, Eye, EyeOff, Filter, ChevronLeft, ChevronRight, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown, RotateCcw, BarChart3 } from 'lucide-react';
import { routesAPI, getImageUrl } from '@/lib/api';
import { ConfirmModal, AlertModal, RouteFiltersModal } from '../components';
import styles from '../admin.module.css';

export default function RoutesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [routes, setRoutes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmModal, setConfirmModal] = useState(null);
  const [alertModal, setAlertModal] = useState({ open: false, title: '', message: '' });
  const [togglingId, setTogglingId] = useState(null);
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);
  const searchDebounceRef = useRef(null);

  // Загружаем сохраненный limit из localStorage или используем значение по умолчанию
  const [limit, setLimit] = useState(() => {
    const saved = localStorage.getItem('admin_routes_limit');
    return saved ? parseInt(saved, 10) : 10;
  });

  const MIN_LOADING_MS = 500;
  const lastFetchedPageRef = useRef(null);
  const lastFetchedSortRef = useRef({ sortBy: null, sortOrder: 'asc' });
  
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
      newSortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
      newSortBy = field;
    } else {
      newSortBy = field;
      newSortOrder = 'asc';
    }
    
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    
    newParams.set('sortBy', newSortBy);
    newParams.set('sortOrder', newSortOrder);
    newParams.delete('page');
    setSearchParams(newParams, { replace: true });
  };

  const handleResetSort = () => {
    setSortBy(null);
    setSortOrder('asc');
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('sortBy');
    newParams.delete('sortOrder');
    newParams.delete('page');
    setSearchParams(newParams, { replace: true });
  };

  const fetchRoutes = async (page, updateUrl = true) => {
    const start = Date.now();
    setIsLoading(true);
    try {
      const params = { page, limit, search: searchQuery };
      if (sortBy) {
        params.sortBy = sortBy;
        params.sortOrder = sortOrder;
      }
      const response = await routesAPI.getAll(params);
      setRoutes(response.data.items);
      setPagination(response.data.pagination);
      lastFetchedPageRef.current = page;
      
      // Обновляем URL с текущей страницей только если нужно
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
      console.error('Ошибка загрузки маршрутов:', error);
      setRoutes([]);
    } finally {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, MIN_LOADING_MS - elapsed);
      setTimeout(() => setIsLoading(false), remaining);
    }
  };

  const handleLimitChange = (newLimit) => {
    setLimit(newLimit);
    localStorage.setItem('admin_routes_limit', newLimit.toString());
    // Сбрасываем на первую страницу при изменении limit
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('page');
    setSearchParams(newParams, { replace: true });
    fetchRoutes(1, true);
  };

  const handlePageChange = (newPage) => {
    fetchRoutes(newPage, true);
  };

  // Синхронизируем состояние сортировки с URL параметрами при их изменении
  useEffect(() => {
    const urlSortBy = searchParams.get('sortBy');
    const urlSortOrder = searchParams.get('sortOrder');
    
    if (urlSortBy !== sortBy) {
      setSortBy(urlSortBy || null);
    }
    if (urlSortOrder && urlSortOrder !== sortOrder && (urlSortOrder === 'asc' || urlSortOrder === 'desc')) {
      setSortOrder(urlSortOrder);
    }
    if (!urlSortBy && sortBy !== null) {
      setSortBy(null);
      setSortOrder('asc');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Загружаем данные при изменении страницы в URL, сортировки или при первой загрузке
  useEffect(() => {
    let urlPage = parseInt(searchParams.get('page') || '1', 10);
    const lastFetchedPage = lastFetchedPageRef.current;
    
    // При первой загрузке проверяем, есть ли сохраненная страница для возврата
    if (lastFetchedPage === null) {
      const savedReturnPage = localStorage.getItem('admin_routes_return_page');
      if (savedReturnPage) {
        const savedPage = parseInt(savedReturnPage, 10);
        if (savedPage > 0 && savedPage !== urlPage) {
          // Восстанавливаем сохраненную страницу
          urlPage = savedPage;
          const newParams = new URLSearchParams(searchParams);
          if (savedPage === 1) {
            newParams.delete('page');
          } else {
            newParams.set('page', savedPage.toString());
          }
          setSearchParams(newParams, { replace: true });
          // Удаляем сохраненную страницу после использования
          localStorage.removeItem('admin_routes_return_page');
        }
      }
    }
    
    // Загружаем данные если:
    // 1. Это первая загрузка (lastFetchedPage === null)
    // 2. Страница в URL отличается от последней загруженной
    // 3. Изменилась сортировка
    const sortChanged = sortBy !== lastFetchedSortRef.current.sortBy || sortOrder !== lastFetchedSortRef.current.sortOrder;
    const shouldFetch = lastFetchedPage === null || urlPage !== lastFetchedPage || sortChanged;
    if (shouldFetch) {
      lastFetchedSortRef.current = { sortBy, sortOrder };
      fetchRoutes(urlPage, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, sortBy, sortOrder]);

  useEffect(() => {
    if (lastFetchedPageRef.current === null) return;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      // При изменении поиска или limit сбрасываем на первую страницу
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('page');
      setSearchParams(newParams, { replace: true });
      fetchRoutes(1, true);
    }, 400);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, limit]);

  const handleDeleteClick = (id) => {
    setConfirmModal({
      title: 'Удалить маршрут?',
      message: 'Вы уверены, что хотите удалить этот маршрут? Действие нельзя отменить.',
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await routesAPI.delete(id);
          setConfirmModal(null);
          handlePageChange(pagination.page);
        } catch (error) {
          console.error('Ошибка удаления:', error);
          setConfirmModal(null);
          setAlertModal({ open: true, title: 'Ошибка', message: 'Ошибка удаления маршрута' });
        }
      },
      onCancel: () => setConfirmModal(null),
    });
  };

  const handleTogglePublish = async (route) => {
    const nextActive = !route.isActive;
    setTogglingId(route.id);
    try {
      await routesAPI.update(route.id, { isActive: nextActive });
      setRoutes((prev) =>
        prev.map((r) => (r.id === route.id ? { ...r, isActive: nextActive } : r))
      );
    } catch (error) {
      console.error('Ошибка изменения видимости:', error);
      setAlertModal({
        open: true,
        title: 'Ошибка',
        message: 'Не удалось изменить видимость',
      });
    } finally {
      setTogglingId(null);
    }
  };

  const renderPagination = () => (
    <>
      <div className={styles.paginationLimit}>
        <label htmlFor="limit-select">Показывать:</label>
        <select id="limit-select" value={limit} onChange={(e) => handleLimitChange(parseInt(e.target.value, 10))} className={styles.limitSelect}>
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>
      {pagination.pages > 1 && (
        <div className={styles.pagination}>
          <button onClick={() => handlePageChange(pagination.page - 1)} disabled={pagination.page === 1} className={styles.pageBtn} aria-label="Предыдущая страница"><ChevronLeft size={18} /></button>
          {(() => {
            const pages = [];
            const totalPages = pagination.pages;
            const current = pagination.page;
            if (current > 3) { pages.push(<button key={1} onClick={() => handlePageChange(1)} className={styles.pageBtn}>1</button>); if (current > 4) pages.push(<span key="ellipsis1" className={styles.ellipsis}>...</span>); }
            const start = Math.max(1, current - 2), end = Math.min(totalPages, current + 2);
            for (let i = start; i <= end; i++) pages.push(<button key={i} onClick={() => handlePageChange(i)} className={`${styles.pageBtn} ${current === i ? styles.active : ''}`}>{i}</button>);
            if (current < totalPages - 2) { if (current < totalPages - 3) pages.push(<span key="ellipsis2" className={styles.ellipsis}>...</span>); pages.push(<button key={totalPages} onClick={() => handlePageChange(totalPages)} className={styles.pageBtn}>{totalPages}</button>); }
            return pages;
          })()}
          <button onClick={() => handlePageChange(pagination.page + 1)} disabled={pagination.page === pagination.pages} className={styles.pageBtn} aria-label="Следующая страница"><ChevronRight size={18} /></button>
        </div>
      )}
    </>
  );

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Маршруты</h1>
        <div className={styles.pageHeaderActions}>
          <div className={styles.searchWrap}>
            <input type="text" placeholder="Поиск маршрутов..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={styles.searchInput} aria-label="Поиск маршрутов" />
            <Search size={18} className={styles.searchIcon} aria-hidden />
          </div>
          <button type="button" onClick={() => setFiltersModalOpen(true)} className={styles.filtersBtn} title="Управление фильтрами">
            <Filter size={18} /> Фильтры
          </button>
          <Link to="/admin/routes/new" className={styles.addBtn}><Plus size={18} /> Добавить маршрут</Link>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <div className={styles.tableContainer}>
        {isLoading ? (
          <div className={styles.emptyState}>
            <div className={styles.spinner}></div>
            <p>Загрузка...</p>
          </div>
        ) : routes.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.icon}><Map size={48} /></div>
            <h3>Маршруты не найдены</h3>
            <p>Создайте первый маршрут</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Изображение</th>
                <th className={`${styles.titleCell} ${styles.sortableHeader}`} onClick={() => handleSort('title')}>
                  <span className={styles.sortHeaderInner}>
                    <span>Название</span>
                    {sortBy === 'title' ? (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} className={styles.sortIconInactive} />}
                  </span>
                </th>
                <th className={styles.sortableHeader} onClick={() => handleSort('seasons')}>
                  <span className={styles.sortHeaderInner}>
                    <span>Сезон</span>
                    {sortBy === 'seasons' ? (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} className={styles.sortIconInactive} />}
                  </span>
                </th>
                <th className={styles.sortableHeader} onClick={() => handleSort('difficulty')}>
                  <span className={styles.sortHeaderInner}>
                    <span>Сложность</span>
                    {sortBy === 'difficulty' ? (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} className={styles.sortIconInactive} />}
                  </span>
                </th>
                <th className={styles.sortableHeader} onClick={() => handleSort('distance')}>
                  <span className={styles.sortHeaderInner}>
                    <span>Расстояние</span>
                    {sortBy === 'distance' ? (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} className={styles.sortIconInactive} />}
                  </span>
                </th>
                <th className={styles.sortableHeader} onClick={() => handleSort('uniqueViewsCount')}>
                  <span className={styles.sortHeaderInner}>
                    <span>Просмотры</span>
                    {sortBy === 'uniqueViewsCount' ? (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} className={styles.sortIconInactive} />}
                  </span>
                </th>
                <th className={styles.sortableHeader} onClick={() => handleSort('isActive')}>
                  <span className={styles.sortHeaderInner}>
                    <span>Видимость</span>
                    {sortBy === 'isActive' ? (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} className={styles.sortIconInactive} />}
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
              {routes.map((route) => (
                <tr key={route.id}>
                  <td className={styles.tableCell}>
                    <div className={styles.cellInner}>
                      <img
                        src={getImageUrl(route.images?.[0])}
                        alt={route.title}
                        className={styles.tableImage}
                      />
                    </div>
                  </td>
                  <td className={`${styles.tableCell} ${styles.titleCell}`}>
                    <div className={styles.cellInner}>{route.title}</div>
                  </td>
                  {/* Сезон, сложность, расстояние — из полей маршрута; сезон: все из customFilters.seasons, иначе route.season */}
                  <td className={styles.tableCell}>
                    <div className={styles.cellInner}>
                      {Array.isArray(route.customFilters?.seasons) && route.customFilters.seasons.length > 0
                        ? route.customFilters.seasons.join(', ')
                        : (route.season ?? '—')}
                    </div>
                  </td>
                  <td className={styles.tableCell}>
                    <div className={styles.cellInner}>
                      {route.difficulty != null ? `${route.difficulty}` : '—'}
                    </div>
                  </td>
                  <td className={styles.tableCell}>
                    <div className={styles.cellInner}>
                      {route.distance != null && route.distance !== '' ? `${route.distance} км` : '—'}
                    </div>
                  </td>
                  <td className={styles.tableCell}>
                    <div className={styles.cellInner}>
                      <BarChart3 size={14} style={{ marginRight: '4px', opacity: 0.7 }} />
                      <span>{route.uniqueViewsCount ?? 0}</span>
                    </div>
                  </td>
                  <td className={styles.tableCell}>
                    <div className={styles.cellInner}>
                      <span className={`${styles.badge} ${styles[route.isActive ? 'active' : 'inactive']}`}>
                        {route.isActive ? 'Включено' : 'Скрыто'}
                      </span>
                    </div>
                  </td>
                  <td className={`${styles.tableCell} ${styles.actionsCell}`}>
                    <div className={styles.cellInner}>
                      <div className={styles.actions}>
                        <button
                          type="button"
                          onClick={() => handleTogglePublish(route)}
                          disabled={togglingId === route.id}
                          className={route.isActive ? styles.deleteBtn : styles.viewBtn}
                          title={route.isActive ? 'Скрыть' : 'Показать'}
                          aria-label={route.isActive ? 'Скрыть' : 'Показать'}
                        >
                          {route.isActive ? (
                            <EyeOff size={16} />
                          ) : (
                            <Eye size={16} />
                          )}
                        </button>
                        <Link 
                          to={`/admin/routes/${route.id}`}
                          onClick={() => {
                            // Сохраняем текущую страницу перед переходом на редактирование
                            const currentPage = pagination.page || 1;
                            localStorage.setItem('admin_routes_return_page', currentPage.toString());
                          }}
                          className={styles.editBtn} 
                          title="Редактировать"
                        >
                          <Pencil size={16} />
                        </Link>
                        {route.isActive ? (
                          <a
                            href={`/routes/${route.slug || route.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.viewBtn}
                            title="Просмотреть на сайте"
                          >
                            <ExternalLink size={16} />
                          </a>
                        ) : (
                          <span
                            className={`${styles.viewBtn} ${styles.viewBtnDisabled}`}
                            title="Включите видимость, чтобы просмотреть на сайте"
                          >
                            <ExternalLink size={16} />
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(route.id)}
                          className={styles.deleteBtn}
                          title="Удалить"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
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
        title={confirmModal?.title}
        message={confirmModal?.message}
        confirmLabel={confirmModal?.confirmLabel}
        cancelLabel={confirmModal?.cancelLabel}
        variant={confirmModal?.variant}
        onConfirm={confirmModal?.onConfirm}
        onCancel={confirmModal?.onCancel}
      />
      <AlertModal
        open={alertModal.open}
        title={alertModal.title}
        message={alertModal.message}
        onClose={() => setAlertModal({ open: false, title: '', message: '' })}
      />
      <RouteFiltersModal open={filtersModalOpen} onClose={() => setFiltersModalOpen(false)} />
    </div>
  );
}
