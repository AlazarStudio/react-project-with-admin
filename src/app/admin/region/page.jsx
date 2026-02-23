'use client';

import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { Upload, Plus, X, Pencil } from 'lucide-react';
import { regionAPI, mediaAPI, placesAPI, getImageUrl } from '@/lib/api';
import { stripHtml } from '@/lib/utils';
import RichTextEditor from '@/components/RichTextEditor';
import { AdminHeaderRightContext } from '../layout';
import styles from '../admin.module.css';

// Ссылки из хедера сайта для выпадающих списков кнопок
const HEADER_LINKS = [
  { value: '/', label: 'Главная' },
  { value: '/region', label: 'О регионе' },
  { value: '/routes', label: 'Маршруты' },
  { value: '/places', label: 'Места' },
  { value: '/news', label: 'Новости' },
  { value: '/services', label: 'Услуги' },
  { value: '/search', label: 'Поиск' },
];

const DEFAULT_CONTENT = {
  hero: {
    title: 'КАРАЧАЕВО-ЧЕРКЕСИЯ',
    subtitle: 'Край величественных гор, древних традиций и гостеприимных народов',
    image: '/full_roates_bg.jpg',
    buttonText: 'Исследовать маршруты',
    buttonLink: '/routes',
  },
  intro: {
    title: '',
    content: '',
    image: '/slider1.png',
  },
  facts: [],
  history: { intro: '', timeline: [] },
  nature: { title: 'Природа и география', cards: [] },
  culture: { title: 'Народы и культура', intro: '', items: [] },
  places: { title: 'Достопримечательности', items: [], moreButtonText: 'Смотреть все места', moreButtonLink: '/places' },
  cta: {
    title: 'Готовы к путешествию?',
    text: '',
    image: '',
    primaryButtonText: 'Выбрать маршрут',
    primaryButtonLink: '/routes',
    secondaryButtonText: 'Найти гида',
    secondaryButtonLink: '/services',
  },
};

function ensureContent(c) {
  return {
    hero: { ...DEFAULT_CONTENT.hero, ...(c?.hero || {}) },
    intro: (() => {
      const ci = c?.intro || {};
      let content = ci.content;
      if ((!content || content === '') && Array.isArray(ci.paragraphs) && ci.paragraphs.some(Boolean)) {
        content = (ci.paragraphs || []).filter(Boolean).map((p) => `<p>${String(p).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`).join('');
      }
      return {
        ...DEFAULT_CONTENT.intro,
        ...ci,
        title: ci.title ?? DEFAULT_CONTENT.intro.title,
        content: content ?? DEFAULT_CONTENT.intro.content,
      };
    })(),
    facts: Array.isArray(c?.facts) ? c.facts : [],
    history: {
      intro: c?.history?.intro ?? '',
      timeline: Array.isArray(c?.history?.timeline) ? c.history.timeline : [],
    },
    nature: {
      title: c?.nature?.title ?? 'Природа и география',
      cards: Array.isArray(c?.nature?.cards) ? c.nature.cards : [],
    },
    culture: {
      title: c?.culture?.title ?? 'Народы и культура',
      intro: c?.culture?.intro ?? '',
      items: Array.isArray(c?.culture?.items) ? c.culture.items : [],
    },
    places: {
      title: c?.places?.title ?? 'Достопримечательности',
      items: Array.isArray(c?.places?.items) ? c.places.items : [],
      moreButtonText: c?.places?.moreButtonText ?? 'Смотреть все места',
      moreButtonLink: c?.places?.moreButtonLink ?? '/places',
    },
    cta: { ...DEFAULT_CONTENT.cta, ...(c?.cta || {}) },
  };
}

