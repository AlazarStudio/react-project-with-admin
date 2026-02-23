'use client';

import { useState, useEffect, useCallback, useContext, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Upload, X, MapPin, GripVertical, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Eye, EyeOff, Plus, Search } from 'lucide-react';
import { routesAPI, placesAPI, servicesAPI, mediaAPI, routeFiltersAPI, getImageUrl } from '@/lib/api';
import RichTextEditor from '@/components/RichTextEditor';
import YandexMapRoute from '@/components/YandexMapRoute';
import ConfirmModal from '../../components/ConfirmModal';
import SaveProgressModal from '../../components/SaveProgressModal';
import { AdminHeaderRightContext, AdminBreadcrumbContext } from '../../layout';
import { MUI_ICON_NAMES, MUI_ICONS, getMuiIconComponent, getIconGroups } from '../../components/WhatToBringIcons';
import styles from '../../admin.module.css';

const TOAST_DURATION_MS = 3000;

// Предзаполненные пункты "Что взять с собой" для часто используемых вещей
const COMMON_WHAT_TO_BRING_ITEMS = [
  { iconType: 'mui', icon: 'Backpack', text: 'Рюкзак' },
  { iconType: 'mui', icon: 'WaterDrop', text: 'Вода' },
  { iconType: 'mui', icon: 'Utensils', text: 'Еда' },
  { iconType: 'mui', icon: 'Sun', text: 'Солнцезащитный крем' },
  { iconType: 'mui', icon: 'Flashlight', text: 'Фонарик' },
  { iconType: 'mui', icon: 'Phone', text: 'Телефон' },
  { iconType: 'mui', icon: 'Battery', text: 'Power Bank' },
  { iconType: 'mui', icon: 'Map', text: 'Карта' },
  { iconType: 'mui', icon: 'Bandage', text: 'Аптечка' },
  { iconType: 'mui', icon: 'Flame', text: 'Спички/зажигалка' },
  { iconType: 'mui', icon: 'Umbrella', text: 'Дождевик' },
  { iconType: 'mui', icon: 'Shirt', text: 'Теплая одежда' },
];

// Маппинг текста на иконки для автоматического подбора
const TEXT_TO_ICON_MAP = {
  'рюкзак': 'Backpack',
  'вода': 'Droplet',
  'еда': 'Utensils',
  'солнцезащитный': 'Sun',
  'крем': 'Sun',
  'фонарик': 'Flashlight',
  'телефон': 'Phone',
  'power bank': 'Battery',
  'powerbank': 'Battery',
  'карта': 'Map',
  'аптечка': 'Bandage',
  'спички': 'Flame',
  'зажигалка': 'Flame',
  'дождевик': 'Umbrella',
  'одежда': 'Shirt',
  'теплая': 'Shirt',
};

/**
 * Автоматически подбирает иконку для текста на основе ключевых слов
 */
function findIconForText(text) {
  if (!text || typeof text !== 'string') return null;
  const lowerText = text.toLowerCase().trim();
  
  // Сначала проверяем точные совпадения
  for (const [key, icon] of Object.entries(TEXT_TO_ICON_MAP)) {
    if (lowerText.includes(key)) {
      return icon;
    }
  }
  
  // Затем проверяем по ключевым словам в названиях иконок
  const keywords = [
    { words: ['рюкзак', 'backpack'], icon: 'Backpack' },
    { words: ['вода', 'water', 'droplet'], icon: 'Droplet' },
    { words: ['еда', 'food', 'utensils', 'restaurant'], icon: 'Utensils' },
    { words: ['солнце', 'sun', 'sunscreen'], icon: 'Sun' },
    { words: ['фонарик', 'flashlight', 'torch'], icon: 'Flashlight' },
    { words: ['телефон', 'phone', 'smartphone'], icon: 'Phone' },
    { words: ['батарея', 'battery', 'power'], icon: 'Battery' },
    { words: ['карта', 'map'], icon: 'Map' },
    { words: ['аптечка', 'firstaid', 'medical', 'health'], icon: 'Bandage' },
    { words: ['спички', 'зажигалка', 'flame', 'fire', 'lighter'], icon: 'Flame' },
    { words: ['дождевик', 'umbrella', 'rain'], icon: 'Umbrella' },
    { words: ['одежда', 'shirt', 'clothing', 'warm'], icon: 'Shirt' },
  ];
  
  for (const { words, icon } of keywords) {
    if (words.some(word => lowerText.includes(word))) {
      return icon;
    }
  }
  
  return null;
}

const FIXED_GROUPS_CONFIG = [
  { key: 'seasons', label: 'Сезон', optionsKey: 'seasons' },
  { key: 'transport', label: 'Способ передвижения', optionsKey: 'transport' },
  { key: 'durationOptions', label: 'Время прохождения', optionsKey: 'durationOptions' },
  { key: 'difficultyLevels', label: 'Сложность', optionsKey: 'difficultyLevels' },
  { key: 'distanceOptions', label: 'Расстояние', optionsKey: 'distanceOptions' },
  { key: 'elevationOptions', label: 'Перепад высот', optionsKey: 'elevationOptions' },
  { key: 'isFamilyOptions', label: 'Семейный маршрут', optionsKey: 'isFamilyOptions' },
  { key: 'hasOvernightOptions', label: 'С ночевкой', optionsKey: 'hasOvernightOptions' },
];

function getAvailableGroups(filterOptions) {
  const list = [];
  FIXED_GROUPS_CONFIG.forEach(({ key, label, optionsKey }) => {
    const values = Array.isArray(filterOptions[optionsKey]) ? filterOptions[optionsKey] : [];
    if (values.length > 0) {
      list.push({ key, label, values, type: 'single' });
    } else {
      list.push({ key, label, values: [], type: 'input' });
    }
  });
  (filterOptions.extraGroups || []).forEach((g) => {
    if (!g?.key) return;
    const values = g.values || [];
    const item = { key: g.key, label: g.label || g.key, icon: g.icon || null, iconType: g.iconType || null };
    if (values.length > 0) {
      list.push({ ...item, values, type: 'multi' });
    } else {
      list.push({ ...item, values: [], type: 'input' });
    }
  });
  return list;
}

function getGroupByKey(filterOptions, groupKey) {
  return getAvailableGroups(filterOptions).find((g) => g.key === groupKey) || null;
}

function deriveAddedFilterGroups(formData, filterOptions) {
  const keys = [];
  const has = (key) => {
    const arr = formData.customFilters?.[key];
    return Array.isArray(arr) ? arr.length > 0 : (arr != null && arr !== '');
  };
  if (has('seasons') || formData.season) keys.push('seasons');
  if (has('transport') || formData.transport) keys.push('transport');
  if (has('durationOptions') || formData.duration) keys.push('durationOptions');
  if (has('difficultyLevels') || (formData.difficulty != null && formData.difficulty !== '')) keys.push('difficultyLevels');
  if (has('distanceOptions') || formData.customFilters?.distance) keys.push('distanceOptions');
  if (has('elevationOptions') || formData.customFilters?.elevationGain) keys.push('elevationOptions');
  if (has('isFamilyOptions') || formData.isFamily) keys.push('isFamilyOptions');
  if (has('hasOvernightOptions') || formData.hasOvernight) keys.push('hasOvernightOptions');
  (filterOptions.extraGroups || []).forEach((g) => {
    if (has(g.key)) keys.push(g.key);
  });
  return keys;
}

function clearFilter(formData, groupKey) {
  const cf = { ...formData.customFilters };
  delete cf[groupKey];
  if (groupKey === 'distanceOptions') delete cf.distance;
  if (groupKey === 'elevationOptions') delete cf.elevationGain;
  return { ...formData, customFilters: cf };
}

function applyFilter(formData, groupKey, valueOrValues, groupType) {
  if (groupType === 'multi') {
    return { ...formData, customFilters: { ...formData.customFilters, [groupKey]: valueOrValues } };
  }
  if (groupType === 'input') {
    const cf = { ...formData.customFilters };
    if (groupKey === 'distanceOptions') cf.distance = valueOrValues;
    else if (groupKey === 'elevationOptions') cf.elevationGain = valueOrValues;
    else cf[groupKey] = valueOrValues;
    return { ...formData, customFilters: cf };
  }
  if (groupKey === 'seasons') return { ...formData, customFilters: { ...formData.customFilters, seasons: valueOrValues } };
  if (groupKey === 'transport') return { ...formData, customFilters: { ...formData.customFilters, transport: valueOrValues } };
  if (groupKey === 'durationOptions') return { ...formData, customFilters: { ...formData.customFilters, durationOptions: valueOrValues } };
  if (groupKey === 'difficultyLevels') return { ...formData, customFilters: { ...formData.customFilters, difficultyLevels: valueOrValues } };
  if (groupKey === 'distanceOptions') return { ...formData, customFilters: { ...formData.customFilters, distanceOptions: valueOrValues } };
  if (groupKey === 'elevationOptions') return { ...formData, customFilters: { ...formData.customFilters, elevationOptions: valueOrValues } };
  if (groupKey === 'isFamilyOptions') return { ...formData, customFilters: { ...formData.customFilters, isFamilyOptions: valueOrValues } };
  if (groupKey === 'hasOvernightOptions') return { ...formData, customFilters: { ...formData.customFilters, hasOvernightOptions: valueOrValues } };
  return { ...formData, customFilters: { ...formData.customFilters, [groupKey]: valueOrValues } };
}

function getCurrentValueForGroup(formData, groupKey, groupType) {
  if (groupType === 'input') {
    if (groupKey === 'distanceOptions') return formData.customFilters?.distance ?? '';
    if (groupKey === 'elevationOptions') return formData.customFilters?.elevationGain ?? '';
    const v = formData.customFilters?.[groupKey];
    return Array.isArray(v) ? (v[0] ?? '') : (typeof v === 'string' ? v : '');
  }
  if (groupType === 'multi' || groupKey === 'seasons' || groupKey === 'transport' || groupKey === 'durationOptions' || groupKey === 'difficultyLevels' || groupKey === 'distanceOptions' || groupKey === 'elevationOptions' || groupKey === 'isFamilyOptions' || groupKey === 'hasOvernightOptions') {
    const arr = formData.customFilters?.[groupKey];
    if (Array.isArray(arr)) return arr;
    if (groupKey === 'seasons' && formData.season) return [formData.season];
    if (groupKey === 'transport' && formData.transport) return [formData.transport];
    if (groupKey === 'durationOptions' && formData.duration) return [formData.duration];
    if (groupKey === 'difficultyLevels' && formData.difficulty != null) return [String(formData.difficulty)];
    if (groupKey === 'distanceOptions' && formData.customFilters?.distance) return [formData.customFilters.distance];
    if (groupKey === 'elevationOptions' && formData.customFilters?.elevationGain) return [formData.customFilters.elevationGain];
    if (groupKey === 'isFamilyOptions' && formData.isFamily) return ['Да'];
    if (groupKey === 'hasOvernightOptions' && formData.hasOvernight) return ['Да'];
    return [];
  }
  return formData.customFilters?.[groupKey] || [];
}

