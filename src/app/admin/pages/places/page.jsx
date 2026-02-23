'use client';

import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { Upload, X, Pencil } from 'lucide-react';
import { pagesAPI, mediaAPI, getImageUrl } from '@/lib/api';
import { AdminHeaderRightContext } from '../../layout';
import ImageCropModal from '../../components/ImageCropModal';
import RichTextEditor from '@/components/RichTextEditor';
import styles from '../../admin.module.css';

const DEFAULT_CONTENT = {
  hero: {
    title: 'ИНТЕРЕСНЫЕ МЕСТА',
    description: 'Создайте свой уникальный маршрут!',
    image: '/full_places_bg.jpg',
  },
};

function ensureContent(c) {
  return {
    hero: {
      title: c?.hero?.title ?? DEFAULT_CONTENT.hero.title,
      description: c?.hero?.description ?? DEFAULT_CONTENT.hero.description,
      image: c?.hero?.image ?? DEFAULT_CONTENT.hero.image,
    },
  };
}

export default function AdminPlacesPage() {
  const [content, setContent] = useState(ensureContent(null));
  const [pendingImages, setPendingImages] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [savedVersion, setSavedVersion] = useState(0);
  const savedContentRef = useRef(null);
  const setHeaderRight = useContext(AdminHeaderRightContext)?.setHeaderRight;

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    pagesAPI.get('places')
      .then((res) => {
        if (!cancelled && res.data?.content) {
          const ensured = ensureContent(res.data.content);
          setContent(ensured);
          savedContentRef.current = JSON.parse(JSON.stringify(ensured));
          setSavedVersion((v) => v + 1);
        }
      })
      .catch(() => {
        if (!cancelled) {
          const defaultContent = ensureContent(null);
          setContent(defaultContent);
          savedContentRef.current = JSON.parse(JSON.stringify(defaultContent));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const update = useCallback((path, value) => {
    setContent((prev) => {
      const next = { ...prev };
      const keys = path.split('.');
      let current = next;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return next;
    });
  }, []);

  const handleFileSelect = useCallback((path, e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPendingImages((prev) => {
      const old = prev[path];
      if (old?.preview) {
        URL.revokeObjectURL(old.preview);
      }
      return { ...prev, [path]: { file, preview: URL.createObjectURL(file) } };
    });
  }, []);

  const hasImage = useCallback((path) => {
    if (pendingImages[path]) return true;
    const keys = path.split('.');
    let current = content;
    for (const key of keys) {
      current = current?.[key];
      if (current === undefined) return false;
    }
    return !!current;
  }, [content, pendingImages]);

  const getImageSrc = useCallback((path) => {
    if (pendingImages[path]) return pendingImages[path].preview;
    const keys = path.split('.');
    let current = content;
    for (const key of keys) {
      current = current?.[key];
      if (current === undefined) return '';
    }
    return getImageUrl(current) || '';
  }, [content, pendingImages]);

  const clearImage = useCallback((path) => {
    setPendingImages((prev) => {
      const next = { ...prev };
      if (next[path]?.preview) {
        URL.revokeObjectURL(next[path].preview);
      }
      delete next[path];
      return next;
    });
    update(path, '');
  }, [update]);

  const handleCropComplete = useCallback((path, croppedFile) => {
    const formData = new FormData();
    formData.append('file', croppedFile);
    const imagePath = `hero.image`;
    
    mediaAPI.upload(formData)
      .then((res) => {
        if (res.data?.url) {
          update(imagePath, res.data.url);
        } else if (res.data?.path) {
          update(imagePath, res.data.path);
        }
        setPendingImages((prev) => {
          const next = { ...prev };
          if (next[path]?.preview) {
            URL.revokeObjectURL(next[path].preview);
          }
          delete next[path];
          return next;
        });
      })
      .catch((err) => {
        console.error('Upload error:', err);
        setPendingImages((prev) => {
          const next = { ...prev };
          if (next[path]?.preview) {
            URL.revokeObjectURL(next[path].preview);
          }
          delete next[path];
          return next;
        });
      });
  }, [update]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const contentToSave = { ...content };
      
      for (const [path, { file }] of Object.entries(pendingImages)) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await mediaAPI.upload(formData);
        if (res.data?.url || res.data?.path) {
          const keys = path.split('.');
          let current = contentToSave;
          for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) current[keys[i]] = {};
            current = current[keys[i]];
          }
          current[keys[keys.length - 1]] = res.data.url || res.data.path;
        }
      }

      const res = await pagesAPI.update('places', contentToSave);
      // Очищаем preview URLs
      for (const path of Object.keys(pendingImages)) {
        if (pendingImages[path]?.preview) {
          URL.revokeObjectURL(pendingImages[path].preview);
        }
      }
      setPendingImages({});
      // Обновляем состояние из ответа сервера
      const c = ensureContent(res.data?.content);
      setContent(c);
      savedContentRef.current = JSON.parse(JSON.stringify(c));
      setSavedVersion((v) => v + 1);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err) {
      console.error('Save error:', err);
      alert('Ошибка при сохранении');
    } finally {
      setIsSaving(false);
    }
  }, [content, pendingImages]);

  const hasPendingImages = Object.keys(pendingImages).length > 0;
  const isDirty = savedContentRef.current != null && (JSON.stringify(content) !== JSON.stringify(savedContentRef.current) || hasPendingImages);

  useEffect(() => {
    if (!setHeaderRight) return;
    const label = isSaving ? 'Сохранение...' : isDirty ? 'Сохранить изменения' : 'Сохранено';
    const cls = [styles.headerSubmitBtn, !isDirty && !isSaving && styles.headerSubmitBtnSaved].filter(Boolean).join(' ');
    setHeaderRight(
      <button type="button" className={cls} onClick={handleSave} disabled={isSaving}>
        {label}
      </button>
    );
    return () => setHeaderRight(null);
  }, [setHeaderRight, isDirty, isSaving, handleSave, savedVersion]);

  if (isLoading) {
    return <div className={styles.loading}>Загрузка...</div>;
  }

  return (
    <div className={styles.formContainer}>
      {showToast && (
        <div className={styles.toast}>Изменения сохранены</div>
      )}

      <section className={styles.formSection}>
        <h2 className={styles.sectionTitle}>Верхний блок</h2>
        
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Название</label>
          <input
            type="text"
            className={styles.formInput}
            value={content.hero?.title ?? ''}
            onChange={(e) => update('hero.title', e.target.value)}
            placeholder="ИНТЕРЕСНЫЕ МЕСТА"
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Описание</label>
          <RichTextEditor
            value={content.hero?.description ?? ''}
            onChange={(val) => update('hero.description', val)}
            placeholder="Описание страницы"
            minHeight={200}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Картинка</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleFileSelect('hero.image', e)}
            id="heroImage"
            style={{ display: 'none' }}
          />
          {hasImage('hero.image') ? (
            <div className={`${styles.previewItem} ${styles.previewItemMain}`} style={{ width: 280, aspectRatio: '16/9', position: 'relative', overflow: 'hidden', borderRadius: 8 }}>
              <img src={getImageSrc('hero.image')} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <span className={styles.previewItemBadge}>Hero</span>
              <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', flexDirection: 'row', gap: 6 }}>
                <button type="button" onClick={() => document.getElementById('heroImage')?.click()} className={styles.removeImage} style={{ position: 'relative', top: 0, right: 0 }} aria-label="Изменить" title="Изменить"><Pencil size={14} /></button>
                <button type="button" onClick={() => clearImage('hero.image')} className={styles.removeImage} style={{ position: 'relative', top: 0, right: 0 }} aria-label="Удалить" title="Удалить"><X size={14} /></button>
              </div>
              {pendingImages['hero.image'] && (
                <ImageCropModal
                  src={pendingImages['hero.image'].preview}
                  onCropComplete={(file) => handleCropComplete('hero.image', file)}
                  onClose={() => setPendingImages((prev) => {
                    const next = { ...prev };
                    delete next['hero.image'];
                    return next;
                  })}
                />
              )}
            </div>
          ) : (
            <div className={styles.imageUpload} onClick={() => document.getElementById('heroImage')?.click()} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') document.getElementById('heroImage')?.click(); }}>
              <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                <Upload size={20} /> Загрузить изображение
              </label>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
