'use client';

import { useState, useEffect, useId } from 'react';
import { newsAPI, placesAPI, routesAPI, servicesAPI, getImageUrl } from '@/lib/api';
import styles from '../../admin.module.css';

const LINK_TYPES = [
  { value: 'news', label: 'Новость' },
  { value: 'place', label: 'Место' },
  { value: 'route', label: 'Маршрут' },
  { value: 'service', label: 'Услуга' },
  { value: 'page', label: 'Страница сайта' },
  { value: 'file', label: 'Файл' },
  { value: 'custom', label: 'Своя ссылка' },
];

const PAGE_OPTIONS = [
  { url: '/', title: 'Главная' },
  { url: '/region', title: 'О регионе' },
  { url: '/routes', title: 'Маршруты' },
  { url: '/places', title: 'Места' },
  { url: '/news', title: 'Новости' },
  { url: '/services', title: 'Услуги' },
  { url: '/search', title: 'Поиск' },
];

/** Resolves link object to { text, url, isFile? } for display */
export function resolveLink(link) {
  if (!link) return { text: '', url: '#', isFile: false };
  if (link.text && link.url && link.type !== 'file') return { text: link.text, url: link.url, isFile: false };
  if (link.type === 'news') return { text: link.title || '', url: `/news/${link.slug || link.id}`, isFile: false };
  if (link.type === 'place') return { text: link.title || '', url: `/places/${link.slug || link.id}`, isFile: false };
  if (link.type === 'route') return { text: link.title || '', url: `/routes/${link.slug || link.id}`, isFile: false };
  if (link.type === 'service') return { text: link.title || '', url: `/services/${link.slug || link.id}`, isFile: false };
  if (link.type === 'page') return { text: link.title || '', url: link.url || '#', isFile: false };
  if (link.type === 'file') return { text: link.title || '', url: link.url || '#', isFile: true };
  if (link.type === 'custom') return { text: link.title || '', url: link.url || '#', isFile: false };
  const isFile = link.url && /^\/uploads\/.+\.(pdf|doc|docx)$/i.test(link.url);
  if (link.url) return { text: link.title || link.text || '', url: link.url, isFile };
  return { text: '', url: '#', isFile: false };
}

export default function LinkSelector({ value, onChange, filePath, onFileSelect, pendingFile, fileOnly }) {
  const id = useId();
  const fileInputId = `link-file-${(filePath || id).replace(/[^a-z0-9]/gi, '-')}`;
  const [type, setType] = useState(fileOnly ? 'file' : (value?.type || (value?.url ? 'page' : 'page')));
  const [news, setNews] = useState([]);
  const [places, setPlaces] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [services, setServices] = useState([]);

  useEffect(() => {
    if (type === 'news') {
      newsAPI.getAll({ limit: 500 }).then((r) => setNews(r.data?.items || []));
    } else if (type === 'place') {
      placesAPI.getAll({ page: 1, limit: 500 }).then((r) => setPlaces(r.data?.items || []));
    } else if (type === 'route') {
      routesAPI.getAll({ limit: 500 }).then((r) => setRoutes(r.data?.items || []));
    } else if (type === 'service') {
      servicesAPI.getAll({ limit: 500 }).then((r) => setServices(r.data?.items || []));
    }
  }, [type]);

  const handleTypeChange = (t) => {
    setType(t);
    if (t !== 'file' && filePath) onFileSelect?.(filePath, null);
    onChange({ type: t });
  };

  const handleItemSelect = (item) => {
    if (type === 'news') {
      onChange({ type: 'news', id: item.id, slug: item.slug, title: item.title });
    } else if (type === 'place') {
      onChange({ type: 'place', id: item.id, slug: item.slug, title: item.title });
    } else if (type === 'route') {
      onChange({ type: 'route', id: item.id, slug: item.slug, title: item.title });
    } else if (type === 'service') {
      onChange({ type: 'service', id: item.id, slug: item.slug, title: item.title });
    } else if (type === 'page') {
      onChange({ type: 'page', url: item.url, title: item.title });
    }
  };

  const handleCustomChange = (field, v) => {
    onChange({ ...value, type: 'custom', [field]: v });
  };

  const handleFileChange = (field, v) => {
    onChange({ ...value, type: 'file', [field]: v });
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    onFileSelect?.(filePath, file || null);
  };

  const items = type === 'news' ? news : type === 'place' ? places : type === 'route' ? routes : type === 'service' ? services : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {!fileOnly && (
          <select
            value={type}
            onChange={(e) => handleTypeChange(e.target.value)}
            className={styles.formSelect}
            style={{ width: 160 }}
          >
            {LINK_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        )}
        {type === 'page' && (
          <select
            value={value?.url ?? ''}
            onChange={(e) => {
              const opt = PAGE_OPTIONS.find((o) => o.url === e.target.value);
              if (opt) handleItemSelect(opt);
            }}
            className={styles.formSelect}
            style={{ flex: 1, minWidth: 180 }}
          >
            <option value="">— Выберите страницу —</option>
            {PAGE_OPTIONS.map((o) => (
              <option key={o.url} value={o.url}>{o.title}</option>
            ))}
          </select>
        )}
        {['news', 'place', 'route', 'service'].includes(type) && (
          <select
            value={value?.id ?? ''}
            onChange={(e) => {
              const id = e.target.value;
              const item = items.find((i) => i.id === id);
              if (item) handleItemSelect(item);
            }}
            className={styles.formSelect}
            style={{ flex: 1, minWidth: 180 }}
          >
            <option value="">— Выберите {LINK_TYPES.find((t) => t.value === type)?.label?.toLowerCase()} —</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {(item.title || '').length > 60 ? (item.title || '').slice(0, 57) + '...' : item.title}
              </option>
            ))}
          </select>
        )}
        {type === 'file' && (
          <>
            <input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id={fileInputId}
            />
            <label
              htmlFor={fileInputId}
              className={styles.formSelect}
              style={{ cursor: 'pointer', padding: '8px 12px', minWidth: 140, textAlign: 'center' }}
            >
              {pendingFile ? pendingFile.name : (value?.url ? (() => {
                const fn = (value.url || '').split('/').pop() || '';
                return fn ? (fn.length > 28 ? fn.slice(0, 25) + '...' : fn) : 'Файл выбран';
              })() : 'Выбрать файл')}
            </label>
            <input
              type="text"
              value={value?.title ?? ''}
              onChange={(e) => handleFileChange('title', e.target.value)}
              className={styles.formInput}
              placeholder="Название ссылки"
              style={{ flex: 1, minWidth: 140 }}
            />
            {value?.url && (
              <a
                href={getImageUrl(value.url)}
                target="_blank"
                rel="noopener noreferrer"
                download
                className={styles.editBtn}
                style={{ padding: '8px 12px', textDecoration: 'none', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center' }}
              >
                Скачать
              </a>
            )}
          </>
        )}
        {type === 'custom' && (
          <>
            <input
              type="text"
              value={value?.title ?? ''}
              onChange={(e) => handleCustomChange('title', e.target.value)}
              className={styles.formInput}
              placeholder="Текст ссылки"
              style={{ flex: 1, minWidth: 120 }}
            />
            <input
              type="text"
              value={value?.url ?? ''}
              onChange={(e) => handleCustomChange('url', e.target.value)}
              className={styles.formInput}
              placeholder="URL"
              style={{ width: 180 }}
            />
          </>
        )}
      </div>
    </div>
  );
}
