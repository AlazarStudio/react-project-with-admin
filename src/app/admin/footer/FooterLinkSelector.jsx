'use client';

import { useState, useEffect, useCallback } from 'react';
import { newsAPI, placesAPI, routesAPI, servicesAPI } from '@/lib/api';
import { stripHtml } from '@/lib/utils';
import styles from '../admin.module.css';

const LINK_TYPES = [
  { value: 'static', label: 'Страница сайта' },
  { value: 'news', label: 'Новость' },
  { value: 'place', label: 'Место' },
  { value: 'route', label: 'Маршрут' },
  { value: 'service', label: 'Услуга' },
  { value: 'external', label: 'Внешняя ссылка' },
];

const STATIC_OPTIONS = [
  { value: '/', label: 'Главная' },
  { value: '/region', label: 'О регионе' },
  { value: '/routes', label: 'Маршруты' },
  { value: '/places', label: 'Места' },
  { value: '/news', label: 'Новости' },
  { value: '/services', label: 'Услуги' },
  { value: '/search', label: 'Поиск' },
];

const MAX_TITLE_LENGTH = 70; // примерно 2 строки

function truncateTitle(text) {
  if (!text) return '';
  const cleaned = stripHtml(text).trim();
  if (cleaned.length <= MAX_TITLE_LENGTH) return cleaned;
  return cleaned.slice(0, MAX_TITLE_LENGTH).trim() + '…';
}

