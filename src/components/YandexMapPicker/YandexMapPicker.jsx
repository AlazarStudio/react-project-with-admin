'use client';

import { useEffect, useRef, useState } from 'react';

const DEFAULT_CENTER = [43.5, 41.7]; // КЧР
const DEFAULT_ZOOM = 12;
const SCRIPT_ID = 'yandex-maps-script-2-1';
const GEOCODE_DEBOUNCE_MS = 800;

// КЧР — общее для всего сайта, в локацию нужен город или район внутри КЧР
const KCHR_NAMES = /карачаево-черкесск|кчр|карачаево-черкесия|республика$/i;
function getLocationInKchr(first) {
  const locality = first.getLocalities && first.getLocalities();
  if (locality && locality.length && locality[0]) return locality[0];
  const areas = first.getAdministrativeAreas && first.getAdministrativeAreas();
  if (!areas || !areas.length) return typeof first.getAddressLine === 'function' ? first.getAddressLine() : '';
  const notRepublic = areas.filter((a) => a && !KCHR_NAMES.test(a.trim()));
  return notRepublic.length ? notRepublic[0] : '';
}

/**
 * @param {Object} props
 * @param {number|null} props.latitude
 * @param {number|null} props.longitude
 * @param {string} props.geocodeQuery - запрос для поиска на карте (название места или пусто при режиме координат)
 * @param {number} [props.geocodeTrigger] - при изменении принудительно геокодирует geocodeQuery
 * @param {function} props.onCoordinatesChange
 * @param {function} [props.onLocationChange] - вызывается только при явном determineLocationTrigger
 * @param {number} [props.determineLocationTrigger] - при изменении определяет локацию и вызывает onLocationChange
 * @param {'name'|'coordinates'} [props.determineLocationBy='name'] - по названию (geocodeQuery) или по координатам (reverse geocode)
 */
