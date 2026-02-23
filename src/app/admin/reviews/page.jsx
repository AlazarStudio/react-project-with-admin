'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Star, Check, X, Trash2, Map, MapPin, Building2, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, RotateCcw, Eye } from 'lucide-react';
import { reviewsAPI } from '@/lib/api';
import { ConfirmModal, AlertModal, ReviewDetailModal } from '../components';
import styles from '../admin.module.css';

const ENTITY_TABS = [
  { value: 'all', label: 'Все', icon: null },
  { value: 'route', label: 'Маршруты', icon: Map },
  { value: 'place', label: 'Места', icon: MapPin },
  { value: 'service', label: 'Услуги', icon: Building2 },
];

export default function ReviewsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [entityTypeTab, setEntityTypeTab] = useState('all');
  const [filter, setFilter] = useState('all');
  const [confirmModal, setConfirmModal] = useState(null);
  const [alertModal, setAlertModal] = useState({ open: false, title: '', message: '' });
  const [selectedReview, setSelectedReview] = useState(null);

  // Загружаем сохраненный limit из localStorage или используем значение по умолчанию
  const [limit, setLimit] = useState(() => {
    const saved = localStorage.getItem('admin_reviews_limit');
    return saved ? parseInt(saved, 10) : 10;
  });

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

  const fetchReviews = async (page, updateUrl = true) => {
    setIsLoading(true);
    try {
      const params = { page, limit };
      if (filter !== 'all') params.status = filter;
      if (entityTypeTab !== 'all') params.entityType = entityTypeTab;
      if (sortBy) {
        params.sortBy = sortBy;
        params.sortOrder = sortOrder;
      }
      const response = await reviewsAPI.getAll(params);
      setReviews(response.data.items);
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
      console.error('Ошибка загрузки отзывов:', error);
      setReviews([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLimitChange = (newLimit) => {
    setLimit(newLimit);
    localStorage.setItem('admin_reviews_limit', newLimit.toString());
    // Сбрасываем на первую страницу при изменении limit
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('page');
    setSearchParams(newParams, { replace: true });
    fetchReviews(1, true);
  };

  const handlePageChange = (newPage) => {
    fetchReviews(newPage, true);
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
    const urlPage = parseInt(searchParams.get('page') || '1', 10);
    const lastFetchedPage = lastFetchedPageRef.current;
    
    // Загружаем данные если:
    // 1. Это первая загрузка (lastFetchedPage === null)
    // 2. Страница в URL отличается от последней загруженной
    // 3. Изменилась сортировка
    const sortChanged = sortBy !== lastFetchedSortRef.current.sortBy || sortOrder !== lastFetchedSortRef.current.sortOrder;
    const shouldFetch = lastFetchedPage === null || urlPage !== lastFetchedPage || sortChanged;
    if (shouldFetch) {
      lastFetchedSortRef.current = { sortBy, sortOrder };
      fetchReviews(urlPage, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, sortBy, sortOrder]);

  useEffect(() => {
    if (lastFetchedPageRef.current === null) return;
    // При изменении фильтров сбрасываем на первую страницу
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('page');
    setSearchParams(newParams, { replace: true });
    fetchReviews(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, entityTypeTab, limit]);

  const handleApprove = async (id) => {
    try {
      await reviewsAPI.update(id, { status: 'approved' });
      handlePageChange(pagination.page);
    } catch (error) {
      console.error('Ошибка одобрения:', error);
      setAlertModal({ open: true, title: 'Ошибка', message: 'Ошибка одобрения отзыва' });
    }
  };

  const handleRejectClick = (id) => {
    setConfirmModal({
      title: 'Отклонить отзыв?',
      message: 'Вы уверены, что хотите отклонить этот отзыв?',
      confirmLabel: 'Отклонить',
      cancelLabel: 'Отмена',
      variant: 'default',
      onConfirm: async () => {
        try {
          await reviewsAPI.update(id, { status: 'rejected' });
          setConfirmModal(null);
          handlePageChange(pagination.page);
        } catch (error) {
          console.error('Ошибка отклонения:', error);
          setConfirmModal(null);
          setAlertModal({ open: true, title: 'Ошибка', message: 'Ошибка отклонения отзыва' });
        }
      },
      onCancel: () => setConfirmModal(null),
    });
  };

  const handleDeleteClick = (id) => {
    setConfirmModal({
      title: 'Удалить отзыв?',
      message: 'Вы уверены, что хотите удалить этот отзыв? Действие нельзя отменить.',
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await reviewsAPI.delete(id);
          setConfirmModal(null);
          handlePageChange(pagination.page);
        } catch (error) {
          console.error('Ошибка удаления:', error);
          setConfirmModal(null);
          setAlertModal({ open: true, title: 'Ошибка', message: 'Ошибка удаления отзыва' });
        }
      },
      onCancel: () => setConfirmModal(null),
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star 
        key={i} 
        size={14} 
        fill={i < rating ? '#f59e0b' : 'none'} 
        color={i < rating ? '#f59e0b' : '#d1d5db'} 
      />
    ));
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <span className={`${styles.badge} ${styles.active}`}>Одобрен</span>;
      case 'rejected':
        return <span className={`${styles.badge} ${styles.inactive}`}>Отклонён</span>;
      default:
        return <span className={`${styles.badge} ${styles.pending}`}>На модерации</span>;
    }
  };

  const getEntityIcon = (type) => {
    switch (type) {
      case 'route': return <Map size={16} />;
      case 'place': return <MapPin size={16} />;
      case 'service': return <Building2 size={16} />;
      default: return null;
    }
  };

  const getEntityLabel = (type) => {
    switch (type) {
      case 'route': return 'Маршрут';
      case 'place': return 'Место';
      case 'service': return 'Услуга';
      default: return type;
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
        <h1 className={styles.pageTitle}>Модерация отзывов</h1>
        <div className={styles.pageHeaderActions}>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className={styles.formSelect} style={{ maxWidth: '200px' }}>
            <option value="all">Все отзывы</option>
            <option value="pending">На модерации</option>
            <option value="approved">Одобренные</option>
            <option value="rejected">Отклонённые</option>
          </select>
        </div>
      </div>

      <div className={styles.reviewTabs}>
        {ENTITY_TABS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            className={`${styles.reviewTab} ${entityTypeTab === value ? styles.reviewTabActive : ''}`}
            onClick={() => setEntityTypeTab(value)}
          >
            {Icon && <Icon size={18} style={{ marginRight: 6 }} />}
            {label}
          </button>
        ))}
      </div>

      <div className={styles.tableWrapper}>
        <div className={styles.tableContainer}>
        {isLoading ? (
          <div className={styles.emptyState}>
            <div className={styles.spinner}></div>
            <p>Загрузка...</p>
          </div>
        ) : reviews.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.icon}><Star size={48} /></div>
            <h3>Отзывы не найдены</h3>
            <p>Пока нет отзывов для модерации</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.sortableHeader} onClick={() => handleSort('authorName')}>
                  <span className={styles.sortHeaderInner}>
                    <span>Автор</span>
                    {sortBy === 'authorName' ? (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} className={styles.sortIconInactive} />}
                  </span>
                </th>
                <th className={styles.sortableHeader} onClick={() => handleSort('entityTitle')}>
                  <span className={styles.sortHeaderInner}>
                    <span>Объект</span>
                    {sortBy === 'entityTitle' ? (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} className={styles.sortIconInactive} />}
                  </span>
                </th>
                <th className={styles.sortableHeader} onClick={() => handleSort('rating')}>
                  <span className={styles.sortHeaderInner}>
                    <span>Рейтинг</span>
                    {sortBy === 'rating' ? (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} className={styles.sortIconInactive} />}
                  </span>
                </th>
                <th className={styles.sortableHeader} onClick={() => handleSort('createdAt')}>
                  <span className={styles.sortHeaderInner}>
                    <span>Дата</span>
                    {sortBy === 'createdAt' ? (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} className={styles.sortIconInactive} />}
                  </span>
                </th>
                <th className={styles.sortableHeader} onClick={() => handleSort('status')}>
                  <span className={styles.sortHeaderInner}>
                    <span>Статус</span>
                    {sortBy === 'status' ? (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} className={styles.sortIconInactive} />}
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
              {reviews.map((review) => (
                <tr key={review.id}>
                  <td>
                    <div className={styles.cellInner} style={{ gap: '10px' }}>
                      <img
                        src={review.authorAvatar || '/no-avatar.png'}
                        alt={review.authorName}
                        style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                      />
                      <span>{review.authorName}</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.cellInner} style={{ gap: '8px' }}>
                      {getEntityIcon(review.entityType)}
                      <span style={{ fontWeight: 500 }}>{review.entityTitle || '—'}</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.cellInner} style={{ gap: '4px' }}>
                      {renderStars(review.rating)}
                    </div>
                  </td>
                  <td>
                    <div className={styles.cellInner}>
                      {formatDate(review.createdAt)}
                    </div>
                  </td>
                  <td>
                    <div className={styles.cellInner}>
                      {getStatusBadge(review.status)}
                    </div>
                  </td>
                  <td className={`${styles.tableCell} ${styles.actionsCell}`}>
                    <div className={styles.cellInner}>
                      <div className={styles.actions}>
                        <button
                          onClick={() => setSelectedReview(review)}
                          className={styles.viewBtn}
                          title="Просмотреть детали"
                        >
                          <Eye size={16} />
                        </button>
                        {review.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(review.id)}
                              className={styles.viewBtn}
                              title="Одобрить"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={() => handleRejectClick(review.id)}
                              className={styles.editBtn}
                              title="Отклонить"
                            >
                              <X size={16} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDeleteClick(review.id)}
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
      <ReviewDetailModal
        open={!!selectedReview}
        review={selectedReview}
        onClose={() => setSelectedReview(null)}
      />
    </div>
  );
}
