'use client';

import { AlertTriangle } from 'lucide-react';
import styles from './Modal.module.css';

export default function ConfirmModal({
  open,
  title = 'Подтверждение',
  message,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  variant = 'default', // 'default' | 'danger'
  onConfirm,
  onCancel,
  dialogStyle,
}) {
  if (!open) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onCancel?.();
  };

  return (
    <div className={styles.overlay} onClick={handleOverlayClick} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className={styles.dialog} style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={`${styles.iconWrap} ${variant === 'danger' ? styles.iconWrapDanger : styles.iconWrapInfo}`}>
            <AlertTriangle size={24} />
          </div>
          <h2 id="confirm-title" className={styles.title}>{title}</h2>
        </div>
        <div className={styles.body}>
          {message && <p className={styles.message}>{message}</p>}
          <div className={styles.actions}>
            <button type="button" className={`${styles.btn} ${styles.btnCancel}`} onClick={onCancel}>
              {cancelLabel}
            </button>
            <button
              type="button"
              className={`${styles.btn} ${variant === 'danger' ? styles.btnDanger : styles.btnConfirm}`}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
