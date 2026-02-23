'use client';

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import styles from './Modal.module.css';

// Добавляем стиль для анимации спиннера
const spinStyle = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = spinStyle;
  document.head.appendChild(styleSheet);
}

export default function ProgressModal({
  open,
  title = 'Генерация ресурса',
  steps = [],
  currentStep = 0,
  error = null,
  onClose,
}) {
  if (!open) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !error) {
      // Не закрываем, если есть ошибка или процесс не завершен
      return;
    }
    onClose?.();
  };

  const allStepsCompleted = currentStep >= steps.length && !error;
  const hasError = error !== null;

  return (
    <div
      className={styles.overlay}
      style={{ zIndex: 12000 }}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="progress-title"
    >
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className={styles.header}>
          <h2 id="progress-title" className={styles.title}>{title}</h2>
        </div>
        <div className={styles.body}>
          <div style={{ marginBottom: '24px' }}>
            {steps.map((step, index) => {
              const isActive = index === currentStep && !allStepsCompleted && !hasError;
              const isCompleted = index < currentStep || allStepsCompleted;
              const isError = hasError && index === currentStep;

              return (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '16px',
                    opacity: isCompleted ? 1 : isActive ? 1 : 0.5,
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '12px',
                      backgroundColor: isError
                        ? '#fee2e2'
                        : isCompleted
                        ? '#dcfce7'
                        : isActive
                        ? '#dbeafe'
                        : '#f1f5f9',
                      color: isError
                        ? '#dc2626'
                        : isCompleted
                        ? '#16a34a'
                        : isActive
                        ? '#2563eb'
                        : '#64748b',
                      flexShrink: 0,
                    }}
                  >
                    {isError ? (
                      <XCircle size={20} />
                    ) : isCompleted ? (
                      <CheckCircle2 size={20} />
                    ) : isActive ? (
                      <Loader2 
                        size={20} 
                        style={{ 
                          animation: 'spin 1s linear infinite',
                        }} 
                      />
                    ) : (
                      <span style={{ fontSize: '14px', fontWeight: 600 }}>{index + 1}</span>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontWeight: isActive || isCompleted ? 600 : 400,
                        color: isError ? '#dc2626' : '#1e293b',
                        marginBottom: '4px',
                      }}
                    >
                      {step.label}
                    </div>
                    {step.description && (
                      <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{step.description}</div>
                    )}
                    {/* Прогресс-бар для текущего шага */}
                    {isActive && step.progress !== undefined && (
                      <div
                        style={{
                          marginTop: '8px',
                          width: '100%',
                          height: '4px',
                          backgroundColor: '#e2e8f0',
                          borderRadius: '2px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${step.progress}%`,
                            height: '100%',
                            backgroundColor: '#2563eb',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {error && (
            <div
              style={{
                padding: '12px',
                backgroundColor: '#fee2e2',
                borderRadius: '8px',
                color: '#dc2626',
                marginBottom: '16px',
              }}
            >
              <strong>Ошибка:</strong> {error}
            </div>
          )}

          {allStepsCompleted && (
            <div
              style={{
                padding: '12px',
                backgroundColor: '#dcfce7',
                borderRadius: '8px',
                color: '#16a34a',
                marginBottom: '16px',
                fontWeight: 600,
              }}
            >
              ✅ Генерация успешно завершена!
            </div>
          )}

          <div className={`${styles.actions} ${styles.actionsSingle}`}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={onClose}
              disabled={!allStepsCompleted && !hasError}
            >
              {hasError ? 'Закрыть' : allStepsCompleted ? 'Готово' : 'Отмена'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
