'use client';

import { Check, Loader2, XCircle } from 'lucide-react';
import styles from './Modal.module.css';

export default function SaveProgressModal({ open, steps = [], totalProgress = 0 }) {
  if (!open) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="save-progress-title">
      <div className={styles.dialog} style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 id="save-progress-title" className={styles.title}>
            {totalProgress >= 100 ? 'Сохранено' : 'Сохранение...'}
          </h2>
        </div>
        <div className={styles.body}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, totalProgress)}%`,
                  backgroundColor: totalProgress >= 100 ? '#22c55e' : '#2563eb',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {steps.map((step, i) => (
              <li
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  padding: '8px 0',
                  fontSize: '0.9rem',
                  color: step.status === 'error' ? '#dc2626' : step.status === 'done' ? '#64748b' : '#1e293b',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {step.status === 'pending' && (
                    <span style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #e2e8f0', flexShrink: 0 }} />
                  )}
                  {step.status === 'active' && (
                    <Loader2 size={20} style={{ flexShrink: 0, animation: 'spin 1s linear infinite' }} />
                  )}
                  {step.status === 'done' && (
                    <Check size={20} style={{ flexShrink: 0, color: '#22c55e' }} />
                  )}
                  {step.status === 'error' && (
                    <XCircle size={20} style={{ flexShrink: 0, color: '#dc2626' }} />
                  )}
                  <span style={{ flex: 1 }}>{step.label}</span>
                  {step.status === 'active' && typeof step.progress === 'number' && (
                    <span style={{ fontWeight: 600, color: '#2563eb' }}>{step.progress}%</span>
                  )}
                </div>
                {step.status === 'active' && (step.subLabel || (typeof step.progress === 'number' && step.progress < 100)) && (
                  <div style={{ paddingLeft: 32, fontSize: '0.8rem', color: '#64748b' }}>
                    {step.subLabel || `Загрузка: ${step.progress}%`}
                  </div>
                )}
                {step.status === 'active' && typeof step.progress === 'number' && step.progress < 100 && (
                  <div style={{ paddingLeft: 32, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${step.progress}%`,
                        backgroundColor: '#2563eb',
                        transition: 'width 0.2s ease',
                      }}
                    />
                  </div>
                )}
                {step.status === 'active' && step.subLabel && (step.progress ?? 0) >= 100 && (
                  <div style={{ paddingLeft: 32, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: '40%',
                        backgroundColor: '#2563eb',
                        borderRadius: 2,
                        animation: 'convertShimmer 2s ease-in-out infinite',
                      }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
          <style>{`
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes convertShimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }
          `}</style>
        </div>
      </div>
    </div>
  );
}
