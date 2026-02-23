'use client';

import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { Upload, Plus, X, Pencil } from 'lucide-react';
import { footerAPI, mediaAPI, getImageUrl } from '@/lib/api';
import { AdminHeaderRightContext } from '../layout';
import LinkSelector from '../components/LinkSelector/LinkSelector';
import styles from '../admin.module.css';

const EMPTY_CONTENT = {
  left: { logo: '', social: [], phone: '', address: '' },
  center: { title: '', links: [] },
  right: { title: '', formPlaceholderName: '', formPlaceholderEmail: '', formPlaceholderText: '', formButtonText: '', formRecipientEmail: '' },
  bottom: { orgName: '', links: [], partners: [] },
};

function ensureContent(c) {
  if (!c || typeof c !== 'object') return { ...JSON.parse(JSON.stringify(EMPTY_CONTENT)) };
  return {
    left: {
      logo: c?.left?.logo ?? '',
      social: Array.isArray(c?.left?.social) ? c.left.social : [],
      phone: c?.left?.phone ?? '',
      address: c?.left?.address ?? '',
    },
    center: {
      title: c?.center?.title ?? '',
      links: Array.isArray(c?.center?.links) ? c.center.links : [],
    },
    right: {
      title: c?.right?.title ?? '',
      formPlaceholderName: c?.right?.formPlaceholderName ?? '',
      formPlaceholderEmail: c?.right?.formPlaceholderEmail ?? '',
      formPlaceholderText: c?.right?.formPlaceholderText ?? '',
      formButtonText: c?.right?.formButtonText ?? '',
      formRecipientEmail: c?.right?.formRecipientEmail ?? '',
    },
    bottom: {
      orgName: c?.bottom?.orgName ?? '',
      links: Array.isArray(c?.bottom?.links) ? c.bottom.links : [],
      partners: Array.isArray(c?.bottom?.partners) ? c.bottom.partners : [],
    },
  };
}