export default function YandexMapPicker({ latitude, longitude, geocodeQuery, geocodeTrigger, onCoordinatesChange, onLocationChange, determineLocationTrigger, determineLocationBy = 'name', visible = true, height = 500 }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const placemarkRef = useRef(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [error, setError] = useState(null);
  const geocodeDebounceRef = useRef(null);
  const isFirstGeocodeRunRef = useRef(true);
  const onCoordinatesChangeRef = useRef(onCoordinatesChange);
  const onLocationChangeRef = useRef(onLocationChange);
  onCoordinatesChangeRef.current = onCoordinatesChange;
  onLocationChangeRef.current = onLocationChange;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const apiKey = import.meta.env.VITE_YANDEX_MAPS_API_KEY || '';
    const lang = 'ru_RU';

    if (window.ymaps && window.ymaps.ready) {
      setScriptReady(true);
      return;
    }

    if (document.getElementById(SCRIPT_ID)) {
      if (window.ymaps) setScriptReady(true);
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=${lang}`;
    script.async = true;
    script.onload = () => {
      window.ymaps.ready(() => setScriptReady(true));
    };
    script.onerror = () => setError('Не удалось загрузить Яндекс.Карты');
    document.head.appendChild(script);

    return () => {
      if (mapRef.current && mapRef.current.destroy) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
      placemarkRef.current = null;
      isFirstGeocodeRunRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (!visible || !scriptReady || !containerRef.current || !window.ymaps) return;

    const lat = latitude != null && Number(latitude) ? Number(latitude) : DEFAULT_CENTER[0];
    const lon = longitude != null && Number(longitude) ? Number(longitude) : DEFAULT_CENTER[1];
    const center = [lat, lon];

    const map = new window.ymaps.Map(containerRef.current, {
      center,
      zoom: DEFAULT_ZOOM,
      controls: ['zoomControl', 'typeSelector', 'fullscreenControl'],
    });
    mapRef.current = map;

    const placemark = new window.ymaps.Placemark(
      center,
      { balloonContent: 'Перетащите маркер на место' },
      { draggable: true }
    );

    placemark.events.add('dragend', () => {
      const coords = placemark.geometry.getCoordinates();
      const cb = onCoordinatesChangeRef.current;
      if (cb) cb(coords[0], coords[1]);
    });

    map.geoObjects.add(placemark);
    placemarkRef.current = placemark;

    return () => {
      if (mapRef.current && mapRef.current.destroy) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
      placemarkRef.current = null;
    };
  }, [scriptReady, visible]);

  // при смене latitude/longitude извне — перемещаем маркер и центр карты (если карта уже создана)
  useEffect(() => {
    if (!visible || !scriptReady || !mapRef.current || !placemarkRef.current) return;
    const lat = latitude != null && Number(latitude) ? Number(latitude) : null;
    const lon = longitude != null && Number(longitude) ? Number(longitude) : null;
    if (lat == null || lon == null) return;
    const coords = [lat, lon];
    placemarkRef.current.geometry.setCoordinates(coords);
    mapRef.current.setCenter(coords);
  }, [visible, scriptReady, latitude, longitude]);

  // Геокодирование при изменении запроса — только обновляет координаты на карте, локацию НЕ подставляет
  useEffect(() => {
    if (!scriptReady || !window.ymaps) return;

    const query = (geocodeQuery || '').trim();
    if (!query) return;

    if (isFirstGeocodeRunRef.current) {
      isFirstGeocodeRunRef.current = false;
      return;
    }

    if (geocodeDebounceRef.current) clearTimeout(geocodeDebounceRef.current);
    geocodeDebounceRef.current = setTimeout(() => {
      geocodeDebounceRef.current = null;
      window.ymaps.geocode(query).then((res) => {
        const first = res.geoObjects.get(0);
        if (!first) return;
        const coords = first.geometry.getCoordinates();
        const coordCb = onCoordinatesChangeRef.current;
        if (coordCb) coordCb(coords[0], coords[1]);
        // Локацию не подставляем — только по кнопке «Определить локацию»
      }).catch(() => {});
    }, GEOCODE_DEBOUNCE_MS);

    return () => {
      if (geocodeDebounceRef.current) clearTimeout(geocodeDebounceRef.current);
    };
  }, [scriptReady, geocodeQuery]);

  // По кнопке «Найти» — принудительно геокодируем запрос (только координаты)
  const prevGeocodeTriggerRef = useRef(geocodeTrigger);
  useEffect(() => {
    const query = (geocodeQuery || '').trim();
    if (!query || !scriptReady || !window.ymaps || geocodeTrigger == null || geocodeTrigger === prevGeocodeTriggerRef.current) return;
    prevGeocodeTriggerRef.current = geocodeTrigger;
    window.ymaps.geocode(query).then((res) => {
      const first = res.geoObjects.get(0);
      if (!first) return;
      const coords = first.geometry.getCoordinates();
      const coordCb = onCoordinatesChangeRef.current;
      if (coordCb) coordCb(coords[0], coords[1]);
    }).catch(() => {});
  }, [scriptReady, geocodeQuery, geocodeTrigger]);

  // По кнопке «Определить локацию» — геокодируем по названию или обратное геокодирование по координатам
  const prevDetermineLocationRef = useRef(determineLocationTrigger);
  useEffect(() => {
    if (!scriptReady || !window.ymaps || determineLocationTrigger == null || determineLocationTrigger === prevDetermineLocationRef.current) return;
    prevDetermineLocationRef.current = determineLocationTrigger;
    const locationCb = onLocationChangeRef.current;
    if (!locationCb) return;

    if (determineLocationBy === 'name') {
      const query = (geocodeQuery || '').trim();
      if (!query) return;
      window.ymaps.geocode(query).then((res) => {
        const first = res.geoObjects.get(0);
        if (!first) return;
        const shortLocation = getLocationInKchr(first);
        if (shortLocation) locationCb(shortLocation);
      }).catch(() => {});
    } else {
      const lat = latitude != null && Number(latitude) ? Number(latitude) : null;
      const lon = longitude != null && Number(longitude) ? Number(longitude) : null;
      if (lat == null || lon == null) return;
      window.ymaps.geocode([lat, lon]).then((res) => {
        const first = res.geoObjects.get(0);
        if (!first) return;
        const shortLocation = getLocationInKchr(first);
        if (shortLocation) locationCb(shortLocation);
      }).catch(() => {});
    }
  }, [scriptReady, determineLocationTrigger, determineLocationBy, geocodeQuery, latitude, longitude]);

  if (!visible) return null;

  if (error) {
    return (
      <div style={{ height, background: '#f1f5f9', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
        {error}. Укажите VITE_YANDEX_MAPS_API_KEY.
      </div>
    );
  }

  if (!scriptReady) {
    return (
      <div style={{ height, background: '#f1f5f9', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
        Загрузка карты...
      </div>
    );
  }

  return <div ref={containerRef} style={{ width: '100%', height, borderRadius: 8, overflow: 'hidden' }} />;
}
