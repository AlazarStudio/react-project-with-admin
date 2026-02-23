'use client';

import { useState, useEffect, useCallback, useContext, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Upload, X, Eye, EyeOff, Pencil } from 'lucide-react';
import RichTextEditor from '@/components/RichTextEditor';
import { newsAPI, mediaAPI, getImageUrl } from '@/lib/api';
import ConfirmModal from '../../components/ConfirmModal';
import SaveProgressModal from '../../components/SaveProgressModal';
import NewsBlockEditor from '../../components/NewsBlockEditor';
import { AdminHeaderRightContext, AdminBreadcrumbContext } from '../../layout';
import styles from '../../admin.module.css';

const TOAST_DURATION_MS = 3000;

function getFormSnapshot(data) {
  return {
    type: data.type ?? 'news',
    title: data.title ?? '',
    shortDescription: data.shortDescription ?? '',
    image: data.image ?? '',
    publishedAt: data.publishedAt ?? '',
    isActive: !!data.isActive,
    blocks: JSON.stringify(data.blocks || []),
  };
}

function formSnapshotsEqual(a, b) {
  return JSON.stringify(getFormSnapshot(a)) === JSON.stringify(getFormSnapshot(b));
}

function migrateLegacyData(data) {
  const blocks = Array.isArray(data.blocks) ? data.blocks : [];
  if (blocks.length === 0 && (data.content || data.images?.length)) {
    const migrated = [];
    if (data.content) {
      migrated.push({ id: `b-${Date.now()}-text`, type: 'text', order: 0, data: { content: data.content } });
    }
    if (Array.isArray(data.images) && data.images.length > 0) {
      if (data.images.length === 1) {
        migrated.push({ id: `b-${Date.now()}-img`, type: 'image', order: migrated.length, data: { url: data.images[0] } });
      } else {
        migrated.push({ id: `b-${Date.now()}-gal`, type: 'gallery', order: migrated.length, data: { images: data.images } });
      }
    }
    return migrated.map((b, i) => ({ ...b, order: i }));
  }
  return blocks;
}

const initialFormData = () => ({
  type: 'news',
  title: '',
  shortDescription: '',
  image: '',
  publishedAt: new Date().toISOString().split('T')[0],
  isActive: false,
  blocks: [],
});