export default function FooterLinkSelector({ value = {}, onChange }) {
  const { text = '', url = '', linkType: storedType, linkValue: storedValue } = value;

  const [linkType, setLinkType] = useState(storedType || 'static');
  const [linkValue, setLinkValue] = useState(storedValue || '');
  const [externalText, setExternalText] = useState(linkType === 'external' ? text : '');
  const [externalUrl, setExternalUrl] = useState(linkType === 'external' ? url : '');

  const [newsList, setNewsList] = useState([]);
  const [placesList, setPlacesList] = useState([]);
  const [routesList, setRoutesList] = useState([]);
  const [servicesList, setServicesList] = useState([]);

  const fetchLists = useCallback(async () => {
    try {
      const [newsRes, placesRes, routesRes, servicesRes] = await Promise.all([
        newsAPI.getAll({ page: 1, limit: 500 }),
        placesAPI.getAll({ page: 1, limit: 500 }),
        routesAPI.getAll({ page: 1, limit: 500 }),
        servicesAPI.getAll({ page: 1, limit: 500 }),
      ]);
      setNewsList(newsRes.data?.items || []);
      setPlacesList(placesRes.data?.items || []);
      setRoutesList(routesRes.data?.items || []);
      setServicesList(servicesRes.data?.items || []);
    } catch (e) {
      console.error('Ошибка загрузки списков:', e);
    }
  }, []);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  useEffect(() => {
    if (storedType) setLinkType(storedType);
    if (storedValue !== undefined) setLinkValue(storedValue);
    if (storedType === 'external') {
      setExternalText(text);
      setExternalUrl(url);
    }
  }, [storedType, storedValue, text, url]);

  const applyChange = useCallback((type, val, resolvedText, resolvedUrl) => {
    onChange({
      text: resolvedText,
      url: resolvedUrl,
      linkType: type,
      linkValue: val,
    });
  }, [onChange]);

  const handleTypeChange = (e) => {
    const type = e.target.value;
    setLinkType(type);
    setLinkValue('');
    if (type === 'static') {
      applyChange(type, '/', 'Главная', '/');
    } else if (type === 'external') {
      setExternalText(text || '');
      setExternalUrl(url || '');
      applyChange(type, '', text || '', url || '');
    } else {
      applyChange(type, '', '', '');
    }
  };

  const handleStaticSelect = (e) => {
    const val = e.target.value;
    const opt = STATIC_OPTIONS.find((o) => o.value === val);
    setLinkValue(val);
    applyChange('static', val, opt?.label || val, val);
  };

  const handleNewsSelect = (e) => {
    const id = e.target.value;
    const item = newsList.find((n) => n.id === id);
    if (item) {
      setLinkValue(id);
      const title = truncateTitle(item.title);
      const slug = item.slug || id;
      applyChange('news', id, title, `/news/${slug}`);
    }
  };

  const handlePlaceSelect = (e) => {
    const id = e.target.value;
    const item = placesList.find((p) => p.id === id);
    if (item) {
      setLinkValue(id);
      const title = truncateTitle(item.title);
      const slug = item.slug || id;
      applyChange('place', id, title, `/places/${slug}`);
    }
  };

  const handleRouteSelect = (e) => {
    const id = e.target.value;
    const item = routesList.find((r) => r.id === id);
    if (item) {
      setLinkValue(id);
      const title = truncateTitle(item.title);
      const slug = item.slug || id;
      applyChange('route', id, title, `/routes/${slug}`);
    }
  };

  const handleServiceSelect = (e) => {
    const id = e.target.value;
    const item = servicesList.find((s) => s.id === id);
    if (item) {
      setLinkValue(id);
      const title = truncateTitle(item.title);
      const slug = item.slug || id;
      applyChange('service', id, title, `/services/${slug}`);
    }
  };

  const handleExternalChange = (field, val) => {
    if (field === 'text') {
      setExternalText(val);
      applyChange('external', '', val, externalUrl);
    } else {
      setExternalUrl(val);
      applyChange('external', '', externalText, val);
    }
  };

  const currentStatic = STATIC_OPTIONS.find((o) => o.value === (linkType === 'static' ? linkValue : url))?.value || linkValue || '/';
  const currentNews = linkType === 'news' ? linkValue : '';
  const currentPlace = linkType === 'place' ? linkValue : '';
  const currentRoute = linkType === 'route' ? linkValue : '';
  const currentService = linkType === 'service' ? linkValue : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={linkType} onChange={handleTypeChange} className={styles.formSelect} style={{ minWidth: 160 }}>
          {LINK_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        {linkType === 'static' && (
          <select value={currentStatic} onChange={handleStaticSelect} className={styles.formSelect} style={{ minWidth: 180 }}>
            {STATIC_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}

        {linkType === 'news' && (
          <select value={currentNews} onChange={handleNewsSelect} className={styles.formSelect} style={{ minWidth: 220, maxWidth: 320 }}>
            <option value="">— Выберите новость —</option>
            {newsList.map((n) => (
              <option key={n.id} value={n.id}>{truncateTitle(n.title)}</option>
            ))}
          </select>
        )}

        {linkType === 'place' && (
          <select value={currentPlace} onChange={handlePlaceSelect} className={styles.formSelect} style={{ minWidth: 220, maxWidth: 320 }}>
            <option value="">— Выберите место —</option>
            {placesList.map((p) => (
              <option key={p.id} value={p.id}>{truncateTitle(p.title)}</option>
            ))}
          </select>
        )}

        {linkType === 'route' && (
          <select value={currentRoute} onChange={handleRouteSelect} className={styles.formSelect} style={{ minWidth: 220, maxWidth: 320 }}>
            <option value="">— Выберите маршрут —</option>
            {routesList.map((r) => (
              <option key={r.id} value={r.id}>{truncateTitle(r.title)}</option>
            ))}
          </select>
        )}

        {linkType === 'service' && (
          <select value={currentService} onChange={handleServiceSelect} className={styles.formSelect} style={{ minWidth: 220, maxWidth: 320 }}>
            <option value="">— Выберите услугу —</option>
            {servicesList.map((s) => (
              <option key={s.id} value={s.id}>{truncateTitle(s.title)}</option>
            ))}
          </select>
        )}

        {linkType === 'external' && (
          <>
            <input
              type="text"
              value={externalText}
              onChange={(e) => handleExternalChange('text', e.target.value)}
              className={styles.formInput}
              placeholder="Текст ссылки"
              style={{ minWidth: 140, flex: 1 }}
            />
            <input
              type="text"
              value={externalUrl}
              onChange={(e) => handleExternalChange('url', e.target.value)}
              className={styles.formInput}
              placeholder="URL (https://...)"
              style={{ minWidth: 160 }}
            />
          </>
        )}
      </div>
      {(text || url) && linkType !== 'external' && (
        <div style={{ fontSize: 12, color: '#6b7280' }}>
          Отображается: «{text}» → {url}
        </div>
      )}
    </div>
  );
}
