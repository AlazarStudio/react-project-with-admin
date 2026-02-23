'use client';

import { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Pencil, Trash2, Eye, EyeOff, GripVertical, X, Upload, Settings, ChevronUp, ChevronDown, Search, RefreshCw } from 'lucide-react';
import { menuAPI, mediaAPI, getImageUrl, dynamicPagesAPI, configAPI, updateApiBaseUrl, generateResourceAPI, structureAPI, adminDataAPI } from '@/lib/api';
import { AdminHeaderRightContext } from '../layout';
import { ConfirmModal, AlertModal, ProgressModal } from '../components';
import { MUI_ICON_NAMES, MUI_ICONS, getMuiIconComponent, getIconGroups } from '../components/WhatToBringIcons';
import { BLOCK_TYPES, createEmptyBlock } from '../components/NewsBlockEditor';
import styles from '../admin.module.css';

// Категории типов блоков для аккордеона в настройке структуры
const BLOCK_CATEGORIES = [
  { id: 'base', label: 'Базовые', types: ['heading', 'text', 'number', 'boolean', 'date', 'datetime'] },
  { id: 'choice', label: 'Выпадающие списки и связи', types: ['multiselect', 'relatedEntities'] },
  { id: 'links', label: 'Ссылки и контакты', types: ['url', 'contact'] },
  { id: 'media', label: 'Медиа и файлы', types: ['image', 'gallery', 'file', 'video', 'audio'] },
  { id: 'structured', label: 'Структурированные', types: ['list', 'table', 'accordion', 'tabs', 'quote', 'json'] },
];

