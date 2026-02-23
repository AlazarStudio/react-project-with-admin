'use client';

import { useState, useEffect, useContext, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, X as XIcon } from 'lucide-react';
import { dynamicPagesAPI, dynamicPageRecordsAPI, menuAPI, mediaAPI, structureAPI, getImageUrl } from '@/lib/api';
import { AdminHeaderRightContext, AdminBreadcrumbContext } from '../../../layout';
import { BLOCK_TYPES, createEmptyBlock, slugFromText } from '../../../components/NewsBlockEditor';
import { ConfirmModal } from '../../../components';
import NewsBlockEditor from '../../../components/NewsBlockEditor';
import RichTextEditor from '@/components/RichTextEditor';
import styles from '../../../admin.module.css';

function getBlockLabel(field) {
  if (field.label && String(field.label).trim()) return field.label;
  return BLOCK_TYPES.find(b => b.type === field.type)?.label ?? field.type;
}

/** Из названия блока делаем ключ для JSON: транслит + нижние подчёркивания вместо пробелов/дефисов */
function labelToFieldKey(label) {
  if (!label || !String(label).trim()) return '';
  const slug = slugFromText(label);
  if (!slug) return '';
  return slug.replace(/-/g, '_');
}

/** Строим массив полей структуры с уникальными fieldKey из label (транслит + подчёркивания) */
function buildStructureFields(raw) {
  const fields = raw
    .filter((f) => f?.type !== 'additionalBlocks')
    .map((f, i) => ({
      type: f.type || 'text',
      order: f.order ?? i,
      label: f.label ?? '',
    }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const usedKeys = new Set();
  return fields.map((f, i) => {
    let baseKey = labelToFieldKey(f.label);
    if (!baseKey) baseKey = `${f.type}-${f.order ?? i}`;
    let fieldKey = baseKey;
    let suffix = 0;
    while (usedKeys.has(fieldKey)) {
      suffix++;
      fieldKey = `${baseKey}_${suffix}`;
    }
    usedKeys.add(fieldKey);
    return { ...f, fieldKey };
  });
}

export default function DynamicRecordEditPage() {
  const { slug, id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const [pageTitle, setPageTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [structureFields, setStructureFields] = useState([]);
  const [recordData, setRecordData] = useState({});
  const [additionalBlocks, setAdditionalBlocks] = useState([]);
  const [isPublished, setIsPublished] = useState(true);
  const [pendingFiles, setPendingFiles] = useState({});
  const [infoModal, setInfoModal] = useState(null);
  const [invalidStructureFieldKeys, setInvalidStructureFieldKeys] = useState([]);
  const [invalidAdditionalBlockIds, setInvalidAdditionalBlockIds] = useState([]);
  const [pulseStructureFieldKeys, setPulseStructureFieldKeys] = useState([]);
  const [pulseAdditionalBlockIds, setPulseAdditionalBlockIds] = useState([]);
  const [scrollToAdditionalBlockId, setScrollToAdditionalBlockId] = useState(null);
  const [additionalScrollRequestId, setAdditionalScrollRequestId] = useState(0);
  const setHeaderRight = useContext(AdminHeaderRightContext)?.setHeaderRight;
  const setBreadcrumbLabel = useContext(AdminBreadcrumbContext)?.setBreadcrumbLabel;

  // Важно: header рисуется через context и может держать устаревшие замыкания.
  // Поэтому для сохранения используем refs с актуальными данными.
  const structureFieldsRef = useRef(structureFields);
  const recordDataRef = useRef(recordData);
  const additionalBlocksRef = useRef(additionalBlocks);
  const isPublishedRef = useRef(isPublished);
  const pendingFilesRef = useRef(pendingFiles);
  const structureFieldRefs = useRef({});

  useEffect(() => {
    structureFieldsRef.current = structureFields;
    recordDataRef.current = recordData;
    additionalBlocksRef.current = additionalBlocks;
    isPublishedRef.current = isPublished;
    pendingFilesRef.current = pendingFiles;
  }, [structureFields, recordData, additionalBlocks, isPublished, pendingFiles]);

  useEffect(() => {
    if (pulseStructureFieldKeys.length === 0) return;
    const timer = window.setTimeout(() => {
      setPulseStructureFieldKeys([]);
      setInvalidStructureFieldKeys([]);
    }, 4200);
    return () => window.clearTimeout(timer);
  }, [pulseStructureFieldKeys]);

  useEffect(() => {
    if (pulseAdditionalBlockIds.length === 0) return;
    const timer = window.setTimeout(() => {
      setPulseAdditionalBlockIds([]);
      setInvalidAdditionalBlockIds([]);
    }, 4200);
    return () => window.clearTimeout(timer);
  }, [pulseAdditionalBlockIds]);

  useEffect(() => {
    if (slug === 'settings') {
      navigate('/admin/settings', { replace: true });
      return;
    }
    loadPageData();
  }, [slug, id, navigate]);

  // Выводим структуру записи в консоль при каждом изменении
  useEffect(() => {
    if (!isLoading) {
      const currentData = {
        ...recordData,
        isPublished,
      };
      // Преобразуем дополнительные блоки в объект для отображения в консоли
      if (additionalBlocks.length > 0) {
        currentData.additionalBlocks = blocksToObject(additionalBlocks);
      }
      console.log('[Редактирование записи] Текущая структура данных:', JSON.stringify(currentData, null, 2));
    }
  }, [recordData, additionalBlocks, isPublished, isLoading]);

  const loadPageData = async () => {
    setIsLoading(true);
    try {
      // Загружаем название из меню (сначала с бэка, потом из localStorage)
      let menuItems = [];
      
      try {
        const menuRes = await menuAPI.get();
        if (menuRes.status === 404) {
          // Ресурс еще не сгенерирован - это нормально
        } else {
          menuItems = menuRes.data?.items || [];
        }
      } catch (error) {
        // Тихая обработка
      }
      
      // Ищем пункт меню по slug
      const menuItem = menuItems.find(item => {
        if (!item.url) return false;
        // Убираем префикс /admin/ и сравниваем со slug из URL
        let itemSlug = item.url.replace(/^\/admin\/?/, '').replace(/^\/+/, '').replace(/\/+$/, '');
        const normalizedSlug = slug?.replace(/^\/+/, '').replace(/\/+$/, '') || '';
        return itemSlug === normalizedSlug || itemSlug === slug;
      });
      
      // Не редиректим, если пункт меню не найден - продолжаем работу
      if (!menuItem) {
        console.warn('Пункт меню не найден для slug:', slug);
      }
      
      // Используем найденный пункт меню или создаем заглушку
      const title = menuItem?.label || slug.charAt(0).toUpperCase() + slug.slice(1);
      setPageTitle(title);
      
      // Загружаем структуру полей:
      // 1) основной источник — отдельный structure endpoint
      // 2) fallback — legacy структура в dynamic page
      let raw = [];
      try {
        const structureRes = await structureAPI.get(slug);
        raw = structureRes.data?.fields || [];
      } catch (structureError) {
        const pageRes = await dynamicPagesAPI.get(slug).catch(() => ({ data: { structure: { fields: [] } } }));
        raw = pageRes.data?.structure?.fields || [];
      }
      const fields = buildStructureFields(raw);
      setStructureFields(fields);
      
      // Загружаем запись, если редактируем существующую
      if (!isNew) {
        try {
          const recordRes = await dynamicPageRecordsAPI.getById(slug, id);
          const data = recordRes.data || {};
          // Преобразуем старый формат (по типу) в новый (по fieldKey)
          const convertedData = {};
          fields.forEach(field => {
            const fieldKey = field.fieldKey;
            const oldKeyByOrder = `${field.type}-${field.order ?? 0}`;
            // Приоритет: новый ключ (транслит) → старый ключ (type-order) → по типу
            let fieldValue;
            if (data[fieldKey] !== undefined) {
              fieldValue = data[fieldKey];
            } else if (data[oldKeyByOrder] !== undefined) {
              fieldValue = data[oldKeyByOrder];
            } else if (data[field.type] !== undefined) {
              fieldValue = data[field.type];
            } else {
              const block = createEmptyBlock(field.type);
              fieldValue = block.data || '';
            }
            
            // Нормализуем формат для типа image: преобразуем в формат { type: 'url', value: ... }
            if (field.type === 'image') {
              if (typeof fieldValue === 'string' && fieldValue) {
                convertedData[fieldKey] = { type: 'url', value: fieldValue };
              } else if (fieldValue && typeof fieldValue === 'object' && fieldValue.url) {
                convertedData[fieldKey] = { type: 'url', value: fieldValue.url };
              } else if (fieldValue && typeof fieldValue === 'object' && fieldValue.type === 'url') {
                convertedData[fieldKey] = fieldValue;
              } else {
                convertedData[fieldKey] = null;
              }
            } else {
              convertedData[fieldKey] = fieldValue;
            }
          });
          setRecordData(convertedData);
          setIsPublished(data.isPublished !== undefined ? data.isPublished : true);
          // Загружаем дополнительные блоки
          if (data.additionalBlocks) {
            if (Array.isArray(data.additionalBlocks)) {
              // Старый формат (массив) - нормализуем блоки для редактора
              const normalizedBlocks = normalizeEditorBlocks(data.additionalBlocks);
              setAdditionalBlocks(normalizedBlocks);
              additionalBlocksRef.current = normalizedBlocks;
            } else if (typeof data.additionalBlocks === 'object') {
              // Новый формат (объект) - преобразуем и нормализуем
              const blocksArray = objectToBlocksArray(data.additionalBlocks);
              const normalizedBlocks = normalizeEditorBlocks(blocksArray);
              setAdditionalBlocks(normalizedBlocks);
              additionalBlocksRef.current = normalizedBlocks;
            } else {
              setAdditionalBlocks([]);
              additionalBlocksRef.current = [];
            }
          } else {
            setAdditionalBlocks([]);
            additionalBlocksRef.current = [];
          }
        } catch (error) {
          console.error('Ошибка загрузки записи:', error);
          navigate(`/admin/dynamic/${slug}`, { replace: true });
        }
      } else {
        // Для новой записи инициализируем пустые значения по структуре
        const initialData = {};
        fields.forEach(field => {
          if (field.type === 'image') {
            initialData[field.fieldKey] = null;
          } else {
            const block = createEmptyBlock(field.type);
            initialData[field.fieldKey] = block.data || '';
          }
        });
        setRecordData(initialData);
        setIsPublished(true);
        setAdditionalBlocks([]);
        additionalBlocksRef.current = [];
      }
      
      // Устанавливаем название в хлебные крошки
      if (setBreadcrumbLabel) {
        setBreadcrumbLabel(isNew ? `Новая запись - ${title}` : `Редактирование - ${title}`);
      }
    } catch (error) {
      console.error('Ошибка загрузки страницы:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFieldChange = (fieldType, value) => {
    setRecordData(prev => ({
      ...prev,
      [fieldType]: value
    }));
    setInvalidStructureFieldKeys((prev) => prev.filter((key) => key !== fieldType));
    setPulseStructureFieldKeys((prev) => prev.filter((key) => key !== fieldType));
  };

  const normalizeEditorBlocks = (blocks) => {
    if (!Array.isArray(blocks)) return [];
    return [...blocks]
      .filter((block) => block && typeof block === 'object')
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((block, index) => ({
        ...block,
        id: block.id || createEmptyBlock(block.type || 'text').id,
        order: index,
        label: block.label ?? '',
        data: block.data && typeof block.data === 'object' ? block.data : {},
      }));
  };

  const handleAdditionalBlocksChange = (blocks) => {
    const normalized = normalizeEditorBlocks(blocks);
    additionalBlocksRef.current = normalized;
    setAdditionalBlocks(normalized);
    setInvalidAdditionalBlockIds([]);
    setPulseAdditionalBlockIds([]);
    setScrollToAdditionalBlockId(null);
  };

  const handlePendingBlockFilesChange = (blockId, data) => {
    setPendingFiles((prev) => {
      const next = { ...prev };
      if (data === null) {
        delete next[blockId];
      } else {
        next[blockId] = { ...prev[blockId], ...data };
      }
      pendingFilesRef.current = next;
      return next;
    });
  };

  const handleImageFileSelect = (fieldKey, file) => {
    if (!file) return;
    // Сохраняем файл в состояние с превью (как в услугах)
    handleFieldChange(fieldKey, { type: 'file', value: file, preview: URL.createObjectURL(file) });
  };

  const handleGalleryUpload = async (fieldKey, files) => {
    try {
      const uploadPromises = Array.from(files).map(file => {
        const formData = new FormData();
        formData.append('file', file);
        return mediaAPI.upload(formData);
      });
      const results = await Promise.all(uploadPromises);
      const urls = results.map(r => r.data.url);
      const currentImages = Array.isArray(recordData[fieldKey]) ? recordData[fieldKey] : [];
      handleFieldChange(fieldKey, [...currentImages, ...urls]);
    } catch (error) {
      console.error('Ошибка загрузки изображений:', error);
      setInfoModal({
        title: 'Ошибка загрузки',
        message: 'Не удалось загрузить изображения.',
      });
    }
  };

  /** Преобразует массив блоков в объект с ключами на основе транслита названий */
  const blocksToObject = (blocks) => {
    if (!Array.isArray(blocks) || blocks.length === 0) return {};
    const result = {};
    const usedKeys = new Set();
    blocks.forEach((block) => {
      let baseKey = labelToFieldKey(block.label);
      if (!baseKey) baseKey = `${block.type}-${block.order ?? 0}`;
      let key = baseKey;
      let suffix = 0;
      while (usedKeys.has(key)) {
        suffix++;
        key = `${baseKey}_${suffix}`;
      }
      usedKeys.add(key);
      // Сохраняем блок с ключом как транслит названия
      result[key] = {
        ...block,
        key, // Добавляем ключ в сам блок тоже
      };
    });
    return result;
  };

  /** Преобразует объект блоков обратно в массив */
  const objectToBlocksArray = (obj) => {
    if (!obj || typeof obj !== 'object') return [];
    if (Array.isArray(obj)) return obj; // Если уже массив (старый формат)
    return Object.values(obj).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  };

  const uploadFileAndGetUrl = async (file) => {
    if (!(file instanceof Blob)) return null;
    const formData = new FormData();
    formData.append('file', file);
    const res = await mediaAPI.upload(formData);
    return res.data?.url || null;
  };

  const uploadPendingBlockAssets = async (blocks, pendingMap) => {
    const nextBlocks = (Array.isArray(blocks) ? blocks : []).map((block) => ({
      ...block,
      data: { ...(block.data || {}) },
    }));

    const entries = Object.entries(pendingMap || {}).filter(
      ([, pending]) => pending && (pending.url || (pending.images?.length ?? 0) > 0)
    );

    for (const [blockId, pending] of entries) {
      const blockIndex = nextBlocks.findIndex((b) => b.id === blockId);
      if (blockIndex < 0) continue;
      const block = nextBlocks[blockIndex];

      if (pending.url instanceof Blob) {
        const uploadedUrl = await uploadFileAndGetUrl(pending.url);
        if (uploadedUrl) {
          block.data = { ...block.data, url: uploadedUrl };
        }
      }

      if (Array.isArray(pending.images) && pending.images.length > 0) {
        const uploadedUrls = [];
        for (const file of pending.images) {
          if (!(file instanceof Blob)) continue;
          const uploadedUrl = await uploadFileAndGetUrl(file);
          if (uploadedUrl) uploadedUrls.push(uploadedUrl);
        }

        if (uploadedUrls.length > 0) {
          const imageKey = block.type === 'partners' ? 'logos' : 'images';
          block.data = {
            ...block.data,
            [imageKey]: [...(block.data?.[imageKey] || []), ...uploadedUrls],
          };
        }
      }

      nextBlocks[blockIndex] = block;
    }

    return nextBlocks;
  };

  // Бэкенд сгенерированных ресурсов часто ожидает String-поля.
  // Приводим значения редактора (объекты блоков) к скалярным/string-значениям.
  const normalizeFieldValueForSave = (field, value) => {
    if (value === undefined) return null;
    if (value === null) return null;

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    if (Array.isArray(value)) {
      return JSON.stringify(value);
    }

    if (typeof value === 'object') {
      switch (field.type) {
        case 'heading':
          return typeof value.text === 'string' ? value.text : '';
        case 'text':
        case 'quote':
          return typeof value.content === 'string' ? value.content : '';
        case 'video':
          return typeof value.url === 'string' ? value.url : '';
        case 'list':
          if (Array.isArray(value.items)) return JSON.stringify(value.items);
          return '';
        default:
          return JSON.stringify(value);
      }
    }

    return String(value);
  };

  const asPlainText = (value) =>
    String(value ?? '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const hasFilledValue = (fieldType, value) => {
    if (fieldType === 'separator') return true;
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean' || typeof value === 'number') return true;
    if (typeof value === 'string') return asPlainText(value).length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value !== 'object') return false;

    switch (fieldType) {
      case 'heading':
        return asPlainText(value.text).length > 0;
      case 'text':
      case 'quote':
        return asPlainText(value.content).length > 0;
      case 'image':
        return asPlainText(value.value || value.url).length > 0 || value.value instanceof Blob;
      case 'gallery': {
        const images = Array.isArray(value.images) ? value.images : [];
        return images.length > 0;
      }
      case 'video':
      case 'audio':
      case 'document':
        return asPlainText(value.url).length > 0;
      case 'list': {
        const items = Array.isArray(value.items) ? value.items : [];
        return items.some((item) => asPlainText(item).length > 0);
      }
      default:
        return Object.values(value).some((inner) => {
          if (Array.isArray(inner)) return inner.length > 0;
          if (typeof inner === 'object' && inner !== null) return Object.keys(inner).length > 0;
          return asPlainText(inner).length > 0;
        });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const fieldsToSave = Array.isArray(structureFieldsRef.current) ? structureFieldsRef.current : [];
      const recordDataToSave = recordDataRef.current && typeof recordDataRef.current === 'object' ? recordDataRef.current : {};
      const blocksToSave = Array.isArray(additionalBlocksRef.current) ? additionalBlocksRef.current : [];
      const pendingFilesToSave = pendingFilesRef.current && typeof pendingFilesRef.current === 'object' ? pendingFilesRef.current : {};
      const publishedToSave = Boolean(isPublishedRef.current);

      // Валидация обязательного заполнения полей структуры
      const unfilledStructureFields = fieldsToSave
        .filter((field) => !hasFilledValue(field.type, recordDataToSave[field.fieldKey]));
      if (unfilledStructureFields.length > 0) {
        const invalidKeys = unfilledStructureFields.map((field) => field.fieldKey);
        setInvalidStructureFieldKeys(invalidKeys);
        setPulseStructureFieldKeys(invalidKeys);
        setInvalidAdditionalBlockIds([]);
        setPulseAdditionalBlockIds([]);
        const lastInvalidKey = invalidKeys[invalidKeys.length - 1];
        if (lastInvalidKey && structureFieldRefs.current[lastInvalidKey]) {
          structureFieldRefs.current[lastInvalidKey].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setInfoModal({
          title: 'Заполните обязательные блоки',
          message: `Заполните все блоки из структуры: ${unfilledStructureFields.map((field) => `"${getBlockLabel(field)}"`).join(', ')}`,
        });
        setIsSaving(false);
        return;
      }
      setInvalidStructureFieldKeys([]);

      // Валидация названий дополнительных блоков: обязательность + уникальность
      const structureNameKeys = new Set(
        fieldsToSave
          .map((field) => labelToFieldKey(getBlockLabel(field)))
          .filter(Boolean)
      );
      const additionalNameKeys = new Map();
      const additionalErrors = [];
      const invalidAdditionalIds = new Set();

      blocksToSave.forEach((block, index) => {
        const rawLabel = String(block?.label || '').trim();
        if (!rawLabel) {
          additionalErrors.push(`Дополнительный блок #${index + 1}: укажите "Название блока".`);
          if (block?.id) invalidAdditionalIds.add(block.id);
          return;
        }

        const normalizedName = labelToFieldKey(rawLabel) || rawLabel.toLowerCase();
        if (structureNameKeys.has(normalizedName)) {
          additionalErrors.push(`"${rawLabel}" уже используется в блоках структуры.`);
          if (block?.id) invalidAdditionalIds.add(block.id);
        }
        if (additionalNameKeys.has(normalizedName)) {
          const duplicateWith = additionalNameKeys.get(normalizedName);
          additionalErrors.push(`"${rawLabel}" дублирует название "${duplicateWith}".`);
          if (block?.id) invalidAdditionalIds.add(block.id);
        } else {
          additionalNameKeys.set(normalizedName, rawLabel);
        }
      });

      if (additionalErrors.length > 0) {
        const invalidIdsArray = Array.from(invalidAdditionalIds);
        setInvalidAdditionalBlockIds(invalidIdsArray);
        setPulseAdditionalBlockIds(invalidIdsArray);
        setScrollToAdditionalBlockId(invalidIdsArray[invalidIdsArray.length - 1] || null);
        setAdditionalScrollRequestId((prev) => prev + 1);
        setInvalidStructureFieldKeys([]);
        setPulseStructureFieldKeys([]);
        setInfoModal({
          title: 'Проверьте названия блоков',
          message: `Исправьте названия дополнительных блоков: ${additionalErrors.join(' ')}`,
        });
        setIsSaving(false);
        return;
      }
      setInvalidAdditionalBlockIds([]);
      setPulseAdditionalBlockIds([]);
      setScrollToAdditionalBlockId(null);

      // Преобразуем данные для сохранения: загружаем файлы изображений если нужно
      const dataToSave = {};
      
      // Обрабатываем каждое поле структуры
      for (const field of fieldsToSave) {
        const fieldKey = field.fieldKey;
        const value = recordDataToSave[fieldKey];
        
        if (field.type === 'image' && value && typeof value === 'object') {
          if (value.type === 'url') {
            // Уже загружено - сохраняем URL
            dataToSave[fieldKey] = value.value;
          } else if (value.type === 'file' && value.value) {
            // Нужно загрузить файл
            try {
              const uploadedUrl = await uploadFileAndGetUrl(value.value);
              dataToSave[fieldKey] = uploadedUrl;
              // Освобождаем память от preview
              if (value.preview) {
                URL.revokeObjectURL(value.preview);
              }
            } catch (error) {
              console.error('Ошибка загрузки изображения:', error);
              setInfoModal({
                title: 'Ошибка загрузки',
                message: `Не удалось загрузить изображение для поля "${field.label}".`,
              });
              setIsSaving(false);
              return;
            }
          } else {
            dataToSave[fieldKey] = null;
          }
        } else {
          dataToSave[fieldKey] = normalizeFieldValueForSave(field, value);
        }
      }
      
      dataToSave.isPublished = publishedToSave;
      
      // Всегда отправляем additionalBlocks, чтобы удаление всех блоков
      // гарантированно очищало данные на бэкенде.
      const blocksWithUploadedAssets = await uploadPendingBlockAssets(blocksToSave, pendingFilesToSave);
      const convertedBlocks = blocksToObject(blocksWithUploadedAssets);
      dataToSave.additionalBlocks = convertedBlocks;

      if (Object.keys(pendingFilesToSave).length > 0) {
        setPendingFiles({});
        pendingFilesRef.current = {};
      }
      if (isNew) {
        console.log('[Новая запись] Структура данных при создании:', JSON.stringify(dataToSave, null, 2));
        await dynamicPageRecordsAPI.create(slug, dataToSave);
      } else {
        await dynamicPageRecordsAPI.update(slug, id, dataToSave);
      }
      navigate(`/admin/dynamic/${slug}`, { replace: true });
    } catch (error) {
      console.error('Ошибка сохранения:', error);
      setInfoModal({
        title: 'Ошибка сохранения',
        message: 'Не удалось сохранить запись.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Устанавливаем кнопки в header
  useEffect(() => {
    if (!setHeaderRight) return;
    
    const submitLabel = isNew ? 'Создать запись' : (isSaving ? 'Сохранение...' : 'Сохранить');
    
    setHeaderRight(
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <label className={styles.visibilityToggle}>
          <input
            type="checkbox"
            checked={isPublished}
            onChange={() => setIsPublished(!isPublished)}
          />
          <span className={styles.visibilitySwitch} />
          <span className={styles.visibilityLabel}>
            {isPublished ? (
              <Eye size={16} style={{ marginRight: 6, flexShrink: 0 }} />
            ) : (
              <EyeOff size={16} style={{ marginRight: 6, flexShrink: 0, opacity: 0.7 }} />
            )}
            Публикация
          </span>
        </label>
        <button
          type="button"
          onClick={() => navigate(`/admin/dynamic/${slug}`)}
          className={styles.headerCancelBtn}
        >
          Назад
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className={styles.headerSubmitBtn}
        >
          {submitLabel}
        </button>
      </div>
    );
    
    return () => setHeaderRight(null);
  }, [setHeaderRight, isSaving, slug, navigate, isPublished, isNew]);

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Загрузка...</p>
      </div>
    );
  }

  if (structureFields.length === 0) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.emptyState}>
          <h3>Структура не настроена</h3>
          <p>Перейдите в настройки и настройте структуру полей для этого раздела.</p>
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => navigate('/admin/settings')}
          >
            Перейти в настройки
          </button>
        </div>
      </div>
    );
  }

  const renderField = (field) => {
    const fieldType = field.type;
    const fieldKey = field.fieldKey; // Уникальный ключ поля
    const value = recordData[fieldKey];
    const blockDef = BLOCK_TYPES.find(b => b.type === fieldType);
    const label = getBlockLabel(field);
    const fieldClassName = `${styles.formField} ${invalidStructureFieldKeys.includes(fieldKey) ? styles.invalidFormField : ''} ${pulseStructureFieldKeys.includes(fieldKey) ? styles.invalidFormFieldPulse : ''}`;

    switch (fieldType) {
      case 'heading':
        return (
          <div key={fieldKey} ref={(el) => { structureFieldRefs.current[fieldKey] = el; }} className={fieldClassName}>
            <label className={styles.blockLabel}>{label}</label>
            <input
              type="text"
              value={typeof value === 'object' && value?.text ? value.text : (typeof value === 'string' ? value : '')}
              onChange={(e) => handleFieldChange(fieldKey, { text: e.target.value })}
              className={styles.blockInput}
              placeholder="Введите заголовок"
            />
          </div>
        );

      case 'text':
        return (
          <div key={fieldKey} ref={(el) => { structureFieldRefs.current[fieldKey] = el; }} className={fieldClassName}>
            <label className={styles.blockLabel}>{label}</label>
            <RichTextEditor
              value={typeof value === 'object' && value?.content ? value.content : (typeof value === 'string' ? value : '')}
              onChange={(v) => handleFieldChange(fieldKey, { content: v })}
              placeholder="Введите текст..."
              minHeight={200}
            />
          </div>
        );

      case 'image':
        const imageItem = value && typeof value === 'object' ? value : (value ? { type: 'url', value } : null);
        return (
          <div key={fieldKey} ref={(el) => { structureFieldRefs.current[fieldKey] = el; }} className={fieldClassName}>
            <label className={styles.blockLabel}>{label}</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) {
                  handleImageFileSelect(fieldKey, file);
                }
              }}
              style={{ display: 'none' }}
              id={`field-img-${fieldKey}`}
            />
            {imageItem && (
              <div className={styles.imagePreview} style={{ marginTop: 12 }}>
                <div className={styles.previewItem} style={{ aspectRatio: 'auto', height: 'auto' }}>
                  <img 
                    src={imageItem.type === 'url' ? getImageUrl(imageItem.value) : imageItem.preview} 
                    alt="" 
                    style={{ width: '100%', height: 'auto', maxHeight: 300, borderRadius: '8px', display: 'block', objectFit: 'contain' }} 
                  />
                  <button 
                    type="button" 
                    onClick={() => {
                      if (imageItem.type === 'file' && imageItem.preview) {
                        URL.revokeObjectURL(imageItem.preview);
                      }
                      handleFieldChange(fieldKey, null);
                    }} 
                    className={styles.removeImage} 
                    title="Удалить" 
                    aria-label="Удалить"
                  >
                    <XIcon size={14} />
                  </button>
                </div>
              </div>
            )}
            {!imageItem && (
              <label htmlFor={`field-img-${fieldKey}`} className={styles.uploadArea} style={{ marginTop: 12 }}>
                Загрузить изображение
              </label>
            )}
          </div>
        );

      case 'gallery':
        const images = Array.isArray(value) ? value : (value?.images ? value.images : []);
        return (
          <div key={fieldKey} ref={(el) => { structureFieldRefs.current[fieldKey] = el; }} className={fieldClassName}>
            <label className={styles.blockLabel}>{label}</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length > 0) handleGalleryUpload(fieldKey, files);
              }}
              style={{ display: 'none' }}
              id={`field-gal-${fieldKey}`}
            />
            <label htmlFor={`field-gal-${fieldKey}`} className={styles.uploadArea}>
              Добавить изображения в галерею
            </label>
            {images.length > 0 && (
              <div className={styles.galleryPreview}>
                {images.map((img, i) => (
                  <div key={i} className={styles.galleryItemWrap}>
                    <img src={getImageUrl(typeof img === 'string' ? img : img.url)} alt="" />
                    <button
                      type="button"
                      onClick={() => {
                        const newImages = images.filter((_, idx) => idx !== i);
                        handleFieldChange(fieldKey, newImages);
                      }}
                      className={styles.removeBtn}
                    >
                      <XIcon size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'quote':
        return (
          <div key={fieldKey} ref={(el) => { structureFieldRefs.current[fieldKey] = el; }} className={fieldClassName}>
            <label className={styles.blockLabel}>{label}</label>
            <textarea
              value={typeof value === 'object' && value?.content ? value.content : (typeof value === 'string' ? value : '')}
              onChange={(e) => handleFieldChange(fieldKey, { content: e.target.value })}
              className={styles.blockInput}
              placeholder="Введите цитату..."
              rows={4}
            />
          </div>
        );

      case 'video':
        return (
          <div key={fieldKey} ref={(el) => { structureFieldRefs.current[fieldKey] = el; }} className={fieldClassName}>
            <label className={styles.blockLabel}>{label}</label>
            <input
              type="text"
              value={typeof value === 'object' && value?.url ? value.url : (typeof value === 'string' ? value : '')}
              onChange={(e) => handleFieldChange(fieldKey, { url: e.target.value })}
              className={styles.blockInput}
              placeholder="URL видео VK"
            />
          </div>
        );

      case 'list':
        const listItems = Array.isArray(value?.items) ? value.items : [];
        return (
          <div key={fieldKey} ref={(el) => { structureFieldRefs.current[fieldKey] = el; }} className={fieldClassName}>
            <label className={styles.blockLabel}>{label}</label>
            <div>
              {listItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => {
                      const newItems = [...listItems];
                      newItems[i] = e.target.value;
                      handleFieldChange(fieldKey, { items: newItems, ordered: value?.ordered || false });
                    }}
                    className={styles.blockInput}
                    placeholder={`Элемент ${i + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newItems = listItems.filter((_, idx) => idx !== i);
                      handleFieldChange(fieldKey, { items: newItems, ordered: value?.ordered || false });
                    }}
                    className={styles.removeBtn}
                  >
                    <XIcon size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  handleFieldChange(fieldKey, { items: [...listItems, ''], ordered: value?.ordered || false });
                }}
                className={styles.addBtn}
                style={{ marginTop: '8px' }}
              >
                Добавить элемент
              </button>
            </div>
          </div>
        );

      default:
        // Для остальных типов блоков используем простое текстовое поле
        return (
          <div key={fieldKey} ref={(el) => { structureFieldRefs.current[fieldKey] = el; }} className={fieldClassName}>
            <label className={styles.blockLabel}>{label}</label>
            <input
              type="text"
              value={typeof value === 'string' ? value : (typeof value === 'object' ? JSON.stringify(value) : '')}
              onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
              className={styles.blockInput}
              placeholder={`Введите ${label.toLowerCase()}`}
            />
          </div>
        );
    }
  };

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>
          {isNew ? `Новая запись: ${pageTitle}` : `Редактирование: ${pageTitle}`}
        </h1>
      </div>

      <div className={styles.formContainer}>
        {structureFields.map(field => renderField(field))}
        
        <div className={styles.formField} style={{ marginTop: 32 }}>
          <label className={styles.blockLabel}>Дополнительные блоки</label>
          <p className={styles.formHint} style={{ marginBottom: 12 }}>
            Добавляйте дополнительные блоки поверх структуры. Они будут отображаться после стандартных полей.
          </p>
          <NewsBlockEditor
            blocks={additionalBlocks}
            onChange={handleAdditionalBlocksChange}
            pendingBlockFiles={pendingFiles}
            onPendingBlockFilesChange={handlePendingBlockFilesChange}
            preserveRelatedSelections={!isNew}
            excludedRecordId={!isNew ? id : null}
            invalidBlockIds={invalidAdditionalBlockIds}
            pulseInvalidBlockIds={pulseAdditionalBlockIds}
            scrollToBlockId={scrollToAdditionalBlockId}
            scrollRequestId={additionalScrollRequestId}
          />
        </div>
      </div>

      <ConfirmModal
        open={Boolean(infoModal)}
        title={infoModal?.title || 'Уведомление'}
        message={infoModal?.message || ''}
        confirmLabel="Понятно"
        cancelLabel="Закрыть"
        onConfirm={() => setInfoModal(null)}
        onCancel={() => setInfoModal(null)}
      />
    </div>
  );
}
