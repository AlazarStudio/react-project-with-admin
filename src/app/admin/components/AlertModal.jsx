'use client';

import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import styles from './Modal.module.css';

export default function AlertModal({
  open,
  title = 'Внимание',
  message,
  buttonLabel = 'OK',
  variant = 'error', // 'error' | 'info' | 'success'
  onClose,
}) {
  if (!open) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  // Выбираем иконку в зависимости от варианта
  const getIcon = () => {
    switch (variant) {
      case 'success':
        return <CheckCircle2 size={24} />;
      case 'info':
        return <Info size={24} />;
      case 'error':
      default:
        return <AlertCircle size={24} />;
    }
  };

  // Выбираем класс для обертки иконки
  const getIconWrapClass = () => {
    switch (variant) {
      case 'success':
        return styles.iconWrapSuccess;
      case 'info':
        return styles.iconWrapInfo;
      case 'error':
      default:
        return styles.iconWrapError;
    }
  };

  return (
    <div className={styles.overlay} onClick={handleOverlayClick} role="alertdialog" aria-modal="true" aria-labelledby="alert-title">
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()} style={variant === 'success' ? { maxWidth: '600px' } : {}}>
        <div className={styles.header}>
          <div className={`${styles.iconWrap} ${getIconWrapClass()}`}>
            {getIcon()}
          </div>
          <h2 id="alert-title" className={styles.title}>{title}</h2>
        </div>
        <div className={styles.body}>
          {message && (
            <div className={styles.message}>
              {message.split('\n').map((line, index) => {
                // Если строка начинается с эмодзи или маркера, делаем её жирной
                if (line.match(/^[📋📊🔗•]/) || line.trim().startsWith('•')) {
                  return <div key={index} style={{ fontWeight: 600, marginTop: index > 0 ? 8 : 0, color: '#1e293b' }}>{line}</div>;
                }
                // Если строка начинается с пробелов (вложенный список), делаем отступ
                if (line.startsWith('  ')) {
                  return <div key={index} style={{ marginLeft: 16, fontSize: '0.9rem', color: '#64748b' }}>{line.trim()}</div>;
                }
                return <div key={index} style={{ marginTop: index > 0 ? 4 : 0 }}>{line}</div>;
              })}
            </div>
          )}
          <div className={`${styles.actions} ${styles.actionsSingle}`}>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onClose}>
              {buttonLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