/** Парсит whatToBring (JSON-строка массива { iconType, icon, text }) в массив объектов для формы. */
function parseWhatToBring(str) {
  if (!str || typeof str !== 'string') return [];
  try {
    const parsed = JSON.parse(str);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((i) => ({
      iconType: i?.iconType ?? 'mui',
      icon: i?.icon ?? '',
      text: i?.text ?? '',
    }));
  } catch {
    return [];
  }
}

/** Значение сложности из customFilters: массив [0] или строка (например "1" или "1/10"). */
function getDifficultyFromFilters(cf) {
  const v = cf?.difficultyLevels;
  if (Array.isArray(v) && v[0] != null) return v[0];
  if (typeof v === 'string' && v.trim() !== '') return v.trim();
  return null;
}

function getFormSnapshot(data) {
  const cf = data.customFilters && typeof data.customFilters === 'object' ? data.customFilters : {};
  const first = (key) => (Array.isArray(cf[key]) ? cf[key][0] : null);
  const difficultyRaw = getDifficultyFromFilters(cf) ?? data.difficulty;
  const points = Array.isArray(data.points)
    ? data.points.map((p) => ({ title: p.title ?? '', description: p.description ?? '' }))
    : [];
  return {
    title: data.title ?? '',
    description: data.description ?? '',
    shortDescription: data.shortDescription ?? '',
    season: first('seasons') ?? data.season ?? '',
    duration: first('durationOptions') ?? data.duration ?? '',
    difficulty: (() => { const n = parseInt(difficultyRaw, 10); return Number.isFinite(n) ? n : 3; })(),
    transport: first('transport') ?? data.transport ?? '',
    customFilters: cf,
    isFamily: (Array.isArray(cf.isFamilyOptions) ? cf.isFamilyOptions : []).includes('Да') || !!data.isFamily,
    hasOvernight: (Array.isArray(cf.hasOvernightOptions) ? cf.hasOvernightOptions : []).includes('Да') || !!data.hasOvernight,
    whatToBring: data.whatToBring ?? '',
    whatToBringItems: Array.isArray(data.whatToBringItems)
      ? data.whatToBringItems.map((i) => ({ iconType: i.iconType ?? 'mui', icon: i.icon ?? '', text: i.text ?? '' }))
      : parseWhatToBring(data.whatToBring ?? ''),
    importantInfo: data.importantInfo ?? '',
    isActive: !!data.isActive,
    images: Array.isArray(data.images) ? [...data.images] : [],
    placeIds: Array.isArray(data.placeIds) ? [...data.placeIds] : [],
    nearbyPlaceIds: Array.isArray(data.nearbyPlaceIds) ? [...data.nearbyPlaceIds] : [],
    guideIds: Array.isArray(data.guideIds) ? [...data.guideIds] : [],
    similarRouteIds: Array.isArray(data.similarRouteIds) ? [...data.similarRouteIds] : [],
    points,
  };
}

function formSnapshotsEqual(a, b) {
  return JSON.stringify(getFormSnapshot(a)) === JSON.stringify(getFormSnapshot(b));
}

