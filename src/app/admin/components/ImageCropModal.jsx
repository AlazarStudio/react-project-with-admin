'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { X } from 'lucide-react';
import styles from './Modal.module.css';

/**
 * Загружает изображение по URL (в т.ч. object URL).
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Возвращает blob обрезанной области изображения.
 * @param {string} imageSrc - URL изображения
 * @param {{ x: number, y: number, width: number, height: number }} pixelCrop - область в пикселях
 * @returns {Promise<Blob>}
 */
export async function getCroppedImageBlob(imageSrc, pixelCrop) {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2d not available');
  ctx.drawImage(
    img,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/png',
      1.0
    );
  });
}

const CROP_CONTAINER_HEIGHT = 400;

export default function ImageCropModal({
  open,
  imageSrc,
  title = 'Обрезка изображения',
  onComplete,
  onCancel,
  aspect = 330 / 390,
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const croppedAreaPixelsRef = useRef(null);

  // Сбрасываем состояние при открытии/закрытии модалки
  useEffect(() => {
    if (open && imageSrc) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    }
  }, [open, imageSrc]);

  const onCropComplete = useCallback((_croppedArea, croppedAreaPixels) => {
    croppedAreaPixelsRef.current = croppedAreaPixels;
  }, []);

  const handleApply = useCallback(async () => {
    if (!imageSrc || !croppedAreaPixelsRef.current) return;
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixelsRef.current);
      onComplete?.(blob);
    } catch (err) {
      console.error('Ошибка обрезки:', err);
    }
  }, [imageSrc, onComplete]);

  if (!open || !imageSrc) return null;

  return (
    <div
      className={styles.overlay}
      onClick={(e) => e.target === e.currentTarget && onCancel?.()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-modal-title"
    >
      <div
        className={styles.dialog}
        style={{ maxWidth: 560, width: '100%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 id="crop-modal-title" className={styles.title}>{title}</h2>
          <button
            type="button"
            onClick={onCancel}
            className={styles.modalClose}
            aria-label="Закрыть"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
          >
            <X size={20} />
          </button>
        </div>
        <div className={styles.body}>
          <p className={styles.message} style={{ marginBottom: 12 }}>
            Выберите нужную область изображения. Затем нажмите «Применить».
          </p>
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: CROP_CONTAINER_HEIGHT,
              background: '#f1f5f9',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              style={{
                containerStyle: { borderRadius: 8 },
                cropAreaStyle: { border: '2px solid #2563eb' },
              }}
            />
          </div>
          <div style={{ marginTop: 16 }}>
            <label style={{ display: 'block', fontSize: '0.875rem', color: '#64748b', marginBottom: 6 }}>
              Масштаб
            </label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#2563eb' }}
            />
          </div>
          <div className={styles.actions} style={{ marginTop: 20 }}>
            <button type="button" className={`${styles.btn} ${styles.btnCancel}`} onClick={onCancel}>
              Отмена
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnConfirm}`} onClick={handleApply}>
              Применить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