export default function AdminFooterPage() {
  const [content, setContent] = useState(ensureContent(null));
  const [pendingImages, setPendingImages] = useState({});
  const [pendingFiles, setPendingFiles] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [savedVersion, setSavedVersion] = useState(0);
  const savedContentRef = useRef(null);
  const pendingImagesRef = useRef(pendingImages);
  pendingImagesRef.current = pendingImages;
  const setHeaderRight = useContext(AdminHeaderRightContext)?.setHeaderRight;

  const hasPendingImages = Object.keys(pendingImages).length > 0;
  const hasPendingFiles = Object.keys(pendingFiles).length > 0;
  const isDirty = savedContentRef.current != null && (JSON.stringify(content) !== JSON.stringify(savedContentRef.current) || hasPendingImages || hasPendingFiles);

  const fetchFooter = useCallback(async () => {
    try {
      const res = await footerAPI.get();
      const c = ensureContent(res.data?.content);
      setContent(c);
      savedContentRef.current = JSON.parse(JSON.stringify(c));
    } catch (e) {
      console.error('Ошибка загрузки футера:', e);
      setContent(ensureContent(null));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFooter();
  }, [fetchFooter]);

  useEffect(() => {
    return () => {
      for (const { preview } of Object.values(pendingImagesRef.current)) {
        URL.revokeObjectURL(preview);
      }
    };
  }, []);

  const handleLinkFileSelect = useCallback((path, file) => {
    setPendingFiles((prev) => {
      const next = { ...prev };
      if (file) next[path] = file;
      else delete next[path];
      return next;
    });
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
      const filePaths = Object.keys(pendingFiles);
      for (const path of filePaths) {
        const file = pendingFiles[path];
        if (!file) continue;
        try {
          const fd = new FormData();
          fd.append('file', file);
          const res = await mediaAPI.uploadDocument(fd);
          if (res.data?.url) {
            const parts = path.split('.');
            let cur = contentToSave;
            for (let i = 0; i < parts.length; i++) {
              const p = parts[i];
              const idx = parseInt(p, 10);
              cur = !isNaN(idx) ? cur[idx] : (cur[p] ??= {});
            }
            if (cur && typeof cur === 'object') cur.url = res.data.url;
          }
        } catch (err) {
          console.error('Ошибка загрузки документа:', err);
          throw err;
        }
      }
      const res = await footerAPI.update(contentToSave);
      for (const path of paths) {
        URL.revokeObjectURL(pendingImages[path].preview);
      }
      setPendingImages({});
      setPendingFiles({});
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
  }, [content, pendingImages, pendingFiles]);

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
        cur = !isNaN(idx) ? cur[idx] : (cur[p] ??= {});
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

  const setLinkAt = (path, index, value) => {
    setContent((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const parts = path.split('.');
      let cur = next;
      for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
      const arr = cur[parts[parts.length - 1]];
      if (arr[index] !== undefined) arr[index] = { ...arr[index], ...value };
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
    const basePath = path;
    setPendingFiles((prev) => {
      const next = {};
      const re = new RegExp('^' + path.replace(/\./g, '\\.') + '\\.(\\d+)$');
      for (const [key, val] of Object.entries(prev)) {
        const m = key.match(re);
        if (!m) { next[key] = val; continue; }
        const idx = parseInt(m[1], 10);
        if (idx === index) continue;
        if (idx < index) next[key] = val;
        else next[path + '.' + (idx - 1)] = val;
      }
      return next;
    });
    setPendingImages((prev) => {
      const next = {};
      const re = new RegExp('^' + path.replace(/\./g, '\\.') + '\\.(\\d+)\\.(\\w+)$');
      for (const [key, val] of Object.entries(prev)) {
        const m = key.match(re);
        if (!m) { next[key] = val; continue; }
        const idx = parseInt(m[1], 10);
        const f = m[2];
        if (idx === index) {
          URL.revokeObjectURL(val.preview);
        } else if (idx < index) {
          next[key] = val;
        } else {
          next[basePath + '.' + (idx - 1) + '.' + f] = val;
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
          <h1 className={styles.pageTitle}>Футер</h1>
          <p className={styles.pageSubtitle}>Редактирование контента футера сайта</p>
        </div>
      </div>

      <div className={styles.formContainer}>
        {/* Левая колонка */}
        <section className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Левая колонка (логотип, контакты)</h2>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Логотип</label>
            <input type="file" accept="image/*" onChange={(e) => handleFileSelect('left.logo', e)} style={{ display: 'none' }} id="footerLogo" />
            {hasImage('left.logo') ? (
              <div className={styles.footerImageBlock}>
                <div className={styles.footerImagePreview} style={{ width: 180, height: 44 }}>
                  <img src={getImageSrc('left.logo')} alt="" />
                </div>
                <div className={styles.footerImageActions}>
                  <button type="button" onClick={() => document.getElementById('footerLogo')?.click()} aria-label="Изменить" title="Изменить"><Pencil size={14} /></button>
                  <button type="button" className={styles.footerImageDelete} onClick={() => clearImage('left.logo')} aria-label="Удалить" title="Удалить"><X size={14} /></button>
                </div>
              </div>
            ) : (
              <div className={styles.imageUpload} style={{ maxWidth: 200 }} onClick={() => document.getElementById('footerLogo')?.click()} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') document.getElementById('footerLogo')?.click(); }}>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}><Upload size={20} /> Загрузить изображение</label>
              </div>
            )}
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Соцсети</label>
            {(content.left?.social ?? []).map((s, i) => (
              <div key={i} className={styles.footerSocialRow}>
                <input type="file" accept="image/*" onChange={(e) => handleFileSelect(`left.social.${i}.icon`, e)} style={{ display: 'none' }} id={`socialIcon${i}`} />
                {hasImage(`left.social.${i}.icon`) ? (
                  <div className={styles.footerImageBlock} style={{ flexShrink: 0 }}>
                    <div className={styles.footerImagePreview} style={{ width: 44, height: 44 }}>
                      <img src={getImageSrc(`left.social.${i}.icon`)} alt="" />
                    </div>
                    <div className={styles.footerImageActions}>
                      <button type="button" onClick={() => document.getElementById(`socialIcon${i}`)?.click()} aria-label="Изменить" title="Изменить"><Pencil size={12} /></button>
                      <button type="button" className={styles.footerImageDelete} onClick={() => clearImage(`left.social.${i}.icon`)} aria-label="Удалить" title="Удалить"><X size={12} /></button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.imageUpload} style={{ width: 44, height: 44, minWidth: 44, padding: 10 }} onClick={() => document.getElementById(`socialIcon${i}`)?.click()} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') document.getElementById(`socialIcon${i}`)?.click(); }}>
                    <Upload size={18} style={{ color: '#94a3b8' }} />
                  </div>
                )}
                <input type="url" value={s.url ?? ''} onChange={(e) => updateArray('left.social', i, 'url', e.target.value)} className={styles.formInput} placeholder="Ссылка (https://t.me/...)" style={{ flex: 1 }} />
                <button type="button" onClick={() => removeArrayItem('left.social', i)} className={styles.removeBtn}><X size={16} /></button>
              </div>
            ))}
            <button type="button" onClick={() => addArrayItem('left.social', { url: '', icon: '' })} className={styles.addBtn}><Plus size={18} /> Добавить соцсеть</button>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Телефон</label>
            <input type="text" value={content.left?.phone ?? ''} onChange={(e) => update('left.phone', e.target.value)} className={styles.formInput} placeholder="+7 (099) 09 00 09" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Адрес</label>
            <textarea value={content.left?.address ?? ''} onChange={(e) => update('left.address', e.target.value)} className={styles.formTextarea} rows={3} placeholder="Адрес" />
          </div>
        </section>

        {/* Центральная колонка */}
        <section className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Центральная колонка (На помощь туристу)</h2>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Заголовок</label>
            <input type="text" value={content.center?.title ?? ''} onChange={(e) => update('center.title', e.target.value)} className={styles.formInput} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Ссылки</label>
            <p className={styles.imageHint} style={{ marginBottom: 12 }}>Выберите тип, затем нужный объект. Для типа «Файл» — выберите PDF/DOC и введите название.</p>
            {(content.center?.links ?? []).map((link, i) => (
              <div key={i} className={styles.footerLinkCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span className={styles.formLabel}>Ссылка {i + 1}</span>
                  <button type="button" onClick={() => removeArrayItem('center.links', i)} className={styles.removeBtn}><X size={16} /></button>
                </div>
                <LinkSelector
                  value={link}
                  onChange={(v) => setLinkAt('center.links', i, v)}
                  filePath={`center.links.${i}`}
                  onFileSelect={handleLinkFileSelect}
                  pendingFile={pendingFiles[`center.links.${i}`]}
                />
              </div>
            ))}
            <button type="button" onClick={() => addArrayItem('center.links', { type: 'page', url: '/', title: '' })} className={styles.addBtn}><Plus size={18} /> Добавить ссылку</button>
          </div>
        </section>

        {/* Правая колонка */}
        <section className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Правая колонка (Обратная связь)</h2>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Заголовок</label>
            <input type="text" value={content.right?.title ?? ''} onChange={(e) => update('right.title', e.target.value)} className={styles.formInput} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Плейсхолдер «Имя»</label>
            <input type="text" value={content.right?.formPlaceholderName ?? ''} onChange={(e) => update('right.formPlaceholderName', e.target.value)} className={styles.formInput} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Плейсхолдер «Email»</label>
            <input type="text" value={content.right?.formPlaceholderEmail ?? ''} onChange={(e) => update('right.formPlaceholderEmail', e.target.value)} className={styles.formInput} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Плейсхолдер «Ваш текст»</label>
            <input type="text" value={content.right?.formPlaceholderText ?? ''} onChange={(e) => update('right.formPlaceholderText', e.target.value)} className={styles.formInput} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Текст кнопки</label>
            <input type="text" value={content.right?.formButtonText ?? ''} onChange={(e) => update('right.formButtonText', e.target.value)} className={styles.formInput} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Почта для получения сообщений</label>
            <input type="email" value={content.right?.formRecipientEmail ?? ''} onChange={(e) => update('right.formRecipientEmail', e.target.value)} className={styles.formInput} placeholder="example@mail.ru" />
            <p className={styles.imageHint} style={{ marginTop: 6 }}>На эту почту будут приходить сообщения из формы обратной связи.</p>
          </div>
        </section>

        {/* Нижний блок */}
        <section className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Нижний блок (организация, ссылки, партнёры)</h2>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Текст об организации</label>
            <textarea value={content.bottom?.orgName ?? ''} onChange={(e) => update('bottom.orgName', e.target.value)} className={styles.formTextarea} rows={2} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Ссылки (политика, правила)</label>
            <p className={styles.imageHint} style={{ marginBottom: 12 }}>Выберите PDF/DOC и введите название ссылки.</p>
            {(content.bottom?.links ?? []).map((link, i) => (
              <div key={i} className={styles.footerLinkCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span className={styles.formLabel}>Ссылка {i + 1}</span>
                  <button type="button" onClick={() => removeArrayItem('bottom.links', i)} className={styles.removeBtn}><X size={16} /></button>
                </div>
                <LinkSelector
                  value={{ ...link, type: 'file' }}
                  onChange={(v) => setLinkAt('bottom.links', i, { ...v, type: 'file' })}
                  filePath={`bottom.links.${i}`}
                  onFileSelect={handleLinkFileSelect}
                  pendingFile={pendingFiles[`bottom.links.${i}`]}
                  fileOnly
                />
              </div>
            ))}
            <button type="button" onClick={() => addArrayItem('bottom.links', { type: 'file', title: '', url: '' })} className={styles.addBtn}><Plus size={18} /> Добавить ссылку</button>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Партнёры (логотипы)</label>
            <p className={styles.imageHint} style={{ marginBottom: 12 }}>Ссылки ведут на сайты партнёров. Логотип загружается при сохранении.</p>
            {(content.bottom?.partners ?? []).map((p, i) => (
              <div key={i} className={styles.footerPartnerCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span className={styles.formLabel}>Партнёр {i + 1}</span>
                  <button type="button" onClick={() => removeArrayItem('bottom.partners', i)} className={styles.removeBtn}><X size={16} /></button>
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div>
                    <div className={styles.formLabel} style={{ marginBottom: 4 }}>Логотип</div>
                    <input type="file" accept="image/*" onChange={(e) => handleFileSelect(`bottom.partners.${i}.image`, e)} style={{ display: 'none' }} id={`partnerImg${i}`} />
                    {hasImage(`bottom.partners.${i}.image`) ? (
                      <div className={styles.footerImageBlock}>
                        <div className={styles.footerImagePreview} style={{ width: 88, height: 50 }}>
                          <img src={getImageSrc(`bottom.partners.${i}.image`)} alt="" />
                        </div>
                        <div className={styles.footerImageActions}>
                          <button type="button" onClick={() => document.getElementById(`partnerImg${i}`)?.click()} aria-label="Изменить" title="Изменить"><Pencil size={12} /></button>
                          <button type="button" className={styles.footerImageDelete} onClick={() => clearImage(`bottom.partners.${i}.image`)} aria-label="Удалить" title="Удалить"><X size={12} /></button>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.imageUpload} style={{ width: 88, height: 50, minWidth: 88, padding: 10 }} onClick={() => document.getElementById(`partnerImg${i}`)?.click()} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') document.getElementById(`partnerImg${i}`)?.click(); }}>
                        <Upload size={18} style={{ color: '#94a3b8' }} />
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div className={styles.formLabel} style={{ marginBottom: 4 }}>Ссылка на сайт партнёра</div>
                    <input type="url" value={p.url ?? ''} onChange={(e) => updateArray('bottom.partners', i, 'url', e.target.value)} className={styles.formInput} placeholder="https://..." style={{ width: '100%' }} />
                  </div>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => addArrayItem('bottom.partners', { url: '', image: '' })} className={styles.addBtn}><Plus size={18} /> Добавить партнёра</button>
          </div>
        </section>
      </div>

      {showToast && <div className={styles.toast}>Сохранено</div>}
    </div>
  );
}