// Системные пункты меню (неудаляемые) - только Настройки
const SYSTEM_MENU_ITEMS = [
  { href: '/admin/settings', label: 'Настройки', isSystem: true },
];

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState('menu'); // 'menu' | 'backend'
  const [menuItems, setMenuItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [backendUrl, setBackendUrl] = useState('');
  const [backendUrlSaving, setBackendUrlSaving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [menuItemModal, setMenuItemModal] = useState({ open: false, itemId: null });
  const [editForm, setEditForm] = useState({ label: '', url: '', icon: '', iconType: 'library', isVisible: true, useTranslation: true });
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const dragOverRef = useRef(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [alertModal, setAlertModal] = useState({ open: false, title: '', message: '', variant: 'error' });
  const [showToast, setShowToast] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconPickerGroup, setIconPickerGroup] = useState('all');
  const [iconPickerSearch, setIconPickerSearch] = useState('');
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [structureModal, setStructureModal] = useState({ open: false, itemId: null, itemLabel: '', slug: null });
  const [structureFields, setStructureFields] = useState([]);
  const [resourceMetadata, setResourceMetadata] = useState({}); // Хранит метаданные моделей для каждого пункта меню
  const [isMenuResourceGenerated, setIsMenuResourceGenerated] = useState(false); // Флаг генерации ресурса Menu
  const setHeaderRight = useContext(AdminHeaderRightContext)?.setHeaderRight;

  const stripAdminPrefix = useCallback((url) => {
    if (typeof url !== 'string') return '';
    const v = url.trim();
    if (!v) return '';
    if (v === '/admin') return '';
    if (v.startsWith('/admin/')) return v.slice('/admin/'.length);
    if (v.startsWith('admin/')) return v.slice('admin/'.length);
    if (v.startsWith('/admin')) return v.slice('/admin'.length).replace(/^\/+/, '');
    return v.replace(/^\/+/, '');
  }, []);

  // Функция для проверки наличия структуры для пункта меню (проверяет только текущее состояние)
  const checkStructureExists = useCallback((menuItem) => {
    if (!menuItem) return false;
    
    const slug = stripAdminPrefix(menuItem.url);
    if (!slug) return false;
    
    // Если модальное окно структуры открыто для этого пункта, проверяем текущее состояние
    if (structureModal.open && structureModal.itemId === menuItem.id && structureFields.length > 0) {
      return true;
    }
    
    // Проверяем resourceMetadata (только в памяти, не localStorage)
    const metadata = resourceMetadata[menuItem.id];
    if (metadata && metadata.fields && metadata.fields.length > 0) {
      return true;
    }
    
    return false;
  }, [structureModal, structureFields, resourceMetadata, stripAdminPrefix]);
  const [structureBlockSearch, setStructureBlockSearch] = useState('');
  const [structureAccordionOpen, setStructureAccordionOpen] = useState(new Set(['base']));
  const [structureDraggedIndex, setStructureDraggedIndex] = useState(null);
  const [structureDragOverIndex, setStructureDragOverIndex] = useState(null);
  const structureDragOverRef = useRef(null);
  const savedItemsRef = useRef(null);
  const urlManuallyEditedRef = useRef(false);
  const [syncingResource, setSyncingResource] = useState(null); // ID пункта меню, который синхронизируется
  const [progressModal, setProgressModal] = useState({ 
    open: false, 
    title: '', 
    steps: [], 
    currentStep: 0,
    error: null 
  }); // Модальное окно прогресса генерации
  const [isStructureSaving, setIsStructureSaving] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [importingData, setImportingData] = useState(false);
  const importFileInputRef = useRef(null);

  const buildAdminUrl = useCallback((raw) => {
    if (typeof raw !== 'string') return '';
    const v = raw.trim();
    if (!v) return '';
    if (v === '/admin' || v === 'admin') return '/admin';
    if (v.startsWith('/admin/')) return v.replace(/\/+$/, '');
    if (v.startsWith('/admin')) {
      const rest = v.slice('/admin'.length).replace(/^\/+/, '');
      return rest ? `/admin/${rest}` : '/admin';
    }
    const normalized = v.replace(/^\/+/, '').replace(/\/+$/, '');
    return `/admin/${normalized}`;
  }, []);

  // Транслитерация кириллицы в латиницу
  const transliterate = useCallback((text) => {
    const map = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
      'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
      'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
      'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
      'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo', 'Ж': 'Zh',
      'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O',
      'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'H', 'Ц': 'Ts',
      'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch', 'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
    };
    return text.split('').map(char => map[char] || char).join('');
  }, []);

  // Словарь для перевода русских слов в английские
  const translationDict = useCallback(() => {
    return {
      'главная': 'home', 'главная страница': 'home',
      'места': 'places', 'место': 'place',
      'маршруты': 'routes', 'маршрут': 'route',
      'новости': 'news', 'новость': 'news',
      'статьи': 'articles', 'статья': 'article',
      'услуги': 'services', 'услуга': 'service',
      'отзывы': 'reviews', 'отзыв': 'review',
      'пользователи': 'users', 'пользователь': 'user',
      'страницы': 'pages', 'страница': 'page',
      'настройки': 'settings', 'настройка': 'setting',
      'регион': 'region', 'о регионе': 'about-region',
      'поиск': 'search',
      'контакты': 'contacts', 'контакт': 'contact',
      'о нас': 'about', 'о компании': 'about',
      'галерея': 'gallery',
      'блог': 'blog',
      'кейсы': 'cases', 'кейс': 'case',
      'проекты': 'projects', 'проект': 'project',
      'портфолио': 'portfolio',
      'компания': 'company', 'компании': 'companies',
      'каталог': 'catalog', 'каталоги': 'catalogs',
      'товары': 'products', 'товар': 'product',
      'категории': 'categories', 'категория': 'category',
    };
  }, []);

  // Перевод русских слов в английские
  const translateToEnglish = useCallback((text) => {
    if (!text || typeof text !== 'string') return null;
    const dict = translationDict();
    const lowerText = text.toLowerCase().trim();
    
    // Проверяем точное совпадение
    if (dict[lowerText]) {
      return dict[lowerText];
    }
    
    // Проверяем частичные совпадения (сначала более длинные совпадения)
    const sortedEntries = Object.entries(dict).sort((a, b) => b[0].length - a[0].length);
    for (const [ru, en] of sortedEntries) {
      if (lowerText.includes(ru)) {
        return en;
      }
    }
    
    // Если не нашли перевод, возвращаем null (будет использована транслитерация)
    return null;
  }, [translationDict]);

  // Генерация URL из названия
  const generateUrlFromLabel = useCallback((label, useTranslation = false) => {
    if (!label || typeof label !== 'string') return '';
    
    let result = '';
    if (useTranslation) {
      const translated = translateToEnglish(label);
      if (translated) {
        result = translated;
      } else {
        // Если перевод не найден, используем транслитерацию
        result = transliterate(label.trim());
      }
    } else {
      result = transliterate(label.trim());
    }
    
    return result
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Удаляем все кроме букв, цифр, пробелов и дефисов
      .replace(/\s+/g, '-') // Пробелы в дефисы
      .replace(/-+/g, '-') // Множественные дефисы в один
      .replace(/^-+|-+$/g, ''); // Убираем дефисы в начале и конце
  }, [transliterate, translateToEnglish]);

  // Автоматический подбор иконки на основе названия
  const suggestIconFromLabel = useCallback((label) => {
    if (!label || typeof label !== 'string') return null;
    
    const lowerLabel = label.toLowerCase();
    
    // Маппинг ключевых слов к иконкам
    const iconMap = {
      // Главная
      'главная': 'Home',
      'home': 'Home',
      
      // Места
      'места': 'MapPin',
      'место': 'MapPin',
      'places': 'MapPin',
      'place': 'MapPin',
      
      // Маршруты
      'маршруты': 'Map',
      'маршрут': 'Map',
      'routes': 'Map',
      'route': 'Map',
      
      // Новости
      'новости': 'Newspaper',
      'новость': 'Newspaper',
      'news': 'Newspaper',
      'статьи': 'FileText',
      'статья': 'FileText',
      'articles': 'FileText',
      'article': 'FileText',
      
      // Услуги
      'услуги': 'Building2',
      'услуга': 'Building2',
      'services': 'Building2',
      'service': 'Building2',
      
      // Отзывы
      'отзывы': 'Star',
      'отзыв': 'Star',
      'reviews': 'Star',
      'review': 'Star',
      
      // Пользователи
      'пользователи': 'Users',
      'пользователь': 'Users',
      'users': 'Users',
      'user': 'Users',
      
      // Страницы
      'страницы': 'FileText',
      'страница': 'FileText',
      'pages': 'FileText',
      'page': 'FileText',
      
      // Настройки
      'настройки': 'Settings',
      'настройка': 'Settings',
      'settings': 'Settings',
      'setting': 'Settings',
      
      // Регион
      'регион': 'MapPin',
      'region': 'MapPin',
      
      // Поиск
      'поиск': 'Search',
      'search': 'Search',
      
      // Контакты
      'контакты': 'Phone',
      'контакт': 'Phone',
      'contacts': 'Phone',
      'contact': 'Phone',
      
      // О нас
      'о нас': 'Info',
      'about': 'Info',
      
      // Галерея
      'галерея': 'Image',
      'gallery': 'Image',
      
      // Блог
      'блог': 'BookOpen',
      'blog': 'BookOpen',
    };
    
    // Ищем точное совпадение
    if (iconMap[lowerLabel.trim()]) {
      const iconName = iconMap[lowerLabel.trim()];
      if (getMuiIconComponent(iconName)) {
        return iconName;
      }
    }
    
    // Ищем частичное совпадение
    for (const [keyword, iconName] of Object.entries(iconMap)) {
      if (lowerLabel.includes(keyword)) {
        if (getMuiIconComponent(iconName)) {
          return iconName;
        }
      }
    }
    
    return null;
  }, []);

  // Нормализуем данные для сравнения (сортируем по order и убираем лишние поля)
  const normalizeItems = (items) => {
    return items
      .map(item => ({
        id: item.id,
        label: item.label?.trim() || '',
        url: item.url?.trim() || '',
        order: item.order || 0,
        isVisible: item.isVisible !== false,
        icon: item.icon || '',
        iconType: item.iconType || (item.icon && (item.icon.startsWith('http') || item.icon.startsWith('/')) ? 'upload' : 'library'),
        isSystem: item.isSystem || SYSTEM_MENU_ITEMS.some(si => si.href === item.url)
      }))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  };

  // Для структуры ресурса всегда добавляем служебный блок additionalBlocks.
  // В UI структуры он не отображается, но должен храниться в БД.
  const buildStructurePayloadFields = useCallback((blocks) => {
    const payloadFields = (Array.isArray(blocks) ? blocks : []).map((block, i) => ({
      type: block.type,
      order: i,
      label: block.label ?? '',
    }));

    if (!payloadFields.some((field) => field.type === 'additionalBlocks')) {
      payloadFields.push({
        type: 'additionalBlocks',
        order: payloadFields.length,
        label: 'additionalBlocks',
      });
    }

    return payloadFields;
  }, []);

  const isDirty = savedItemsRef.current !== null && 
    JSON.stringify(normalizeItems(menuItems)) !== JSON.stringify(normalizeItems(savedItemsRef.current));

  useEffect(() => {
    // Загружаем пункты меню только с бэка
    fetchMenu();

    // Загружаем URL backend из БД через защищенный endpoint
    const loadBackendConfig = async () => {
      try {
        const configRes = await configAPI.get();
        const savedUrl = configRes.data?.backendApiUrl || '';
        const envRaw = import.meta.env.VITE_API_URL;
        const envUrl = (envRaw && typeof envRaw === 'string' && envRaw.startsWith('http')) ? envRaw.replace(/\/api\/?$/, '') : '';
        const urlToUse = savedUrl || envUrl;
        setBackendUrl(urlToUse);
        
        // Если конфиг не найден - переключаемся на вкладку подключения backend
        if (!savedUrl && !envUrl) {
          setActiveTab('backend');
        }
      } catch (error) {
        const envRaw = import.meta.env.VITE_API_URL;
        const envUrl = (envRaw && typeof envRaw === 'string' && envRaw.startsWith('http')) ? envRaw.replace(/\/api\/?$/, '') : '';
        setBackendUrl(envUrl);
        
        // Если и env пустой - переключаемся на вкладку подключения
        if (!envUrl) {
          setActiveTab('backend');
        }
      }
    };
    loadBackendConfig();
  }, []);

  useEffect(() => {
    if (iconPickerOpen) setIconPickerSearch('');
  }, [iconPickerOpen]);

  const saveMenuItems = useCallback(async (itemsToSave, skipBackendSync = false) => {
    setIsSaving(true);
    try {
      // Фильтруем пункт Настройки - он не сохраняется в настройках
      const itemsToSaveFiltered = itemsToSave.filter(item => item.url !== '/admin/settings');
      
      // Нормализуем и обновляем order для всех элементов
      // Сохраняем isSystem для правильного отображения кнопок
      const itemsWithOrder = itemsToSaveFiltered.map((item, index) => {
        const isSystem = SYSTEM_MENU_ITEMS.some(si => si.href === item.url);
        const icon = item.icon || '';
        const iconType = item.iconType || (icon && (icon.startsWith('http') || icon.startsWith('/')) ? 'upload' : 'library');
        return {
          id: item.id,
          label: item.label?.trim() || '',
          url: item.url?.trim() || '',
          order: index + 1,
          isVisible: item.isVisible !== false,
          icon: icon,
          iconType: iconType,
          isSystem: isSystem
        };
      });
      
      // Сохраняем на бэк (всегда, без проверки флагов)
      if (!skipBackendSync) {
        try {
          await menuAPI.update(itemsWithOrder);
          console.log('✅ Меню синхронизировано с бэком');
        } catch (error) {
          // Игнорируем ошибку, если ресурс еще не сгенерирован - данные сохранены локально
          // Это нормально до генерации ресурса меню через админку
          if (error.response?.status === 404) {
            console.log('📝 Меню сохранено локально. Сгенерируйте ресурс меню через админку для синхронизации с бэком.');
          } else {
            console.warn('⚠️ Не удалось синхронизировать меню с бэком:', error.message);
          }
        }
      } else {
        console.log('📝 Меню сохранено локально (синхронизация с бэком пропущена).');
      }
      
      // Сохраняем полные данные с isSystem для отображения
      // Важно: сохраняем isSystem в состоянии, чтобы кнопки удаления работали правильно
      const itemsWithSystem = itemsToSaveFiltered.map(item => {
        const saved = itemsWithOrder.find(i => i.id === item.id);
        return {
          ...item,
          order: saved?.order || item.order,
          icon: saved?.icon || item.icon || '',
          iconType: saved?.iconType || item.iconType || (item.icon && (item.icon.startsWith('http') || item.icon.startsWith('/')) ? 'upload' : 'library'),
          isSystem: item.isSystem || SYSTEM_MENU_ITEMS.some(si => si.href === item.url)
        };
      });
      setMenuItems(itemsWithSystem);
      savedItemsRef.current = JSON.parse(JSON.stringify(itemsWithSystem));
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
      
      // Отправляем событие для обновления меню в layout после небольшой задержки,
      // чтобы дать время React обновить состояние
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('menuUpdated'));
      }, 100);
    } catch (error) {
      console.error('Ошибка сохранения меню:', error);
      setAlertModal({ 
        open: true, 
        title: 'Ошибка', 
        message: 'Не удалось сохранить меню' 
      });
    } finally {
      setIsSaving(false);
    }
  }, []);

  const handleSave = useCallback(async () => {
    await saveMenuItems(menuItems);
  }, [menuItems, saveMenuItems]);

  const handleSaveBackendUrl = useCallback(async () => {
    if (!backendUrl.trim()) {
      setAlertModal({
        open: true,
        title: 'Ошибка',
        message: 'Введите URL backend'
      });
      return;
    }

    setBackendUrlSaving(true);
    try {
      // Сначала проверяем что указанный URL - это наш бэкенд
      const testUrl = backendUrl.trim()
      let fullUrl
      
      // Валидация URL
      try {
        if (testUrl.startsWith('http://') || testUrl.startsWith('https://')) {
          fullUrl = new URL(testUrl)
        } else {
          fullUrl = new URL(`http://${testUrl}`)
        }
        
        if (!['http:', 'https:'].includes(fullUrl.protocol)) {
          throw new Error('URL должен начинаться с http:// или https://')
        }
        
        if (!fullUrl.hostname || fullUrl.hostname.trim() === '') {
          throw new Error('URL должен содержать домен или IP адрес')
        }
        
        const hostname = fullUrl.hostname
        const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)
        const isLocalhost = hostname === 'localhost'
        const hasDomain = hostname.includes('.') && hostname.split('.').length >= 2
        
        if (!isIP && !isLocalhost && !hasDomain) {
          throw new Error('URL должен содержать валидный домен или IP адрес')
        }
      } catch (urlError) {
        setBackendUrlSaving(false);
        setAlertModal({
          open: true,
          title: 'Ошибка',
          message: urlError.message || 'Введите корректный URL (например: http://localhost:5000 или https://back.example.com)'
        });
        return;
      }
      
      // Проверяем что это наш бэкенд через /api/config
      const baseUrl = fullUrl.toString().replace(/\/+$/, '')
      const testApiUrl = `${baseUrl}/api`
      
      try {
        const axios = (await import('axios')).default
        const testAxios = axios.create({
          baseURL: testApiUrl,
          timeout: 5000,
        })
        
        const testResponse = await testAxios.get('/config', {
          validateStatus: (status) => status === 200,
        })
        
        // Проверяем что ответ имеет правильную структуру
        if (!testResponse.data || typeof testResponse.data !== 'object' || !('backendApiUrl' in testResponse.data)) {
          setBackendUrlSaving(false);
          setAlertModal({
            open: true,
            title: 'Ошибка',
            message: 'Указанный сервер не является бэкендом. Убедитесь, что указан правильный адрес сервера .'
          });
          return;
        }
      } catch (testError) {
        setBackendUrlSaving(false);
        setAlertModal({
          open: true,
          title: 'Ошибка',
          message: 'Не удалось подключиться к бэкенду. Проверьте, что сервер запущен и доступен, и что указан правильный адрес сервера.'
        });
        return;
      }
      
      // Отправляем запрос на текущий бэкенд для проверки подключения и сохранения
      // Бэкенд сам проверит подключение к указанному URL и сохранит конфигурацию в БД
      console.log('📤 Отправляю запрос на сохранение конфигурации:', { backendApiUrl: backendUrl.trim() });
      
      // Проверяем текущий baseURL перед запросом
      const apiModule = await import('@/lib/api');
      console.log('🔍 Текущий baseURL axios:', apiModule.default.defaults.baseURL);
      console.log('🔍 Токен авторизации:', typeof window !== 'undefined' ? (localStorage.getItem('token') || localStorage.getItem('adminToken') ? 'ЕСТЬ' : 'НЕТ') : 'N/A');
      
      let response;
      try {
        // Передаем URL фронтенда для обновления config.json через PHP
        const frontendUrl = typeof window !== 'undefined' ? window.location.origin : '';
        response = await configAPI.update({ 
          backendApiUrl: backendUrl.trim(),
          frontendUrl: frontendUrl
        });
        console.log('📥 Получен ответ от бэкенда:', response.data);
      } catch (error) {
        console.error('❌ Ошибка при сохранении конфигурации:', error);
        console.error('❌ Детали ошибки:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          config: {
            url: error.config?.url,
            baseURL: error.config?.baseURL,
            method: error.config?.method
          }
        });
        setBackendUrlSaving(false);
        setAlertModal({
          open: true,
          title: 'Ошибка',
          message: error.response?.data?.message || error.message || 'Не удалось сохранить конфигурацию. Проверьте консоль для деталей.'
        });
        return;
      }
      
      if (response.data?.success) {
        // Обновляем baseURL в axios для всех последующих запросов
        updateApiBaseUrl(backendUrl.trim());
        
        // URL сохраняется только на бэке через configAPI.update
        
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
        
        // Показываем подтверждение перезагрузки
        setConfirmModal({
          open: true,
          title: 'Подключение успешно',
          message: response.data?.message || 'Backend подключен успешно. Для применения изменений необходимо перезагрузить страницу. Перезагрузить сейчас?',
          confirmLabel: 'Перезагрузить',
          cancelLabel: 'Позже',
          variant: 'default',
          onConfirm: () => {
            window.location.reload();
          },
          onCancel: () => {
            setConfirmModal(null);
          }
        });
      }
    } catch (error) {
      console.error('Ошибка сохранения URL backend:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Не удалось подключиться к указанному backend';
      setAlertModal({
        open: true,
        title: 'Ошибка подключения',
        message: errorMessage
      });
    } finally {
      setBackendUrlSaving(false);
    }
  }, [backendUrl]);

  const handleExportData = useCallback(async () => {
    setExportingData(true);
    try {
      setProgressModal({
        open: true,
        title: 'Экспорт данных',
        steps: [
          { label: 'Подготовка снимка', description: 'Собираем настройки, структуры, схемы и данные из базы.' },
          { label: 'Формирование файла', description: 'Готовим JSON-файл для скачивания.' },
        ],
        currentStep: 0,
        error: null,
      });

      const response = await adminDataAPI.exportSnapshot();
      setProgressModal((prev) => ({ ...prev, currentStep: 1 }));

      const filename = `admin-export-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setProgressModal((prev) => ({ ...prev, currentStep: 2 }));
      setAlertModal({
        open: true,
        title: 'Экспорт завершен',
        message: `Файл успешно сохранен: ${filename}`,
        variant: 'success',
      });
    } catch (error) {
      console.error('Ошибка экспорта:', error);
      setProgressModal((prev) => ({
        ...prev,
        error: error.response?.data?.message || error.message || 'Не удалось экспортировать данные',
      }));
    } finally {
      setExportingData(false);
    }
  }, []);

  const executeImportData = useCallback(async (snapshot) => {
    setImportingData(true);
    try {
      setProgressModal({
        open: true,
        title: 'Импорт данных (не обновляйте страницу)',
        steps: [
          { label: 'Проверка файла', description: 'Проверяем корректность загруженного файла.' },
          { label: 'Отправка на сервер', description: 'Передаем файл импорта на backend.' },
          { label: 'Полная замена данных', description: 'Выполняется reset и восстановление из файла.' },
          { label: 'Финализация', description: 'Не обновляйте страницу до завершения процесса.' },
        ],
        currentStep: 0,
        error: null,
      });

      setProgressModal((prev) => ({ ...prev, currentStep: 1 }));
      setProgressModal((prev) => ({ ...prev, currentStep: 2 }));
      await adminDataAPI.importSnapshot(snapshot);
      setProgressModal((prev) => ({ ...prev, currentStep: 3 }));
      setProgressModal((prev) => ({ ...prev, currentStep: 4 }));

      setConfirmModal({
        open: true,
        title: 'Импорт завершен',
        message: 'Импорт успешно завершен. Для корректного применения изменений рекомендуется перезагрузить страницу. Перезагрузить сейчас?',
        confirmLabel: 'Перезагрузить',
        cancelLabel: 'Позже',
        variant: 'default',
        onConfirm: () => {
          window.location.reload();
        },
        onCancel: () => {
          setConfirmModal(null);
        },
      });
    } catch (error) {
      console.error('Ошибка импорта:', error);
      setProgressModal((prev) => ({
        ...prev,
        error: error.response?.data?.message || error.message || 'Не удалось импортировать данные',
      }));
    } finally {
      setImportingData(false);
    }
  }, []);

  const handleImportFileSelected = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);

      setConfirmModal({
        open: true,
        title: 'Импорт данных с полной заменой',
        message: 'Все текущие данные, структуры, схемы и сгенерированные ресурсы будут полностью заменены данными из выбранного файла. Продолжить?',
        confirmLabel: 'Импортировать',
        cancelLabel: 'Отмена',
        variant: 'danger',
        onConfirm: async () => {
          setConfirmModal(null);
          await executeImportData(parsed?.snapshot ? parsed.snapshot : parsed);
        },
        onCancel: () => {
          setConfirmModal(null);
        },
      });
    } catch (error) {
      console.error('Ошибка чтения файла импорта:', error);
      setAlertModal({
        open: true,
        title: 'Ошибка',
        message: 'Не удалось прочитать файл импорта. Проверьте формат JSON.',
        variant: 'error',
      });
    }
  }, [executeImportData]);

  useEffect(() => {
    if (!setHeaderRight) return;
    const label = isSaving ? 'Сохранение...' : isDirty ? 'Сохранить изменения' : 'Сохранено';
    const cls = [styles.headerSubmitBtn, !isDirty && !isSaving && styles.headerSubmitBtnSaved].filter(Boolean).join(' ');
    setHeaderRight(
      <button type="button" className={cls} onClick={handleSave} disabled={isSaving || !isDirty}>
        {label}
      </button>
    );
    return () => setHeaderRight(null);
  }, [setHeaderRight, isDirty, isSaving, handleSave]);

  const fetchMenu = async () => {
    setIsLoading(true);
    try {
      let savedItems = [];
      
      // ВСЕГДА пытаемся загрузить меню с бэка, независимо от флагов
      try {
        const response = await menuAPI.get();
        savedItems = response.data?.items || [];

        // Ресурс считается сгенерированным, если endpoint /menu существует (не 404),
        // даже когда в меню пока нет ни одного пункта.
        const isGenerated = response.status !== 404;
        setIsMenuResourceGenerated(isGenerated);
      } catch (error) {
        // Если 404 - значит ресурс еще не сгенерирован
        if (error.response?.status === 404) {
          console.log('⚠️ Ресурс Menu еще не сгенерирован на бэке');
          setIsMenuResourceGenerated(false);
          savedItems = [];
        } else {
          console.error('Ошибка загрузки меню с бэка:', error);
          setIsMenuResourceGenerated(false);
          savedItems = [];
        }
      }
      
      // Создаем карту сохраненных пунктов по href
      const savedMap = new Map();
      savedItems.forEach(item => {
        savedMap.set(item.url, item);
      });
      
      // Объединяем системные и сохраненные пункты
      const allItems = [];
      
      // Добавляем все сохраненные пункты (исключая Настройки)
      savedItems
        .filter(item => item.url !== '/admin/settings') // Исключаем пункт Настройки
        .forEach(item => {
          const isSystem = SYSTEM_MENU_ITEMS.some(si => si.href === item.url);
          const icon = item.icon || '';
          const iconType = item.iconType || (icon && (icon.startsWith('http') || icon.startsWith('/')) ? 'upload' : 'library');
          allItems.push({
            id: item.id,
            label: item.label || '',
            url: item.url || '',
            order: item.order || 0,
            isVisible: item.isVisible !== false,
            icon: icon,
            iconType: iconType,
            isSystem: isSystem
          });
        });
      
      // Сортируем по order
      const sortedItems = [...allItems].sort((a, b) => (a.order || 0) - (b.order || 0));
      // Убеждаемся, что isSystem установлен для всех пунктов
      const itemsWithSystem = sortedItems.map(item => ({
        ...item,
        isSystem: item.isSystem !== undefined ? item.isSystem : SYSTEM_MENU_ITEMS.some(si => si.href === item.url)
      }));
      setMenuItems(itemsWithSystem);
      savedItemsRef.current = JSON.parse(JSON.stringify(itemsWithSystem));
    } catch (error) {
      console.error('Ошибка загрузки меню:', error);
      setAlertModal({ 
        open: true, 
        title: 'Ошибка', 
        message: 'Не удалось загрузить меню' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Функция для генерации ресурса Menu
  const generateMenuResource = async () => {
    // Показываем модалку прогресса генерации ресурса Menu
    const menuGenerationSteps = [
      { label: 'Генерация модели Prisma', description: 'Создание схемы базы данных' },
      { label: 'Генерация контроллера', description: 'Создание логики обработки запросов' },
      { label: 'Генерация роутов', description: 'Создание API endpoints' },
      { label: 'Регистрация роутов', description: 'Подключение к серверу' },
      { label: 'Синхронизация с БД', description: 'Применение изменений в базе данных' },
    ];

    setProgressModal({
      open: true,
      title: 'Генерация ресурса Menu',
      steps: menuGenerationSteps,
      currentStep: 0,
      error: null,
    });

    try {
      // Генерируем ресурс Menu как обычную коллекцию записей
      const menuFields = [
        { name: 'label', type: 'String', required: true },
        { name: 'url', type: 'String', required: true },
        { name: 'order', type: 'Int', required: false },
        { name: 'isVisible', type: 'Boolean', required: false },
        { name: 'icon', type: 'String', required: false },
        { name: 'iconType', type: 'String', required: false },
        { name: 'isSystem', type: 'Boolean', required: false },
      ];

      // Обновляем прогресс по шагам
      const updateProgress = (step) => {
        setProgressModal(prev => ({ ...prev, currentStep: step }));
      };

      // Симулируем прогресс генерации
      updateProgress(0); // Шаг 1: Генерация модели Prisma
      await new Promise(resolve => setTimeout(resolve, 200));
      
      updateProgress(1); // Шаг 2: Генерация контроллера
      await new Promise(resolve => setTimeout(resolve, 200));
      
      updateProgress(2); // Шаг 3: Генерация роутов
      await new Promise(resolve => setTimeout(resolve, 200));
      
      updateProgress(3); // Шаг 4: Регистрация роутов
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Вызываем API генерации
      await generateResourceAPI.generate({
        resourceName: 'Menu',
        fields: menuFields,
        menuItem: null, // Для Menu не нужен menuItem
        resourceType: 'collectionBulk',
      });

      // Если генерация успешна, переходим к последнему шагу
      updateProgress(4); // Шаг 5: Синхронизация с БД
      await new Promise(resolve => setTimeout(resolve, 500));

      // Ресурс Menu сгенерирован
      setIsMenuResourceGenerated(true);

      // Ждем несколько секунд, чтобы сервер успел перезапуститься после prisma generate
      console.log('⏳ Ждем перезапуска сервера после генерации Prisma Client...')
      await new Promise(resolve => setTimeout(resolve, 5000)) // 5 секунд задержки для перезапуска nodemon
      
      // Закрываем модалку прогресса
      setProgressModal(prev => ({ ...prev, open: false }));

      // Перезагружаем меню с бэка
      await fetchMenu();

      // Показываем успешное сообщение
      setAlertModal({
        open: true,
        title: 'Успех',
        message: 'Ресурс Menu успешно сгенерирован. Теперь вы можете добавлять пункты меню.',
        variant: 'success',
      });

    } catch (error) {
      console.error('Ошибка генерации ресурса Menu:', error);
      setProgressModal(prev => ({ 
        ...prev, 
        error: error.response?.data?.message || error.message || 'Неизвестная ошибка генерации ресурса Menu'
      }));
    }
  };

  const openAddModal = () => {
    setMenuItemModal({ open: true, itemId: null });
    setEditForm({
      label: '',
      url: '',
      icon: '',
      iconType: 'library',
      isVisible: true,
      useTranslation: true,
    });
    urlManuallyEditedRef.current = false;
    setIconPickerOpen(false);
    setIconPickerGroup('all');
    setIconPickerSearch('');
  };

  const openEditModal = (item) => {
    const icon = item.icon || '';
    const iconType = item.iconType || (icon && (icon.startsWith('http') || icon.startsWith('/')) ? 'upload' : 'library');
    setMenuItemModal({ open: true, itemId: item.id });
    setEditForm({
      label: item.label || '',
      url: stripAdminPrefix(item.url || ''),
      icon,
      iconType,
      isVisible: item.isVisible !== false,
      useTranslation: true, // По умолчанию перевод
    });
    urlManuallyEditedRef.current = true; // При редактировании URL уже установлен, не меняем автоматически
    setIconPickerOpen(false);
    setIconPickerGroup('all');
    setIconPickerSearch('');
  };

  const closeMenuItemModal = () => {
    setMenuItemModal({ open: false, itemId: null });
    setEditForm({ label: '', url: '', icon: '', iconType: 'library', isVisible: true, useTranslation: true });
    urlManuallyEditedRef.current = false;
    setIconPickerOpen(false);
    setIconPickerGroup('all');
    setIconPickerSearch('');
    setUploadingIcon(false);
  };

  const saveMenuItemFromModal = async () => {
    if (!editForm.label.trim() || !editForm.url.trim()) {
      setAlertModal({
        open: true,
        title: 'Ошибка',
        message: 'Заполните все поля',
      });
      return;
    }

    const adminUrl = buildAdminUrl(editForm.url);
    if (!adminUrl) {
      setAlertModal({
        open: true,
        title: 'Ошибка',
        message: 'Некорректная ссылка',
      });
      return;
    }

    const icon = editForm.icon || '';
    const iconType = editForm.iconType || (icon && (icon.startsWith('http') || icon.startsWith('/')) ? 'upload' : 'library');

    let updatedItems;
    const isNewItem = menuItemModal.itemId == null;
    
    // Проверяем, сгенерирован ли ресурс Menu
    if (!isMenuResourceGenerated) {
      setAlertModal({
        open: true,
        title: 'Ошибка',
        message: 'Ресурс Menu еще не сгенерирован. Пожалуйста, сначала сгенерируйте ресурс Menu.',
        variant: 'error',
      });
      return;
    }

    if (isNewItem) {
      // Ресурс Menu уже сгенерирован - просто сохраняем пункт меню в БД
      const newItem = {
        id: Date.now(),
        label: editForm.label.trim(),
        url: adminUrl,
        order: menuItems.length + 1,
        isVisible: editForm.isVisible !== false,
        icon,
        iconType,
        isSystem: false,
      };
      
      updatedItems = [...menuItems, newItem];
      
      try {
        // Сохраняем в БД через API
        await menuAPI.update(updatedItems.filter(item => item.url !== '/admin/settings'));
        
        // Обновляем состояние
        setMenuItems(updatedItems);
        savedItemsRef.current = updatedItems;
        
        // Перезагружаем меню с бэка
        await fetchMenu();
        
        // Отправляем событие для обновления меню в layout
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('menuUpdated'));
        }, 200);
        
        closeMenuItemModal();
        
        // Показываем успешное сообщение
        setAlertModal({
          open: true,
          title: 'Успех',
          message: 'Пункт меню успешно создан и сохранен в базе данных',
          variant: 'success',
        });
      } catch (error) {
        console.error('Ошибка сохранения пункта меню:', error);
        setAlertModal({
          open: true,
          title: 'Ошибка',
          message: error.response?.data?.message || error.message || 'Не удалось сохранить пункт меню',
          variant: 'error',
        });
      }
      return;
    } else {
      // Редактирование существующего пункта меню
      updatedItems = menuItems.map((item) => {
        if (item.id !== menuItemModal.itemId) return item;
        const isSystem = SYSTEM_MENU_ITEMS.some((si) => si.href === item.url);
        return {
          ...item,
          label: editForm.label.trim(),
          url: adminUrl,
          isVisible: editForm.isVisible !== false,
          icon,
          iconType,
          isSystem,
        };
      });

      // Сохраняем в БД через API (если ресурс Menu сгенерирован)
      if (isMenuResourceGenerated) {
        try {
          await menuAPI.update(updatedItems.filter(item => item.url !== '/admin/settings'));
          
          // Перезагружаем меню с бэка
          await fetchMenu();
          
          // Отправляем событие для обновления меню в layout
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('menuUpdated'));
          }, 200);
        } catch (error) {
          console.error('Ошибка сохранения пункта меню:', error);
          setAlertModal({
            open: true,
            title: 'Ошибка',
            message: error.response?.data?.message || error.message || 'Не удалось сохранить изменения',
            variant: 'error',
          });
          return;
        }
      }
      
      setMenuItems(updatedItems);
      savedItemsRef.current = updatedItems;
      closeMenuItemModal();
    }
  };

  // Функции генерации удалены - генерация теперь происходит автоматически при сохранении структуры

  // Функция синхронизации ресурса с бэком
  const syncResourceWithBackend = async (menuItemId) => {
    const metadata = resourceMetadata[menuItemId];
    
    if (!metadata) {
      setAlertModal({
        open: true,
        title: 'Ошибка',
        message: 'Метаданные модели не найдены. Создайте структуру для этого пункта меню.',
      });
      return;
    }
    
    if (metadata.synced) {
      setAlertModal({
        open: true,
        title: 'Информация',
        message: 'Ресурс уже синхронизирован с бэком.',
      });
      return;
    }
    
    if (!metadata.fields || metadata.fields.length === 0) {
      setAlertModal({
        open: true,
        title: 'Ошибка',
        message: 'Необходимо создать структуру для этого пункта меню перед синхронизацией.',
      });
      return;
    }
    
    setSyncingResource(menuItemId);
    
    try {
      // Отправляем запрос на генерацию ресурса
      const response = await generateResourceAPI.generate({
        resourceName: metadata.resourceName,
        fields: metadata.fields,
        menuItem: metadata.menuItem
      });
      
      // Обновляем флаг синхронизации
      const updatedMetadata = { ...metadata, synced: true };
      setResourceMetadata(prev => ({ ...prev, [menuItemId]: updatedMetadata }));
      
      // Формируем детальное сообщение о том, что было создано
      const endpoints = response.data.endpoints || {};
      const endpointList = Object.entries(endpoints)
        .map(([action, endpoint]) => {
          const actionNames = {
            getAll: 'Получить все записи',
            getById: 'Получить запись по ID',
            create: 'Создать запись',
            update: 'Обновить запись',
            delete: 'Удалить запись'
          };
          return `• ${actionNames[action] || action}: ${endpoint}`;
        })
        .join('\n');

      const fieldCount = metadata.fields?.length || 0;
      const fieldList = metadata.fields
        ?.map(f => `  - ${f.name} (${f.type})`)
        .join('\n') || '';

      setAlertModal({
        open: true,
        title: 'Успех',
        variant: 'success',
        message: `Ресурс "${metadata.resourceName}" успешно создан на бэкенде!\n\n` +
          `📋 Что было создано:\n` +
          `• Prisma модель "${metadata.resourceName}" с ${fieldCount} полями\n` +
          `• Контроллер для обработки запросов\n` +
          `• Роуты API\n` +
          `• Динамическая страница на фронтенде\n\n` +
          `📊 Поля модели:\n${fieldList}\n\n` +
          `🔗 Доступные API эндпоинты:\n${endpointList}`,
      });
    } catch (error) {
      console.error('Ошибка синхронизации ресурса:', error);
      setAlertModal({
        open: true,
        title: 'Ошибка',
        message: error.response?.data?.message || error.message || 'Не удалось синхронизировать ресурс с бэком',
      });
    } finally {
      setSyncingResource(null);
    }
  };

  // Метаданные ресурсов хранятся только в памяти (state), не в localStorage
  // При необходимости можно загружать с бэка через API

  const handleDelete = (id) => {
    const itemToDelete = menuItems.find(item => item.id === id);
    if (!itemToDelete) {
      console.error('Пункт меню не найден:', id);
      return;
    }
    
    if (itemToDelete.isSystem) {
      setAlertModal({ 
        open: true, 
        title: 'Ошибка', 
        message: 'Системные пункты меню нельзя удалять' 
      });
      return;
    }
    
    setConfirmModal({
      title: 'Удалить пункт меню?',
      message: `Вы уверены, что хотите удалить пункт меню "${itemToDelete.label}"?`,
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const updatedItems = menuItems.filter(item => item.id !== id);
          setMenuItems(updatedItems);
          setConfirmModal(null);
          await saveMenuItems(updatedItems);
        } catch (error) {
          console.error('Ошибка удаления:', error);
          setConfirmModal(null);
          setAlertModal({ 
            open: true, 
            title: 'Ошибка', 
            message: 'Не удалось удалить пункт меню' 
          });
        }
      },
      onCancel: () => {
        setConfirmModal(null);
      },
    });
  };

  const handleToggleVisibility = async (id) => {
    const updatedItems = menuItems.map(item => {
      if (item.id === id) {
        const isSystem = SYSTEM_MENU_ITEMS.some(si => si.href === item.url);
        return { 
          ...item, 
          isVisible: !item.isVisible,
          isSystem: isSystem
        };
      }
      return item;
    });
    setMenuItems(updatedItems);
    await saveMenuItems(updatedItems);
  };

  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    if (dragOverRef.current !== index) {
      dragOverRef.current = index;
      setDragOverIndex(index);
    }
  };

  const closeStructureModal = useCallback(() => {
    if (isStructureSaving) return;
    // Закрываем без автосохранения:
    // обновление структуры и модели выполняется только по кнопке "Сохранить"
    setStructureModal({ open: false, itemId: null, itemLabel: '', slug: null });
    setStructureFields([]);
  }, [isStructureSaving]);

  const loadStructureFields = async (slug) => {
    try {
      console.log('📖 Загрузка структуры для slug:', slug);
      let raw = [];
      
      // Получаем имя ресурса из slug (например, "cases" из "cases")
      const resourceName = slug;
      
      // ВСЕГДА пытаемся загрузить структуру из БД, независимо от флагов
      try {
        const res = await structureAPI.get(resourceName);
        raw = (res.data?.fields || []).filter((f) => f?.type !== 'additionalBlocks');
        console.log('📡 Загружена структура из БД:', raw.length, 'полей');
        
        // Структура загружена из БД
      } catch (error) {
        // Если 404 - значит ресурс еще не сгенерирован или структура пустая
        if (error.response?.status === 404) {
          console.log('⚠️ Структура не найдена на бэке (ресурс еще не сгенерирован или структура пустая)');
          raw = [];
        } else {
          console.warn('⚠️ Ошибка загрузки структуры с бэка:', error);
          raw = [];
        }
      }
      
      // Преобразуем структуру в формат blocks для NewsBlockEditor
      const blocks = raw.map((f, i) => {
        const type = f.type && BLOCK_TYPES.some(b => b.type === f.type) ? f.type : 'text';
        const block = createEmptyBlock(type);
        return { ...block, order: f.order ?? i, label: f.label ?? '' };
      });
      
      console.log('📋 Загружено блоков структуры:', blocks.length);
      setStructureFields(blocks);
    } catch (error) {
      console.error('Ошибка загрузки структуры:', error);
      setStructureFields([]);
    }
  };

  const saveStructureFields = async () => {
    if (isStructureSaving) return;
    try {
      const slug = structureModal.slug;
      const menuItemId = structureModal.itemId;
      
      if (!slug || !menuItemId) {
        setAlertModal({
          open: true,
          title: 'Ошибка',
          message: 'Не указаны slug или ID пункта меню'
        });
        return;
      }

      if (structureFields.length === 0) {
        setAlertModal({
          open: true,
          title: 'Ошибка',
          message: 'Добавьте хотя бы одно поле в структуру'
        });
        return;
      }
      
      // Преобразуем blocks обратно в структуру полей
      const fields = buildStructurePayloadFields(structureFields);
      
      console.log('💾 Сохраняю структуру:', {
        slug,
        fieldsCount: fields.length,
        fields: fields.map(f => ({ type: f.type, label: f.label }))
      });
      
      const menuItem = menuItems.find(item => item.id === menuItemId);
      if (!menuItem) {
        setAlertModal({
          open: true,
          title: 'Ошибка',
          message: 'Пункт меню не найден'
        });
        return;
      }
      setIsStructureSaving(true);

      const resourceName = slug.split('-').map((word, index) => 
        index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
      ).join('');
      
      // Преобразуем структуру в поля модели
      const modelFields = structureFields.map((block) => {
        let fieldType = 'String';
        if (block.type === 'file' || block.type === 'image' || block.type === 'gallery') fieldType = 'String';
        else if (block.type === 'number') fieldType = 'Int';
        else if (block.type === 'boolean') fieldType = 'Boolean';
        else if (block.type === 'date') fieldType = 'DateTime';
        
        // Генерируем имя поля из label транслитом
        const fieldName = block.label 
          ? transliterate(block.label.toLowerCase())
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
          : `field_${block.type}_${block.order}`;
        
        return {
          name: fieldName,
          type: fieldType,
          required: false
        };
      });
      
      // Метаданные хранятся только в памяти (state)
      const existingMetadata = resourceMetadata[menuItemId] || {};
      
      const metadata = {
        ...existingMetadata,
        resourceName,
        fields: modelFields,
        menuItem,
        slug,
        synced: existingMetadata.synced || false
      };
      
      setResourceMetadata(prev => ({ ...prev, [menuItemId]: metadata }));

      // Проверяем, сгенерирован ли ресурс, пытаясь загрузить структуру с бэка
      let isResourceSynced = false;
      try {
        const structureRes = await structureAPI.get(resourceName);
        if (structureRes.data?.fields && structureRes.data.fields.length > 0) {
          isResourceSynced = true;
        }
      } catch (e) {
        // Если 404 - ресурс еще не сгенерирован
        isResourceSynced = false;
      }

      // Если ресурс еще не сгенерирован - запускаем генерацию автоматически
      if (!isResourceSynced && !metadata.synced) {
        // Показываем модалку прогресса генерации ресурса
        const generationSteps = [
          { label: 'Генерация модели Prisma', description: 'Создание схемы базы данных' },
          { label: 'Генерация контроллера', description: 'Создание логики обработки запросов' },
          { label: 'Генерация роутов', description: 'Создание API endpoints' },
          { label: 'Регистрация роутов', description: 'Подключение к серверу' },
          { label: 'Синхронизация с БД', description: 'Применение изменений в базе данных' },
        ];

        setProgressModal({
          open: true,
          title: `Генерация ресурса ${resourceName}`,
          steps: generationSteps,
          currentStep: 0,
          error: null,
        });

        try {
          // Обновляем прогресс по шагам
          const updateProgress = (step) => {
            setProgressModal(prev => ({ ...prev, currentStep: step }));
          };

          // Симулируем прогресс генерации
          updateProgress(0); // Шаг 1: Генерация модели Prisma
          await new Promise(resolve => setTimeout(resolve, 200));
          
          updateProgress(1); // Шаг 2: Генерация контроллера
          await new Promise(resolve => setTimeout(resolve, 200));
          
          updateProgress(2); // Шаг 3: Генерация роутов
          await new Promise(resolve => setTimeout(resolve, 200));
          
          updateProgress(3); // Шаг 4: Регистрация роутов
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Генерируем ресурс на бэке (динамическая страница создается автоматически в генераторе)
          updateProgress(4); // Шаг 5: Синхронизация с БД
          await new Promise(resolve => setTimeout(resolve, 200));

          console.log('📤 Отправляю запрос на генерацию ресурса:', {
            resourceName: metadata.resourceName,
            fieldsCount: metadata.fields.length,
            structureFieldsCount: fields.length,
            structure: { fields }
          });
          
          const response = await generateResourceAPI.generate({
            resourceName: metadata.resourceName,
            fields: metadata.fields,
            menuItem: metadata.menuItem,
            structure: { fields } // Передаем структуру в генератор
          });
          
          console.log('📥 Ответ от генератора:', response.data);

          // Ждем несколько секунд, чтобы сервер успел перезапуститься после prisma generate
          console.log('⏳ Ждем перезапуска сервера после генерации Prisma Client...')
          await new Promise(resolve => setTimeout(resolve, 5000)) // 5 секунд задержки для перезапуска nodemon

          // Сохраняем структуру в БД через API структуры (после перезапуска сервера)
          // Делаем несколько попыток, так как модель может быть еще не доступна
          let structureSaved = false;
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              console.log(`📝 Попытка ${attempt}/3 сохранения структуры в БД...`);
              await structureAPI.update(resourceName, fields);
              console.log('✅ Структура успешно сохранена в БД через API структуры');
              structureSaved = true;
              break;
            } catch (structureError) {
              console.error(`⚠️ Попытка ${attempt}/3 не удалась:`, structureError.response?.data || structureError.message);
              if (attempt < 3) {
                // Ждем перед следующей попыткой
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
            }
          }

          // Обновляем метаданные в памяти
          const updatedMetadata = { ...metadata, synced: true };
          setResourceMetadata(prev => ({ ...prev, [menuItemId]: updatedMetadata }));
          
          console.log('✅ Ресурс синхронизирован, структура хранится в БД');

          // Закрываем модалку прогресса
          setProgressModal(prev => ({ ...prev, open: false }));

          // Перезагружаем меню с бэка
          await fetchMenu();
          setStructureModal({ open: false, itemId: null, itemLabel: '', slug: null });
          setStructureFields([]);

          // Показываем успешное сообщение
          setAlertModal({
            open: true,
            title: structureSaved ? 'Успех' : 'Предупреждение',
            message: structureSaved
              ? `Ресурс "${resourceName}" успешно сгенерирован и структура сохранена!`
              : `Ресурс "${resourceName}" создан, но структура не была сохранена автоматически. Откройте структуру и нажмите "Сохранить" еще раз.`,
            variant: structureSaved ? 'success' : 'error',
          });

        } catch (error) {
          console.error('Ошибка генерации ресурса:', error);
          setProgressModal(prev => ({ 
            ...prev, 
            error: error.response?.data?.message || error.message || 'Не удалось сгенерировать ресурс'
          }));
        }
      } else {
        // Ресурс уже сгенерирован - обновляем структуру через API структуры
        try {
          const resourceName = slug;
          setProgressModal({
            open: true,
            title: `Сохранение структуры ${resourceName}`,
            steps: [
              { label: 'Сохранение структуры', description: 'Обновление структуры ресурса в БД' },
              { label: 'Синхронизация полей', description: 'Обновление полей модели ресурса' },
            ],
            currentStep: 0,
            error: null,
          });

          await structureAPI.update(resourceName, fields);
          setProgressModal((prev) => ({ ...prev, currentStep: 1 }));
          await new Promise((resolve) => setTimeout(resolve, 200));
          setProgressModal((prev) => ({ ...prev, open: false }));

          setStructureModal({ open: false, itemId: null, itemLabel: '', slug: null });
          setStructureFields([]);
          setShowToast(true);
          setTimeout(() => setShowToast(false), 2000);
        } catch (error) {
          console.error('Ошибка сохранения структуры на бэк:', error);
          setProgressModal((prev) => ({
            ...prev,
            error: error.response?.data?.message || error.message || 'Не удалось сохранить структуру и синхронизировать поля',
          }));
          setAlertModal({
            open: true,
            title: 'Ошибка',
            message: 'Не удалось сохранить структуру на бэкенд'
          });
        }
      }
    } catch (error) {
      console.error('Ошибка сохранения структуры:', error);
      setAlertModal({
        open: true,
        title: 'Ошибка',
        message: 'Не удалось сохранить структуру полей'
      });
    } finally {
      setIsStructureSaving(false);
    }
  };

  const handleDragEnd = async () => {
    if (draggedIndex === null || dragOverIndex === null) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      dragOverRef.current = null;
      return;
    }

    const newItems = [...menuItems];
    const draggedItem = newItems[draggedIndex];
    newItems.splice(draggedIndex, 1);
    newItems.splice(dragOverIndex, 0, draggedItem);
    
    // Сохраняем isSystem при перетаскивании
    const itemsWithSystem = newItems.map(item => ({
      ...item,
      isSystem: item.isSystem !== undefined ? item.isSystem : SYSTEM_MENU_ITEMS.some(si => si.href === item.url)
    }));
    
    setMenuItems(itemsWithSystem);
    setDraggedIndex(null);
    setDragOverIndex(null);
    dragOverRef.current = null;
    await saveMenuItems(itemsWithSystem);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
    dragOverRef.current = null;
  };

  // Drag and drop для структуры полей
  const handleStructureDragStart = (index) => {
    setStructureDraggedIndex(index);
  };

  const handleStructureDragOver = (e, index) => {
    e.preventDefault();
    if (structureDraggedIndex === null || structureDraggedIndex === index) return;
    
    if (structureDragOverRef.current !== index) {
      structureDragOverRef.current = index;
      setStructureDragOverIndex(index);
    }
  };

  const handleStructureDragEnd = () => {
    if (structureDraggedIndex === null || structureDragOverIndex === null) {
      setStructureDraggedIndex(null);
      setStructureDragOverIndex(null);
      structureDragOverRef.current = null;
      return;
    }

    const newFields = [...structureFields];
    const draggedField = newFields[structureDraggedIndex];
    newFields.splice(structureDraggedIndex, 1);
    newFields.splice(structureDragOverIndex, 0, draggedField);
    
    setStructureFields(newFields);
    setStructureDraggedIndex(null);
    setStructureDragOverIndex(null);
    structureDragOverRef.current = null;
  };

  const handleStructureDragLeave = () => {
    setStructureDragOverIndex(null);
    structureDragOverRef.current = null;
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
    <div className={styles.pageWrapper}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Настройки</h1>
      </div>

      <div className={styles.tabs}>
        <div className={styles.tabsHeader}>
          <button
            type="button"
            className={`${styles.tabButton} ${activeTab === 'menu' ? styles.active : ''}`}
            onClick={() => setActiveTab('menu')}
          >
            Пункты меню
          </button>
          <button
            type="button"
            className={`${styles.tabButton} ${activeTab === 'backend' ? styles.active : ''}`}
            onClick={() => setActiveTab('backend')}
          >
            Настройки подключения
          </button>
        </div>

        <div className={styles.tabsContent}>
          {/* Таб: Пункты меню */}
          <div className={`${styles.tabPanel} ${activeTab === 'menu' ? styles.active : ''}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1f2937', margin: 0 }}>Пункты меню</h2>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {!isMenuResourceGenerated ? (
                  <button 
                    type="button" 
                    className={styles.addBtn}
                    onClick={generateMenuResource}
                  >
                    <Settings size={18} /> Генерировать ресурс Menu
                  </button>
                ) : (
                  <button 
                    type="button" 
                    className={styles.addBtn}
                    onClick={openAddModal}
                  >
                    <Plus size={18} /> Добавить пункт меню
                  </button>
                )}
              </div>
            </div>

            <div className={styles.tableWrapper}>
        <div className={styles.tableContainer}>
          {menuItems.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.icon}><GripVertical size={48} /></div>
              <h3>Пунктов меню пока нет</h3>
              <p>Добавьте первый пункт меню</p>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '40px' }} aria-label="Порядок"></th>
                  <th style={{ width: '80px' }}>Иконка</th>
                  <th className={styles.titleCell}>Название</th>
                  <th>Ссылка</th>
                  <th style={{ width: '140px' }}>Видимость</th>
                  <th className={styles.actionsCell} style={{ width: '180px' }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {menuItems.map((item, index) => (
                  <tr
                    key={item.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    onDragLeave={handleDragLeave}
                    className={dragOverIndex === index ? styles.dragOver : ''}
                    style={{ 
                      opacity: draggedIndex === index ? 0.5 : 1,
                      cursor: 'move'
                    }}
                  >
                    <td className={styles.tableCell} style={{ width: '40px' }}>
                      <div className={styles.cellInner}>
                        <GripVertical size={18} style={{ color: '#94a3b8', cursor: 'grab' }} />
                      </div>
                    </td>
                    <td className={styles.tableCell} style={{ width: '80px' }}>
                      <div className={styles.cellInner}>
                        {item.icon && item.iconType === 'upload' ? (
                          <img 
                            src={getImageUrl(item.icon)} 
                            alt="" 
                            style={{ width: 24, height: 24, objectFit: 'contain' }}
                          />
                        ) : item.icon && getMuiIconComponent(item.icon) ? (
                          (() => {
                            const Icon = getMuiIconComponent(item.icon);
                            return <Icon size={24} />;
                          })()
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>—</span>
                        )}
                      </div>
                    </td>
                    <td className={`${styles.tableCell} ${styles.titleCell}`}>
                      <div className={styles.cellInner}>
                        <span style={{ fontWeight: item.isVisible ? 500 : 400, opacity: item.isVisible ? 1 : 0.6 }}>
                          {item.label}
                        </span>
                      </div>
                    </td>
                    <td className={styles.tableCell}>
                      <div className={styles.cellInner}>
                        <code style={{ 
                          background: '#f1f5f9', 
                          padding: '4px 8px', 
                          borderRadius: 4,
                          fontSize: '0.875rem',
                          opacity: item.isVisible ? 1 : 0.6
                        }}>
                          {stripAdminPrefix(item.url) || '—'}
                        </code>
                      </div>
                    </td>
                    <td className={styles.tableCell} style={{ width: '140px' }}>
                      <div className={styles.cellInner}>
                        <span className={`${styles.badge} ${styles[item.isVisible ? 'active' : 'inactive']}`}>
                          {item.isVisible ? 'Включено' : 'Скрыто'}
                        </span>
                      </div>
                    </td>
                    <td className={`${styles.tableCell} ${styles.actionsCell}`} style={{ width: '180px' }}>
                      <div className={styles.cellInner}>
                        <div className={styles.actions}>
                          <button
                            type="button"
                            onClick={() => handleToggleVisibility(item.id)}
                            className={item.isVisible ? styles.deleteBtn : styles.viewBtn}
                            title={item.isVisible ? 'Скрыть' : 'Показать'}
                          >
                            {item.isVisible ? (
                              <EyeOff size={16} />
                            ) : (
                              <Eye size={16} />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className={styles.editBtn}
                            title="Редактировать"
                          >
                            <Pencil size={16} />
                          </button>
                          {/* Кнопки для всех пунктов меню, кроме системных */}
                          {!item.isSystem && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  const slug = stripAdminPrefix(item.url);
                                  setStructureModal({ open: true, itemId: item.id, itemLabel: item.label, slug });
                                  setStructureBlockSearch('');
                                  setStructureAccordionOpen(new Set(['base']));
                                  // Загружаем текущую структуру полей
                                  loadStructureFields(slug);
                                }}
                                className={styles.viewBtn}
                                title="Настроить структуру"
                              >
                                <Settings size={16} />
                              </button>
                              {resourceMetadata[item.id] && resourceMetadata[item.id].synced && (
                                <span 
                                  className={styles.badge}
                                  style={{ 
                                    background: '#10b981', 
                                    color: 'white',
                                    padding: '4px 8px',
                                    fontSize: '0.75rem',
                                    borderRadius: 4
                                  }}
                                  title="Ресурс синхронизирован с бэком"
                                >
                                  ✓
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDelete(item.id)}
                                className={styles.deleteBtn}
                                title="Удалить"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
            </div>
          </div>
          </div>

          {/* Таб: Подключение backend */}
          <div className={`${styles.tabPanel} ${activeTab === 'backend' ? styles.active : ''}`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1f2937', margin: 0 }}>Настройки подключения</h2>
              
              {!backendUrl && (
                <div style={{
                  padding: '16px',
                  backgroundColor: '#fef3c7',
                  border: '1px solid #fbbf24',
                  borderRadius: '8px',
                  color: '#92400e'
                }}>
                  <strong>⚠️ Внимание:</strong> URL backend не настроен. Укажите адрес вашего backend сервера для работы админ-панели и фронтенда.
                </div>
              )}
              
              <div style={{ 
                padding: 24, 
                background: '#f8fafc', 
                borderRadius: 8, 
                border: '1px solid #e2e8f0' 
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: 8, 
                      fontSize: '0.9rem', 
                      fontWeight: 500, 
                      color: '#334155' 
                    }}>
                      URL Backend API
                    </label>
                    <input
                      type="text"
                      value={backendUrl}
                      onChange={(e) => setBackendUrl(e.target.value)}
                      placeholder="http://localhost:5000 (без /api в конце)"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        fontSize: '0.95rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        backgroundColor: '#fff',
                        color: '#334155',
                        transition: 'border-color 0.2s',
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#2563eb';
                        e.target.style.outline = 'none';
                        e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e2e8f0';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                    <p style={{ 
                      marginTop: 8, 
                      marginBottom: 0, 
                      fontSize: '0.85rem', 
                      color: '#64748b' 
                    }}>
                      Укажите базовый URL вашего backend сервера без /api в конце. Например: <code style={{ 
                        background: '#e2e8f0', 
                        padding: '2px 6px', 
                        borderRadius: 4,
                        fontSize: '0.85rem'
                      }}>http://localhost:5000</code> или <code style={{ 
                        background: '#e2e8f0', 
                        padding: '2px 6px', 
                        borderRadius: 4,
                        fontSize: '0.85rem'
                      }}>https://your-backend.com</code>
                    </p>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    <button
                      type="button"
                      onClick={handleSaveBackendUrl}
                      disabled={backendUrlSaving || !backendUrl.trim()}
                      style={{
                        padding: '10px 24px',
                        fontSize: '0.95rem',
                        fontWeight: 500,
                        color: '#fff',
                        backgroundColor: backendUrlSaving || !backendUrl.trim() ? '#94a3b8' : '#2563eb',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: backendUrlSaving || !backendUrl.trim() ? 'not-allowed' : 'pointer',
                        transition: 'background-color 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                      onMouseEnter={(e) => {
                        if (!backendUrlSaving && backendUrl.trim()) {
                          e.target.style.backgroundColor = '#1d4ed8';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!backendUrlSaving && backendUrl.trim()) {
                          e.target.style.backgroundColor = '#2563eb';
                        }
                      }}
                    >
                      {backendUrlSaving ? 'Сохранение...' : 'Сохранить'}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{
                padding: 24,
                background: '#f8fafc',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#1f2937' }}>
                  Импорт и экспорт данных
                </h3>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
                  Экспорт сохраняет полный снимок: настройки, структуры, схемы, сгенерированные файлы и данные базы.
                  Импорт полностью заменяет текущее состояние данными из файла.
                </p>

                <div style={{
                  padding: '12px 14px',
                  background: '#fff7ed',
                  border: '1px solid #fdba74',
                  borderRadius: 8,
                  color: '#9a3412',
                  fontSize: '0.9rem',
                }}>
                  <strong>Важно:</strong> во время импорта не обновляйте страницу и не закрывайте вкладку, пока процесс не завершится.
                </div>

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleExportData}
                    disabled={exportingData || importingData}
                    className={styles.filtersBtn}
                    style={{ minWidth: 190, justifyContent: 'center' }}
                  >
                    {exportingData ? 'Экспорт...' : 'Экспорт данных'}
                  </button>
                  <button
                    type="button"
                    onClick={() => importFileInputRef.current?.click()}
                    disabled={exportingData || importingData}
                    className={styles.addBtn}
                    style={{ minWidth: 190, justifyContent: 'center' }}
                  >
                    {importingData ? 'Импорт...' : 'Импорт данных'}
                  </button>
                  <input
                    ref={importFileInputRef}
                    type="file"
                    accept="application/json"
                    onChange={handleImportFileSelected}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showToast && <div className={styles.toast}>Сохранено</div>}

      {menuItemModal.open && typeof document !== 'undefined' && createPortal(
        <div
          className={styles.modalOverlay}
          onClick={(e) => e.target === e.currentTarget && closeMenuItemModal()}
          role="dialog"
          aria-modal="true"
          aria-label={menuItemModal.itemId == null ? 'Добавление пункта меню' : 'Редактирование пункта меню'}
          style={{ zIndex: 9999 }}
        >
          <div className={styles.modalDialog} style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {menuItemModal.itemId == null ? 'Добавить пункт меню' : 'Редактировать пункт меню'}
              </h2>
              <button type="button" onClick={closeMenuItemModal} className={styles.modalClose} aria-label="Закрыть">
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className={styles.whatToBringBlock} style={{ margin: 0 }}>
                  <div className={styles.whatToBringIconCell}>
                    <div className={styles.whatToBringTypeSwitcher} role="group" aria-label="Источник иконки">
                      <button
                        type="button"
                        className={`${styles.whatToBringTypeSegment} ${editForm.iconType === 'upload' ? styles.whatToBringTypeSegmentActive : ''}`}
                        onClick={() => setEditForm((prev) => ({ ...prev, iconType: 'upload', icon: '' }))}
                      >
                        Загрузить
                      </button>
                      <button
                        type="button"
                        className={`${styles.whatToBringTypeSegment} ${editForm.iconType === 'library' ? styles.whatToBringTypeSegmentActive : ''}`}
                        onClick={() => setEditForm((prev) => ({ ...prev, iconType: 'library', icon: '' }))}
                      >
                        Библиотека
                      </button>
                    </div>
                    <div className={styles.whatToBringIconPreview}>
                      {editForm.iconType === 'upload' ? (
                        <>
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            id="menu-item-icon-upload"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setUploadingIcon(true);
                              try {
                                const fd = new FormData();
                                fd.append('file', file);
                                const res = await mediaAPI.upload(fd);
                                setEditForm((prev) => ({ ...prev, icon: res.data?.url ?? '' }));
                              } catch (err) {
                                console.error(err);
                                setAlertModal({
                                  open: true,
                                  title: 'Ошибка',
                                  message: 'Не удалось загрузить иконку',
                                });
                              } finally {
                                setUploadingIcon(false);
                              }
                              e.target.value = '';
                            }}
                          />
                          <label htmlFor="menu-item-icon-upload" className={styles.whatToBringUploadBtn}>
                            {editForm.icon ? (
                              <img src={getImageUrl(editForm.icon)} alt="" className={styles.whatToBringUploadImg} />
                            ) : (
                              <Upload size={24} />
                            )}
                          </label>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIconPickerOpen(true)}
                          className={styles.whatToBringMuiBtn}
                          title="Выбрать иконку"
                          aria-label="Выбрать иконку"
                        >
                          {editForm.icon && getMuiIconComponent(editForm.icon) ? (
                            (() => {
                              const Icon = getMuiIconComponent(editForm.icon);
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
                    value={editForm.label}
                    onChange={(e) => {
                      const newLabel = e.target.value;
                      setEditForm((prev) => {
                        // Автоматически генерируем URL из названия только для новых пунктов и если URL не был изменен вручную
                        const shouldAutoGenerate = menuItemModal.itemId == null && !urlManuallyEditedRef.current;
                        const newUrl = shouldAutoGenerate ? generateUrlFromLabel(newLabel, prev.useTranslation) : prev.url;
                        
                        // Автоматически подбираем иконку, если её еще нет (но не перезаписываем если пользователь уже выбрал)
                        let newIcon = prev.icon;
                        if (newLabel && !prev.icon) {
                          const suggestedIcon = suggestIconFromLabel(newLabel);
                          if (suggestedIcon) {
                            newIcon = suggestedIcon;
                          }
                        }
                        
                        return { ...prev, label: newLabel, url: newUrl, icon: newIcon };
                      });
                    }}
                    placeholder="Название пункта меню"
                    aria-label="Название пункта меню"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 6 }}>Ссылка</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <code style={{ background: '#f1f5f9', padding: '8px 10px', borderRadius: 8, color: '#334155' }}>/admin/</code>
                    <input
                      type="text"
                      value={editForm.url}
                      onChange={(e) => {
                        urlManuallyEditedRef.current = true; // Отмечаем, что пользователь изменил URL вручную
                        setEditForm((prev) => ({ ...prev, url: e.target.value }));
                      }}
                      className={styles.formInput}
                      style={{ width: '100%', padding: '10px 12px' }}
                      placeholder="new-page"
                      aria-label="Ссылка без /admin"
                      autoComplete="off"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label className={styles.visibilityToggle} style={{ justifyContent: 'space-between' }}>
                    <span className={styles.visibilityLabel}>Перевод вместо транслита</span>
                    <input
                      type="checkbox"
                      checked={editForm.useTranslation === true}
                      onChange={(e) => {
                        const useTranslation = e.target.checked;
                        setEditForm((prev) => {
                          // При изменении режима пересчитываем URL, если он не был изменен вручную
                          const shouldAutoGenerate = menuItemModal.itemId == null && !urlManuallyEditedRef.current;
                          const newUrl = shouldAutoGenerate && prev.label ? generateUrlFromLabel(prev.label, useTranslation) : prev.url;
                          return { ...prev, useTranslation, url: newUrl };
                        });
                      }}
                    />
                    <span className={styles.visibilitySwitch} />
                  </label>

                  <label className={styles.visibilityToggle} style={{ justifyContent: 'space-between' }}>
                    <span className={styles.visibilityLabel}>Показывать в меню</span>
                    <input
                      type="checkbox"
                      checked={editForm.isVisible !== false}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, isVisible: e.target.checked }))}
                    />
                    <span className={styles.visibilitySwitch} />
                  </label>
                </div>

                {uploadingIcon && <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Загрузка иконки…</span>}
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" onClick={closeMenuItemModal} className={styles.cancelBtn}>
                Отмена
              </button>
              <button
                type="button"
                onClick={saveMenuItemFromModal}
                className={styles.submitBtn}
                disabled={isSaving || !editForm.label.trim() || !editForm.url.trim()}
              >
                {isSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <ConfirmModal
        open={!!confirmModal}
        title={confirmModal?.title}
        message={confirmModal?.message}
        confirmLabel={confirmModal?.confirmLabel}
        cancelLabel={confirmModal?.cancelLabel}
        variant={confirmModal?.variant}
        onConfirm={confirmModal?.onConfirm}
        onCancel={confirmModal?.onCancel}
      />

      <AlertModal
        open={alertModal.open}
        title={alertModal.title}
        message={alertModal.message}
        variant={alertModal.variant || 'error'}
        onClose={() => setAlertModal({ open: false, title: '', message: '', variant: 'error' })}
      />

      <ProgressModal
        open={progressModal.open}
        title={progressModal.title}
        steps={progressModal.steps}
        currentStep={progressModal.currentStep}
        error={progressModal.error}
        onClose={() => {
          if (progressModal.error || progressModal.currentStep >= progressModal.steps.length) {
            setProgressModal({ open: false, title: '', steps: [], currentStep: 0, error: null });
          }
        }}
      />

      {iconPickerOpen && typeof document !== 'undefined' && createPortal(
        <div
          className={styles.modalOverlay}
          style={{ zIndex: 10000 }}
          onClick={(e) => e.target === e.currentTarget && setIconPickerOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Выбор иконки"
        >
          <div className={styles.modalDialog} style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Выберите иконку</h3>
              <button type="button" onClick={() => setIconPickerOpen(false)} className={styles.modalClose} aria-label="Закрыть">
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalBody} style={{ maxHeight: 440, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div className={styles.whatToBringIconFilters}>
                <input
                  type="search"
                  className={styles.whatToBringIconSearch}
                  placeholder="Поиск иконки..."
                  value={iconPickerSearch}
                  onChange={(e) => setIconPickerSearch(e.target.value)}
                  aria-label="Поиск иконки"
                  autoComplete="off"
                />
                <select
                  className={styles.whatToBringIconGroupSelect}
                  value={iconPickerGroup}
                  onChange={(e) => setIconPickerGroup(e.target.value)}
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
                  iconPickerGroup === 'all'
                    ? MUI_ICON_NAMES
                    : (groups.find((g) => g.id === iconPickerGroup)?.iconNames ?? []);
                const searchLower = (iconPickerSearch || '').trim().toLowerCase();
                const namesToShow = searchLower
                  ? baseNames.filter((name) => name.toLowerCase().includes(searchLower))
                  : baseNames;
                const setPickingIcon = (name) => {
                  setEditForm((prev) => ({ ...prev, icon: name }));
                  setIconPickerOpen(false);
                  setIconPickerGroup('all');
                  setIconPickerSearch('');
                };
                return (
                  <>
                    <div className={styles.whatToBringIconGridWrap}>
                      <button
                        type="button"
                        className={styles.whatToBringIconGridItem}
                        onClick={() => setPickingIcon('')}
                        title="Без иконки"
                      >
                        —
                      </button>
                      {namesToShow.map((name) => {
                        const IconComponent = MUI_ICONS[name];
                        if (!IconComponent) return null;
                        return (
                          <button
                            key={name}
                            type="button"
                            className={`${styles.whatToBringIconGridItem} ${editForm.icon === name ? styles.routeFilterIconSelected : ''}`}
                            onClick={() => setPickingIcon(name)}
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
        </div>,
        document.body
      )}

      {structureModal.open && typeof document !== 'undefined' && createPortal(
        <div
          className={styles.modalOverlay}
          style={{ background: 'rgba(15, 23, 42, 0.6)', zIndex: 9999 }}
          onClick={(e) => e.target === e.currentTarget && closeStructureModal()}
          role="dialog"
          aria-modal="true"
          aria-label="Настройка структуры"
        >
          <div className={styles.modalDialog} style={{ width: '90%', maxWidth: 'none', height: '90vh', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Структура: {structureModal.itemLabel}</h2>
              <button
                type="button"
                className={styles.modalClose}
                onClick={closeStructureModal}
                aria-label="Закрыть"
              >
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalBody} style={{ display: 'flex', gap: 24, padding: 24, flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div className={styles.structureModalLeft}>
                <div className={styles.structureListLabel}>Пункты структуры</div>
                <div className={styles.structureModalListWrap}>
                  {structureFields.length === 0 ? (
                    <p className={styles.structureModalEmpty}>Добавьте блоки справа</p>
                  ) : (
                    structureFields.map((block, idx) => {
                      const blockDef = BLOCK_TYPES.find(b => b.type === block.type);
                      const Icon = blockDef?.icon;
                      return (
                        <div
                          key={block.id}
                          className={styles.structureModalListItem}
                          draggable
                          onDragStart={() => handleStructureDragStart(idx)}
                          onDragOver={(e) => handleStructureDragOver(e, idx)}
                          onDragEnd={handleStructureDragEnd}
                          onDragLeave={handleStructureDragLeave}
                          style={{
                            opacity: structureDraggedIndex === idx ? 0.5 : 1,
                            cursor: 'move',
                            borderColor: structureDragOverIndex === idx ? '#2563eb' : undefined,
                            backgroundColor: structureDragOverIndex === idx ? '#eff6ff' : undefined,
                          }}
                        >
                          <GripVertical size={18} className={styles.structureModalGrip} />
                          <span className={styles.structureModalListOrder}>{idx + 1}</span>
                          {Icon && <Icon size={20} className={styles.structureModalListIcon} />}
                          <input
                            type="text"
                            value={block.label ?? ''}
                            onChange={(e) => {
                              const next = [...structureFields];
                              next[idx] = { ...next[idx], label: e.target.value };
                              setStructureFields(next);
                            }}
                            placeholder={blockDef?.label ? `Напр.: ${blockDef.label}` : 'Подсказка'}
                            className={styles.structureModalListInput}
                            onDragStart={(e) => e.stopPropagation()}
                          />
                          <div className={styles.structureModalListActions}>
                            <button
                              type="button"
                              onClick={() => {
                                if (idx <= 0) return;
                                const next = [...structureFields];
                                [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                                setStructureFields(next);
                              }}
                              disabled={idx === 0}
                              className={styles.structureModalActionBtn}
                              title="Поднять"
                            >
                              <ChevronUp size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (idx >= structureFields.length - 1) return;
                                const next = [...structureFields];
                                [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                                setStructureFields(next);
                              }}
                              disabled={idx === structureFields.length - 1}
                              className={styles.structureModalActionBtn}
                              title="Опустить"
                            >
                              <ChevronDown size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setStructureFields(structureFields.filter((_, i) => i !== idx))}
                              className={styles.structureModalDeleteBtn}
                              title="Удалить"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              <div className={styles.structureModalRight}>
                <div className={styles.structureListLabel}>Добавить блок</div>
                <div className={styles.structureBlockSearchWrap}>
                  <Search size={18} className={styles.structureBlockSearchIcon} />
                  <input
                    type="text"
                    className={styles.structureBlockSearchInput}
                    placeholder="Поиск по типам блоков..."
                    value={structureBlockSearch}
                    onChange={(e) => setStructureBlockSearch(e.target.value)}
                  />
                </div>
                <div className={styles.structureAccordion}>
                  {(() => {
                    const searchLower = structureBlockSearch.trim().toLowerCase();
                    const typeMatchesSearch = (label, type) =>
                      !searchLower || label.toLowerCase().includes(searchLower) || type.toLowerCase().includes(searchLower);
                    const typeToBlock = Object.fromEntries(BLOCK_TYPES.map((b) => [b.type, b]));
                    const visibleCategories = BLOCK_CATEGORIES.filter((cat) =>
                      cat.types.some((t) => {
                        const b = typeToBlock[t];
                        return b && typeMatchesSearch(b.label, b.type);
                      })
                    );
                    const hasSearch = searchLower.length > 0;
                    const effectiveOpen = hasSearch ? new Set(visibleCategories.map((c) => c.id)) : structureAccordionOpen;
                    const toggleCategory = (id) => {
                      if (hasSearch) return;
                      setStructureAccordionOpen((prev) => {
                        const next = new Set(prev);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        return next;
                      });
                    };
                    return visibleCategories.map((cat) => {
                      const isOpen = effectiveOpen.has(cat.id);
                      const blocksInCat = cat.types
                        .map((t) => typeToBlock[t])
                        .filter(Boolean)
                        .filter((b) => typeMatchesSearch(b.label, b.type));
                      if (blocksInCat.length === 0) return null;
                      return (
                        <div key={cat.id} className={styles.structureAccordionSection}>
                          <button
                            type="button"
                            className={styles.structureAccordionHeader}
                            onClick={() => toggleCategory(cat.id)}
                            aria-expanded={isOpen}
                          >
                            <span>{cat.label}</span>
                            {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </button>
                          {isOpen && (
                            <div className={styles.structureAccordionBody}>
                              <div className={styles.structureAccordionGrid}>
                                {blocksInCat.map(({ type, label, icon: Icon }) => (
                                  <button
                                    key={type}
                                    type="button"
                                    className={styles.structureModalGridCard}
                                    onClick={() =>
                                      setStructureFields([
                                        ...structureFields,
                                        { ...createEmptyBlock(type), order: structureFields.length, label: '' },
                                      ])
                                    }
                                  >
                                    <Icon size={24} />
                                    <span>{label}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                onClick={closeStructureModal}
                className={styles.cancelBtn}
                disabled={isStructureSaving}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={saveStructureFields}
                className={styles.submitBtn}
                disabled={isStructureSaving}
              >
                {isStructureSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Модальные окна генерации удалены - генерация теперь происходит автоматически при сохранении структуры */}
    </div>
  );
}