export default function AdminRegionPage() {
  const [content, setContent] = useState(ensureContent(null));
  const [pendingImages, setPendingImages] = useState({}); // { path: { file, preview } }
  const [allPlaces, setAllPlaces] = useState([]);
  const [addPlacesModalOpen, setAddPlacesModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [savedVersion, setSavedVersion] = useState(0);
  const savedContentRef = useRef(null);
  const setHeaderRight = useContext(AdminHeaderRightContext)?.setHeaderRight;

  const hasPendingImages = Object.keys(pendingImages).length > 0;
  const isDirty = savedContentRef.current != null && (JSON.stringify(content) !== JSON.stringify(savedContentRef.current) || hasPendingImages);

  const fetchRegion = useCallback(async () => {
    try {
      const res = await regionAPI.get();
      const c = ensureContent(res.data?.content);
      setContent(c);
      savedContentRef.current = JSON.parse(JSON.stringify(c));
    } catch (e) {
      console.error('Ошибка загрузки региона:', e);
      setContent(ensureContent(DEFAULT_CONTENT));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRegion();
  }, [fetchRegion]);

  const fetchPlaces = useCallback(async () => {
    try {
      const res = await placesAPI.getAll({ page: 1, limit: 500 });
      setAllPlaces(res.data?.items || []);
    } catch (e) {
      console.error('Ошибка загрузки мест:', e);
    }
  }, []);

  useEffect(() => {
    fetchPlaces();
  }, [fetchPlaces]);

  const placeToItem = (p) => ({
    placeId: p.id,
    place: p.location || '',
    title: p.title || '',
    desc: stripHtml(p.shortDescription || p.description || '') || '',
    link: `/places/${p.slug || p.id}`,
    img: p.image || p.images?.[0] || '',
    rating: p.rating != null ? String(p.rating) : '',
    feedback: p.reviewsCount === 1 ? '1 отзыв' : p.reviewsCount >= 2 && p.reviewsCount <= 4 ? `${p.reviewsCount} отзыва` : `${p.reviewsCount || 0} отзывов`,
  });

  const addPlaceToItems = (place) => {
    const currentIds = new Set((content.places?.items || []).map((i) => i.placeId).filter(Boolean));
    if (currentIds.has(place.id)) return;
    addArrayItem('places.items', placeToItem(place));
  };

  const pendingImagesRef = useRef(pendingImages);
  pendingImagesRef.current = pendingImages;
  useEffect(() => {
    return () => {
      for (const { preview } of Object.values(pendingImagesRef.current)) {
        URL.revokeObjectURL(preview);
      }
    };
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      let contentToSave = JSON.parse(JSON.stringify(content));
      const paths = Object.keys(pendingImages);
      for (const path of paths) {
        const { file, preview } = pendingImages[path];
        try {
          const fd = new FormData();
          fd.append('file', file);
          const res = await mediaAPI.upload(fd);
          if (res.data?.url) {
            const parts = path.split('.');
            let cur = contentToSave;
            for (let i = 0; i < parts.length - 1; i++) {
              const p = parts[i];
              const idx = parseInt(p, 10);
              cur = !isNaN(idx) ? cur[idx] : (cur[p] ??= {});
            }
            cur[parts[parts.length - 1]] = res.data.url;
          }
        } catch (err) {
          console.error('Ошибка загрузки:', err);
          throw err;
        }
      }
      const res = await regionAPI.update(contentToSave);
      for (const path of paths) {
        URL.revokeObjectURL(pendingImages[path].preview);
      }
      setPendingImages({});
      const c = ensureContent(res.data?.content);
      setContent(c);
      savedContentRef.current = JSON.parse(JSON.stringify(c));
      setSavedVersion((v) => v + 1);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (e) {
      console.error('Ошибка сохранения:', e);
    } finally {
      setIsSaving(false);
    }
  }, [content, pendingImages]);

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

  const update = (path, value) => {
    setContent((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const parts = path.split('.');
      let cur = next;
      for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i];
        const idx = parseInt(p, 10);
        if (!isNaN(idx)) {
          cur = cur[idx];
        } else {
          if (!cur[p]) cur[p] = {};
          cur = cur[p];
        }
      }
      cur[parts[parts.length - 1]] = value;
      return next;
    });
  };

  const updateArray = (path, index, field, value) => {
    setContent((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const parts = path.split('.');
      let cur = next;
      for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
      const arr = cur[parts[parts.length - 1]];
      if (arr[index]) arr[index][field] = value;
      return next;
    });
  };

  const addArrayItem = (path, item) => {
    setContent((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const parts = path.split('.');
      let cur = next;
      for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
      cur[parts[parts.length - 1]].push(item);
      return next;
    });
  };

  const removeArrayItem = (path, index) => {
    setPendingImages((prev) => {
      const next = {};
      const re = new RegExp('^' + path.replace(/\./g, '\\.') + '\\.(\\d+)\\.(\\w+)$');
      for (const [key, val] of Object.entries(prev)) {
        const m = key.match(re);
        if (!m) { next[key] = val; continue; }
        const idx = parseInt(m[1], 10);
        const field = m[2];
        if (idx === index) {
          URL.revokeObjectURL(val.preview);
        } else if (idx < index) {
          next[key] = val;
        } else {
          next[path + '.' + (idx - 1) + '.' + field] = val;
        }
      }
      return next;
    });
    setContent((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const parts = path.split('.');
      let cur = next;
      for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
      cur[parts[parts.length - 1]].splice(index, 1);
      return next;
    });
  };

  const getImageSrc = (path) => {
    const pending = pendingImages[path];
    if (pending) return pending.preview;
    const parts = path.split('.');
    let cur = content;
    for (const p of parts) {
      const idx = parseInt(p, 10);
      cur = !isNaN(idx) ? cur?.[idx] : cur?.[p];
    }
    return cur ? getImageUrl(cur) : null;
  };

  const hasImage = (path) => {
    if (pendingImages[path]) return true;
    const parts = path.split('.');
    let cur = content;
    for (const p of parts) {
      const idx = parseInt(p, 10);
      cur = !isNaN(idx) ? cur?.[idx] : cur?.[p];
    }
    return !!cur;
  };

  const handleFileSelect = (path, e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPendingImages((prev) => {
      const old = prev[path];
      if (old) URL.revokeObjectURL(old.preview);
      return { ...prev, [path]: { file, preview: URL.createObjectURL(file) } };
    });
  };

  const clearImage = (path) => {
    setPendingImages((prev) => {
      const next = { ...prev };
      if (next[path]) {
        URL.revokeObjectURL(next[path].preview);
        delete next[path];
      }
      return next;
    });
    update(path, '');
  };

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Загрузка...</p>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>О регионе</h1>
          <p className={styles.pageSubtitle}>Редактирование контента страницы «О регионе»</p>
        </div>
      </div>

      <div className={styles.formContainer}>
        {/* Hero */}
        <section className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Hero-блок</h2>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Заголовок</label>
            <input
              type="text"
              value={content.hero?.title ?? ''}
              onChange={(e) => update('hero.title', e.target.value)}
              className={styles.formInput}
              placeholder="КАРАЧАЕВО-ЧЕРКЕСИЯ"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Подзаголовок</label>
            <input
              type="text"
              value={content.hero?.subtitle ?? ''}
              onChange={(e) => update('hero.subtitle', e.target.value)}
              className={styles.formInput}
              placeholder="Край величественных гор..."
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Фоновое изображение</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileSelect('hero.image', e)}
              style={{ display: 'none' }}
              id="heroImage"
            />
            {hasImage('hero.image') ? (
              <div className={`${styles.previewItem} ${styles.previewItemMain}`} style={{ width: 280, aspectRatio: '16/9', position: 'relative', overflow: 'hidden', borderRadius: 8 }}>
                <img src={getImageSrc('hero.image')} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <span className={styles.previewItemBadge}>Hero</span>
                <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', flexDirection: 'row', gap: 6 }}>
                  <button type="button" onClick={() => document.getElementById('heroImage')?.click()} className={styles.removeImage} style={{ position: 'relative', top: 0, right: 0 }} aria-label="Изменить" title="Изменить"><Pencil size={14} /></button>
                  <button type="button" onClick={() => clearImage('hero.image')} className={styles.removeImage} style={{ position: 'relative', top: 0, right: 0 }} aria-label="Удалить" title="Удалить"><X size={14} /></button>
                </div>
              </div>
            ) : (
              <div className={styles.imageUpload} onClick={() => document.getElementById('heroImage')?.click()} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') document.getElementById('heroImage')?.click(); }}>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                  <Upload size={20} /> Загрузить изображение
                </label>
              </div>
            )}
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Текст кнопки</label>
            <input
              type="text"
              value={content.hero?.buttonText ?? ''}
              onChange={(e) => update('hero.buttonText', e.target.value)}
              className={styles.formInput}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Ссылка кнопки</label>
            <select
              value={content.hero?.buttonLink ?? '/routes'}
              onChange={(e) => update('hero.buttonLink', e.target.value)}
              className={styles.formSelect}
            >
              {HEADER_LINKS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </section>

        {/* Intro */}
        <section className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Блок «Добро пожаловать»</h2>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Заголовок</label>
            <input
              type="text"
              value={content.intro?.title ?? ''}
              onChange={(e) => update('intro.title', e.target.value)}
              className={styles.formInput}
              placeholder="Добро пожаловать в КЧР"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Текст</label>
            <RichTextEditor
              value={content.intro?.content ?? ''}
              onChange={(val) => update('intro.content', val)}
              placeholder="Введите текст абзацев"
              minHeight={280}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Изображение</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileSelect('intro.image', e)}
              style={{ display: 'none' }}
              id="introImage"
            />
            {hasImage('intro.image') ? (
              <div className={`${styles.previewItem} ${styles.previewItemMain}`} style={{ width: 280, aspectRatio: '16/9', position: 'relative', overflow: 'hidden', borderRadius: 8 }}>
                <img src={getImageSrc('intro.image')} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <span className={styles.previewItemBadge}>Превью</span>
                <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', flexDirection: 'row', gap: 6 }}>
                  <button type="button" onClick={() => document.getElementById('introImage')?.click()} className={styles.removeImage} style={{ position: 'relative', top: 0, right: 0 }} aria-label="Изменить" title="Изменить"><Pencil size={14} /></button>
                  <button type="button" onClick={() => clearImage('intro.image')} className={styles.removeImage} style={{ position: 'relative', top: 0, right: 0 }} aria-label="Удалить" title="Удалить"><X size={14} /></button>
                </div>
              </div>
            ) : (
              <div className={styles.imageUpload} onClick={() => document.getElementById('introImage')?.click()} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') document.getElementById('introImage')?.click(); }}>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                  <Upload size={20} /> Загрузить изображение
                </label>
              </div>
            )}
          </div>
        </section>

        {/* Facts */}
        <section className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Факты в цифрах</h2>
          {(content.facts ?? []).map((fact, i) => (
            <div key={i} className={styles.formGroup} style={{ border: '1px solid #e5e7eb', padding: 16, borderRadius: 10, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span className={styles.formLabel}>Факт {i + 1}</span>
                <button type="button" onClick={() => removeArrayItem('facts', i)} className={styles.removeBtn}><X size={16} /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 12 }}>
                <input
                  type="text"
                  value={fact.number ?? ''}
                  onChange={(e) => updateArray('facts', i, 'number', e.target.value)}
                  className={styles.formInput}
                  placeholder="Число (14 277)"
                />
                <input
                  type="text"
                  value={fact.label ?? ''}
                  onChange={(e) => updateArray('facts', i, 'label', e.target.value)}
                  className={styles.formInput}
                  placeholder="Ед. (км²)"
                />
                <input
                  type="text"
                  value={fact.description ?? ''}
                  onChange={(e) => updateArray('facts', i, 'description', e.target.value)}
                  className={styles.formInput}
                  placeholder="Описание"
                />
              </div>
            </div>
          ))}
          <button type="button" onClick={() => addArrayItem('facts', { number: '', label: '', description: '' })} className={styles.addBtn}>
            <Plus size={18} /> Добавить факт
          </button>
        </section>

        {/* History */}
        <section className={styles.formSection}>
          <h2 className={styles.sectionTitle}>История региона</h2>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Вступительный текст</label>
            <RichTextEditor
              value={content.history?.intro ?? ''}
              onChange={(val) => update('history.intro', val)}
              placeholder="Введите вступительный текст"
              minHeight={120}
            />
          </div>
          <label className={styles.formLabel}>Хронология</label>
          {(content.history?.timeline ?? []).map((item, i) => (
            <div key={i} className={styles.formGroup} style={{ border: '1px solid #e5e7eb', padding: 16, borderRadius: 10, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className={styles.formLabel}>Пункт {i + 1}</span>
                <button type="button" onClick={() => removeArrayItem('history.timeline', i)} className={styles.removeBtn}><X size={16} /></button>
              </div>
              <input
                type="text"
                value={item.year ?? ''}
                onChange={(e) => updateArray('history.timeline', i, 'year', e.target.value)}
                className={styles.formInput}
                placeholder="Год (V-IV тыс. до н.э.)"
                style={{ marginBottom: 8 }}
              />
              <input
                type="text"
                value={item.title ?? ''}
                onChange={(e) => updateArray('history.timeline', i, 'title', e.target.value)}
                className={styles.formInput}
                placeholder="Заголовок"
                style={{ marginBottom: 8 }}
              />
              <RichTextEditor
                value={item.description ?? ''}
                onChange={(val) => updateArray('history.timeline', i, 'description', val)}
                placeholder="Описание"
                minHeight={80}
              />
            </div>
          ))}
          <button type="button" onClick={() => addArrayItem('history.timeline', { year: '', title: '', description: '' })} className={styles.addBtn}>
            <Plus size={18} /> Добавить пункт
          </button>
        </section>

        {/* Nature */}
        <section className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Природа и география</h2>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Заголовок секции</label>
            <input
              type="text"
              value={content.nature?.title ?? ''}
              onChange={(e) => update('nature.title', e.target.value)}
              className={styles.formInput}
            />
          </div>
          {(content.nature?.cards ?? []).map((card, i) => (
            <div key={i} className={styles.formGroup} style={{ border: '1px solid #e5e7eb', padding: 16, borderRadius: 10, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className={styles.formLabel}>Карточка {i + 1}</span>
                <button type="button" onClick={() => removeArrayItem('nature.cards', i)} className={styles.removeBtn}><X size={16} /></button>
              </div>
              <input
                type="text"
                value={card.title ?? ''}
                onChange={(e) => updateArray('nature.cards', i, 'title', e.target.value)}
                className={styles.formInput}
                placeholder="Заголовок"
                style={{ marginBottom: 8 }}
              />
              <RichTextEditor
                value={card.description ?? ''}
                onChange={(val) => updateArray('nature.cards', i, 'description', val)}
                placeholder="Описание"
                minHeight={80}
              />
              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label className={styles.formLabel}>Изображение</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileSelect(`nature.cards.${i}.image`, e)}
                  style={{ display: 'none' }}
                  id={`natureImg${i}`}
                />
                {hasImage(`nature.cards.${i}.image`) ? (
                  <div className={`${styles.previewItem} ${styles.previewItemMain}`} style={{ width: 120, height: 90, position: 'relative', overflow: 'hidden', borderRadius: 8 }}>
                    <img src={getImageSrc(`nature.cards.${i}.image`)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', flexDirection: 'row', gap: 4 }}>
                      <button type="button" onClick={() => document.getElementById(`natureImg${i}`)?.click()} className={styles.removeImage} aria-label="Изменить" title="Изменить"><Pencil size={12} /></button>
                      <button type="button" onClick={() => clearImage(`nature.cards.${i}.image`)} className={styles.removeImage} aria-label="Удалить" title="Удалить"><X size={12} /></button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.imageUpload} style={{ maxWidth: 200 }} onClick={() => document.getElementById(`natureImg${i}`)?.click()} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') document.getElementById(`natureImg${i}`)?.click(); }}>
                    <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                      <Upload size={18} /> Загрузить
                    </label>
                  </div>
                )}
              </div>
            </div>
          ))}
          <button type="button" onClick={() => addArrayItem('nature.cards', { title: '', description: '', image: '' })} className={styles.addBtn}>
            <Plus size={18} /> Добавить карточку
          </button>
        </section>

        {/* Culture */}
        <section className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Народы и культура</h2>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Заголовок секции</label>
            <input
              type="text"
              value={content.culture?.title ?? ''}
              onChange={(e) => update('culture.title', e.target.value)}
              className={styles.formInput}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Вступительный текст</label>
            <RichTextEditor
              value={content.culture?.intro ?? ''}
              onChange={(val) => update('culture.intro', val)}
              placeholder="Введите вступительный текст"
              minHeight={120}
            />
          </div>
          {(content.culture?.items ?? []).map((item, i) => (
            <div key={i} className={styles.formGroup} style={{ border: '1px solid #e5e7eb', padding: 16, borderRadius: 10, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className={styles.formLabel}>Народ {i + 1}</span>
                <button type="button" onClick={() => removeArrayItem('culture.items', i)} className={styles.removeBtn}><X size={16} /></button>
              </div>
              <input
                type="text"
                value={item.name ?? ''}
                onChange={(e) => updateArray('culture.items', i, 'name', e.target.value)}
                className={styles.formInput}
                placeholder="Название народа"
                style={{ marginBottom: 8 }}
              />
              <RichTextEditor
                value={item.description ?? ''}
                onChange={(val) => updateArray('culture.items', i, 'description', val)}
                placeholder="Описание"
                minHeight={80}
                style={{ marginBottom: 8 }}
              />
              <label className={styles.formLabel}>Традиции (через запятую)</label>
              <input
                type="text"
                value={Array.isArray(item.traditions) ? item.traditions.join(', ') : (item.traditions || '')}
                onChange={(e) => updateArray('culture.items', i, 'traditions', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                className={styles.formInput}
                placeholder="Традиция 1, Традиция 2"
              />
            </div>
          ))}
          <button type="button" onClick={() => addArrayItem('culture.items', { name: '', description: '', traditions: [] })} className={styles.addBtn}>
            <Plus size={18} /> Добавить народ
          </button>
        </section>

        {/* Places */}
        <section className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Достопримечательности</h2>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Заголовок секции</label>
            <input
              type="text"
              value={content.places?.title ?? ''}
              onChange={(e) => update('places.title', e.target.value)}
              className={styles.formInput}
            />
          </div>
          <div className={styles.formGroup} style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label className={styles.formLabel}>Текст кнопки «Смотреть все»</label>
              <input
                type="text"
                value={content.places?.moreButtonText ?? ''}
                onChange={(e) => update('places.moreButtonText', e.target.value)}
                className={styles.formInput}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className={styles.formLabel}>Ссылка кнопки</label>
              <select
                value={content.places?.moreButtonLink ?? '/places'}
                onChange={(e) => update('places.moreButtonLink', e.target.value)}
                className={styles.formSelect}
              >
                {HEADER_LINKS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Выбранные места</label>
            <p className={styles.imageHint} style={{ marginBottom: 12 }}>
              Выберите места из списка ниже. Порядок можно изменить, удалив и добавив заново.
            </p>
            {(content.places?.items ?? []).length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                {(content.places?.items ?? []).map((item, i) => (
                  <div key={i} style={{ width: 140, position: 'relative', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                    <img src={getImageUrl(item.img)} alt="" style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />
                    <div style={{ padding: 8, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.title}>{item.title || item.place || 'Место'}</div>
                    <button type="button" onClick={() => removeArrayItem('places.items', i)} className={styles.removeImage} style={{ position: 'absolute', top: 4, right: 4 }} aria-label="Удалить" title="Удалить"><X size={14} /></button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#6b7280', marginBottom: 12 }}>Места не выбраны</p>
            )}
            <button type="button" onClick={() => setAddPlacesModalOpen(true)} className={styles.addBtn}>
              <Plus size={18} /> Выбрать места
            </button>
          </div>

          {addPlacesModalOpen && (
            <div
              className={styles.modalOverlay}
              onClick={(e) => e.target === e.currentTarget && setAddPlacesModalOpen(false)}
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-places-region-title"
            >
              <div className={styles.modalDialog} style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                  <h2 id="add-places-region-title" className={styles.modalTitle}>Выбрать места</h2>
                  <button type="button" onClick={() => setAddPlacesModalOpen(false)} className={styles.modalClose} aria-label="Закрыть"><X size={20} /></button>
                </div>
                <div className={styles.modalBody}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, maxHeight: 360, overflowY: 'auto' }}>
                    {allPlaces
                      .filter((p) => !(content.places?.items ?? []).some((i) => i.placeId === p.id))
                      .map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => addPlaceToItems(p)}
                          style={{ textAlign: 'left', padding: 0, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', cursor: 'pointer', background: '#fff' }}
                        >
                          <img src={getImageUrl(p.image || p.images?.[0])} alt="" style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />
                          <div style={{ padding: 8, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.title}>{p.title}</div>
                        </button>
                      ))}
                  </div>
                  {allPlaces.filter((p) => !(content.places?.items ?? []).some((i) => i.placeId === p.id)).length === 0 && (
                    <p style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Все места уже добавлены</p>
                  )}
                </div>
                <div className={styles.modalFooter}>
                  <button type="button" onClick={() => setAddPlacesModalOpen(false)} className={styles.submitBtn}>Готово</button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* CTA */}
        <section className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Призыв к действию (CTA)</h2>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Фоновое изображение</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileSelect('cta.image', e)}
              style={{ display: 'none' }}
              id="ctaImage"
            />
            {hasImage('cta.image') ? (
              <div className={`${styles.previewItem} ${styles.previewItemMain}`} style={{ width: 280, aspectRatio: '16/9', position: 'relative', overflow: 'hidden', borderRadius: 8 }}>
                <img src={getImageSrc('cta.image')} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <span className={styles.previewItemBadge}>CTA</span>
                <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', flexDirection: 'row', gap: 6 }}>
                  <button type="button" onClick={() => document.getElementById('ctaImage')?.click()} className={styles.removeImage} style={{ position: 'relative', top: 0, right: 0 }} aria-label="Изменить" title="Изменить"><Pencil size={14} /></button>
                  <button type="button" onClick={() => clearImage('cta.image')} className={styles.removeImage} style={{ position: 'relative', top: 0, right: 0 }} aria-label="Удалить" title="Удалить"><X size={14} /></button>
                </div>
              </div>
            ) : (
              <div className={styles.imageUpload} style={{ maxWidth: 280 }} onClick={() => document.getElementById('ctaImage')?.click()} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') document.getElementById('ctaImage')?.click(); }}>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                  <Upload size={20} /> Загрузить изображение
                </label>
              </div>
            )}
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Заголовок</label>
            <input
              type="text"
              value={content.cta?.title ?? ''}
              onChange={(e) => update('cta.title', e.target.value)}
              className={styles.formInput}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Текст</label>
            <textarea
              value={content.cta?.text ?? ''}
              onChange={(e) => update('cta.text', e.target.value)}
              className={styles.formTextarea}
              rows={2}
            />
          </div>
          <div className={styles.formGroup} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className={styles.formLabel}>Текст основной кнопки</label>
              <input
                type="text"
                value={content.cta?.primaryButtonText ?? ''}
                onChange={(e) => update('cta.primaryButtonText', e.target.value)}
                className={styles.formInput}
              />
            </div>
            <div>
              <label className={styles.formLabel}>Ссылка основной кнопки</label>
              <select
                value={content.cta?.primaryButtonLink ?? '/routes'}
                onChange={(e) => update('cta.primaryButtonLink', e.target.value)}
                className={styles.formSelect}
              >
                {HEADER_LINKS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.formGroup} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className={styles.formLabel}>Текст второй кнопки</label>
              <input
                type="text"
                value={content.cta?.secondaryButtonText ?? ''}
                onChange={(e) => update('cta.secondaryButtonText', e.target.value)}
                className={styles.formInput}
              />
            </div>
            <div>
              <label className={styles.formLabel}>Ссылка второй кнопки</label>
              <select
                value={content.cta?.secondaryButtonLink ?? '/services'}
                onChange={(e) => update('cta.secondaryButtonLink', e.target.value)}
                className={styles.formSelect}
              >
                {HEADER_LINKS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </section>
      </div>

      {showToast && <div className={styles.toast}>Сохранено</div>}
    </div>
  );
}
