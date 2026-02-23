'use client';

import { X, Star, Map, MapPin, Building2, Calendar, User } from 'lucide-react';
import styles from './Modal.module.css';

export default function ReviewDetailModal({ open, review, onClose }) {
  if (!open || !review) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  const getEntityIcon = (type) => {
    switch (type) {
      case 'route': return <Map size={20} />;
      case 'place': return <MapPin size={20} />;
      case 'service': return <Building2 size={20} />;
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

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <span className={`${styles.badge} ${styles.badgeActive}`}>Одобрен</span>;
      case 'rejected':
        return <span className={`${styles.badge} ${styles.badgeRejected}`}>Отклонён</span>;
      default:
        return <span className={`${styles.badge} ${styles.badgePending}`}>На модерации</span>;
    }
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star 
        key={i} 
        size={18} 
        fill={i < rating ? '#f59e0b' : 'none'} 
        color={i < rating ? '#f59e0b' : '#d1d5db'} 
      />
    ));
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={styles.overlay} onClick={handleOverlayClick} role="dialog" aria-modal="true">
      <div className={styles.dialog} style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <h2 className={styles.title} style={{ margin: 0 }}>Детали отзыва</h2>
            <button
              type="button"
              onClick={onClose}
              className={styles.closeBtn}
              aria-label="Закрыть"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <div className={styles.body}>
          <div className={styles.reviewDetail}>
            {/* Автор */}
            <div className={styles.reviewDetailSection}>
              <div className={styles.reviewDetailLabel}>
                <User size={16} style={{ marginRight: '8px' }} />
                Автор
              </div>
              <div className={styles.reviewDetailValue}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img
                    src={review.authorAvatar || '/no-avatar.png'}
                    alt={review.authorName}
                    style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div>
                    <div style={{ fontWeight: 500, marginBottom: '4px' }}>{review.authorName}</div>
                    {review.authorEmail && (
                      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{review.authorEmail}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Объект */}
            <div className={styles.reviewDetailSection}>
              <div className={styles.reviewDetailLabel}>
                {getEntityIcon(review.entityType)}
                <span style={{ marginLeft: '8px' }}>Объект</span>
              </div>
              <div className={styles.reviewDetailValue}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  {getEntityIcon(review.entityType)}
                  <span style={{ fontWeight: 500 }}>{getEntityLabel(review.entityType)}</span>
                </div>
                <div style={{ fontSize: '0.95rem', color: '#475569' }}>{review.entityTitle || '—'}</div>
              </div>
            </div>

            {/* Рейтинг */}
            <div className={styles.reviewDetailSection}>
              <div className={styles.reviewDetailLabel}>
                <Star size={16} style={{ marginRight: '8px' }} />
                Рейтинг
              </div>
              <div className={styles.reviewDetailValue}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {renderStars(review.rating)}
                  <span style={{ marginLeft: '8px', fontWeight: 500 }}>{review.rating} из 5</span>
                </div>
              </div>
            </div>

            {/* Текст отзыва */}
            <div className={styles.reviewDetailSection}>
              <div className={styles.reviewDetailLabel}>Текст отзыва</div>
              <div className={styles.reviewDetailValue}>
                <div className={styles.reviewText}>{review.text || '—'}</div>
              </div>
            </div>

            {/* Дата и статус */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className={styles.reviewDetailSection}>
                <div className={styles.reviewDetailLabel}>
                  <Calendar size={16} style={{ marginRight: '8px' }} />
                  Дата
                </div>
                <div className={styles.reviewDetailValue}>
                  {formatDate(review.createdAt)}
                </div>
              </div>
              <div className={styles.reviewDetailSection}>
                <div className={styles.reviewDetailLabel}>Статус</div>
                <div className={styles.reviewDetailValue}>
                  {getStatusBadge(review.status)}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.actions} style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #f1f5f9' }}>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onClose}>
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