export default function RouteEditPage() {
  const navigate = useNavigate();
  const params = useParams();
  const isNew = params.id === 'new';
  const setHeaderRight = useContext(AdminHeaderRightContext)?.setHeaderRight;
  const setBreadcrumbLabel = useContext(AdminBreadcrumbContext)?.setBreadcrumbLabel;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    shortDescription: '',
    season: '',
    duration: '',
    difficulty: 3,
    transport: '',
    customFilters: {},
    isFamily: false,
    hasOvernight: false,
    whatToBring: '',
    whatToBringItems: [],
    importantInfo: '',
    isActive: true,
    images: [],
    placeIds: [],
    nearbyPlaceIds: [],
    guideIds: [],
    similarRouteIds: [],
    points: [],
  });
  const [activePointIndex, setActivePointIndex] = useState(0);

  const [allPlaces, setAllPlaces] = useState([]);
  const [allGuides, setAllGuides] = useState([]);
  const [allRoutes, setAllRoutes] = useState([]);
  const [filterOptions, setFilterOptions] = useState({
    seasons: [],
    transport: [],
    durationOptions: [],
    difficultyLevels: [],
    distanceOptions: [],
    elevationOptions: [],
    isFamilyOptions: [],
    hasOvernightOptions: [],
    extraGroups: [],
  });
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [placesSearch, setPlacesSearch] = useState('');
  const [guidesSearch, setGuidesSearch] = useState('');
  const [addNearbyPlacesModalOpen, setAddNearbyPlacesModalOpen] = useState(false);
  const [addNearbyPlacesSearch, setAddNearbyPlacesSearch] = useState('');
  const [addNearbyPlacesSelected, setAddNearbyPlacesSelected] = useState(new Set());
  const [addSimilarRoutesModalOpen, setAddSimilarRoutesModalOpen] = useState(false);
  const [addSimilarRoutesSearch, setAddSimilarRoutesSearch] = useState('');
  const [addSimilarRoutesSelected, setAddSimilarRoutesSelected] = useState(new Set());
  const [showToast, setShowToast] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [addFilterModalOpen, setAddFilterModalOpen] = useState(false);
  const [addFilterSelectedGroups, setAddFilterSelectedGroups] = useState([]);
  const [addedFilterGroups, setAddedFilterGroups] = useState([]);
  const [whatToBringIconPickerIndex, setWhatToBringIconPickerIndex] = useState(null);
  const [whatToBringIconGroup, setWhatToBringIconGroup] = useState('all');
  const [whatToBringIconSearch, setWhatToBringIconSearch] = useState('');
  const [addExistingItemsModalOpen, setAddExistingItemsModalOpen] = useState(false);
  const [addExistingItemsSelected, setAddExistingItemsSelected] = useState(new Set());
  const [addExistingItemsSearch, setAddExistingItemsSearch] = useState('');
  const [pendingGallery, setPendingGallery] = useState([]);
  const [saveProgress, setSaveProgress] = useState({ open: false, steps: [], totalProgress: 0 });
  const pendingGalleryRef = useRef([]);
  pendingGalleryRef.current = pendingGallery;
  const savedFormDataRef = useRef(null);
  /** Снимок формы на момент последнего сохранения — для точного сравнения isDirty. */
  const savedSnapshotRef = useRef(null);

  const allGalleryItems = useMemo(() => [
    ...(formData.images || []).map((url) => ({ type: 'saved', url })),
    ...pendingGallery.map((p) => ({ type: 'pending', file: p.file, preview: p.preview })),
  ], [formData.images, pendingGallery]);

  const isDirty = useMemo(() => {
    if (isNew) return pendingGallery.length > 0;
    if (savedSnapshotRef.current == null) return pendingGallery.length > 0;
    return JSON.stringify(getFormSnapshot(formData)) !== JSON.stringify(savedSnapshotRef.current) || pendingGallery.length > 0;
  }, [isNew, formData, pendingGallery.length]);

  const navigateToList = useCallback(() => {
    // Проверяем, есть ли сохраненная страница для возврата
    const savedReturnPage = localStorage.getItem('admin_routes_return_page');
    if (savedReturnPage) {
      const savedPage = parseInt(savedReturnPage, 10);
      if (savedPage > 0) {
        navigate(`/admin/routes?page=${savedPage}`);
        localStorage.removeItem('admin_routes_return_page');
        return;
      }
    }
    navigate('/admin/routes');
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

  useEffect(() => {
    if (!isNew) {
      fetchRoute();
    }
  }, [params.id]);

  useEffect(() => {
    if (whatToBringIconPickerIndex !== null) setWhatToBringIconSearch('');
  }, [whatToBringIconPickerIndex]);

  const fetchPlaces = useCallback(async () => {
    try {
      const response = await placesAPI.getAll({ limit: 500 });
      setAllPlaces(response.data.items || []);
    } catch (error) {
      console.error('Ошибка загрузки мест:', error);
    }
  }, []);

  const fetchGuides = useCallback(async () => {
    try {
      const response = await servicesAPI.getAll({ limit: 500 });
      const items = response.data.items || [];
      setAllGuides(items.filter((s) => (s.category || '').toLowerCase() === 'гид'));
    } catch (error) {
      console.error('Ошибка загрузки гидов:', error);
    }
  }, []);

  const fetchRoutes = useCallback(async () => {
    try {
      const response = await routesAPI.getAll({ limit: 500 });
      setAllRoutes(response.data.items || []);
    } catch (error) {
      console.error('Ошибка загрузки маршрутов:', error);
    }
  }, []);

  const fetchFilterOptions = useCallback(async () => {
    try {
      const res = await routeFiltersAPI.get();
      const d = res.data || {};
      const extra = Array.isArray(d.extraGroups) ? d.extraGroups : [];
      setFilterOptions({
        seasons: Array.isArray(d.seasons) ? d.seasons : [],
        transport: Array.isArray(d.transport) ? d.transport : [],
        durationOptions: Array.isArray(d.durationOptions) ? d.durationOptions : [],
        difficultyLevels: Array.isArray(d.difficultyLevels) ? d.difficultyLevels : [],
        distanceOptions: Array.isArray(d.distanceOptions) ? d.distanceOptions : [],
        elevationOptions: Array.isArray(d.elevationOptions) ? d.elevationOptions : [],
        isFamilyOptions: Array.isArray(d.isFamilyOptions) ? d.isFamilyOptions : [],
        hasOvernightOptions: Array.isArray(d.hasOvernightOptions) ? d.hasOvernightOptions : [],
        extraGroups: extra.filter((g) => g && typeof g.key === 'string' && g.key.trim()),
      });
    } catch (e) {
      console.error('Ошибка загрузки опций фильтров маршрутов:', e);
    }
  }, []);

  useEffect(() => {
    fetchPlaces();
    fetchGuides();
    fetchRoutes();
    fetchFilterOptions();
  }, [fetchPlaces, fetchGuides, fetchRoutes, fetchFilterOptions]);

  useEffect(() => {
    if (isNew) return;
    if (!savedFormDataRef.current) return;
    setAddedFilterGroups((prev) => [...new Set([...deriveAddedFilterGroups(savedFormDataRef.current, filterOptions), ...prev])]);
  }, [isNew, filterOptions]);

  const fetchRoute = async () => {
    try {
      const response = await routesAPI.getById(params.id);
      const raw = response.data.customFilters && typeof response.data.customFilters === 'object' ? response.data.customFilters : {};
      const r = response.data;
      // Единый источник: плоские поля маршрута (difficulty, distance, elevationGain). customFilters заполняем из них для отображения в форме.
      const customFilters = {
        ...raw,
        seasons: Array.isArray(raw.seasons) ? raw.seasons : (r.season ? [r.season] : []),
        transport: Array.isArray(raw.transport) ? raw.transport : (r.transport ? [r.transport] : []),
        durationOptions: Array.isArray(raw.durationOptions) ? raw.durationOptions : (r.duration ? [r.duration] : []),
        difficultyLevels: Array.isArray(raw.difficultyLevels) ? raw.difficultyLevels : (r.difficulty != null ? [String(r.difficulty)] : []),
        distanceOptions: Array.isArray(raw.distanceOptions) ? raw.distanceOptions : (r.distance != null && r.distance !== '' ? [r.distance] : []),
        elevationOptions: Array.isArray(raw.elevationOptions) ? raw.elevationOptions : (r.elevationGain != null && r.elevationGain !== '' ? [r.elevationGain] : []),
        isFamilyOptions: Array.isArray(raw.isFamilyOptions) ? raw.isFamilyOptions : (r.isFamily ? ['Да'] : []),
        hasOvernightOptions: Array.isArray(raw.hasOvernightOptions) ? raw.hasOvernightOptions : (r.hasOvernight ? ['Да'] : []),
        distance: r.distance != null && r.distance !== '' ? (typeof r.distance === 'number' ? `${r.distance} км` : String(r.distance)) : (raw.distance ?? ''),
        elevationGain: r.elevationGain != null && r.elevationGain !== '' ? (typeof r.elevationGain === 'number' ? `${r.elevationGain} м` : String(r.elevationGain)) : (raw.elevationGain ?? ''),
      };
      const points = Array.isArray(response.data.points)
        ? response.data.points
            .slice()
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((p) => ({ id: p.id, title: p.title ?? '', description: p.description ?? '', image: p.image ?? null, order: p.order ?? 0 }))
        : [];
      const whatToBringItems = parseWhatToBring(response.data.whatToBring ?? '');
      const next = {
        ...response.data,
        placeIds: response.data.placeIds || [],
        nearbyPlaceIds: response.data.nearbyPlaceIds || [],
        guideIds: response.data.guideIds || [],
        similarRouteIds: response.data.similarRouteIds || [],
        customFilters,
        points,
        whatToBringItems,
      };
      setFormData(next);
      savedFormDataRef.current = next;
      savedSnapshotRef.current = getFormSnapshot(next);
      setActivePointIndex(0);
    } catch (error) {
      console.error('Ошибка загрузки маршрута:', error);
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;
      setError(status === 404 ? 'Маршрут не найден' : message || 'Ошибка загрузки маршрута');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!setBreadcrumbLabel) return;
    const label = formData.title?.trim() || (isNew ? 'Новый маршрут' : '');
    setBreadcrumbLabel(label);
    return () => setBreadcrumbLabel(null);
  }, [setBreadcrumbLabel, formData.title, isNew]);

  useEffect(() => {
    if (!setHeaderRight) return;
    const submitLabel = isSaving
      ? 'Сохранение...'
      : isNew
        ? 'Создать маршрут'
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
          form="route-form"
          className={submitClassName}
          disabled={isSaving}
        >
          {submitLabel}
        </button>
      </div>
    );
    return () => setHeaderRight(null);
  }, [setHeaderRight, formData.isActive, isSaving, isNew, isDirty, handleCancelClick]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setPendingGallery((prev) => [...prev, ...files.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
  };

  const applyGalleryOrder = (items) => {
    const saved = items.filter((x) => x.type === 'saved').map((x) => x.url);
    const pending = items.filter((x) => x.type === 'pending').map((x) => ({ file: x.file, preview: x.preview }));
    setFormData((prev) => ({ ...prev, images: saved }));
    setPendingGallery(pending);
  };

  const removeGalleryItem = (index) => {
    const item = allGalleryItems[index];
    if (item?.type === 'pending' && item.preview) URL.revokeObjectURL(item.preview);
    const next = allGalleryItems.filter((_, i) => i !== index);
    applyGalleryOrder(next);
  };

  const setMainGalleryImage = (index) => {
    if (index === 0) return;
    const next = [...allGalleryItems];
    const [item] = next.splice(index, 1);
    next.unshift(item);
    applyGalleryOrder(next);
  };

  const moveGalleryItem = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= allGalleryItems.length) return;
    const next = [...allGalleryItems];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    applyGalleryOrder(next);
  };

  const [draggedImageIndex, setDraggedImageIndex] = useState(null);
  const [dragOverImageIndex, setDragOverImageIndex] = useState(null);

  const moveGalleryItemTo = (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    const next = [...allGalleryItems];
    const [item] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, item);
    applyGalleryOrder(next);
  };

  // Функции для работы с местами маршрута
  const addPlace = (placeId) => {
    if (!formData.placeIds.includes(placeId)) {
      setFormData((prev) => ({
        ...prev,
        placeIds: [...prev.placeIds, placeId],
      }));
    }
  };

  const removePlace = (placeId) => {
    setFormData((prev) => ({
      ...prev,
      placeIds: prev.placeIds.filter((id) => id !== placeId),
    }));
  };

  const movePlace = (index, direction) => {
    const newPlaceIds = [...formData.placeIds];
    const newIndex = index + direction;

    if (newIndex < 0 || newIndex >= newPlaceIds.length) return;

    [newPlaceIds[index], newPlaceIds[newIndex]] = [newPlaceIds[newIndex], newPlaceIds[index]];

    setFormData((prev) => ({
      ...prev,
      placeIds: newPlaceIds,
    }));
  };

  const movePlaceByDrag = (draggedIndex, targetIndex) => {
    if (draggedIndex === targetIndex) return;
    setFormData((prev) => {
      const ids = [...prev.placeIds];
      const [removed] = ids.splice(draggedIndex, 1);
      ids.splice(targetIndex, 0, removed);
      return { ...prev, placeIds: ids };
    });
  };

  const moveWhatToBringItem = (index, direction) => {
    const newItems = [...(formData.whatToBringItems ?? [])];
    const newIndex = index + direction;

    if (newIndex < 0 || newIndex >= newItems.length) return;

    [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];

    setFormData((prev) => ({
      ...prev,
      whatToBringItems: newItems,
    }));
  };

  const moveWhatToBringItemByDrag = (draggedIndex, targetIndex) => {
    if (draggedIndex === targetIndex) return;
    setFormData((prev) => {
      const items = [...(prev.whatToBringItems ?? [])];
      const [removed] = items.splice(draggedIndex, 1);
      items.splice(targetIndex, 0, removed);
      return { ...prev, whatToBringItems: items };
    });
  };

  const getPlaceById = (id) => allPlaces.find((p) => p.id === id);

  // Получаем все уникальные пункты "Что взять с собой" из всех маршрутов
  const allExistingItems = useMemo(() => {
    const itemsMap = new Map();
    allRoutes.forEach((route) => {
      if (!route.whatToBring) return;
      const items = parseWhatToBring(route.whatToBring);
      items.forEach((item) => {
        if (!item.text || !item.text.trim()) return;
        const key = item.text.toLowerCase().trim();
        // Если такого пункта еще нет или у текущего есть иконка, а у сохраненного нет
        if (!itemsMap.has(key) || (!itemsMap.get(key).icon && item.icon)) {
          let icon = item.icon || '';
          // Если иконка не указана или не существует, подбираем автоматически
          if (!icon || !getMuiIconComponent(icon)) {
            const autoIcon = findIconForText(item.text);
            if (autoIcon && getMuiIconComponent(autoIcon)) {
              icon = autoIcon;
            }
          }
          itemsMap.set(key, {
            iconType: item.iconType || 'mui',
            icon: icon,
            text: item.text.trim(),
          });
        }
      });
    });
    // Также добавляем часто используемые пункты
    COMMON_WHAT_TO_BRING_ITEMS.forEach((item) => {
      const key = item.text.toLowerCase().trim();
      if (!itemsMap.has(key)) {
        let icon = item.icon || '';
        if (!icon || !getMuiIconComponent(icon)) {
          const autoIcon = findIconForText(item.text);
          if (autoIcon && getMuiIconComponent(autoIcon)) {
            icon = autoIcon;
          }
        }
        itemsMap.set(key, {
          iconType: item.iconType || 'mui',
          icon: icon,
          text: item.text.trim(),
        });
      }
    });
    return Array.from(itemsMap.values()).sort((a, b) => a.text.localeCompare(b.text));
  }, [allRoutes]);

  const toggleAddExistingItemSelection = (itemKey) => {
    setAddExistingItemsSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemKey)) next.delete(itemKey);
      else next.add(itemKey);
      return next;
    });
  };

  const addSelectedExistingItems = () => {
    const existingTexts = new Set((formData.whatToBringItems ?? []).map((item) => item.text.toLowerCase().trim()));
    const itemsToAdd = allExistingItems
      .filter((item) => addExistingItemsSelected.has(item.text.toLowerCase().trim()))
      .filter((item) => !existingTexts.has(item.text.toLowerCase().trim()))
      .map((item) => ({
        iconType: item.iconType || 'mui',
        icon: item.icon || '',
        text: item.text,
      }));
    if (itemsToAdd.length > 0) {
      setFormData((prev) => ({
        ...prev,
        whatToBringItems: [...(prev.whatToBringItems ?? []), ...itemsToAdd],
      }));
    }
    setAddExistingItemsModalOpen(false);
    setAddExistingItemsSelected(new Set());
    setAddExistingItemsSearch('');
  };

  // Локации мест маршрута (для фильтра «места рядом с маршрутом»)
  const routeLocations = useMemo(() => {
    const locs = new Set();
    formData.placeIds.forEach((id) => {
      const place = getPlaceById(id);
      if (place?.location && String(place.location).trim()) {
        locs.add(String(place.location).trim().toLowerCase());
      }
    });
    return locs;
  }, [formData.placeIds, allPlaces]);

  const filteredPlaces = allPlaces.filter(
    (place) =>
      place.isActive !== false &&
      !formData.placeIds.includes(place.id) &&
      place.title.toLowerCase().includes(placesSearch.toLowerCase())
  );

  const addGuide = (guideId) => {
    if (!formData.guideIds.includes(guideId)) {
      setFormData((prev) => ({
        ...prev,
        guideIds: [...prev.guideIds, guideId],
      }));
    }
  };

  const removeGuide = (guideId) => {
    setFormData((prev) => ({
      ...prev,
      guideIds: prev.guideIds.filter((id) => id !== guideId),
    }));
  };

  const getGuideById = (id) => allGuides.find((g) => g.id === id);

  const filteredGuides = allGuides.filter(
    (guide) =>
      !formData.guideIds.includes(guide.id) &&
      (guide.title || '').toLowerCase().includes(guidesSearch.toLowerCase())
  );

  const removeNearbyPlace = (placeId) => {
    setFormData((prev) => ({
      ...prev,
      nearbyPlaceIds: (prev.nearbyPlaceIds || []).filter((id) => id !== placeId),
    }));
  };

  const openAddNearbyPlacesModal = () => {
    setAddNearbyPlacesSearch('');
    setAddNearbyPlacesSelected(new Set());
    setAddNearbyPlacesModalOpen(true);
  };

  const toggleAddNearbyPlaceSelection = (placeId) => {
    setAddNearbyPlacesSelected((prev) => {
      const next = new Set(prev);
      if (next.has(placeId)) next.delete(placeId);
      else next.add(placeId);
      return next;
    });
  };

  const addSelectedNearbyPlaces = () => {
    const ids = Array.from(addNearbyPlacesSelected);
    setFormData((prev) => ({
      ...prev,
      nearbyPlaceIds: [...new Set([...(prev.nearbyPlaceIds || []), ...ids])],
    }));
    setAddNearbyPlacesModalOpen(false);
  };

  const getRouteById = (id) => allRoutes.find((r) => r.id === id);

  // Похожесть маршрута = число общих мест с текущим маршрутом (для сортировки в модалке)
  const routesWithSimilarity = useMemo(() => {
    const currentPlaceSet = new Set(formData.placeIds || []);
    const excludeIds = new Set([...(formData.similarRouteIds || []), params.id].filter(Boolean));
    return allRoutes
      .filter((r) => r.id && !excludeIds.has(r.id))
      .map((r) => {
        const otherPlaceIds = Array.isArray(r.placeIds) ? r.placeIds : [];
        const sharedCount = otherPlaceIds.filter((id) => currentPlaceSet.has(id)).length;
        return { route: r, sharedPlaceCount: sharedCount };
      })
      .sort((a, b) => b.sharedPlaceCount - a.sharedPlaceCount);
  }, [allRoutes, formData.placeIds, formData.similarRouteIds, params.id]);

  const removeSimilarRoute = (routeId) => {
    setFormData((prev) => ({
      ...prev,
      similarRouteIds: (prev.similarRouteIds || []).filter((id) => id !== routeId),
    }));
  };

  const openAddSimilarRoutesModal = () => {
    setAddSimilarRoutesSearch('');
    setAddSimilarRoutesSelected(new Set());
    setAddSimilarRoutesModalOpen(true);
  };

  const toggleAddSimilarRouteSelection = (routeId) => {
    setAddSimilarRoutesSelected((prev) => {
      const next = new Set(prev);
      if (next.has(routeId)) next.delete(routeId);
      else next.add(routeId);
      return next;
    });
  };

  const addSelectedSimilarRoutes = () => {
    const ids = Array.from(addSimilarRoutesSelected);
    setFormData((prev) => ({
      ...prev,
      similarRouteIds: [...new Set([...(prev.similarRouteIds || []), ...ids])],
    }));
    setAddSimilarRoutesModalOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');

    let imagesToSend = Array.isArray(formData.images) ? [...formData.images] : [];
    const hadGalleryUpload = pendingGallery.length > 0;

    try {
      if (hadGalleryUpload) {
        const initialSteps = [
          { label: 'Загрузка фотогалереи', status: 'pending' },
          { label: 'Сохранение данных', status: 'pending' },
        ];
        const totalWeight = 2;
        setSaveProgress({ open: true, steps: initialSteps.map((s, i) => (i === 0 ? { ...s, status: 'active' } : s)), totalProgress: 0 });

        const pendingItems = allGalleryItems.filter((x) => x.type === 'pending');
        const total = pendingItems.length;
        const uploadedUrls = [];
        for (let idx = 0; idx < pendingItems.length; idx++) {
          const item = pendingItems[idx];
          const fd = new FormData();
          fd.append('file', item.file);
          const res = await mediaAPI.upload(fd, {
            onUploadProgress: (e) => {
              const pct = e.total ? Math.round((e.loaded / e.total) * 100) : 0;
              const overall = Math.round(((idx * 100 + pct) / total));
              setSaveProgress((prev) => {
                const steps = prev.steps.map((s, i) =>
                  i === 0 ? { ...s, progress: overall, subLabel: `Файл ${idx + 1} из ${total}` } : s
                );
                const totalProgress = Math.round(((1 * (overall / 100)) / totalWeight) * 100);
                return { ...prev, steps, totalProgress };
              });
            },
          });
          if (res.data?.url) uploadedUrls.push(res.data.url);
          URL.revokeObjectURL(item.preview);
        }
        let uploadIdx = 0;
        imagesToSend = allGalleryItems.map((item) =>
          item.type === 'saved' ? item.url : uploadedUrls[uploadIdx++]
        ).filter(Boolean);
        setPendingGallery([]);
        setFormData((prev) => ({ ...prev, images: imagesToSend }));
        setSaveProgress((prev) => ({
          ...prev,
          steps: prev.steps.map((s, i) => (i === 0 ? { ...s, status: 'done' } : { ...s, status: 'active' })),
          totalProgress: 50,
        }));
      }
      const cf = formData.customFilters && typeof formData.customFilters === 'object' ? formData.customFilters : {};
      const first = (key) => (Array.isArray(cf[key]) ? cf[key][0] : null);
      // Сложность: только из customFilters.difficultyLevels или formData.difficulty (одно место)
      const difficultyRaw = getDifficultyFromFilters(cf) ?? formData.difficulty ?? 3;
      const difficultyNum = (() => { const n = parseInt(difficultyRaw, 10); return Number.isFinite(n) ? n : 3; })();
      // Расстояние: из поля ввода customFilters.distance, иначе из distanceOptions/формы
      const distanceFromForm = cf.distance ?? first('distanceOptions') ?? formData.distance;
      const distanceNum = (() => {
        if (distanceFromForm == null || distanceFromForm === '') return null;
        const num = typeof distanceFromForm === 'number' ? distanceFromForm : parseFloat(String(distanceFromForm).replace(/\s*км.*/i, '').trim());
        return Number.isFinite(num) ? num : null;
      })();
      const elevationFromForm = cf.elevationGain ?? first('elevationOptions') ?? formData.elevationGain;
      const elevationNum = (() => {
        if (elevationFromForm == null || elevationFromForm === '') return null;
        const num = typeof elevationFromForm === 'number' ? elevationFromForm : parseFloat(String(elevationFromForm).replace(/\s*м.*/i, '').trim());
        return Number.isFinite(num) ? num : null;
      })();
      const pointsPayload = Array.isArray(formData.points)
        ? formData.points.map((p, index) => ({
            title: p.title ?? '',
            description: p.description ?? '',
            image: p.image ?? null,
            order: index,
          }))
        : [];
      // customFilters для API: те же значения, что уходят в плоских полях (difficulty, distance, elevationGain)
      const customFiltersPayload = {
        ...cf,
        seasons: Array.isArray(cf.seasons) ? cf.seasons : (formData.season ? [formData.season] : []),
        transport: Array.isArray(cf.transport) ? cf.transport : (formData.transport ? [formData.transport] : []),
        durationOptions: Array.isArray(cf.durationOptions)
          ? cf.durationOptions
          : typeof cf.durationOptions === 'string' && cf.durationOptions.trim()
            ? [cf.durationOptions.trim()]
            : (formData.duration ? [formData.duration] : []),
        difficultyLevels: [String(difficultyNum)],
        distanceOptions: distanceNum != null ? [distanceNum] : (Array.isArray(cf.distanceOptions) ? cf.distanceOptions : []),
        elevationOptions: elevationNum != null ? [elevationNum] : (Array.isArray(cf.elevationOptions) ? cf.elevationOptions : []),
        isFamilyOptions: Array.isArray(cf.isFamilyOptions) ? cf.isFamilyOptions : (formData.isFamily ? ['Да'] : []),
        hasOvernightOptions: Array.isArray(cf.hasOvernightOptions) ? cf.hasOvernightOptions : (formData.hasOvernight ? ['Да'] : []),
        distance: distanceNum != null ? distanceNum : (cf.distance ?? null),
        elevationGain: elevationNum != null ? elevationNum : (cf.elevationGain ?? null),
      };
      const durationFromForm =
        first('durationOptions') ??
        (typeof cf.durationOptions === 'string' && cf.durationOptions.trim() !== '' ? cf.durationOptions.trim() : null) ??
        formData.duration ??
        '';
      const dataToSend = {
        title: formData.title ?? '',
        shortDescription: formData.shortDescription ?? null,
        description: formData.description ?? null,
        season: first('seasons') ?? formData.season ?? '',
        transport: first('transport') ?? formData.transport ?? '',
        duration: durationFromForm,
        difficulty: difficultyNum,
        isFamily: (Array.isArray(cf.isFamilyOptions) ? cf.isFamilyOptions : []).includes('Да') || formData.isFamily,
        hasOvernight: (Array.isArray(cf.hasOvernightOptions) ? cf.hasOvernightOptions : []).includes('Да') || formData.hasOvernight,
        distance: distanceNum,
        elevationGain: elevationNum,
        whatToBring: JSON.stringify(formData.whatToBringItems ?? []),
        importantInfo: formData.importantInfo ?? null,
        mapUrl: formData.mapUrl ?? null,
        isActive: formData.isActive !== false,
        images: Array.isArray(imagesToSend) ? imagesToSend : [],
        placeIds: Array.isArray(formData.placeIds) ? formData.placeIds : [],
        nearbyPlaceIds: Array.isArray(formData.nearbyPlaceIds) ? formData.nearbyPlaceIds : [],
        guideIds: Array.isArray(formData.guideIds) ? formData.guideIds : [],
        similarRouteIds: Array.isArray(formData.similarRouteIds) ? formData.similarRouteIds : [],
        customFilters: customFiltersPayload,
        points: pointsPayload,
      };

      if (hadGalleryUpload) {
        setSaveProgress((prev) => ({
          ...prev,
          steps: prev.steps.map((s, i) => (i === 1 ? { ...s, status: 'active' } : s)),
        }));
      }

      if (isNew) {
        const res = await routesAPI.create(dataToSend);
        const created = res.data;
        if (hadGalleryUpload) {
          setSaveProgress((prev) => ({ ...prev, steps: prev.steps.map((s, i) => (i === 1 ? { ...s, status: 'done' } : s)), totalProgress: 100 }));
        }
        setShowToast(true);
        setTimeout(() => setShowToast(false), TOAST_DURATION_MS);
        setTimeout(() => {
          setSaveProgress({ open: false, steps: [], totalProgress: 0 });
          if (created?.id) {
            navigate(`/admin/routes/${created.id}`, { replace: true });
          } else {
            navigate('/admin/routes');
          }
        }, hadGalleryUpload ? 500 : 0);
      } else {
        const res = await routesAPI.update(params.id, dataToSend);
        let updated = res?.data;
        if (!updated && res?.status === 200) {
          const refetch = await routesAPI.getById(params.id);
          updated = refetch?.data;
        }
        if (updated) {
          const raw = updated.customFilters && typeof updated.customFilters === 'object' ? updated.customFilters : {};
          // После сохранения заполняем customFilters из плоских полей ответа (то же правило, что при загрузке)
          const customFilters = {
            ...raw,
            seasons: Array.isArray(raw.seasons) ? raw.seasons : (updated.season ? [updated.season] : []),
            transport: Array.isArray(raw.transport) ? raw.transport : (updated.transport ? [updated.transport] : []),
            durationOptions: Array.isArray(raw.durationOptions) ? raw.durationOptions : (updated.duration ? [updated.duration] : []),
            difficultyLevels: Array.isArray(raw.difficultyLevels) ? raw.difficultyLevels : (updated.difficulty != null ? [String(updated.difficulty)] : []),
            distanceOptions: Array.isArray(raw.distanceOptions) ? raw.distanceOptions : (updated.distance != null && updated.distance !== '' ? [updated.distance] : []),
            elevationOptions: Array.isArray(raw.elevationOptions) ? raw.elevationOptions : (updated.elevationGain != null && updated.elevationGain !== '' ? [updated.elevationGain] : []),
            isFamilyOptions: Array.isArray(raw.isFamilyOptions) ? raw.isFamilyOptions : (updated.isFamily ? ['Да'] : []),
            hasOvernightOptions: Array.isArray(raw.hasOvernightOptions) ? raw.hasOvernightOptions : (updated.hasOvernight ? ['Да'] : []),
            distance: updated.distance != null && updated.distance !== '' ? (typeof updated.distance === 'number' ? `${updated.distance} км` : String(updated.distance)) : (raw.distance ?? ''),
            elevationGain: updated.elevationGain != null && updated.elevationGain !== '' ? (typeof updated.elevationGain === 'number' ? `${updated.elevationGain} м` : String(updated.elevationGain)) : (raw.elevationGain ?? ''),
          };
          const points = Array.isArray(updated.points)
            ? updated.points.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((p) => ({ id: p.id, title: p.title ?? '', description: p.description ?? '', image: p.image ?? null, order: p.order ?? 0 }))
            : [];
          const whatToBringItems = parseWhatToBring(updated.whatToBring ?? '');
          const next = {
            ...updated,
            placeIds: Array.isArray(updated.placeIds) ? updated.placeIds : [],
            nearbyPlaceIds: Array.isArray(updated.nearbyPlaceIds) ? updated.nearbyPlaceIds : [],
            guideIds: Array.isArray(updated.guideIds) ? updated.guideIds : [],
            similarRouteIds: Array.isArray(updated.similarRouteIds) ? updated.similarRouteIds : [],
            customFilters,
            points,
            whatToBringItems,
          };
          setFormData(next);
          savedFormDataRef.current = next;
          savedSnapshotRef.current = getFormSnapshot(next);
        } else {
          savedFormDataRef.current = { ...formData };
          savedSnapshotRef.current = getFormSnapshot(formData);
        }
        if (hadGalleryUpload) {
          setSaveProgress((prev) => ({ ...prev, steps: prev.steps.map((s, i) => (i === 1 ? { ...s, status: 'done' } : s)), totalProgress: 100 }));
          setTimeout(() => setSaveProgress({ open: false, steps: [], totalProgress: 0 }), 500);
        }
        setShowToast(true);
        setTimeout(() => setShowToast(false), TOAST_DURATION_MS);
      }
    } catch (error) {
      console.error('Ошибка сохранения:', error);
      const status = error.response?.status;
      const msg = error.response?.data?.message ?? error.message ?? 'Ошибка сохранения маршрута';
      const fullMsg = status ? `[${status}] ${msg}` : msg;
      setError(fullMsg);
      if (hadGalleryUpload) {
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

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    return () => {
      (pendingGalleryRef.current || []).forEach((p) => URL.revokeObjectURL(p.preview));
    };
  }, []);

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
          {isNew ? 'Новый маршрут' : 'Редактирование маршрута'}
        </h1>
      </div>

      <form id="route-form" onSubmit={handleSubmit} className={styles.formContainer}>
        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Название маршрута *</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            className={styles.formInput}
            required
            placeholder="Введите название маршрута"
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Краткое описание</label>
          <RichTextEditor
            value={formData.shortDescription}
            onChange={(value) => setFormData((prev) => ({ ...prev, shortDescription: value }))}
            placeholder="Краткое описание для карточки маршрута"
            minHeight={300}
          />
        </div>

        {/* Описание маршрута — табы (точки маршрута): название + редактор описания */}
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Описание маршрута</label>
          <p className={styles.imageHint} style={{ marginBottom: 12 }}>
            Каждый таб — пункт маршрута (день или отрезок). Название таба и описание отображаются на странице маршрута.
          </p>
          <div className={styles.routeDescTabs}>
            <div className={styles.routeDescTabsList} role="tablist">
              {formData.points.map((point, index) => (
                <div key={point.id ?? point._tempId ?? `point-${index}`} className={styles.routeDescTabWrap}>
                  <button
                    type="button"
                    className={styles.routeDescTabArrow}
                    onClick={() => {
                      if (index > 0) {
                        setFormData((prev) => {
                          const next = [...prev.points];
                          [next[index - 1], next[index]] = [next[index], next[index - 1]];
                          return { ...prev, points: next };
                        });
                        setActivePointIndex((i) => (i === index ? index - 1 : i === index - 1 ? index : i));
                      }
                    }}
                    disabled={index === 0}
                    aria-label="Сдвинуть влево"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activePointIndex === index}
                    className={`${styles.routeDescTab} ${activePointIndex === index ? styles.routeDescTabActive : ''}`}
                    onClick={() => setActivePointIndex(index)}
                  >
                    <span className={styles.routeDescTabLabel}>{point.title?.trim() || `Пункт ${index + 1}`}</span>
                    <span
                      className={styles.routeDescTabDelete}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setFormData((prev) => ({ ...prev, points: prev.points.filter((_, i) => i !== index) }));
                        setActivePointIndex((i) => Math.min(i, Math.max(0, formData.points.length - 2)));
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.click()}
                      aria-label="Удалить пункт"
                      title="Удалить пункт"
                    >
                      <X size={14} />
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.routeDescTabArrow}
                    onClick={() => {
                      if (index < formData.points.length - 1) {
                        setFormData((prev) => {
                          const next = [...prev.points];
                          [next[index], next[index + 1]] = [next[index + 1], next[index]];
                          return { ...prev, points: next };
                        });
                        setActivePointIndex((i) => (i === index ? index + 1 : i === index + 1 ? index : i));
                      }
                    }}
                    disabled={index === formData.points.length - 1}
                    aria-label="Сдвинуть вправо"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={styles.routeDescTabAdd}
                onClick={() => {
                  setFormData((prev) => ({
                    ...prev,
                    points: [...prev.points, { title: '', description: '', order: prev.points.length, _tempId: `t-${Date.now()}` }],
                  }));
                  setActivePointIndex(formData.points.length);
                }}
                aria-label="Добавить пункт"
              >
                <Plus size={18} /> Добавить пункт
              </button>
            </div>
            {formData.points.length > 0 && activePointIndex >= 0 && activePointIndex < formData.points.length && (
              <div className={styles.routeDescTabPanel} role="tabpanel">
                <div className={styles.routeDescTabPanelContent} key={formData.points[activePointIndex]?.id ?? formData.points[activePointIndex]?._tempId ?? activePointIndex}>
                  <div className={styles.routeDescTabRow}>
                    <label className={styles.formLabel} style={{ marginBottom: 6 }}>Название таба</label>
                    <input
                      type="text"
                      value={formData.points[activePointIndex].title ?? ''}
                      onChange={(e) => {
                        const idx = activePointIndex;
                        const newTitle = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          points: prev.points.map((p, i) => (i === idx ? { ...p, title: newTitle } : p)),
                        }));
                      }}
                      className={styles.formInput}
                      placeholder="Например: 1 день или Выезд из Кисловодска"
                    />
                  </div>
                  <div className={styles.routeDescTabRow}>
                    <label className={styles.formLabel} style={{ marginBottom: 6 }}>Описание</label>
                    <RichTextEditor
                      key={`route-point-${activePointIndex}-${formData.points[activePointIndex]?.id ?? formData.points[activePointIndex]?._tempId ?? activePointIndex}`}
                      value={formData.points[activePointIndex].description ?? ''}
                      onChange={(value) => {
                        const idx = activePointIndex;
                        setFormData((prev) => ({
                          ...prev,
                          points: prev.points.map((p, i) => (i === idx ? { ...p, description: value } : p)),
                        }));
                      }}
                      placeholder="Текст описания пункта маршрута"
                      minHeight={280}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Параметры маршрута: в модалке только выбор группы, значения выбираются здесь (можно несколько) */}
        <div className={styles.formGroup}>
          <div className={styles.filtersSection}>
            <label className={styles.formLabel}>Параметры маршрута</label>
            <p className={styles.imageHint} style={{ marginBottom: 16 }}>
              Группы задаются в «Фильтры маршрутов» (список маршрутов). Нажмите «Добавить параметр», выберите группу — значения выбираются ниже на экране (можно несколько).
            </p>
            {addedFilterGroups.length > 0 && (
              <div className={styles.filterGroups} style={{ marginBottom: 16 }}>
                {addedFilterGroups.map((groupKey) => {
                  const g = getGroupByKey(filterOptions, groupKey);
                  if (!g) return null;
                  return (
                    <div key={groupKey} className={styles.filterGroupCard}>
                      <div className={styles.filterGroupTitle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          {g.iconType === 'upload' && g.icon ? (
                            <img src={getImageUrl(g.icon)} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />
                          ) : g.icon && getMuiIconComponent(g.icon) ? (() => {
                            const Icon = getMuiIconComponent(g.icon);
                            return <Icon size={20} />;
                          })() : null}
                          {g.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setAddedFilterGroups((prev) => prev.filter((k) => k !== groupKey));
                            setFormData((prev) => clearFilter(prev, groupKey));
                          }}
                          className={styles.deleteBtn}
                          title="Удалить параметр"
                          aria-label={`Удалить ${g.label}`}
                        >
                          <X size={16} />
                        </button>
                      </div>
                      {g.type === 'input' ? (
                        <input
                          type="text"
                          value={getCurrentValueForGroup(formData, groupKey, 'input')}
                          onChange={(e) => setFormData((prev) => applyFilter(prev, groupKey, e.target.value.trim(), 'input'))}
                          className={styles.formInput}
                          placeholder="Введите значение"
                          aria-label={g.label}
                        />
                      ) : (
                        <div className={styles.filterCheckboxList}>
                          {(g.values || []).map((v) => {
                            const selected = getCurrentValueForGroup(formData, groupKey, g.type === 'multi' ? 'multi' : 'single');
                            const arr = Array.isArray(selected) ? selected : [];
                            const checked = arr.includes(v);
                            return (
                              <label key={v} className={styles.filterCheckboxLabel}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    const next = checked ? arr.filter((x) => x !== v) : [...arr, v];
                                    setFormData((prev) => applyFilter(prev, groupKey, next, 'multi'));
                                  }}
                                />
                                <span>{v}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setAddFilterSelectedGroups([]);
                setAddFilterModalOpen(true);
              }}
              className={styles.addBtn}
            >
              <Plus size={18} /> Добавить параметр
            </button>
          </div>
        </div>

        {/* Модалка: только выбор группы, значения выбираются на экране маршрута */}
        {addFilterModalOpen && (
          <div
            className={styles.modalOverlay}
            onClick={(e) => e.target === e.currentTarget && setAddFilterModalOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-filter-title"
          >
            <div className={styles.modalDialog} style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h2 id="add-filter-title" className={styles.modalTitle}>Добавить параметр</h2>
                <button type="button" onClick={() => setAddFilterModalOpen(false)} className={styles.modalClose} aria-label="Закрыть">
                  <X size={20} />
                </button>
              </div>
              <div className={styles.modalBody}>
                <p className={styles.imageHint} style={{ marginBottom: 16 }}>
                  Отметьте группы, которые хотите добавить. Значения для них вы выберете на экране создания маршрута (можно несколько).
                </p>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Параметры</label>
                  <div className={`${styles.filterCheckboxList} ${styles.addParamCheckboxGrid}`}>
                    {getAvailableGroups(filterOptions)
                      .filter((gr) => !addedFilterGroups.includes(gr.key))
                      .map((gr) => (
                        <label key={gr.key} className={styles.filterCheckboxLabel}>
                          <input
                            type="checkbox"
                            checked={addFilterSelectedGroups.includes(gr.key)}
                            onChange={() => {
                              setAddFilterSelectedGroups((prev) =>
                                prev.includes(gr.key) ? prev.filter((k) => k !== gr.key) : [...prev, gr.key]
                              );
                            }}
                          />
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            {gr.iconType === 'upload' && gr.icon ? (
                              <img src={getImageUrl(gr.icon)} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />
                            ) : gr.icon && getMuiIconComponent(gr.icon) ? (() => {
                              const Icon = getMuiIconComponent(gr.icon);
                              return <Icon size={18} />;
                            })() : null}
                            {gr.label}
                          </span>
                        </label>
                      ))}
                  </div>
                  {getAvailableGroups(filterOptions).filter((gr) => !addedFilterGroups.includes(gr.key)).length === 0 && (
                    <p className={styles.imageHint} style={{ marginTop: 8 }}>
                      Все доступные параметры уже добавлены к маршруту.
                    </p>
                  )}
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" onClick={() => setAddFilterModalOpen(false)} className={styles.cancelBtn}>
                  Отмена
                </button>
                <button
                  type="button"
                  className={styles.submitBtn}
                  onClick={() => {
                    setAddedFilterGroups((prev) => [...new Set([...prev, ...addFilterSelectedGroups])]);
                    setAddFilterModalOpen(false);
                  }}
                  disabled={addFilterSelectedGroups.length === 0}
                >
                  Добавить выбранные
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Секция выбора мест маршрута — тот же стиль, что и «Места рядом» в форме места */}
        <div className={styles.formGroup} style={{ marginTop: 30 }}>
          <label className={styles.formLabel} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* <MapPin size={18} /> */}
            <span>Места на маршруте ({formData.placeIds.length})</span>
          </label>

          {formData.placeIds.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p className={styles.formListHint}>
                Порядок мест на маршруте (можно изменить):
              </p>
              <div className={styles.formCardList}>
                {formData.placeIds.map((placeId, index) => {
                  const place = getPlaceById(placeId);
                  if (!place) return null;
                  return (
                    <div
                      key={placeId}
                      className={styles.formCardRow}
                      data-place-row
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const raw = e.dataTransfer.getData('text/plain');
                        const draggedIndex = parseInt(raw, 10);
                        if (Number.isNaN(draggedIndex) || draggedIndex === index) return;
                        movePlaceByDrag(draggedIndex, index);
                      }}
                    >
                      <div
                        className={styles.formCardRowDragHandle}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', String(index));
                          e.dataTransfer.effectAllowed = 'move';
                          const row = e.currentTarget.closest('[data-place-row]');
                          if (row) e.dataTransfer.setDragImage(row, 0, 0);
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label="Перетащить для изменения порядка"
                        title="Перетащить для изменения порядка"
                      >
                        <GripVertical size={20} />
                      </div>
                      <div className={styles.formMoveButtons}>
                        <button
                          type="button"
                          onClick={() => movePlace(index, -1)}
                          disabled={index === 0}
                          className={styles.formMoveBtn}
                          aria-label="Поднять"
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => movePlace(index, 1)}
                          disabled={index === formData.placeIds.length - 1}
                          className={styles.formMoveBtn}
                          aria-label="Опустить"
                        >
                          <ChevronDown size={16} />
                        </button>
                      </div>
                      <span className={styles.formOrderBadge}>{index + 1}</span>
                      {place.image && (
                        <img src={getImageUrl(place.image)} alt="" />
                      )}
                      <div className={styles.formCardRowContent}>
                        <div className={styles.formCardRowTitle}>{place.title}</div>
                        {place.location && (
                          <div className={styles.formCardRowSub}>{place.location}</div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removePlace(placeId)}
                        className={styles.deleteBtn}
                        title="Удалить"
                        aria-label="Удалить"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className={styles.formAddPlaceWrap}>
            <div className={styles.formAddPlaceSearch}>
              <input
                type="text"
                placeholder="Поиск мест для добавления..."
                value={placesSearch}
                onChange={(e) => setPlacesSearch(e.target.value)}
                className={styles.formInput}
                aria-label="Поиск мест"
              />
            </div>
            {filteredPlaces.length > 0 ? (
              <div className={styles.formAddPlaceList}>
                {filteredPlaces.map((place) => (
                  <div
                    key={place.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => addPlace(place.id)}
                    onKeyDown={(e) => e.key === 'Enter' && addPlace(place.id)}
                    className={styles.formAddPlaceItem}
                  >
                    {place.image && (
                      <img src={getImageUrl(place.image)} alt="" />
                    )}
                    <div className={styles.formAddPlaceItemTitle}>
                      <div>{place.title}</div>
                      {place.location && (
                        <div className={styles.formAddPlaceItemSub}>{place.location}</div>
                      )}
                    </div>
                    <span className={styles.formAddPlaceLabel}>+ Добавить</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.formEmptyHint}>
                {allPlaces.length === 0
                  ? 'Нет доступных мест. Сначала создайте места.'
                  : 'Все места уже добавлены в маршрут'}
              </div>
            )}
          </div>
        </div>

        {/* Карта маршрута: точки мест в порядке следования и маршрут между ними */}
        <div className={styles.formGroup} style={{ marginTop: 24 }}>
          <label className={styles.formLabel}>Карта маршрута</label>
          <YandexMapRoute
            places={formData.placeIds
              .map((id) => getPlaceById(id))
              .filter(Boolean)
              .map((p) => ({
                id: p.id,
                title: p.title,
                latitude: p.latitude,
                longitude: p.longitude,
              }))}
            height={400}
          />
        </div>

        {/* Места рядом с маршрутом — места с той же локацией, что и места маршрута (как в форме места) */}
        <div className={styles.formGroup} style={{ marginTop: 30 }}>
          <label className={styles.formLabel} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={18} />
            <span>Места рядом с маршрутом</span>
          </label>
          <p className={styles.formListHint} style={{ marginBottom: 12 }}>
            Добавляйте места, у которых локация совпадает с локацией любого места из маршрута. В списке для добавления показываются только такие места.
          </p>
          <button type="button" onClick={openAddNearbyPlacesModal} className={styles.addBtn} style={{ marginBottom: 12 }}>
            <Plus size={18} /> Добавить места
          </button>
          {(formData.nearbyPlaceIds || []).length > 0 && (
            <div className={styles.formCardList}>
              {(formData.nearbyPlaceIds || []).map((placeId) => {
                const place = getPlaceById(placeId) || { id: placeId, title: '…', location: '' };
                return (
                  <div key={placeId} className={styles.formCardRow}>
                    {place.image && (
                      <img src={getImageUrl(place.image)} alt="" />
                    )}
                    <div className={styles.formCardRowContent}>
                      <div className={styles.formCardRowTitle}>{place.title}</div>
                      {place.location && (
                        <div className={styles.formCardRowSub}>{place.location}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeNearbyPlace(placeId)}
                      className={styles.deleteBtn}
                      title="Удалить"
                      aria-label="Удалить"
                    >
                      <X size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Помогут покорить маршрут — выбор гидов с поиском */}
        <div className={styles.formGroup} style={{ marginTop: 30 }}>
          <label className={styles.formLabel} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Помогут покорить маршрут ({formData.guideIds.length})</span>
          </label>

          {formData.guideIds.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div className={styles.formCardList}>
                {formData.guideIds.map((guideId) => {
                  const guide = getGuideById(guideId);
                  if (!guide) return null;
                  return (
                    <div key={guideId} className={styles.formCardRow}>
                      {(guide.image || guide.images?.[0]) ? (
                        <img src={getImageUrl(guide.image || guide.images[0])} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#eee', flexShrink: 0 }} />
                      )}
                      <div className={styles.formCardRowContent} style={{ flex: 1 }}>
                        <div className={styles.formCardRowTitle}>{guide.title}</div>
                        {(guide.rating != null || guide.reviewsCount != null) && (
                          <div className={styles.formCardRowSub}>
                            {guide.rating != null && `${Number(guide.rating).toFixed(1)}`}
                            {guide.reviewsCount != null && guide.reviewsCount > 0 && ` · ${guide.reviewsCount} отзывов`}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeGuide(guideId)}
                        className={styles.deleteBtn}
                        title="Удалить"
                        aria-label="Удалить"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className={styles.formAddPlaceWrap}>
            <div className={styles.formAddPlaceSearch}>
              <input
                type="text"
                placeholder="Поиск гидов для добавления..."
                value={guidesSearch}
                onChange={(e) => setGuidesSearch(e.target.value)}
                className={styles.formInput}
                aria-label="Поиск гидов"
              />
            </div>
            {filteredGuides.length > 0 ? (
              <div className={styles.formAddPlaceList}>
                {filteredGuides.map((guide) => (
                  <div
                    key={guide.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => addGuide(guide.id)}
                    onKeyDown={(e) => e.key === 'Enter' && addGuide(guide.id)}
                    className={styles.formAddPlaceItem}
                  >
                    {(guide.image || guide.images?.[0]) ? (
                      <img src={getImageUrl(guide.image || guide.images[0])} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#eee', flexShrink: 0 }} />
                    )}
                    <div className={styles.formAddPlaceItemTitle}>
                      <div>{guide.title}</div>
                      {(guide.rating != null || guide.reviewsCount != null) && (
                        <div className={styles.formAddPlaceItemSub}>
                          {guide.rating != null && `★ ${Number(guide.rating).toFixed(1)}`}
                          {guide.reviewsCount != null && guide.reviewsCount > 0 && ` · ${guide.reviewsCount} отзывов`}
                        </div>
                      )}
                    </div>
                    <span className={styles.formAddPlaceLabel}>+ Добавить</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.formEmptyHint}>
                {allGuides.length === 0
                  ? 'Нет гидов. Добавьте услуги с категорией «Гид» в разделе Услуги.'
                  : 'Все гиды уже добавлены или нет совпадений по поиску'}
              </div>
            )}
          </div>
        </div>

        {/* Похожие маршруты — чем больше общих мест, тем выше в списке */}
        <div className={styles.formGroup} style={{ marginTop: 30 }}>
          <label className={styles.formLabel} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Похожие маршруты</span>
          </label>
          <p className={styles.formListHint} style={{ marginBottom: 12 }}>
            Чем больше мест совпадает у двух маршрутов, тем они похожее. В списке для добавления маршруты отсортированы по количеству общих мест.
          </p>
          <button type="button" onClick={openAddSimilarRoutesModal} className={styles.addBtn} style={{ marginBottom: 12 }}>
            <Plus size={18} /> Добавить маршруты
          </button>
          {(formData.similarRouteIds || []).length > 0 && (
            <div className={styles.formCardList}>
              {(formData.similarRouteIds || []).map((routeId) => {
                const route = getRouteById(routeId) || { id: routeId, title: '…' };
                return (
                  <div key={routeId} className={styles.formCardRow}>
                    {route.images?.[0] && (
                      <img src={getImageUrl(route.images[0])} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }} />
                    )}
                    <div className={styles.formCardRowContent}>
                      <div className={styles.formCardRowTitle}>{route.title}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSimilarRoute(routeId)}
                      className={styles.deleteBtn}
                      title="Удалить"
                      aria-label="Удалить"
                    >
                      <X size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Что взять с собой</label>
          <p className={styles.imageHint} style={{ marginBottom: 12 }}>
            Каждый пункт: иконка (своя загрузка или из библиотеки) и текст.
          </p>
          {(formData.whatToBringItems ?? []).length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p className={styles.formListHint}>
                Порядок пунктов (можно изменить):
              </p>
              <div className={styles.whatToBringList}>
                {(formData.whatToBringItems ?? []).map((item, index) => (
                  <div
                    key={`wtb-${index}`}
                    className={styles.whatToBringBlock}
                    data-wtb-row
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const raw = e.dataTransfer.getData('text/plain');
                      const draggedIndex = parseInt(raw, 10);
                      if (Number.isNaN(draggedIndex) || draggedIndex === index) return;
                      moveWhatToBringItemByDrag(draggedIndex, index);
                    }}
                  >
                    <div
                      className={styles.formCardRowDragHandle}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', String(index));
                        e.dataTransfer.effectAllowed = 'move';
                        const row = e.currentTarget.closest('[data-wtb-row]');
                        if (row) e.dataTransfer.setDragImage(row, 0, 0);
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label="Перетащить для изменения порядка"
                      title="Перетащить для изменения порядка"
                    >
                      <GripVertical size={20} />
                    </div>
                    <div className={styles.formMoveButtons}>
                      <button
                        type="button"
                        onClick={() => moveWhatToBringItem(index, -1)}
                        disabled={index === 0}
                        className={styles.formMoveBtn}
                        aria-label="Поднять"
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveWhatToBringItem(index, 1)}
                        disabled={index === (formData.whatToBringItems ?? []).length - 1}
                        className={styles.formMoveBtn}
                        aria-label="Опустить"
                      >
                        <ChevronDown size={16} />
                      </button>
                    </div>
                    <span className={styles.formOrderBadge}>{index + 1}</span>
                    <div className={styles.whatToBringIconCell}>
                      <div className={styles.whatToBringTypeSwitcher} role="group" aria-label="Источник иконки">
                        <button
                          type="button"
                          className={`${styles.whatToBringTypeSegment} ${item.iconType === 'upload' ? styles.whatToBringTypeSegmentActive : ''}`}
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              whatToBringItems: prev.whatToBringItems.map((it, i) =>
                                i === index ? { ...it, iconType: 'upload', icon: '' } : it
                              ),
                            }))
                          }
                        >
                          Загрузить
                        </button>
                        <button
                          type="button"
                          className={`${styles.whatToBringTypeSegment} ${item.iconType === 'mui' ? styles.whatToBringTypeSegmentActive : ''}`}
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              whatToBringItems: prev.whatToBringItems.map((it, i) =>
                                i === index ? { ...it, iconType: 'mui', icon: it.iconType === 'mui' ? it.icon : '' } : it
                              ),
                            }))
                          }
                        >
                          Библиотека
                        </button>
                      </div>
                      <div className={styles.whatToBringIconPreview}>
                        {item.iconType === 'upload' ? (
                          <>
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              id={`wtb-upload-${index}`}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try {
                                  const fd = new FormData();
                                  fd.append('file', file);
                                  const res = await mediaAPI.upload(fd);
                                  setFormData((prev) => ({
                                    ...prev,
                                    whatToBringItems: prev.whatToBringItems.map((it, i) =>
                                      i === index ? { ...it, icon: res.data.url } : it
                                    ),
                                  }));
                                } catch (err) {
                                  console.error(err);
                                }
                                e.target.value = '';
                              }}
                            />
                            <label htmlFor={`wtb-upload-${index}`} className={styles.whatToBringUploadBtn}>
                              {item.icon ? (
                                <img src={getImageUrl(item.icon)} alt="" className={styles.whatToBringUploadImg} />
                              ) : (
                                <Upload size={24} />
                              )}
                            </label>
                          </>
                        ) : (
                          <button
                            type="button"
                            className={styles.whatToBringMuiBtn}
                            onClick={() => {
                              setWhatToBringIconGroup('all');
                              setWhatToBringIconSearch('');
                              setWhatToBringIconPickerIndex(index);
                            }}
                            title="Выбрать иконку"
                          >
                            {item.icon && getMuiIconComponent(item.icon) ? (
                              (() => {
                                const Icon = getMuiIconComponent(item.icon);
                                return <Icon size={28} />;
                              })()
                            ) : (
                              <span className={styles.whatToBringMuiPlaceholder}>Иконка</span>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    <input
                  type="text"
                  className={styles.whatToBringTextInput}
                  value={item.text}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      whatToBringItems: prev.whatToBringItems.map((it, i) =>
                        i === index ? { ...it, text: e.target.value } : it
                      ),
                    }))
                  }
                  placeholder="Текст пункта"
                />
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          whatToBringItems: prev.whatToBringItems.filter((_, i) => i !== index),
                        }))
                      }
                      aria-label="Удалить"
                      title="Удалить"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className={styles.whatToBringAddWrap} style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
              <button
                type="button"
                className={styles.addBtn}
                style={{ backgroundColor: '#f0f0f0', color: '#333' }}
                onClick={() => {
                  setAddExistingItemsSelected(new Set());
                  setAddExistingItemsSearch('');
                  setAddExistingItemsModalOpen(true);
                }}
              >
                <Plus size={18} /> Уже добавленные
              </button>
              <button
                type="button"
                className={styles.addBtn}
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    whatToBringItems: [...(prev.whatToBringItems ?? []), { iconType: 'mui', icon: '', text: '' }],
                  }))
                }
              >
                <Plus size={18} /> Добавить пункт
              </button>
            </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Важная информация</label>
          <RichTextEditor
            value={formData.importantInfo}
            onChange={(value) => setFormData((prev) => ({ ...prev, importantInfo: value }))}
            placeholder="Важные предупреждения и рекомендации"
            minHeight={300}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Изображения</label>
          <div className={styles.imageUpload}>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              style={{ display: 'none' }}
              id="imageUpload"
            />
            <label htmlFor="imageUpload" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              <Upload size={20} /> Нажмите для загрузки изображений
            </label>
          </div>
          
          {allGalleryItems.length > 0 && (
            <div className={styles.imagePreview}>
              {allGalleryItems.map((item, index) => (
                <div
                  key={item.type === 'saved' ? item.url : item.preview}
                  className={`${styles.imagePreviewItemWrap} ${draggedImageIndex === index ? styles.dragging : ''} ${dragOverImageIndex === index ? styles.dragOver : ''}`}
                  draggable
                  onDragStart={(e) => {
                    setDraggedImageIndex(index);
                    e.dataTransfer.setData('text/plain', String(index));
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={() => {
                    setDraggedImageIndex(null);
                    setDragOverImageIndex(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setDragOverImageIndex(index);
                  }}
                  onDragLeave={() => setDragOverImageIndex((i) => (i === index ? null : i))}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
                    setDragOverImageIndex(null);
                    if (!Number.isNaN(from) && from !== index) moveGalleryItemTo(from, index);
                  }}
                >
                  <div className={styles.previewItem}>
                    <img src={item.type === 'saved' ? getImageUrl(item.url) : item.preview} alt={`Preview ${index + 1}`} />
                  </div>
                  <div className={styles.imagePreviewActions}>
                    <div className={styles.imageDragHandle} title="Перетащите для изменения порядка">
                      <GripVertical size={18} />
                    </div>
                    <div className={styles.imageMoveButtonsRow}>
                      <button
                        type="button"
                        onClick={() => moveGalleryItem(index, -1)}
                        disabled={index === 0}
                        className={styles.formMoveBtn}
                        aria-label="Влево"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveGalleryItem(index, 1)}
                        disabled={index === allGalleryItems.length - 1}
                        className={styles.formMoveBtn}
                        aria-label="Вправо"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeGalleryItem(index)}
                      className={styles.removeImageBtn}
                      aria-label="Удалить"
                      title="Удалить"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {whatToBringIconPickerIndex !== null && (
          <div
            className={styles.modalOverlay}
            onClick={(e) => e.target === e.currentTarget && setWhatToBringIconPickerIndex(null)}
            role="dialog"
            aria-modal="true"
            aria-label="Выбор иконки"
          >
            <div className={styles.modalDialog} style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>Выберите иконку</h2>
                <button
                  type="button"
                  onClick={() => setWhatToBringIconPickerIndex(null)}
                  className={styles.modalClose}
                  aria-label="Закрыть"
                >
                  <X size={20} />
                </button>
              </div>
              <div className={styles.modalBody} style={{ maxHeight: 440, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div className={styles.whatToBringIconFilters}>
                  <input
                    type="search"
                    className={styles.whatToBringIconSearch}
                    placeholder="Поиск иконки..."
                    value={whatToBringIconSearch}
                    onChange={(e) => setWhatToBringIconSearch(e.target.value)}
                    aria-label="Поиск иконки"
                    autoComplete="off"
                  />
                  <select
                    className={styles.whatToBringIconGroupSelect}
                    value={whatToBringIconGroup}
                    onChange={(e) => setWhatToBringIconGroup(e.target.value)}
                    aria-label="Группа иконок"
                  >
                    <option value="all">Все иконки</option>
                    {getIconGroups().map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label} ({g.iconNames.length})
                      </option>
                    ))}
                  </select>
                </div>
                {(() => {
                  const groups = getIconGroups();
                  const baseNames =
                    whatToBringIconGroup === 'all'
                      ? MUI_ICON_NAMES
                      : (groups.find((g) => g.id === whatToBringIconGroup)?.iconNames ?? []);
                  const searchLower = (whatToBringIconSearch || '').trim().toLowerCase();
                  const namesToShow = searchLower
                    ? baseNames.filter((name) => name.toLowerCase().includes(searchLower))
                    : baseNames;
                  return (
                    <>
                      <div className={styles.whatToBringIconGridWrap}>
                        {namesToShow.map((name) => {
                          const IconComponent = MUI_ICONS[name];
                          if (!IconComponent) return null;
                          return (
                            <button
                              key={name}
                              type="button"
                              className={styles.whatToBringIconGridItem}
                              onClick={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  whatToBringItems: prev.whatToBringItems.map((it, i) =>
                                    i === whatToBringIconPickerIndex ? { ...it, icon: name } : it
                                  ),
                                }));
                                setWhatToBringIconPickerIndex(null);
                                setWhatToBringIconGroup('all');
                                setWhatToBringIconSearch('');
                              }}
                              title={name}
                            >
                              <IconComponent size={28} />
                            </button>
                          );
                        })}
                      </div>
                      {namesToShow.length === 0 && (
                        <p className={styles.whatToBringIconEmpty}>В этой группе нет иконок.</p>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

      </form>

      {/* Модалка: выбор мест для «Места рядом с маршрутом» — только места с совпадающей локацией */}
      {addNearbyPlacesModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={(e) => e.target === e.currentTarget && setAddNearbyPlacesModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-nearby-places-title"
        >
          <div
            className={styles.modalDialog}
            style={{ maxWidth: 480 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h2 id="add-nearby-places-title" className={styles.modalTitle}>Добавить места рядом с маршрутом</h2>
              <button
                type="button"
                onClick={() => setAddNearbyPlacesModalOpen(false)}
                className={styles.modalClose}
                aria-label="Закрыть"
              >
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.formListHint} style={{ marginBottom: 12 }}>
                Показаны только места, у которых локация совпадает с локацией одного из мест маршрута.
              </p>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                <input
                  type="text"
                  value={addNearbyPlacesSearch}
                  onChange={(e) => setAddNearbyPlacesSearch(e.target.value)}
                  className={styles.formInput}
                  placeholder="Поиск по названию или локации..."
                  style={{ paddingLeft: 40 }}
                />
              </div>
              {(() => {
                const alreadyIds = new Set([...(formData.placeIds || []), ...(formData.nearbyPlaceIds || [])]);
                const searchLower = (addNearbyPlacesSearch || '').trim().toLowerCase();
                const list = allPlaces.filter(
                  (p) => p.isActive !== false &&
                    !alreadyIds.has(p.id) &&
                    (p.location || '').trim() &&
                    routeLocations.has((p.location || '').trim().toLowerCase())
                ).filter(
                  (p) =>
                    !searchLower ||
                    (p.title || '').toLowerCase().includes(searchLower) ||
                    (p.location || '').toLowerCase().includes(searchLower)
                );
                return (
                  <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                    {list.length === 0 ? (
                      <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
                        {addNearbyPlacesSearch ? 'Ничего не найдено' : routeLocations.size === 0 ? 'Сначала добавьте места на маршрут и укажите им локацию' : 'Нет мест с такой же локацией'}
                      </div>
                    ) : (
                      list.map((p) => (
                        <label
                          key={p.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '10px 14px',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f1f5f9',
                            background: addNearbyPlacesSelected.has(p.id) ? '#eff6ff' : 'transparent',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={addNearbyPlacesSelected.has(p.id)}
                            onChange={() => toggleAddNearbyPlaceSelection(p.id)}
                          />
                          {p.image && (
                            <img
                              src={getImageUrl(p.image)}
                              alt=""
                              style={{ width: 40, height: 30, objectFit: 'cover', borderRadius: 6 }}
                            />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{p.title}</div>
                            {p.location && (
                              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{p.location}</div>
                            )}
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                );
              })()}
            </div>
            <div className={styles.modalFooter}>
              <button type="button" onClick={() => setAddNearbyPlacesModalOpen(false)} className={styles.cancelBtn}>
                Отмена
              </button>
              <button
                type="button"
                onClick={addSelectedNearbyPlaces}
                disabled={addNearbyPlacesSelected.size === 0}
                className={styles.submitBtn}
              >
                Добавить выбранные ({addNearbyPlacesSelected.size})
              </button>
            </div>
          </div>
          </div>
        )}

      {/* Модалка: выбор уже добавленных пунктов "Что взять с собой" */}
      {addExistingItemsModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={(e) => e.target === e.currentTarget && setAddExistingItemsModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-existing-items-title"
        >
          <div
            className={styles.modalDialog}
            style={{ maxWidth: 520 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h2 id="add-existing-items-title" className={styles.modalTitle}>Выберите пункты</h2>
              <button
                type="button"
                onClick={() => {
                  setAddExistingItemsModalOpen(false);
                  setAddExistingItemsSelected(new Set());
                  setAddExistingItemsSearch('');
                }}
                className={styles.modalClose}
                aria-label="Закрыть"
              >
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.formListHint} style={{ marginBottom: 12 }}>
                Выберите пункты из тех, что уже использовались в других маршрутах.
              </p>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                <input
                  type="text"
                  value={addExistingItemsSearch}
                  onChange={(e) => setAddExistingItemsSearch(e.target.value)}
                  className={styles.formInput}
                  placeholder="Поиск по тексту..."
                  style={{ paddingLeft: 40 }}
                />
              </div>
              {(() => {
                const existingTexts = new Set((formData.whatToBringItems ?? []).map((item) => item.text.toLowerCase().trim()));
                const searchLower = (addExistingItemsSearch || '').trim().toLowerCase();
                const filteredItems = allExistingItems.filter(
                  (item) => !existingTexts.has(item.text.toLowerCase().trim()) &&
                    (!searchLower || item.text.toLowerCase().includes(searchLower))
                );
                return (
                  <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                    {filteredItems.length === 0 ? (
                      <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
                        {searchLower ? 'Ничего не найдено' : 'Нет доступных пунктов'}
                      </div>
                    ) : (
                      filteredItems.map((item) => {
                        const itemKey = item.text.toLowerCase().trim();
                        const IconComponent = item.icon && getMuiIconComponent(item.icon);
                        return (
                          <label
                            key={itemKey}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              padding: '10px 14px',
                              cursor: 'pointer',
                              borderBottom: '1px solid #f1f5f9',
                              background: addExistingItemsSelected.has(itemKey) ? '#eff6ff' : 'transparent',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={addExistingItemsSelected.has(itemKey)}
                              onChange={() => toggleAddExistingItemSelection(itemKey)}
                            />
                            {IconComponent ? (
                              <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <IconComponent size={24} />
                              </div>
                            ) : (
                              <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: '#f1f5f9', borderRadius: 6 }}>
                                <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>?</span>
                              </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{item.text}</div>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                );
              })()}
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                onClick={() => {
                  setAddExistingItemsModalOpen(false);
                  setAddExistingItemsSelected(new Set());
                  setAddExistingItemsSearch('');
                }}
                className={styles.cancelBtn}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={addSelectedExistingItems}
                disabled={addExistingItemsSelected.size === 0}
                className={styles.submitBtn}
              >
                Добавить выбранные ({addExistingItemsSelected.size})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка: выбор похожих маршрутов — отсортированы по числу общих мест */}
      {addSimilarRoutesModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={(e) => e.target === e.currentTarget && setAddSimilarRoutesModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-similar-routes-title"
        >
          <div
            className={styles.modalDialog}
            style={{ maxWidth: 520 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h2 id="add-similar-routes-title" className={styles.modalTitle}>Добавить похожие маршруты</h2>
              <button
                type="button"
                onClick={() => setAddSimilarRoutesModalOpen(false)}
                className={styles.modalClose}
                aria-label="Закрыть"
              >
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.formListHint} style={{ marginBottom: 12 }}>
                Маршруты отсортированы по похожести: чем больше общих мест с текущим маршрутом, тем выше в списке.
              </p>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                <input
                  type="text"
                  value={addSimilarRoutesSearch}
                  onChange={(e) => setAddSimilarRoutesSearch(e.target.value)}
                  className={styles.formInput}
                  placeholder="Поиск по названию..."
                  style={{ paddingLeft: 40 }}
                />
              </div>
              {(() => {
                const searchLower = (addSimilarRoutesSearch || '').trim().toLowerCase();
                const list = routesWithSimilarity
                  .filter(({ route }) => !searchLower || (route.title || '').toLowerCase().includes(searchLower))
                  .map(({ route, sharedPlaceCount }) => ({ route, sharedPlaceCount }));
                return (
                  <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                    {list.length === 0 ? (
                      <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
                        {addSimilarRoutesSearch ? 'Ничего не найдено' : 'Нет других маршрутов для добавления'}
                      </div>
                    ) : (
                      list.map(({ route, sharedPlaceCount }) => (
                        <label
                          key={route.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '10px 14px',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f1f5f9',
                            background: addSimilarRoutesSelected.has(route.id) ? '#eff6ff' : 'transparent',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={addSimilarRoutesSelected.has(route.id)}
                            onChange={() => toggleAddSimilarRouteSelection(route.id)}
                          />
                          {route.images?.[0] && (
                            <img
                              src={getImageUrl(route.images[0])}
                              alt=""
                              style={{ width: 40, height: 30, objectFit: 'cover', borderRadius: 6 }}
                            />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{route.title}</div>
                          </div>
                          <span style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }} title="Общих мест с маршрутом">
                            {sharedPlaceCount} общих мест
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                );
              })()}
            </div>
            <div className={styles.modalFooter}>
              <button type="button" onClick={() => setAddSimilarRoutesModalOpen(false)} className={styles.cancelBtn}>
                Отмена
              </button>
              <button
                type="button"
                onClick={addSelectedSimilarRoutes}
                disabled={addSimilarRoutesSelected.size === 0}
                className={styles.submitBtn}
              >
                Добавить выбранные ({addSimilarRoutesSelected.size})
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={leaveModalOpen}
        title="Несохранённые изменения"
        message="Есть несохранённые изменения. Вы уверены, что хотите уйти? Они будут потеряны."
        confirmLabel="Уйти без сохранения"
        cancelLabel="Остаться"
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