export default function NewsEditPage() {
  const navigate = useNavigate();
  const params = useParams();
  const setHeaderRight = useContext(AdminHeaderRightContext)?.setHeaderRight;
  const setBreadcrumbLabel = useContext(AdminBreadcrumbContext)?.setBreadcrumbLabel;
  const isNew = params.id === 'new';

  const [formData, setFormData] = useState(initialFormData());
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ open: false, steps: [], totalProgress: 0 });
  const [pendingImageFile, setPendingImageFile] = useState(null);
  const [pendingBlockFiles, setPendingBlockFiles] = useState({});
  const savedFormDataRef = useRef(null);
  const imageUploadRef = useRef(null);

  const isDirty = useMemo(() => {
    if (isNew) return false;
    if (!savedFormDataRef.current) return false;
    const hasPendingFiles = !!(
      pendingImageFile ||
      Object.keys(pendingBlockFiles).some((k) => pendingBlockFiles[k])
    );
    return !formSnapshotsEqual(formData, savedFormDataRef.current) || hasPendingFiles;
  }, [isNew, formData, pendingImageFile, pendingBlockFiles]);

  const [imageDisplayUrl, setImageDisplayUrl] = useState('');
  useEffect(() => {
    if (pendingImageFile) {
      const u = URL.createObjectURL(pendingImageFile);
      setImageDisplayUrl(u);
      return () => URL.revokeObjectURL(u);
    }
    setImageDisplayUrl(formData.image ? getImageUrl(formData.image) : '');
  }, [pendingImageFile, formData.image]);

  const navigateToList = useCallback(() => {
    // Проверяем, есть ли сохраненная страница для возврата
    const savedReturnPage = localStorage.getItem('admin_news_return_page');
    if (savedReturnPage) {
      const savedPage = parseInt(savedReturnPage, 10);
      if (savedPage > 0) {
        navigate(`/admin/news?page=${savedPage}`);
        localStorage.removeItem('admin_news_return_page');
        return;
      }
    }
    navigate('/admin/news');
  }, [navigate]);

  const goToList = useCallback(() => {
    setLeaveModalOpen(false);
    navigateToList();
  }, [navigateToList]);

  const handleCancelClick = useCallback(() => {
    if (isDirty) {
      setLeaveModalOpen(true);
    } else {
      navigateToList();
    }
  }, [isDirty, navigateToList]);

  const fetchNews = useCallback(async () => {
    if (isNew) return;
    try {
      setError('');
      const response = await newsAPI.getById(params.id);
      const data = response.data;
      const blocks = migrateLegacyData(data);
      const next = {
        type: data.type ?? 'news',
        title: data.title ?? '',
        shortDescription: data.shortDescription ?? '',
        image: data.image ?? data.images?.[0] ?? '',
        publishedAt: data.publishedAt ? new Date(data.publishedAt).toISOString().split('T')[0] : '',
        isActive: Boolean(data.isActive),
        blocks,
      };
      setFormData(next);
      savedFormDataRef.current = next;
      setBreadcrumbLabel?.(data.title || 'Запись');
    } catch (err) {
      console.error('Ошибка загрузки:', err);
      setError('Запись не найдена');
    } finally {
      setIsLoading(false);
    }
  }, [params.id, isNew, setBreadcrumbLabel]);

  useEffect(() => {
    if (isNew) {
      setBreadcrumbLabel?.('Новая запись');
      setIsLoading(false);
    } else {
      fetchNews();
    }
    return () => setBreadcrumbLabel?.(null);
  }, [isNew, fetchNews, setBreadcrumbLabel]);

  useEffect(() => {
    if (!setHeaderRight) return;
    const submitLabel = isSaving
      ? 'Сохранение...'
      : isNew
        ? 'Создать запись'
        : isDirty
          ? 'Сохранить изменения'
          : 'Сохранено';
    const submitClassName = [
      styles.headerSubmitBtn,
      !isNew && !isDirty && !isSaving && styles.headerSubmitBtnSaved,
    ].filter(Boolean).join(' ');
    setHeaderRight(
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <label className={styles.visibilityToggle}>
          <input
            type="checkbox"
            checked={!!formData.isActive}
            onChange={() => setFormData((prev) => ({ ...prev, isActive: !prev.isActive }))}
          />
          <span className={styles.visibilitySwitch} />
          <span className={styles.visibilityLabel}>
            {formData.isActive ? (
              <Eye size={16} style={{ marginRight: 6, flexShrink: 0 }} />
            ) : (
              <EyeOff size={16} style={{ marginRight: 6, flexShrink: 0, opacity: 0.7 }} />
            )}
            Видимость
          </span>
        </label>
        <button
          type="button"
          onClick={handleCancelClick}
          className={styles.headerCancelBtn}
        >
          Назад
        </button>
        <button
          type="submit"
          form="news-form"
          className={submitClassName}
          disabled={isSaving}
        >
          {submitLabel}
        </button>
      </div>
    );
    return () => setHeaderRight(null);
  }, [setHeaderRight, formData.isActive, isSaving, isNew, isDirty, handleCancelClick]);

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleMainImageFileSelect = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPendingImageFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');

    let imageUrl = formData.image;
    const blocksToSend = (formData.blocks || []).map((b) => ({ ...b, data: { ...b.data } }));

    const hasPreview = !!pendingImageFile;
    const hasBlocks = Object.values(pendingBlockFiles).some(
      (p) => p && (p.url || (p.images?.length ?? 0) > 0 || (p.documentFile instanceof Blob))
    );
    const totalWeight = (hasPreview ? 1 : 0) + (hasBlocks ? 1 : 0) + 1;
    const initialSteps = [
      { label: 'Загрузка превью', status: hasPreview ? 'pending' : 'done' },
      { label: 'Загрузка блоков контента', status: hasBlocks ? 'pending' : 'done' },
      { label: 'Сохранение данных', status: 'pending' },
    ];
    if (hasPreview || hasBlocks) {
      const stepsWithActive = initialSteps.map((s, i) => {
        if (i === 0 && hasPreview) return { ...s, status: 'active' };
        if (i === 1 && hasBlocks && !hasPreview) return { ...s, status: 'active' };
        return s;
      });
      setSaveProgress({ open: true, steps: stepsWithActive, totalProgress: 0 });
    }

    try {
      if (pendingImageFile) {
        const fd = new FormData();
        fd.append('file', pendingImageFile);
        const res = await mediaAPI.upload(fd, {
          onUploadProgress: (e) => {
            const percent = e.total ? Math.round((e.loaded / e.total) * 100) : 0;
            setSaveProgress((prev) => {
              const steps = prev.steps.map((s, i) => (i === 0 && s.status === 'active' ? { ...s, progress: percent } : s));
              const completedWeight = steps.filter((s) => s.status === 'done').length;
              const activeStep = steps.find((s) => s.status === 'active');
              const activeProgress = activeStep?.progress ?? 0;
              const totalProgress = Math.round(((completedWeight + activeProgress / 100) / totalWeight) * 100);
              return { ...prev, steps, totalProgress };
            });
          },
        });
        imageUrl = res.data?.url || imageUrl;
        setPendingImageFile(null);
        setSaveProgress((prev) => ({ ...prev, steps: prev.steps.map((s, i) => (i === 0 ? { ...s, status: 'done' } : i === 1 && hasBlocks ? { ...s, status: 'active' } : s)), totalProgress: Math.round((1 / totalWeight) * 100) }));
      }

      const blockEntries = Object.entries(pendingBlockFiles).filter(
        ([, p]) => p && (p.url || (p.images?.length ?? 0) > 0 || (p.documentFile instanceof Blob))
      );
      const totalBlockFiles = blockEntries.reduce(
        (acc, [, p]) => acc + (p.url ? 1 : 0) + (p.images?.length ?? 0) + (p.documentFile ? 1 : 0),
        0
      );
      let blockUploadIdx = 0;

      for (const [blockId, pending] of blockEntries) {
        const block = blocksToSend.find((b) => b.id === blockId);
        if (!block) continue;
        if (pending.url) {
          const fd = new FormData();
          fd.append('file', pending.url);
          const res = await mediaAPI.upload(fd, {
            onUploadProgress: (e) => {
              const pct = e.total ? Math.round((e.loaded / e.total) * 100) : 0;
              const overall = totalBlockFiles ? Math.round(((blockUploadIdx * 100 + pct) / totalBlockFiles)) : 0;
              setSaveProgress((prev) => {
                const steps = prev.steps.map((s, i) => (i === 1 && s.status === 'active' ? { ...s, progress: overall, subLabel: `Файл ${blockUploadIdx + 1} из ${totalBlockFiles}` } : s));
                const completedWeight = steps.filter((s) => s.status === 'done').length;
                const activeStep = steps.find((s) => s.status === 'active');
                const activeProgress = activeStep?.progress ?? 0;
                const totalProgress = Math.round(((completedWeight + activeProgress / 100) / totalWeight) * 100);
                return { ...prev, steps, totalProgress };
              });
            },
          });
          if (res.data?.url) block.data = { ...block.data, url: res.data.url };
          blockUploadIdx++;
        }
        if (pending.documentFile && block.type === 'file') {
          const fd = new FormData();
          fd.append('file', pending.documentFile);
          const res = await mediaAPI.upload(fd, {
            onUploadProgress: (e) => {
              const pct = e.total ? Math.round((e.loaded / e.total) * 100) : 0;
              const overall = totalBlockFiles ? Math.round(((blockUploadIdx * 100 + pct) / totalBlockFiles)) : 0;
              setSaveProgress((prev) => {
                const steps = prev.steps.map((s, i) => (i === 1 && s.status === 'active' ? { ...s, progress: overall, subLabel: `Файл ${blockUploadIdx + 1} из ${totalBlockFiles}` } : s));
                const completedWeight = steps.filter((s) => s.status === 'done').length;
                const activeStep = steps.find((s) => s.status === 'active');
                const activeProgress = activeStep?.progress ?? 0;
                const totalProgress = Math.round(((completedWeight + activeProgress / 100) / totalWeight) * 100);
                return { ...prev, steps, totalProgress };
              });
            },
          });
          if (res.data?.url) {
            block.data = {
              ...block.data,
              url: res.data.url,
              title: block.data?.title || pending.documentFile.name || '',
            };
          }
          blockUploadIdx++;
        }
        if (pending.images?.length) {
          const urls = [];
          for (const file of pending.images) {
            const fd = new FormData();
            fd.append('file', file);
            const res = await mediaAPI.upload(fd, {
              onUploadProgress: (e) => {
                const pct = e.total ? Math.round((e.loaded / e.total) * 100) : 0;
                const overall = totalBlockFiles ? Math.round(((blockUploadIdx * 100 + pct) / totalBlockFiles)) : 0;
                setSaveProgress((prev) => {
                  const steps = prev.steps.map((s, i) => (i === 1 && s.status === 'active' ? { ...s, progress: overall, subLabel: `Файл ${blockUploadIdx + 1} из ${totalBlockFiles}` } : s));
                  const completedWeight = steps.filter((s) => s.status === 'done').length;
                  const activeStep = steps.find((s) => s.status === 'active');
                  const activeProgress = activeStep?.progress ?? 0;
                  const totalProgress = Math.round(((completedWeight + activeProgress / 100) / totalWeight) * 100);
                  return { ...prev, steps, totalProgress };
                });
              },
            });
            if (res.data?.url) urls.push(res.data.url);
            blockUploadIdx++;
          }
          block.data = { ...block.data, images: [...(block.data?.images || []), ...urls] };
        }
      }
      setPendingBlockFiles({});
      if (hasBlocks) setSaveProgress((prev) => ({ ...prev, steps: prev.steps.map((s, i) => (i === 1 ? { ...s, status: 'done' } : s)), totalProgress: Math.round(((hasPreview ? 1 : 0) + 1) / totalWeight * 100) }));

      if (hasPreview || hasBlocks) {
        setSaveProgress((prev) => ({ ...prev, steps: prev.steps.map((s, i) => (i === 2 ? { ...s, status: 'active' } : s)) }));
      }

      const dataToSend = {
        type: formData.type,
        title: formData.title.trim(),
        shortDescription: formData.shortDescription || null,
        image: imageUrl || null,
        publishedAt: formData.publishedAt ? new Date(formData.publishedAt).toISOString() : null,
        isActive: Boolean(formData.isActive),
        blocks: blocksToSend,
        images: [],
      };

      if (isNew) {
        const res = await newsAPI.create(dataToSend);
        const created = res.data;
        if (hasPreview || hasBlocks) {
          setSaveProgress((prev) => ({ ...prev, steps: prev.steps.map((s, i) => (i === 2 ? { ...s, status: 'done' } : s)), totalProgress: 100 }));
          setTimeout(() => {
            setSaveProgress({ open: false, steps: [], totalProgress: 0 });
            if (created?.id) {
              navigate(`/admin/news/${created.id}`, { replace: true });
            } else {
              navigateToList();
            }
          }, 500);
        } else {
          if (created?.id) {
            navigate(`/admin/news/${created.id}`, { replace: true });
          } else {
            navigateToList();
          }
        }
        setShowToast(true);
        setTimeout(() => setShowToast(false), TOAST_DURATION_MS);
      } else {
        await newsAPI.update(params.id, dataToSend);
        const updated = { ...formData, image: imageUrl, blocks: blocksToSend };
        savedFormDataRef.current = updated;
        setFormData(updated);
        if (hasPreview || hasBlocks) {
          setSaveProgress((prev) => ({ ...prev, steps: prev.steps.map((s, i) => (i === 2 ? { ...s, status: 'done' } : s)), totalProgress: 100 }));
          setTimeout(() => setSaveProgress({ open: false, steps: [], totalProgress: 0 }), 500);
        }
        setShowToast(true);
        setTimeout(() => setShowToast(false), TOAST_DURATION_MS);
      }
    } catch (err) {
      console.error('Ошибка сохранения:', err);
      setError(err.response?.data?.message || 'Ошибка сохранения');
      if (hasPreview || hasBlocks) {
        setSaveProgress((prev) => {
          const idx = prev.steps.findIndex((s) => s.status === 'active');
          const newSteps = prev.steps.map((s, i) => (i === idx ? { ...s, status: 'error' } : s));
          return { ...prev, steps: newSteps };
        });
        setTimeout(() => setSaveProgress({ open: false, steps: [], totalProgress: 0 }), 2000);
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.spinner}></div>
        <p>Загрузка...</p>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>
          {isNew ? 'Новая запись' : 'Редактирование новости или статьи'}
        </h1>
      </div>

      <form id="news-form" onSubmit={handleSubmit} className={styles.formContainer}>
        {error && <div className={styles.error}>{error}</div>}

        {/* Тип записи: Новость / Статья (одно и то же, разное название) */}
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Тип записи</label>
          <select
            name="type"
            value={formData.type}
            onChange={handleChange}
            className={styles.formSelect}
            style={{ maxWidth: 200 }}
          >
            <option value="news">Новость</option>
            <option value="article">Статья</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Заголовок *</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            className={styles.formInput}
            required
            placeholder="Введите заголовок"
          />
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Дата публикации</label>
            <input
              type="date"
              name="publishedAt"
              value={formData.publishedAt}
              onChange={handleChange}
              className={styles.formInput}
            />
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Краткое описание (для карточки)</label>
          <RichTextEditor
            value={formData.shortDescription}
            onChange={(v) => setFormData((prev) => ({ ...prev, shortDescription: v }))}
            placeholder="Краткое описание для превью в списке"
            minHeight={150}
          />
        </div>

        {/* Главная картинка (без кропа) */}
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Главная картинка</label>
          <p className={styles.imageHint} style={{ marginBottom: 12 }}>
            Отображается в шапке страницы.
          </p>
          <input
            ref={imageUploadRef}
            type="file"
            accept="image/*"
            onChange={handleMainImageFileSelect}
            style={{ display: 'none' }}
            id="mainImageUpload"
          />
          {(imageDisplayUrl || formData.image) ? (
            <div className={styles.previewItem} style={{ maxWidth: 500, aspectRatio: '16/9', position: 'relative', overflow: 'hidden', borderRadius: 8 }}>
              <img src={imageDisplayUrl || getImageUrl(formData.image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
                <button type="button" onClick={() => imageUploadRef.current?.click()} className={styles.removeImage} title="Заменить">
                  <Pencil size={14} />
                </button>
                <button type="button" onClick={() => { setFormData((prev) => ({ ...prev, image: '' })); setPendingImageFile(null); }} className={styles.removeImage} title="Удалить">
                  <X size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.imageUpload}>
              <label htmlFor="mainImageUpload" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                <Upload size={20} /> Загрузить главную картинку
              </label>
            </div>
          )}
        </div>

        {/* Блоки контента */}
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Блоки контента</label>
          <p className={styles.imageHint} style={{ marginBottom: 12 }}>
            Добавляйте блоки через выпадающий список. Заголовки станут якорями в боковой навигации. Перетаскивайте блоки или используйте стрелки для изменения порядка.
          </p>
          <NewsBlockEditor
            blocks={formData.blocks}
            onChange={(blocks) => setFormData((prev) => ({ ...prev, blocks }))}
            pendingBlockFiles={pendingBlockFiles}
            onPendingBlockFilesChange={(blockId, data) => {
              setPendingBlockFiles((prev) => {
                const next = { ...prev };
                if (data === null) {
                  delete next[blockId];
                } else {
                  next[blockId] = { ...prev[blockId], ...data };
                }
                return next;
              });
            }}
          />
        </div>
      </form>

      <ConfirmModal
        open={leaveModalOpen}
        title="Несохранённые изменения"
        message="Есть несохранённые изменения. Вы уверены, что хотите уйти? Они будут потеряны."
        cancelLabel="Остаться"
        confirmLabel="Уйти без сохранения"
        variant="danger"
        dialogStyle={{ maxWidth: 500 }}
        onCancel={() => setLeaveModalOpen(false)}
        onConfirm={goToList}
      />

      <SaveProgressModal
        open={saveProgress.open}
        steps={saveProgress.steps}
        totalProgress={saveProgress.totalProgress}
      />

      {showToast && (
        <div className={styles.toast} role="status">
          Изменения успешно сохранены
        </div>
      )}
    </div>
  );
}
