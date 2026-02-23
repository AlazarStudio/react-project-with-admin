'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  GripVertical, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, X, Type, Image, Images, Quote, Video, Heading, Plus,
  List, ListOrdered, Table, Minus, MousePointerClick, ChevronsDownUp, LayoutGrid, GalleryHorizontal, MapPin, FileText, Grid3x3,
  Code, Instagram, Facebook, Share2, DollarSign, Users, Star, Building2, Phone, Clock, Music, File, Link2, Hash, Upload
} from 'lucide-react';
import RichTextEditor from '@/components/RichTextEditor';
import { dynamicPageRecordsAPI, getImageUrl, menuAPI, structureAPI, mediaAPI } from '@/lib/api';
import { MUI_ICON_NAMES, MUI_ICONS, getMuiIconComponent, getIconGroups } from '../WhatToBringIcons';
import styles from './NewsBlockEditor.module.css';

function PendingImage({ file, alt = '', className }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!file) {
      setUrl('');
      return;
    }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  if (!file || !url) return null;
  return <img src={url} alt={alt} className={className} />;
}

const TABLE_TEXTAREA_MAX_HEIGHT = 300;

function AutoHeightTableTextarea({ value, onChange, className, placeholder, rows = 2, ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, TABLE_TEXTAREA_MAX_HEIGHT)}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      className={className}
      placeholder={placeholder}
      rows={rows}
      {...props}
    />
  );
}

const BLOCK_TYPES = [
  { type: 'heading', label: 'Заголовок', icon: Heading },
  { type: 'text', label: 'Текст', icon: Type },
  { type: 'number', label: 'Число', icon: Hash },
  { type: 'boolean', label: 'Флаг (Да/Нет)', icon: MousePointerClick },
  { type: 'date', label: 'Дата', icon: Clock },
  { type: 'datetime', label: 'Дата и время', icon: Clock },
  { type: 'multiselect', label: 'Выпадающий список', icon: ListOrdered },
  { type: 'url', label: 'Ссылка (URL)', icon: Link2 },
  { type: 'contact', label: 'Контакт (email, телефон, ссылка)', icon: Phone },
  { type: 'image', label: 'Изображение', icon: Image },
  { type: 'gallery', label: 'Галерея', icon: Images },
  { type: 'file', label: 'Файл', icon: File },
  { type: 'video', label: 'Видео', icon: Video },
  { type: 'audio', label: 'Аудио', icon: Music },
  { type: 'quote', label: 'Цитата', icon: Quote },
  { type: 'list', label: 'Список', icon: List },
  { type: 'table', label: 'Таблица', icon: Table },
  { type: 'accordion', label: 'Аккордеон', icon: ChevronsDownUp },
  { type: 'tabs', label: 'Табы', icon: LayoutGrid },
  { type: 'relatedEntities', label: 'Связанные сущности', icon: Link2 },
  { type: 'json', label: 'JSON', icon: Code },
];

function generateBlockId() {
  return `b-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createEmptyBlock(type) {
  const id = generateBlockId();
  const base = { id, type, order: 0, label: '' };
  switch (type) {
    case 'heading':
      return { ...base, data: { text: '' } };
    case 'text':
      return { ...base, data: { content: '' } };
    case 'number':
      return { ...base, data: { value: '' } };
    case 'boolean':
      return { ...base, data: { value: false } };
    case 'date':
      return { ...base, data: { value: '' } };
    case 'datetime':
      return { ...base, data: { value: '' } };
    case 'multiselect':
      return { ...base, data: { values: [], linkEnabled: false, links: [] } };
    case 'url':
      return { ...base, data: { value: '' } };
    case 'contact':
      return { ...base, data: { value: '', icon: '', iconType: 'library' } };
    case 'image':
      return { ...base, data: { url: '' } };
    case 'gallery':
      return { ...base, data: { images: [] } };
    case 'file':
      return { ...base, data: { title: '', url: '' } };
    case 'quote':
      return { ...base, data: { content: '' } };
    case 'video':
      return { ...base, data: { url: '' } };
    case 'list':
      return { ...base, data: { items: [], ordered: false } };
    case 'table':
      return {
        ...base,
        data: {
          headers: ['', '', ''],
          rows: [['', '', '']],
        },
      };
    case 'separator':
      return { ...base, data: {} };
    case 'button':
      return { ...base, data: { text: '', url: '', style: 'primary' } };
    case 'accordion':
      return { ...base, data: { items: [] } };
    case 'tabs':
      return { ...base, data: { tabs: [] } };
    case 'carousel':
      return { ...base, data: { images: [] } };
    case 'map':
      return { ...base, data: { coordinates: '', zoom: 10 } };
    case 'form':
      return { ...base, data: { fields: [] } };
    case 'cards':
      return { ...base, data: { cards: [] } };
    case 'code':
      return { ...base, data: { code: '', language: 'javascript' } };
    case 'social':
      return { ...base, data: { platform: '', embedCode: '' } };
    case 'pricing':
      return { ...base, data: { plans: [] } };
    case 'team':
      return { ...base, data: { members: [] } };
    case 'reviews':
      return { ...base, data: { reviews: [] } };
    case 'partners':
      return { ...base, data: { logos: [] } };
    case 'relatedEntities':
      return { ...base, data: { resourceSlug: '', resourceLabel: '', selectedIds: [], selectedItems: [] } };
    case 'audio':
      return { ...base, data: { url: '' } };
    case 'json':
      return { ...base, data: { value: '{}' } };
    default:
      return { ...base, data: {} };
  }
}

function slugFromText(text) {
  if (!text || !text.trim()) return '';
  return text
    .toLowerCase()
    .replace(/[а-яё]/g, (c) => {
      const map = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
      return map[c] || c;
    })
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function labelToFieldKey(label) {
  if (!label || !String(label).trim()) return '';
  const slug = slugFromText(String(label).trim());
  if (!slug) return '';
  return slug.replace(/-/g, '_');
}

function getDefaultBlockLabel(type, blocks = []) {
  const baseLabel = BLOCK_TYPES.find((block) => block.type === type)?.label ?? type;
  const cleanBaseLabel = String(baseLabel).trim();
  if (!cleanBaseLabel) return '';

  const labelPattern = new RegExp(`^${escapeRegExp(cleanBaseLabel)}(?:\\s(\\d+))?$`);
  let baseTaken = false;
  const usedNumbers = new Set();

  for (const block of blocks) {
    const currentLabel = String(block?.label || '').trim();
    if (!currentLabel) continue;
    const match = currentLabel.match(labelPattern);
    if (!match) continue;

    if (!match[1]) {
      baseTaken = true;
      continue;
    }

    const number = Number(match[1]);
    if (Number.isInteger(number) && number >= 1) {
      usedNumbers.add(number);
    }
  }

  if (!baseTaken) return cleanBaseLabel;

  let suffix = 1;
  while (usedNumbers.has(suffix)) {
    suffix += 1;
  }
  return `${cleanBaseLabel} ${suffix}`;
}

export default function NewsBlockEditor({
  blocks = [],
  onChange,
  pendingBlockFiles = {},
  onPendingBlockFilesChange,
  structureOnly = false,
  preserveRelatedSelections = false,
  excludedRecordId = null,
  invalidBlockIds = [],
  pulseInvalidBlockIds = [],
  scrollToBlockId = null,
  scrollRequestId = 0,
}) {
  const [addBlockOpen, setAddBlockOpen] = useState(false);
  const [hoveredInsertIndex, setHoveredInsertIndex] = useState(null);
  const [openInsertIndex, setOpenInsertIndex] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({});
  const [resourceOptions, setResourceOptions] = useState([]);
  const [recordsBySlug, setRecordsBySlug] = useState({});
  const [recordsLoadingBySlug, setRecordsLoadingBySlug] = useState({});
  const [relatedSearchByBlockId, setRelatedSearchByBlockId] = useState({});
  const [relatedSelectionCacheByBlockId, setRelatedSelectionCacheByBlockId] = useState({});
  const [contactIconPicker, setContactIconPicker] = useState({ open: false, blockId: null, group: 'all', search: '' });
  const [contactIconUploadingByBlockId, setContactIconUploadingByBlockId] = useState({});
  const relatedHeadingMetaBySlugRef = useRef({});
  const relatedHeadingMetaLoadingBySlugRef = useRef({});
  const addBlockRef = useRef(null);
  const insertRefs = useRef({});
  const blockRefs = useRef({});

  const sortedBlocks = [...blocks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const calculateDropdownPosition = (index) => {
    const insertArea = insertRefs.current[index];
    if (!insertArea) return 'bottom';

    const rect = insertArea.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropdownHeight = 350; // Примерная высота выпадающего меню с учетом всех опций

    // Если места снизу недостаточно и сверху больше места - показываем сверху
    if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
      return 'top';
    }
    // Если места сверху недостаточно и снизу больше места - показываем снизу
    if (spaceAbove < dropdownHeight && spaceBelow > spaceAbove) {
      return 'bottom';
    }
    // По умолчанию показываем снизу
    return 'bottom';
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (addBlockRef.current && !addBlockRef.current.contains(e.target)) {
        setAddBlockOpen(false);
      }
      if (openInsertIndex !== null && insertRefs.current[openInsertIndex] && !insertRefs.current[openInsertIndex].contains(e.target)) {
        setOpenInsertIndex(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openInsertIndex]);

  useEffect(() => {
    if (structureOnly) return;

    let mounted = true;
    const loadMenuResources = async () => {
      try {
        const menuRes = await menuAPI.get();
        const menuItems = menuRes?.data?.items || [];
        const options = menuItems
          .filter((item) => item?.isVisible !== false && item?.url?.startsWith('/admin/') && item.url !== '/admin/settings')
          .map((item) => {
            const slug = String(item.url || '')
              .replace(/^\/admin\/?/, '')
              .replace(/^\/+/, '')
              .replace(/\/+$/, '');
            return {
              slug,
              label: String(item.label || slug),
            };
          })
          .filter((item) => item.slug);
        if (mounted) setResourceOptions(options);
      } catch (_) {
        if (mounted) setResourceOptions([]);
      }
    };

    loadMenuResources();
    const onMenuUpdated = () => loadMenuResources();
    window.addEventListener('menuUpdated', onMenuUpdated);
    return () => {
      mounted = false;
      window.removeEventListener('menuUpdated', onMenuUpdated);
    };
  }, [structureOnly]);

  useEffect(() => {
    if (structureOnly) return;
    const slugs = new Set(
      sortedBlocks
        .filter((block) => block.type === 'relatedEntities' && block.data?.resourceSlug)
        .map((block) => block.data.resourceSlug)
    );
    slugs.forEach((slug) => {
      ensureResourceRecordsLoaded(slug);
    });
  }, [structureOnly, sortedBlocks]);

  useEffect(() => {
    if (openInsertIndex !== null) {
      const position = calculateDropdownPosition(openInsertIndex);
      setDropdownPosition(prev => ({ ...prev, [openInsertIndex]: position }));
    }
  }, [openInsertIndex]);

  useEffect(() => {
    if (!scrollToBlockId) return;
    const target = blockRefs.current[scrollToBlockId];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [scrollToBlockId, scrollRequestId]);

  useEffect(() => {
    if (openInsertIndex !== null) {
      const handleResize = () => {
        const position = calculateDropdownPosition(openInsertIndex);
        setDropdownPosition(prev => ({ ...prev, [openInsertIndex]: position }));
      };
      const handleScroll = () => {
        const position = calculateDropdownPosition(openInsertIndex);
        setDropdownPosition(prev => ({ ...prev, [openInsertIndex]: position }));
      };
      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleScroll, true);
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleScroll, true);
      };
    }
  }, [openInsertIndex]);

  const updateBlock = (index, updates) => {
    const next = sortedBlocks.map((b, i) =>
      i === index ? { ...b, ...updates, data: { ...b.data, ...(updates.data || {}) } } : b
    );
    onChange(next.map((b, i) => ({ ...b, order: i })));
  };

  const updateContactBlockById = (blockId, dataPatch) => {
    const blockIndex = sortedBlocks.findIndex((b) => b.id === blockId);
    if (blockIndex < 0) return;
    updateBlock(blockIndex, { data: { ...(sortedBlocks[blockIndex]?.data || {}), ...dataPatch } });
  };

  const openContactIconPicker = (blockId) => {
    setContactIconPicker({ open: true, blockId, group: 'all', search: '' });
  };

  const closeContactIconPicker = () => {
    setContactIconPicker((prev) => ({ ...prev, open: false, blockId: null, group: 'all', search: '' }));
  };

  const handleContactIconUpload = async (blockId, file) => {
    if (!file) return;
    setContactIconUploadingByBlockId((prev) => ({ ...prev, [blockId]: true }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await mediaAPI.upload(formData);
      const uploadedUrl = res.data?.url || '';
      updateContactBlockById(blockId, { icon: uploadedUrl, iconType: 'upload' });
    } catch (error) {
      console.error('Ошибка загрузки иконки контакта:', error);
    } finally {
      setContactIconUploadingByBlockId((prev) => ({ ...prev, [blockId]: false }));
    }
  };

  const addBlock = (type) => {
    const newBlock = createEmptyBlock(type);
    newBlock.label = getDefaultBlockLabel(type, sortedBlocks);
    newBlock.order = sortedBlocks.length;
    onChange([...sortedBlocks, newBlock]);
    setAddBlockOpen(false);
    // Прокручиваем к новому блоку после рендера
    setTimeout(() => {
      const blockElement = blockRefs.current[newBlock.id];
      if (blockElement) {
        blockElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const addBlockAfter = (afterIndex, type) => {
    const newBlock = createEmptyBlock(type);
    newBlock.label = getDefaultBlockLabel(type, sortedBlocks);
    const insertIndex = afterIndex + 1;
    const next = [...sortedBlocks];
    next.splice(insertIndex, 0, newBlock);
    onChange(next.map((b, i) => ({ ...b, order: i })));
    setOpenInsertIndex(null);
    setHoveredInsertIndex(null);
    // Прокручиваем к новому блоку после рендера
    setTimeout(() => {
      const blockElement = blockRefs.current[newBlock.id];
      if (blockElement) {
        blockElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const removeBlock = (index) => {
    const block = sortedBlocks[index];
    if (block) onPendingBlockFilesChange?.(block.id, null);
    const next = sortedBlocks.filter((_, i) => i !== index).map((b, i) => ({ ...b, order: i }));
    onChange(next);
  };

  const moveBlock = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= sortedBlocks.length) return;
    const next = [...sortedBlocks];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    onChange(next.map((b, i) => ({ ...b, order: i })));
  };

  const moveBlockByDrag = (draggedIndex, targetIndex) => {
    if (draggedIndex === targetIndex) return;
    const next = [...sortedBlocks];
    const [removed] = next.splice(draggedIndex, 1);
    next.splice(targetIndex, 0, removed);
    onChange(next.map((b, i) => ({ ...b, order: i })));
  };

  const moveListItem = (blockIndex, itemIndex, direction) => {
    const block = sortedBlocks[blockIndex];
    if (!block) return;
    const items = Array.isArray(block.data?.items) ? [...block.data.items] : [];
    const targetIndex = itemIndex + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    [items[itemIndex], items[targetIndex]] = [items[targetIndex], items[itemIndex]];
    updateBlock(blockIndex, { data: { ...block.data, items } });
  };

  const [draggedListItem, setDraggedListItem] = useState(null);
  const [dragOverListItem, setDragOverListItem] = useState(null);

  const moveListItemTo = (blockIndex, fromIndex, toIndex) => {
    const block = sortedBlocks[blockIndex];
    if (!block) return;
    const items = Array.isArray(block.data?.items) ? [...block.data.items] : [];
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length || fromIndex === toIndex) return;
    const [removed] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, removed);
    updateBlock(blockIndex, { data: { ...block.data, items } });
  };

  const sanitizeLabelText = (value) => {
    if (typeof value !== 'string') return '';
    return value
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const isProbablyImageValue = (value) => {
    if (typeof value !== 'string') return false;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    if (normalized.startsWith('/uploads/')) return true;
    if (/\.(png|jpe?g|webp|gif|svg)(\?.*)?$/.test(normalized)) return true;
    return /^https?:\/\/.+\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(normalized);
  };

  const pickTextValue = (value) => {
    if (typeof value === 'string') {
      const clean = sanitizeLabelText(value);
      return clean && !isProbablyImageValue(clean) ? clean : '';
    }

    if (value && typeof value === 'object') {
      const candidates = [value.text, value.title, value.label, value.name, value.content];
      for (const candidate of candidates) {
        const clean = sanitizeLabelText(candidate);
        if (clean && !isProbablyImageValue(clean)) return clean;
      }
    }

    return '';
  };

  const ensureResourceHeadingMetaLoaded = async (resourceSlug, { force = false } = {}) => {
    if (!resourceSlug) return null;

    const cached = relatedHeadingMetaBySlugRef.current[resourceSlug];
    if (!force && cached !== undefined) {
      return cached;
    }

    if (relatedHeadingMetaLoadingBySlugRef.current[resourceSlug]) {
      return cached ?? null;
    }

    relatedHeadingMetaLoadingBySlugRef.current[resourceSlug] = true;
    try {
      const response = await structureAPI.get(resourceSlug);
      const rawFields = Array.isArray(response?.data?.fields) ? response.data.fields : [];
      const fields = rawFields
        .map((field, index) => ({
          ...field,
          order: Number.isFinite(field?.order) ? field.order : index,
        }))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      const headingIndex = fields.findIndex((field) => field?.type === 'heading');
      const headingField = headingIndex >= 0 ? fields[headingIndex] : null;
      const headingOrder = headingField?.order ?? headingIndex;
      const headingKeyByLabel = labelToFieldKey(headingField?.label || '');
      const headingMeta = headingField
        ? {
          fieldKey: headingKeyByLabel || `heading-${headingOrder >= 0 ? headingOrder : 0}`,
          legacyKey: `heading-${headingOrder >= 0 ? headingOrder : 0}`,
        }
        : null;

      relatedHeadingMetaBySlugRef.current[resourceSlug] = headingMeta;
      return headingMeta;
    } catch (_) {
      relatedHeadingMetaBySlugRef.current[resourceSlug] = null;
      return null;
    } finally {
      relatedHeadingMetaLoadingBySlugRef.current[resourceSlug] = false;
    }
  };

  const guessRecordLabel = (record, headingMeta = null) => {
    if (!record || typeof record !== 'object') return '';

    if (headingMeta) {
      const headingCandidates = [headingMeta.fieldKey, headingMeta.legacyKey, 'heading'];
      for (const key of headingCandidates) {
        if (!key) continue;
        const headingValue = pickTextValue(record[key]);
        if (headingValue) return headingValue;
      }
    }

    const preferredKeys = ['title', 'name', 'label', 'heading', 'nazvanie', 'fio'];
    for (const key of preferredKeys) {
      const value = pickTextValue(record[key]);
      if (value) return value;
    }

    const fallback = Object.entries(record).find(([key, value]) => (
      !['id', '_id', 'createdAt', 'updatedAt', 'created_at', 'updated_at', 'isPublished', 'additionalBlocks'].includes(key) &&
      !!pickTextValue(value)
    ));
    return fallback ? pickTextValue(fallback[1]) : '';
  };

  const guessRecordImage = (record) => {
    if (!record || typeof record !== 'object') return '';

    const isImageUrl = (value) => {
      if (typeof value !== 'string') return false;
      const v = value.trim().toLowerCase();
      if (!v) return false;
      return (
        v.startsWith('/uploads/') ||
        v.startsWith('http://') ||
        v.startsWith('https://') ||
        /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/.test(v)
      );
    };

    const pickStringImage = (value) => (isImageUrl(value) ? value : '');
    const preferredKeys = ['image', 'photo', 'avatar', 'logo', 'cover', 'thumbnail'];

    for (const key of preferredKeys) {
      const value = record[key];
      if (typeof value === 'string') {
        const image = pickStringImage(value);
        if (image) return image;
      }
      if (value && typeof value === 'object') {
        const image = pickStringImage(value.url || value.value);
        if (image) return image;
      }
    }

    for (const value of Object.values(record)) {
      if (typeof value === 'string') {
        const image = pickStringImage(value);
        if (image) return image;
      } else if (Array.isArray(value)) {
        const first = value[0];
        if (typeof first === 'string') {
          const image = pickStringImage(first);
          if (image) return image;
        } else if (first && typeof first === 'object') {
          const image = pickStringImage(first.url || first.value);
          if (image) return image;
        }
      } else if (value && typeof value === 'object') {
        const image = pickStringImage(value.url || value.value);
        if (image) return image;
      }
    }

    return '';
  };

  const ensureResourceRecordsLoaded = async (resourceSlug, { force = false } = {}) => {
    if (!resourceSlug) return;
    if (!force && (recordsBySlug[resourceSlug] || recordsLoadingBySlug[resourceSlug])) return;
    if (force && recordsLoadingBySlug[resourceSlug]) return;

    setRecordsLoadingBySlug((prev) => ({ ...prev, [resourceSlug]: true }));
    try {
      const headingMeta = await ensureResourceHeadingMetaLoaded(resourceSlug, { force });
      const res = await dynamicPageRecordsAPI.getAll(resourceSlug, { page: 1, limit: 5000 });
      const records = Array.isArray(res?.data?.records) ? res.data.records : [];
      const normalized = records.map((record) => ({
        id: record.id,
        label: guessRecordLabel(record, headingMeta) || `Запись ${record.id}`,
        image: guessRecordImage(record),
      })).filter((record) => record.id);

      setRecordsBySlug((prev) => ({ ...prev, [resourceSlug]: normalized }));
    } catch (_) {
      setRecordsBySlug((prev) => ({ ...prev, [resourceSlug]: [] }));
    } finally {
      setRecordsLoadingBySlug((prev) => ({ ...prev, [resourceSlug]: false }));
    }
  };

  const moveAccordionItem = (blockIndex, itemIndex, direction) => {
    const block = sortedBlocks[blockIndex];
    if (!block) return;
    const items = Array.isArray(block.data?.items) ? [...block.data.items] : [];
    const targetIndex = itemIndex + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    [items[itemIndex], items[targetIndex]] = [items[targetIndex], items[itemIndex]];
    updateBlock(blockIndex, { data: { ...block.data, items } });
  };

  const [draggedAccordionItem, setDraggedAccordionItem] = useState(null);
  const [dragOverAccordionItem, setDragOverAccordionItem] = useState(null);

  const moveAccordionItemTo = (blockIndex, fromIndex, toIndex) => {
    const block = sortedBlocks[blockIndex];
    if (!block) return;
    const items = Array.isArray(block.data?.items) ? [...block.data.items] : [];
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length || fromIndex === toIndex) return;
    const [removed] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, removed);
    updateBlock(blockIndex, { data: { ...block.data, items } });
  };

  const moveTabsItem = (blockIndex, itemIndex, direction) => {
    const block = sortedBlocks[blockIndex];
    if (!block) return;
    const tabs = [...(block.data?.tabs || [])];
    const targetIndex = itemIndex + direction;
    if (targetIndex < 0 || targetIndex >= tabs.length) return;
    [tabs[itemIndex], tabs[targetIndex]] = [tabs[targetIndex], tabs[itemIndex]];
    updateBlock(blockIndex, { data: { ...block.data, tabs } });
  };

  const [draggedTabsItem, setDraggedTabsItem] = useState(null);
  const [dragOverTabsItem, setDragOverTabsItem] = useState(null);

  const moveTabsItemTo = (blockIndex, fromIndex, toIndex) => {
    const block = sortedBlocks[blockIndex];
    if (!block) return;
    const tabs = [...(block.data?.tabs || [])];
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= tabs.length || toIndex >= tabs.length || fromIndex === toIndex) return;
    const [removed] = tabs.splice(fromIndex, 1);
    tabs.splice(toIndex, 0, removed);
    updateBlock(blockIndex, { data: { ...block.data, tabs } });
  };

  const moveTableColumn = (blockIndex, fromCol, toCol) => {
    if (fromCol === toCol) return;
    const block = sortedBlocks[blockIndex];
    if (!block?.data) return;
    const headers = [...(block.data.headers || [])];
    const rows = (block.data.rows || []).map(row => [...(row || [])]);
    const colCount = Math.max(headers.length, ...rows.map(r => r.length));
    while (headers.length < colCount) headers.push('');
    rows.forEach(r => { while (r.length < colCount) r.push(''); });
    if (fromCol < 0 || toCol < 0 || fromCol >= colCount || toCol >= colCount) return;
    const [removedH] = headers.splice(fromCol, 1);
    headers.splice(toCol, 0, removedH);
    rows.forEach(r => {
      const [removedC] = r.splice(fromCol, 1);
      r.splice(toCol, 0, removedC);
    });
    updateBlock(blockIndex, { data: { ...block.data, headers, rows } });
  };

  const moveTableRow = (blockIndex, fromRow, toRow) => {
    if (fromRow === toRow) return;
    const block = sortedBlocks[blockIndex];
    if (!block?.data) return;
    const rows = [...(block.data.rows || [])];
    if (fromRow < 0 || toRow < 0 || fromRow >= rows.length || toRow >= rows.length) return;
    const [removed] = rows.splice(fromRow, 1);
    rows.splice(toRow, 0, removed);
    updateBlock(blockIndex, { data: { ...block.data, rows } });
  };

  const moveRelatedEntity = (blockIndex, entityIndex, direction) => {
    const block = sortedBlocks[blockIndex];
    if (!block) return;
    const selectedItems = (Array.isArray(block.data?.selectedItems) ? [...block.data.selectedItems] : [])
      .filter((item) => !excludedRecordId || String(item.id) !== String(excludedRecordId));
    const targetIndex = entityIndex + direction;
    if (targetIndex < 0 || targetIndex >= selectedItems.length) return;
    [selectedItems[entityIndex], selectedItems[targetIndex]] = [selectedItems[targetIndex], selectedItems[entityIndex]];
    const nextIds = selectedItems.map((item) => item.id);

    if (preserveRelatedSelections && block.id && block.data?.resourceSlug) {
      setRelatedSelectionCacheByBlockId((prev) => ({
        ...prev,
        [block.id]: {
          ...(prev[block.id] || {}),
          [block.data.resourceSlug]: {
            selectedIds: nextIds,
            selectedItems,
          },
        },
      }));
    }

    updateBlock(blockIndex, {
      data: {
        ...block.data,
        selectedItems,
        selectedIds: nextIds,
      },
    });
  };

  const [draggedRelatedEntity, setDraggedRelatedEntity] = useState(null);
  const [dragOverRelatedEntity, setDragOverRelatedEntity] = useState(null);

  const moveRelatedEntityTo = (blockIndex, fromIndex, toIndex) => {
    const block = sortedBlocks[blockIndex];
    if (!block) return;
    const selectedItems = (Array.isArray(block.data?.selectedItems) ? [...block.data.selectedItems] : [])
      .filter((item) => !excludedRecordId || String(item.id) !== String(excludedRecordId));
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= selectedItems.length || toIndex >= selectedItems.length || fromIndex === toIndex) return;
    const [removed] = selectedItems.splice(fromIndex, 1);
    selectedItems.splice(toIndex, 0, removed);
    const nextIds = selectedItems.map((item) => item.id);

    if (preserveRelatedSelections && block.id && block.data?.resourceSlug) {
      setRelatedSelectionCacheByBlockId((prev) => ({
        ...prev,
        [block.id]: {
          ...(prev[block.id] || {}),
          [block.data.resourceSlug]: {
            selectedIds: nextIds,
            selectedItems,
          },
        },
      }));
    }

    updateBlock(blockIndex, {
      data: {
        ...block.data,
        selectedItems,
        selectedIds: nextIds,
      },
    });
  };

  const addRelatedEntity = (blockIndex, record) => {
    const block = sortedBlocks[blockIndex];
    if (!block || !record?.id) return;
    if (excludedRecordId && String(record.id) === String(excludedRecordId)) return;
    const currentItems = Array.isArray(block.data?.selectedItems) ? block.data.selectedItems : [];
    if (currentItems.some((item) => item.id === record.id)) return;
    const nextItems = [...currentItems, { id: record.id, label: record.label, image: record.image || '' }];
    const nextIds = nextItems.map((item) => item.id);

    if (preserveRelatedSelections && block.id && block.data?.resourceSlug) {
      setRelatedSelectionCacheByBlockId((prev) => ({
        ...prev,
        [block.id]: {
          ...(prev[block.id] || {}),
          [block.data.resourceSlug]: {
            selectedIds: nextIds,
            selectedItems: nextItems,
          },
        },
      }));
    }

    updateBlock(blockIndex, {
      data: {
        ...block.data,
        selectedItems: nextItems,
        selectedIds: nextIds,
      },
    });
  };

  const removeRelatedEntity = (blockIndex, recordId) => {
    const block = sortedBlocks[blockIndex];
    if (!block) return;
    const currentItems = (Array.isArray(block.data?.selectedItems) ? block.data.selectedItems : [])
      .filter((item) => !excludedRecordId || String(item.id) !== String(excludedRecordId));
    const nextItems = currentItems.filter((item) => item.id !== recordId);
    const nextIds = nextItems.map((item) => item.id);

    if (preserveRelatedSelections && block.id && block.data?.resourceSlug) {
      setRelatedSelectionCacheByBlockId((prev) => ({
        ...prev,
        [block.id]: {
          ...(prev[block.id] || {}),
          [block.data.resourceSlug]: {
            selectedIds: nextIds,
            selectedItems: nextItems,
          },
        },
      }));
    }

    updateBlock(blockIndex, {
      data: {
        ...block.data,
        selectedItems: nextItems,
        selectedIds: nextIds,
      },
    });
  };

  const handleVideoChange = (value, index) => {
    let url = value.trim();
    if (url.includes('<iframe') && url.includes('src=')) {
      const m = url.match(/src=["']([^"']+)["']/);
      if (m) url = m[1];
    }
    updateBlock(index, { data: { url } });
  };

  const handleImageFileSelect = (e, index) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const block = sortedBlocks[index];
    if (!block) return;
    onPendingBlockFilesChange?.(block.id, { url: file, images: undefined });
  };

  const handleGalleryFileSelect = (e, index) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    const block = sortedBlocks[index];
    if (!block) return;
    const prev = pendingBlockFiles[block.id]?.images || [];
    onPendingBlockFilesChange?.(block.id, { url: undefined, images: [...prev, ...files] });
  };

  const removeGalleryImage = (blockIndex, imgIndex) => {
    const block = sortedBlocks[blockIndex];
    if (!block) return;
    const saved = block.data?.images || [];
    const pending = pendingBlockFiles[block.id]?.images || [];
    if (imgIndex < saved.length) {
      const images = saved.filter((_, i) => i !== imgIndex);
      updateBlock(blockIndex, { data: { images } });
    } else {
      const pendingIndex = imgIndex - saved.length;
      const next = pending.filter((_, i) => i !== pendingIndex);
      onPendingBlockFilesChange?.(block.id, next.length ? { images: next } : null);
    }
  };

  const [draggedGalleryImage, setDraggedGalleryImage] = useState(null);
  const [dragOverGalleryImage, setDragOverGalleryImage] = useState(null);
  const [insertRowPlusPos, setInsertRowPlusPos] = useState({ blockIndex: null, rowKey: null, x: 0, y: 0 });
  const [draggedTableColumn, setDraggedTableColumn] = useState({ blockIndex: null, colIndex: null });
  const [dragOverTableColumn, setDragOverTableColumn] = useState({ blockIndex: null, colIndex: null });
  const [draggedTableRow, setDraggedTableRow] = useState({ blockIndex: null, rowIndex: null });
  const [dragOverTableRow, setDragOverTableRow] = useState({ blockIndex: null, rowIndex: null });

  const moveGalleryImageTo = (blockIndex, fromIndex, toIndex) => {
    const block = sortedBlocks[blockIndex];
    if (!block) return;
    const saved = block.data?.images || [];
    const pending = pendingBlockFiles[block.id]?.images || [];
    if (fromIndex < saved.length && toIndex < saved.length) {
      const arr = [...saved];
      const [item] = arr.splice(fromIndex, 1);
      const dropIdx = fromIndex < toIndex ? toIndex - 1 : toIndex;
      arr.splice(dropIdx, 0, item);
      updateBlock(blockIndex, { data: { images: arr } });
    } else if (fromIndex >= saved.length && toIndex >= saved.length) {
      const arr = [...pending];
      const fi = fromIndex - saved.length;
      const ti = toIndex - saved.length;
      const [item] = arr.splice(fi, 1);
      const dropIdx = fi < ti ? ti - 1 : ti;
      arr.splice(dropIdx, 0, item);
      onPendingBlockFilesChange?.(block.id, { images: arr });
    }
  };

  const moveGalleryImage = (blockIndex, imgIndex, direction) => {
    const block = sortedBlocks[blockIndex];
    if (!block) return;
    const saved = block.data?.images || [];
    const pending = pendingBlockFiles[block.id]?.images || [];
    const newIdx = imgIndex + direction;
    if (newIdx < 0 || newIdx >= saved.length + pending.length) return;
    if (imgIndex < saved.length && newIdx < saved.length) {
      const arr = [...saved];
      [arr[imgIndex], arr[newIdx]] = [arr[newIdx], arr[imgIndex]];
      updateBlock(blockIndex, { data: { images: arr } });
    } else if (imgIndex >= saved.length && newIdx >= saved.length) {
      const pIdx = imgIndex - saved.length;
      const pNewIdx = newIdx - saved.length;
      const arr = [...pending];
      [arr[pIdx], arr[pNewIdx]] = [arr[pNewIdx], arr[pIdx]];
      onPendingBlockFilesChange?.(block.id, { images: arr });
    }
  };

  const clearBlockImage = (blockIndex) => {
    const block = sortedBlocks[blockIndex];
    if (!block) return;
    onPendingBlockFilesChange?.(block.id, null);
    updateBlock(blockIndex, { data: { url: '' } });
  };

  const getBlockImageDisplay = (block) => {
    const pending = pendingBlockFiles[block?.id]?.url;
    if (pending) return null;
    return block?.data?.url;
  };

  const getBlockImagePending = (block) => pendingBlockFiles[block?.id]?.url;

  const handleFileBlockSelect = (e, index) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const block = sortedBlocks[index];
    if (!block) return;
    onPendingBlockFilesChange?.(block.id, { ...pendingBlockFiles[block.id], documentFile: file });
  };

  const getBlockFilePending = (block) => pendingBlockFiles[block?.id]?.documentFile;

  const clearBlockFile = (blockIndex) => {
    const block = sortedBlocks[blockIndex];
    if (!block) return;
    onPendingBlockFilesChange?.(block.id, null);
    updateBlock(blockIndex, { data: { title: '', url: '' } });
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.blocksList}>
        {sortedBlocks.map((block, index) => (
          <div 
            key={block.id}
            ref={(el) => {
              if (el) blockRefs.current[block.id] = el;
            }}
          >
            <div
              className={`${styles.blockRow} ${invalidBlockIds.includes(block.id) ? styles.invalidBlockRow : ''} ${pulseInvalidBlockIds.includes(block.id) ? styles.invalidBlockRowPulse : ''}`}
              data-block-row
              onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e) => {
              e.preventDefault();
              const raw = e.dataTransfer.getData('text/plain');
              const draggedIndex = parseInt(raw, 10);
              if (!Number.isNaN(draggedIndex) && draggedIndex !== index) {
                moveBlockByDrag(draggedIndex, index);
              }
            }}
          >
            <div className={styles.blockControls}>
              <div
                className={styles.dragHandle}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', String(index));
                  e.dataTransfer.effectAllowed = 'move';
                  const row = e.currentTarget.closest('[data-block-row]');
                  if (row) e.dataTransfer.setDragImage(row, 0, 0);
                }}
              >
                <GripVertical size={20} />
              </div>
              <div className={styles.moveButtons}>
                <button
                  type="button"
                  onClick={() => moveBlock(index, -1)}
                  disabled={index === 0}
                  className={styles.moveBtn}
                  aria-label="Вверх"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => moveBlock(index, 1)}
                  disabled={index === sortedBlocks.length - 1}
                  className={styles.moveBtn}
                  aria-label="Вниз"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
              <span className={styles.orderBadge}>{index + 1}</span>
            </div>

            <div className={styles.blockContent}>
              {structureOnly ? (
                (() => {
                  const blockDef = BLOCK_TYPES.find(b => b.type === block.type);
                  const BlockIcon = blockDef?.icon;
                  return (
                    <div className={styles.structureOnlyLabel}>
                      {BlockIcon && <BlockIcon size={20} />}
                      <span>{blockDef?.label ?? block.type}</span>
                    </div>
                  );
                })()
              ) : (
                <>
              {/* Поле для названия блока */}
              <div style={{ marginBottom: 16 }}>
                <label className={styles.blockLabel}>Название блока</label>
                <input
                  type="text"
                  value={block.label ?? ''}
                  onChange={(e) => updateBlock(index, { label: e.target.value })}
                  className={styles.blockInput}
                />
              </div>
              
              {block.type === 'heading' && (
                <>
                  <label className={styles.blockLabel}>Заголовок (якорь для навигации)</label>
                  <input
                    type="text"
                    value={block.data?.text ?? ''}
                    onChange={(e) => updateBlock(index, { data: { text: e.target.value } })}
                    className={styles.blockInput}
                    placeholder="Введите заголовок"
                  />
                </>
              )}

              {block.type === 'text' && (
                <>
                  <label className={styles.blockLabel}>Текстовый блок</label>
                  <RichTextEditor
                    value={block.data?.content ?? ''}
                    onChange={(v) => updateBlock(index, { data: { content: v } })}
                    placeholder="Введите текст..."
                    minHeight={200}
                  />
                </>
              )}

              {block.type === 'number' && (
                <>
                  <label className={styles.blockLabel}>Число</label>
                  <input
                    type="number"
                    value={block.data?.value ?? ''}
                    onChange={(e) => updateBlock(index, { data: { value: e.target.value } })}
                    className={styles.blockInput}
                    placeholder="0"
                  />
                </>
              )}

              {block.type === 'boolean' && (
                <>
                  <label className={styles.blockLabel}>Флаг (Да/Нет)</label>
                  <label className={styles.visibilityToggle} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(block.data?.value)}
                      onChange={(e) => updateBlock(index, { data: { value: e.target.checked } })}
                    />
                    <span className={styles.visibilitySwitch} />
                    <span className={styles.visibilityLabel}>{block.data?.value ? 'Да' : 'Нет'}</span>
                  </label>
                </>
              )}

              {block.type === 'date' && (
                <>
                  <label className={styles.blockLabel}>Дата</label>
                  <input
                    type="date"
                    value={block.data?.value ?? ''}
                    onChange={(e) => updateBlock(index, { data: { value: e.target.value } })}
                    className={styles.blockInput}
                  />
                </>
              )}

              {block.type === 'datetime' && (
                <>
                  <label className={styles.blockLabel}>Дата и время</label>
                  <input
                    type="datetime-local"
                    value={block.data?.value ?? ''}
                    onChange={(e) => updateBlock(index, { data: { value: e.target.value } })}
                    className={styles.blockInput}
                  />
                </>
              )}

              {block.type === 'multiselect' && (
                <>
                  <label className={styles.blockLabel}>Выпадающий список</label>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: 12 }}>
                    <label className={styles.visibilityToggle} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                      <input
                        type="checkbox"
                        checked={Boolean(block.data?.linkEnabled)}
                        onChange={(e) => {
                          const linkEnabled = e.target.checked;
                          const values = block.data?.values || [];
                          const links = linkEnabled ? (block.data?.links || []).slice(0, values.length).concat(values.slice((block.data?.links || []).length).fill('')) : [];
                          updateBlock(index, { data: { ...block.data, linkEnabled, links } });
                        }}
                      />
                      <span className={styles.visibilitySwitch} />
                      <span className={styles.visibilityLabel}>Нужна ссылка при выборе</span>
                    </label>
                    {(block.data?.values || []).length === 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const values = block.data?.values || [];
                          const links = block.data?.links || [];
                          updateBlock(index, {
                            data: {
                              ...block.data,
                              values: [...values, ''],
                              links: block.data?.linkEnabled ? [...links, ''] : links,
                            },
                          });
                        }}
                        className={styles.addListItemBtn}
                        style={{ marginTop: 8 }}
                      >
                        + Добавить значение
                      </button>
                    )}
                  </div>
                  {(block.data?.values || []).map((item, itemIdx) => (
                    <div key={itemIdx} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => {
                          const values = [...(block.data?.values || [])];
                          values[itemIdx] = e.target.value;
                          updateBlock(index, { data: { ...block.data, values } });
                        }}
                        className={styles.blockInput}
                        placeholder={`Значение ${itemIdx + 1}`}
                        style={{ flex: '1 1 120px' }}
                      />
                      {block.data?.linkEnabled && (
                        <input
                          type="url"
                          value={(block.data?.links || [])[itemIdx] ?? ''}
                          onChange={(e) => {
                            const links = [...(block.data?.links || [])];
                            while (links.length < itemIdx + 1) links.push('');
                            links[itemIdx] = e.target.value;
                            updateBlock(index, { data: { ...block.data, links } });
                          }}
                          className={styles.blockInput}
                          placeholder="Ссылка"
                          style={{ flex: '1 1 120px' }}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const values = (block.data?.values || []).filter((_, i) => i !== itemIdx);
                          const links = (block.data?.links || []).filter((_, i) => i !== itemIdx);
                          updateBlock(index, { data: { ...block.data, values, links } });
                        }}
                        className={styles.listItemDeleteBtn}
                        aria-label="Удалить значение"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {(block.data?.values || []).length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const values = block.data?.values || [];
                        const links = block.data?.links || [];
                        updateBlock(index, {
                          data: {
                            ...block.data,
                            values: [...values, ''],
                            links: block.data?.linkEnabled ? [...links, ''] : links,
                          },
                        });
                      }}
                      className={styles.addListItemBtn}
                    >
                      + Добавить значение
                    </button>
                  )}
                </>
              )}

              {block.type === 'url' && (
                <>
                  <label className={styles.blockLabel}>Ссылка (URL)</label>
                  <input
                    type="url"
                    value={block.data?.value ?? ''}
                    onChange={(e) => updateBlock(index, { data: { value: e.target.value } })}
                    className={styles.blockInput}
                    placeholder="https://example.com"
                  />
                </>
              )}

              {block.type === 'contact' && (
                <>
                  <label className={styles.blockLabel}>Контакт (email, телефон, ссылка)</label>
                  <div className={styles.whatToBringBlock} style={{ margin: 0 }}>
                    <div className={styles.whatToBringIconCell}>
                      <div className={styles.whatToBringTypeSwitcher} role="group" aria-label="Источник иконки">
                      <button
                        type="button"
                        className={`${styles.whatToBringTypeSegment} ${block.data?.iconType === 'upload' ? styles.whatToBringTypeSegmentActive : ''}`}
                        onClick={() => updateBlock(index, { data: { ...block.data, iconType: 'upload', icon: '' } })}
                      >
                        Загрузить
                      </button>
                      <button
                        type="button"
                        className={`${styles.whatToBringTypeSegment} ${block.data?.iconType === 'library' || !block.data?.iconType ? styles.whatToBringTypeSegmentActive : ''}`}
                        onClick={() => updateBlock(index, { data: { ...block.data, iconType: 'library', icon: '' } })}
                      >
                        Библиотека
                      </button>
                      </div>
                    <div className={styles.whatToBringIconPreview}>
                      {block.data?.iconType === 'upload' ? (
                        <>
                          <input
                            type="file"
                            accept="image/*"
                            id={`contact-icon-upload-${block.id}`}
                            style={{ display: 'none' }}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                await handleContactIconUpload(block.id, file);
                              }
                              e.target.value = '';
                            }}
                          />
                          <label
                            htmlFor={`contact-icon-upload-${block.id}`}
                            className={styles.whatToBringUploadBtn}
                            title="Загрузить иконку"
                          >
                            {block.data?.icon ? (
                              <img src={getImageUrl(block.data.icon)} alt="" className={styles.whatToBringUploadImg} />
                            ) : (
                              <Upload size={24} />
                            )}
                          </label>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openContactIconPicker(block.id)}
                          className={styles.whatToBringMuiBtn}
                          title="Выбрать иконку"
                          aria-label="Выбрать иконку"
                        >
                          {(() => {
                            const Icon = getMuiIconComponent(block.data?.icon);
                            if (Icon) return <Icon size={22} />;
                            return <span className={styles.whatToBringMuiPlaceholder}>Иконка</span>;
                          })()}
                        </button>
                      )}
                    </div>
                    </div>
                    <input
                      type="text"
                      value={block.data?.value ?? ''}
                      onChange={(e) => updateBlock(index, { data: { value: e.target.value } })}
                      className={styles.whatToBringTextInput}
                      placeholder="Email, телефон, ссылка или другой контакт"
                    />
                  </div>
                  {contactIconUploadingByBlockId[block.id] && (
                    <div className={styles.hint} style={{ marginBottom: 8 }}>Загрузка иконки...</div>
                  )}
                </>
              )}

              {block.type === 'image' && (
                <>
                  <label className={styles.blockLabel}>Одна картинка</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageFileSelect(e, index)}
                    style={{ display: 'none' }}
                    id={`block-img-${block.id}`}
                  />
                  {(getBlockImageDisplay(block) || getBlockImagePending(block)) ? (
                    <div className={styles.imagePreview}>
                      {getBlockImagePending(block) ? (
                        <PendingImage file={getBlockImagePending(block)} />
                      ) : (
                        <img src={getImageUrl(block.data.url)} alt="" />
                      )}
                      <div className={styles.imageActions}>
                        <label htmlFor={`block-img-${block.id}`} className={styles.replaceBtn}>
                          Заменить
                        </label>
                        <button type="button" onClick={() => clearBlockImage(index)} className={styles.removeBtn}>
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label htmlFor={`block-img-${block.id}`} className={styles.uploadArea}>
                      Загрузить изображение
                    </label>
                  )}
                </>
              )}

              {block.type === 'gallery' && (
                <>
                  <label className={styles.blockLabel}>Галерея картинок</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleGalleryFileSelect(e, index)}
                    style={{ display: 'none' }}
                    id={`block-gal-${block.id}`}
                  />
                  <label htmlFor={`block-gal-${block.id}`} className={styles.uploadArea}>
                    Добавить изображения в галерею
                  </label>
                  {(() => {
                    const saved = block.data?.images || [];
                    const pending = pendingBlockFiles[block.id]?.images || [];
                    const total = saved.length + pending.length;
                    if (total === 0) return null;
                    return (
                      <div className={styles.galleryPreview}>
                        {saved.map((img, i) => {
                          const isDragged = draggedGalleryImage?.blockIndex === index && draggedGalleryImage?.imgIndex === i;
                          const isDragOver = dragOverGalleryImage?.blockIndex === index && dragOverGalleryImage?.imgIndex === i;
                          return (
                          <div
                            key={`s-${i}`}
                            className={`${styles.galleryItemWrap} ${isDragged ? styles.galleryItemDragging : ''} ${isDragOver ? styles.galleryItemDragOver : ''}`}
                            draggable
                            onDragStart={(e) => {
                              setDraggedGalleryImage({ blockIndex: index, imgIndex: i });
                              e.dataTransfer.setData('text/plain', JSON.stringify({ blockIndex: index, imgIndex: i }));
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragEnd={() => {
                              setDraggedGalleryImage(null);
                              setDragOverGalleryImage(null);
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                              setDragOverGalleryImage({ blockIndex: index, imgIndex: i });
                            }}
                            onDragLeave={() => setDragOverGalleryImage((prev) => (prev?.blockIndex === index && prev?.imgIndex === i ? null : prev))}
                            onDrop={(e) => {
                              e.preventDefault();
                              try {
                                const { blockIndex: bi, imgIndex: fi } = JSON.parse(e.dataTransfer.getData('text/plain'));
                                setDragOverGalleryImage(null);
                                if (bi !== index || fi === i) return;
                                moveGalleryImageTo(index, fi, i);
                              } catch (_) {}
                            }}
                          >
                            <div className={styles.galleryItem}>
                              <img src={getImageUrl(img)} alt="" />
                            </div>
                            <div className={styles.galleryActions}>
                              <div className={styles.imageDragHandle} title="Перетащите для изменения порядка">
                                <GripVertical size={18} />
                              </div>
                              <div className={styles.moveButtons}>
                                <button
                                  type="button"
                                  onClick={() => moveGalleryImage(index, i, -1)}
                                  disabled={i === 0}
                                  className={styles.moveBtn}
                                  aria-label="Влево"
                                >
                                  <ChevronLeft size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveGalleryImage(index, i, 1)}
                                  disabled={i === saved.length - 1}
                                  className={styles.moveBtn}
                                  aria-label="Вправо"
                                >
                                  <ChevronRight size={16} />
                                </button>
                              </div>
                              <button type="button" onClick={() => removeGalleryImage(index, i)} className={styles.removeBtn} aria-label="Удалить" title="Удалить">
                                <X size={16} />
                              </button>
                            </div>
                          </div>
                          );
                        })}
                        {pending.map((file, i) => {
                          const imgIdx = saved.length + i;
                          const isDragged = draggedGalleryImage?.blockIndex === index && draggedGalleryImage?.imgIndex === imgIdx;
                          const isDragOver = dragOverGalleryImage?.blockIndex === index && dragOverGalleryImage?.imgIndex === imgIdx;
                          return (
                          <div
                            key={`p-${i}`}
                            className={`${styles.galleryItemWrap} ${isDragged ? styles.galleryItemDragging : ''} ${isDragOver ? styles.galleryItemDragOver : ''}`}
                            draggable
                            onDragStart={(e) => {
                              setDraggedGalleryImage({ blockIndex: index, imgIndex: imgIdx });
                              e.dataTransfer.setData('text/plain', JSON.stringify({ blockIndex: index, imgIndex: imgIdx }));
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragEnd={() => {
                              setDraggedGalleryImage(null);
                              setDragOverGalleryImage(null);
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                              setDragOverGalleryImage({ blockIndex: index, imgIndex: imgIdx });
                            }}
                            onDragLeave={() => setDragOverGalleryImage((prev) => (prev?.blockIndex === index && prev?.imgIndex === imgIdx ? null : prev))}
                            onDrop={(e) => {
                              e.preventDefault();
                              try {
                                const { blockIndex: bi, imgIndex: fi } = JSON.parse(e.dataTransfer.getData('text/plain'));
                                setDragOverGalleryImage(null);
                                if (bi !== index || fi === imgIdx) return;
                                moveGalleryImageTo(index, fi, imgIdx);
                              } catch (_) {}
                            }}
                          >
                            <div className={styles.galleryItem}>
                              <PendingImage file={file} />
                            </div>
                            <div className={styles.galleryActions}>
                              <div className={styles.imageDragHandle} title="Перетащите для изменения порядка">
                                <GripVertical size={18} />
                              </div>
                              <div className={styles.moveButtons}>
                                <button
                                  type="button"
                                  onClick={() => moveGalleryImage(index, saved.length + i, -1)}
                                  disabled={i === 0}
                                  className={styles.moveBtn}
                                  aria-label="Влево"
                                >
                                  <ChevronLeft size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveGalleryImage(index, saved.length + i, 1)}
                                  disabled={i === pending.length - 1}
                                  className={styles.moveBtn}
                                  aria-label="Вправо"
                                >
                                  <ChevronRight size={16} />
                                </button>
                              </div>
                              <button type="button" onClick={() => removeGalleryImage(index, saved.length + i)} className={styles.removeBtn} aria-label="Удалить" title="Удалить">
                                <X size={16} />
                              </button>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </>
              )}

              {block.type === 'quote' && (
                <>
                  <label className={styles.blockLabel}>Цитата</label>
                  <RichTextEditor
                    value={block.data?.content ?? ''}
                    onChange={(v) => updateBlock(index, { data: { content: v } })}
                    placeholder="Введите цитату..."
                    minHeight={120}
                  />
                </>
              )}

              {block.type === 'video' && (
                <>
                  <label className={styles.blockLabel}>Видео VK</label>
                  <p className={styles.hint}>
                    Вставьте ссылку из кода встраивания (атрибут <code>src</code> из iframe) или весь код iframe.
                  </p>
                  <input
                    type="text"
                    value={block.data?.url ?? ''}
                    onChange={(e) => handleVideoChange(e.target.value, index)}
                    className={styles.blockInput}
                    placeholder="https://vkvideo.ru/video_ext.php?..."
                  />
                </>
              )}

              {/* Простые блоки */}
              {block.type === 'list' && (
                <>
                  <label className={styles.blockLabel}>Список</label>
                  <div style={{ marginBottom: 12 }}>
                    <label className={styles.visibilityToggle} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                      <input
                        type="checkbox"
                        checked={block.data?.ordered ?? false}
                        onChange={(e) => updateBlock(index, { data: { ...block.data, ordered: e.target.checked } })}
                      />
                      <span className={styles.visibilitySwitch} />
                      <span className={styles.visibilityLabel}>Нумерованный список</span>
                    </label>
                  </div>
                  {(block.data?.items || []).map((item, itemIdx) => (
                    <div
                      key={itemIdx}
                      className={`${styles.listItemRow} ${draggedListItem?.blockIndex === index && draggedListItem?.itemIndex === itemIdx ? styles.listItemDragging : ''} ${dragOverListItem?.blockIndex === index && dragOverListItem?.itemIndex === itemIdx ? styles.listItemDragOver : ''}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        setDragOverListItem({ blockIndex: index, itemIndex: itemIdx });
                      }}
                      onDragLeave={() => {
                        setDragOverListItem((prev) => (
                          prev?.blockIndex === index && prev?.itemIndex === itemIdx ? null : prev
                        ));
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        try {
                          const payload = JSON.parse(e.dataTransfer.getData('text/plain'));
                          if (payload?.kind !== 'list-item' || payload.blockIndex !== index) return;
                          moveListItemTo(index, payload.itemIndex, itemIdx);
                        } catch (_) {
                          // no-op
                        } finally {
                          setDragOverListItem(null);
                          setDraggedListItem(null);
                        }
                      }}
                    >
                      <div className={styles.listItemControls}>
                        <div
                          className={styles.listItemDragHandle}
                          draggable
                          onDragStart={(e) => {
                            setDraggedListItem({ blockIndex: index, itemIndex: itemIdx });
                            e.dataTransfer.setData('text/plain', JSON.stringify({
                              kind: 'list-item',
                              blockIndex: index,
                              itemIndex: itemIdx,
                            }));
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragEnd={() => {
                            setDraggedListItem(null);
                            setDragOverListItem(null);
                          }}
                          title="Перетащите для изменения порядка"
                        >
                          <GripVertical size={16} />
                        </div>
                        <div className={styles.moveButtons}>
                          <button
                            type="button"
                            onClick={() => moveListItem(index, itemIdx, -1)}
                            disabled={itemIdx === 0}
                            className={styles.moveBtn}
                            aria-label="Поднять пункт выше"
                            title="Поднять пункт выше"
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveListItem(index, itemIdx, 1)}
                            disabled={itemIdx === (block.data?.items || []).length - 1}
                            className={styles.moveBtn}
                            aria-label="Опустить пункт ниже"
                            title="Опустить пункт ниже"
                          >
                            <ChevronDown size={14} />
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => {
                          const items = [...(block.data.items || [])];
                          items[itemIdx] = e.target.value;
                          updateBlock(index, { data: { ...block.data, items } });
                        }}
                        className={styles.blockInput}
                        placeholder={`Пункт ${itemIdx + 1}`}
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const items = (block.data.items || []).filter((_, i) => i !== itemIdx);
                          updateBlock(index, { data: { ...block.data, items } });
                        }}
                        className={styles.listItemDeleteBtn}
                        aria-label="Удалить пункт"
                        title="Удалить пункт"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const items = block.data?.items || [];
                      updateBlock(index, { data: { ...block.data, items: [...items, ''] } });
                    }}
                    className={styles.addListItemBtn}
                  >
                    + Добавить пункт
                  </button>
                </>
              )}

              {block.type === 'separator' && (
                <>
                  <label className={styles.blockLabel}>Разделитель</label>
                  <div style={{ padding: '20px 0', borderTop: '2px solid #e2e8f0', borderBottom: '2px solid #e2e8f0' }}>
                    <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>Разделитель контента</div>
                  </div>
                </>
              )}

              {block.type === 'button' && (
                <>
                  <label className={styles.blockLabel}>Кнопка/CTA</label>
                  <input
                    type="text"
                    value={block.data?.text ?? ''}
                    onChange={(e) => updateBlock(index, { data: { ...block.data, text: e.target.value } })}
                    className={styles.blockInput}
                    placeholder="Текст кнопки"
                    style={{ marginBottom: 12 }}
                  />
                  <input
                    type="text"
                    value={block.data?.url ?? ''}
                    onChange={(e) => updateBlock(index, { data: { ...block.data, url: e.target.value } })}
                    className={styles.blockInput}
                    placeholder="URL ссылки"
                    style={{ marginBottom: 12 }}
                  />
                  <select
                    value={block.data?.style ?? 'primary'}
                    onChange={(e) => updateBlock(index, { data: { ...block.data, style: e.target.value } })}
                    className={styles.blockInput}
                  >
                    <option value="primary">Основной</option>
                    <option value="secondary">Вторичный</option>
                    <option value="outline">Контур</option>
                  </select>
                </>
              )}

              {block.type === 'code' && (
                <>
                  <label className={styles.blockLabel}>Код/Code block</label>
                  <select
                    value={block.data?.language ?? 'javascript'}
                    onChange={(e) => updateBlock(index, { data: { ...block.data, language: e.target.value } })}
                    className={styles.blockInput}
                    style={{ marginBottom: 12 }}
                  >
                    <option value="javascript">JavaScript</option>
                    <option value="typescript">TypeScript</option>
                    <option value="html">HTML</option>
                    <option value="css">CSS</option>
                    <option value="json">JSON</option>
                    <option value="python">Python</option>
                    <option value="bash">Bash</option>
                    <option value="text">Текст</option>
                  </select>
                  <textarea
                    value={block.data?.code ?? ''}
                    onChange={(e) => updateBlock(index, { data: { ...block.data, code: e.target.value } })}
                    className={styles.blockInput}
                    placeholder="Введите код..."
                    rows={10}
                    style={{ fontFamily: 'monospace', resize: 'vertical' }}
                  />
                </>
              )}

              {block.type === 'audio' && (
                <>
                  <label className={styles.blockLabel}>Аудио</label>
                  <input
                    type="text"
                    value={block.data?.url ?? ''}
                    onChange={(e) => updateBlock(index, { data: { url: e.target.value } })}
                    className={styles.blockInput}
                    placeholder="URL аудио файла или ссылка на сервис"
                  />
                  <p className={styles.hint} style={{ marginTop: 8 }}>
                    Вставьте прямую ссылку на аудио файл (MP3, OGG, WAV) или ссылку на сервис (SoundCloud, Яндекс.Музыка и т.д.)
                  </p>
                </>
              )}

              {block.type === 'file' && (
                <>
                  <label className={styles.blockLabel}>Файл</label>
                  <input
                    type="file"
                    onChange={(e) => handleFileBlockSelect(e, index)}
                    style={{ display: 'none' }}
                    id={`block-file-${block.id}`}
                  />
                  {(block.data?.url || getBlockFilePending(block)) ? (
                    <div className={styles.imagePreview}>
                      <div className={styles.filePreviewName}>
                        {getBlockFilePending(block)
                          ? getBlockFilePending(block).name
                          : (block.data?.title || block.data?.url || 'Файл')}
                      </div>
                      <div className={styles.imageActions}>
                        <label htmlFor={`block-file-${block.id}`} className={styles.replaceBtn}>
                          Заменить
                        </label>
                        <button type="button" onClick={() => clearBlockFile(index)} className={styles.removeBtn}>
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label htmlFor={`block-file-${block.id}`} className={styles.uploadArea}>
                      Загрузить файл
                    </label>
                  )}
                  {block.data?.url && !getBlockFilePending(block) && (
                    <input
                      type="text"
                      value={block.data?.title ?? ''}
                      onChange={(e) => updateBlock(index, { data: { ...block.data, title: e.target.value } })}
                      className={styles.blockInput}
                      placeholder="Название файла (подпись к ссылке)"
                      style={{ marginTop: 8 }}
                    />
                  )}
                </>
              )}

              {block.type === 'json' && (
                <>
                  <label className={styles.blockLabel}>JSON</label>
                  <textarea
                    value={block.data?.value ?? '{}'}
                    onChange={(e) => updateBlock(index, { data: { value: e.target.value } })}
                    className={styles.blockInput}
                    rows={8}
                    style={{ fontFamily: 'monospace', resize: 'vertical' }}
                    placeholder='{"key":"value"}'
                  />
                </>
              )}

              {block.type === 'relatedEntities' && (
                <>
                  <label className={styles.blockLabel}>Связанные сущности</label>
                  <select
                    value={block.data?.resourceSlug || ''}
                    onChange={(e) => {
                      const resourceSlug = e.target.value;
                      const option = resourceOptions.find((item) => item.slug === resourceSlug);
                      const currentSelectedIds = Array.isArray(block.data?.selectedIds) ? block.data.selectedIds : [];
                      const currentSelectedItems = Array.isArray(block.data?.selectedItems) ? block.data.selectedItems : [];

                      let restoredSelectedIds = [];
                      let restoredSelectedItems = [];

                      if (preserveRelatedSelections && block.id) {
                        const nextCache = {
                          ...(relatedSelectionCacheByBlockId[block.id] || {}),
                          ...(block.data?.resourceSlug
                            ? {
                              [block.data.resourceSlug]: {
                                selectedIds: currentSelectedIds,
                                selectedItems: currentSelectedItems,
                              },
                            }
                            : {}),
                        };
                        setRelatedSelectionCacheByBlockId((prev) => ({
                          ...prev,
                          [block.id]: nextCache,
                        }));

                        const restored = nextCache[resourceSlug];
                        restoredSelectedIds = Array.isArray(restored?.selectedIds) ? restored.selectedIds : [];
                        restoredSelectedItems = Array.isArray(restored?.selectedItems) ? restored.selectedItems : [];
                      }

                      updateBlock(index, {
                        data: {
                          ...block.data,
                          resourceSlug,
                          resourceLabel: option?.label || '',
                          selectedIds: preserveRelatedSelections ? restoredSelectedIds : [],
                          selectedItems: preserveRelatedSelections ? restoredSelectedItems : [],
                        },
                      });
                      ensureResourceRecordsLoaded(resourceSlug);
                    }}
                    className={styles.blockInput}
                    style={{ marginBottom: 12 }}
                  >
                    <option value="">Выберите раздел</option>
                    {resourceOptions.map((option) => (
                      <option key={option.slug} value={option.slug}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  {!!block.data?.resourceSlug && (
                    <>
                      <div className={styles.entitiesHeader}>
                        <span className={styles.hint} style={{ marginBottom: 0 }}>
                          Добавляйте записи в выбранные и настраивайте их порядок
                        </span>
                        <button
                          type="button"
                          className={styles.addListItemBtn}
                          onClick={() => ensureResourceRecordsLoaded(block.data.resourceSlug, { force: true })}
                        >
                          Обновить список
                        </button>
                      </div>

                      <input
                        type="text"
                        value={relatedSearchByBlockId[block.id] || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          setRelatedSearchByBlockId((prev) => ({ ...prev, [block.id]: value }));
                        }}
                        className={styles.blockInput}
                        placeholder="Поиск по записям..."
                        style={{ marginBottom: 10 }}
                      />

                      {recordsLoadingBySlug[block.data.resourceSlug] ? (
                        <div className={styles.hint}>Загрузка записей...</div>
                      ) : (
                        (() => {
                          const allRecords = recordsBySlug[block.data.resourceSlug] || [];
                          const query = String(relatedSearchByBlockId[block.id] || '').trim().toLowerCase();
                          const filteredRecords = excludedRecordId
                            ? allRecords.filter((record) => String(record.id) !== String(excludedRecordId))
                            : allRecords;
                          const selectedItems = Array.isArray(block.data?.selectedItems)
                            ? block.data.selectedItems
                            : (Array.isArray(block.data?.selectedIds)
                              ? block.data.selectedIds
                              .filter((id) => !excludedRecordId || String(id) !== String(excludedRecordId))
                              .map((id) => {
                                const found = filteredRecords.find((record) => record.id === id);
                                return found ? { id: found.id, label: found.label, image: found.image || '' } : { id, label: `Запись ${id}`, image: '' };
                              })
                              : []);
                          const selectedItemsResolved = selectedItems.map((item) => {
                            const found = filteredRecords.find((record) => record.id === item.id);
                            if (!found) return item;
                            return {
                              ...item,
                              label: found.label || item.label || `Запись ${item.id}`,
                              image: found.image || item.image || '',
                            };
                          });
                          const normalizedSelectedItems = excludedRecordId
                            ? selectedItemsResolved.filter((item) => String(item.id) !== String(excludedRecordId))
                            : selectedItemsResolved;
                          const selectedIdsSet = new Set(normalizedSelectedItems.map((item) => item.id));
                          const availableRecords = filteredRecords
                            .filter((record) => !selectedIdsSet.has(record.id))
                            .filter((record) => !query || String(record.label || '').toLowerCase().includes(query));

                          return (
                            <>
                              <div className={styles.entitiesSectionTitle}>Выбранные записи</div>
                              <div className={`${styles.entitiesList} ${styles.entitiesListSelected}`}>
                                {normalizedSelectedItems.length === 0 ? (
                                  <div className={styles.hint}>Пока ничего не выбрано</div>
                                ) : (
                                  normalizedSelectedItems.map((item) => {
                                    const itemIdx = normalizedSelectedItems.findIndex((selected) => selected.id === item.id);
                                    return (
                                    <div
                                      key={item.id}
                                      className={`${styles.listItemRow} ${styles.listItemRowNoMargin} ${draggedRelatedEntity?.blockIndex === index && draggedRelatedEntity?.itemIndex === itemIdx ? styles.listItemDragging : ''} ${dragOverRelatedEntity?.blockIndex === index && dragOverRelatedEntity?.itemIndex === itemIdx ? styles.listItemDragOver : ''}`}
                                      onDragOver={(e) => {
                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = 'move';
                                        setDragOverRelatedEntity({ blockIndex: index, itemIndex: itemIdx });
                                      }}
                                      onDragLeave={() => {
                                        setDragOverRelatedEntity((prev) => (
                                          prev?.blockIndex === index && prev?.itemIndex === itemIdx ? null : prev
                                        ));
                                      }}
                                      onDrop={(e) => {
                                        e.preventDefault();
                                        try {
                                          const payload = JSON.parse(e.dataTransfer.getData('text/plain'));
                                          if (payload?.kind !== 'related-entity' || payload.blockIndex !== index) return;
                                          moveRelatedEntityTo(index, payload.itemIndex, itemIdx);
                                        } catch (_) {
                                          // no-op
                                        } finally {
                                          setDragOverRelatedEntity(null);
                                          setDraggedRelatedEntity(null);
                                        }
                                      }}
                                    >
                                      <div className={styles.listItemControls}>
                                        <div
                                          className={styles.listItemDragHandle}
                                          draggable
                                          onDragStart={(e) => {
                                            setDraggedRelatedEntity({ blockIndex: index, itemIndex: itemIdx });
                                            e.dataTransfer.setData('text/plain', JSON.stringify({
                                              kind: 'related-entity',
                                              blockIndex: index,
                                              itemIndex: itemIdx,
                                            }));
                                            e.dataTransfer.effectAllowed = 'move';
                                          }}
                                          onDragEnd={() => {
                                            setDraggedRelatedEntity(null);
                                            setDragOverRelatedEntity(null);
                                          }}
                                          title="Перетащите для изменения порядка"
                                        >
                                          <GripVertical size={16} />
                                        </div>
                                        <div className={styles.moveButtons}>
                                          <button
                                            type="button"
                                            onClick={() => moveRelatedEntity(index, itemIdx, -1)}
                                            disabled={itemIdx === 0}
                                            className={styles.moveBtn}
                                            aria-label="Поднять выше"
                                            title="Поднять выше"
                                          >
                                            <ChevronUp size={14} />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => moveRelatedEntity(index, itemIdx, 1)}
                                            disabled={itemIdx === normalizedSelectedItems.length - 1}
                                            className={styles.moveBtn}
                                            aria-label="Опустить ниже"
                                            title="Опустить ниже"
                                          >
                                            <ChevronDown size={14} />
                                          </button>
                                        </div>
                                      </div>

                                      <div className={styles.entitySelectedContent}>
                                        {item.image ? (
                                          <img
                                            src={getImageUrl(item.image)}
                                            alt=""
                                            className={styles.entityImage}
                                            loading="lazy"
                                          />
                                        ) : (
                                          <div className={styles.entityImagePlaceholder}>
                                            <FileText size={16} />
                                          </div>
                                        )}
                                        <div className={styles.entityMeta}>
                                          <div className={styles.entityTitle}>{item.label || `Запись ${item.id}`}</div>
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => removeRelatedEntity(index, item.id)}
                                        className={styles.listItemDeleteBtn}
                                        aria-label="Удалить из выбранных"
                                        title="Удалить из выбранных"
                                      >
                                        ×
                                      </button>
                                    </div>
                                    );
                                  })
                                )}
                              </div>

                              <div className={styles.entitiesSectionTitle} style={{ marginTop: 12 }}>Доступные записи</div>
                              <div className={`${styles.entitiesList} ${styles.entitiesListAvailable}`}>
                                {availableRecords.length === 0 ? (
                                  <div className={styles.hint}>Нет доступных записей</div>
                                ) : (
                                  availableRecords.map((record) => (
                                    <div key={record.id} className={styles.entityCard}>
                                      {record.image ? (
                                        <img
                                          src={getImageUrl(record.image)}
                                          alt=""
                                          className={styles.entityImage}
                                          loading="lazy"
                                        />
                                      ) : (
                                        <div className={styles.entityImagePlaceholder}>
                                          <FileText size={16} />
                                        </div>
                                      )}
                                      <div className={styles.entityMeta}>
                                        <div className={styles.entityTitle}>{record.label}</div>
                                      </div>
                                      <button
                                        type="button"
                                        className={styles.entityAddBtn}
                                        onClick={() => addRelatedEntity(index, record)}
                                        aria-label="Добавить запись"
                                        title="Добавить запись"
                                      >
                                        +
                                      </button>
                                    </div>
                                  ))
                                )}
                              </div>
                            </>
                          );
                        })()
                      )}
                    </>
                  )}
                </>
              )}

              {/* Блоки с коллекциями */}
              {block.type === 'table' && (() => {
                const headers = block.data?.headers || [];
                const rows = block.data?.rows || [];
                const colCount = Math.max(1, headers.length);
                const safeHeaders = headers.length >= colCount ? headers : [...headers, ...Array(colCount - headers.length).fill('')];
                const normalizeRow = (row) => {
                  const r = [...(row || [])];
                  while (r.length < colCount) r.push('');
                  return r.slice(0, colCount);
                };
                const safeRows = (rows || []).map(normalizeRow);
                const addColumn = (atIndex) => {
                  const nextHeaders = [...safeHeaders.slice(0, atIndex), '', ...safeHeaders.slice(atIndex)];
                  const nextRows = safeRows.map(row => [...row.slice(0, atIndex), '', ...row.slice(atIndex)]);
                  updateBlock(index, { data: { ...block.data, headers: nextHeaders, rows: nextRows } });
                };
                const addRow = (atIndex) => {
                  const newRow = Array(colCount).fill('');
                  const nextRows = [...safeRows.slice(0, atIndex), newRow, ...safeRows.slice(atIndex)];
                  updateBlock(index, { data: { ...block.data, headers: safeHeaders, rows: nextRows } });
                };
                const removeColumn = (hIdx) => {
                  if (colCount <= 1) return;
                  const nextHeaders = safeHeaders.filter((_, i) => i !== hIdx);
                  const nextRows = safeRows.map(row => row.filter((_, i) => i !== hIdx));
                  updateBlock(index, { data: { ...block.data, headers: nextHeaders, rows: nextRows } });
                };
                const removeRow = (rIdx) => {
                  if (safeRows.length < 1) return;
                  const nextRows = safeRows.filter((_, i) => i !== rIdx);
                  updateBlock(index, { data: { ...block.data, rows: nextRows } });
                };
                return (
                  <>
                    <label className={styles.blockLabel}>Таблица</label>
                    <div className={styles.tableWrap}>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr>
                            {safeHeaders.flatMap((header, hIdx) => [
                              <th
                                key={`ins-${hIdx}`}
                                className={styles.tableInsertCol}
                                onClick={() => addColumn(hIdx)}
                                title="Добавить столбец слева"
                              >
                                <span className={styles.tableInsertColInner}><Plus size={14} /></span>
                              </th>,
                              <th
                                key={`h-${hIdx}`}
                                className={`${styles.tableTh} ${dragOverTableColumn.blockIndex === index && dragOverTableColumn.colIndex === hIdx ? styles.tableThDragOver : ''}`}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  e.dataTransfer.dropEffect = 'move';
                                  if (draggedTableColumn.blockIndex === index && draggedTableColumn.colIndex !== hIdx) {
                                    setDragOverTableColumn({ blockIndex: index, colIndex: hIdx });
                                  }
                                }}
                                onDragLeave={() => setDragOverTableColumn(prev => (prev.blockIndex === index && prev.colIndex === hIdx ? { blockIndex: null, colIndex: null } : prev))}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  try {
                                    const payload = JSON.parse(e.dataTransfer.getData('text/plain'));
                                    if (payload?.kind !== 'table-col' || payload.blockIndex !== index) return;
                                    setDragOverTableColumn({ blockIndex: null, colIndex: null });
                                    moveTableColumn(index, payload.colIndex, hIdx);
                                  } catch (_) {}
                                }}
                              >
                                <span className={styles.tableThInner}>
                                  {colCount > 1 && (
                                    <span
                                      className={styles.tableThGrip}
                                      draggable
                                      onDragStart={(e) => {
                                        e.stopPropagation();
                                        setDraggedTableColumn({ blockIndex: index, colIndex: hIdx });
                                        e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'table-col', blockIndex: index, colIndex: hIdx }));
                                        e.dataTransfer.effectAllowed = 'move';
                                      }}
                                      onDragEnd={() => setDraggedTableColumn({ blockIndex: null, colIndex: null })}
                                      title="Перетащите для изменения порядка столбца"
                                    >
                                      <GripVertical size={16} />
                                    </span>
                                  )}
                                  <AutoHeightTableTextarea
                                    value={header}
                                    onChange={(e) => {
                                      const next = [...safeHeaders];
                                      next[hIdx] = e.target.value;
                                      updateBlock(index, { data: { ...block.data, headers: next } });
                                    }}
                                    className={styles.tableCellTextarea}
                                    placeholder="Заголовок"
                                    rows={2}
                                  />
                                  {colCount > 1 && (
                                    <button
                                      type="button"
                                      className={styles.tableRemoveCol}
                                      onClick={(e) => { e.stopPropagation(); removeColumn(hIdx); }}
                                      title="Удалить столбец"
                                    >
                                      <X size={14} />
                                    </button>
                                  )}
                                </span>
                              </th>,
                            ])}
                            <th
                              key="ins-end"
                              className={styles.tableInsertCol}
                              onClick={() => addColumn(colCount)}
                              title="Добавить столбец справа"
                            >
                              <span className={styles.tableInsertColInner}><Plus size={14} /></span>
                            </th>
                            {safeRows.length >= 1 && <th key="row-actions-head" className={styles.tableRowActions} />}
                          </tr>
                        </thead>
                        <tbody>
                          {safeRows.length > 0 && (
                            <tr
                              key="ins-before"
                              className={`${styles.tableInsertRowBetween} ${insertRowPlusPos.blockIndex === index && insertRowPlusPos.rowKey === 'ins-before' ? styles.tableInsertRowBetweenActive : ''}`}
                              onClick={() => addRow(0)}
                              title="Добавить строку сверху"
                            >
                              <td
                                colSpan={2 * colCount + 1 + (safeRows.length >= 1 ? 1 : 0)}
                                className={styles.tableInsertRowBetweenTd}
                                onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setInsertRowPlusPos({ blockIndex: index, rowKey: 'ins-before', x: e.clientX - rect.left, y: e.clientY - rect.top });
                                }}
                                onMouseMove={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setInsertRowPlusPos(prev => (prev.blockIndex === index && prev.rowKey === 'ins-before' ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top } : prev));
                                }}
                                onMouseLeave={() => setInsertRowPlusPos(prev => (prev.blockIndex === index && prev.rowKey === 'ins-before' ? { blockIndex: null, rowKey: null, x: 0, y: 0 } : prev))}
                              >
                                <span
                                  className={styles.tableInsertRowBetweenInner}
                                  style={insertRowPlusPos.blockIndex === index && insertRowPlusPos.rowKey === 'ins-before' ? { left: insertRowPlusPos.x, top: insertRowPlusPos.y } : undefined}
                                >
                                  <Plus size={14} />
                                </span>
                              </td>
                            </tr>
                          )}
                          {safeRows.length === 0 ? null : (
                            safeRows.flatMap((row, rIdx) => [
                              <tr
                                key={rIdx}
                                className={`${styles.tableDataRow} ${dragOverTableRow.blockIndex === index && dragOverTableRow.rowIndex === rIdx ? styles.tableDataRowDragOver : ''}`}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  e.dataTransfer.dropEffect = 'move';
                                  if (draggedTableRow.blockIndex === index && draggedTableRow.rowIndex !== rIdx) {
                                    setDragOverTableRow({ blockIndex: index, rowIndex: rIdx });
                                  }
                                }}
                                onDragLeave={() => setDragOverTableRow(prev => (prev.blockIndex === index && prev.rowIndex === rIdx ? { blockIndex: null, rowIndex: null } : prev))}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  try {
                                    const payload = JSON.parse(e.dataTransfer.getData('text/plain'));
                                    if (payload?.kind !== 'table-row' || payload.blockIndex !== index) return;
                                    setDragOverTableRow({ blockIndex: null, rowIndex: null });
                                    moveTableRow(index, payload.rowIndex, rIdx);
                                  } catch (_) {}
                                }}
                              >
                                {row.flatMap((cell, cIdx) => [
                                  <td
                                    key={`ic-${cIdx}`}
                                    className={styles.tableInsertCol}
                                    onClick={() => addColumn(cIdx)}
                                    title="Добавить столбец"
                                  >
                                    <span className={styles.tableInsertColInner}><Plus size={14} /></span>
                                  </td>,
                                  <td key={cIdx} className={styles.tableTd}>
                                    <AutoHeightTableTextarea
                                      value={cell}
                                      onChange={(e) => {
                                        const nextRows = safeRows.map((r, i) => (i === rIdx ? [...r] : r));
                                        nextRows[rIdx][cIdx] = e.target.value;
                                        updateBlock(index, { data: { ...block.data, rows: nextRows } });
                                      }}
                                      className={styles.tableCellTextarea}
                                      rows={2}
                                    />
                                  </td>,
                                ])}
                                <td
                                  key="ic-end"
                                  className={styles.tableInsertCol}
                                  onClick={() => addColumn(colCount)}
                                  title="Добавить столбец справа"
                                >
                                  <span className={styles.tableInsertColInner}><Plus size={14} /></span>
                                </td>
                                {safeRows.length >= 1 && (
                                  <td className={styles.tableRowActions}>
                                    {safeRows.length > 1 && (
                                      <span
                                        className={styles.tableRowGrip}
                                        draggable
                                        onDragStart={(e) => {
                                          e.stopPropagation();
                                          setDraggedTableRow({ blockIndex: index, rowIndex: rIdx });
                                          e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'table-row', blockIndex: index, rowIndex: rIdx }));
                                          e.dataTransfer.effectAllowed = 'move';
                                        }}
                                        onDragEnd={() => setDraggedTableRow({ blockIndex: null, rowIndex: null })}
                                        title="Перетащите для изменения порядка строки"
                                      >
                                        <GripVertical size={16} />
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      className={styles.tableRemoveRow}
                                      onClick={(e) => { e.stopPropagation(); removeRow(rIdx); }}
                                      title="Удалить строку"
                                    >
                                      <X size={14} />
                                    </button>
                                  </td>
                                )}
                              </tr>,
                              ...(rIdx < safeRows.length - 1 ? [
                                <tr
                                  key={`ins-${rIdx}`}
                                  className={`${styles.tableInsertRowBetween} ${insertRowPlusPos.blockIndex === index && insertRowPlusPos.rowKey === `ins-${rIdx}` ? styles.tableInsertRowBetweenActive : ''}`}
                                  onClick={() => addRow(rIdx + 1)}
                                  title="Добавить строку здесь"
                                >
                                  <td
                                    colSpan={2 * colCount + 1 + (safeRows.length >= 1 ? 1 : 0)}
                                    className={styles.tableInsertRowBetweenTd}
                                    onMouseEnter={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setInsertRowPlusPos({ blockIndex: index, rowKey: `ins-${rIdx}`, x: e.clientX - rect.left, y: e.clientY - rect.top });
                                    }}
                                    onMouseMove={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setInsertRowPlusPos(prev => (prev.blockIndex === index && prev.rowKey === `ins-${rIdx}` ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top } : prev));
                                    }}
                                    onMouseLeave={() => setInsertRowPlusPos(prev => (prev.blockIndex === index && prev.rowKey === `ins-${rIdx}` ? { blockIndex: null, rowKey: null, x: 0, y: 0 } : prev))}
                                  >
                                    <span
                                      className={styles.tableInsertRowBetweenInner}
                                      style={insertRowPlusPos.blockIndex === index && insertRowPlusPos.rowKey === `ins-${rIdx}` ? { left: insertRowPlusPos.x, top: insertRowPlusPos.y } : undefined}
                                    >
                                      <Plus size={14} />
                                    </span>
                                  </td>
                                </tr>,
                              ] : []),
                            ])
                          )}
                          <tr
                            key="add-row-bottom"
                            className={styles.tableInsertRow}
                            onClick={() => addRow(safeRows.length)}
                            title="Добавить строку"
                          >
                            <td colSpan={2 * colCount + 1 + (safeRows.length >= 1 ? 1 : 0)} className={styles.tableInsertRowTd}>
                              <span className={styles.tableInsertRowInner}><Plus size={16} /> Добавить строку</span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}

              {block.type === 'accordion' && (
                <>
                  <label className={styles.blockLabel}>Аккордеон/FAQ</label>
                  {(block.data?.items || []).map((item, itemIdx) => (
                    <div
                      key={itemIdx}
                      className={`${styles.listItemRow} ${draggedAccordionItem?.blockIndex === index && draggedAccordionItem?.itemIndex === itemIdx ? styles.listItemDragging : ''} ${dragOverAccordionItem?.blockIndex === index && dragOverAccordionItem?.itemIndex === itemIdx ? styles.listItemDragOver : ''}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        setDragOverAccordionItem({ blockIndex: index, itemIndex: itemIdx });
                      }}
                      onDragLeave={() => {
                        setDragOverAccordionItem((prev) => (
                          prev?.blockIndex === index && prev?.itemIndex === itemIdx ? null : prev
                        ));
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        try {
                          const payload = JSON.parse(e.dataTransfer.getData('text/plain'));
                          if (payload?.kind !== 'accordion-item' || payload.blockIndex !== index) return;
                          moveAccordionItemTo(index, payload.itemIndex, itemIdx);
                        } catch (_) {
                          // no-op
                        } finally {
                          setDragOverAccordionItem(null);
                          setDraggedAccordionItem(null);
                        }
                      }}
                    >
                      <div className={styles.listItemControls}>
                        <div
                          className={styles.listItemDragHandle}
                          draggable
                          onDragStart={(e) => {
                            setDraggedAccordionItem({ blockIndex: index, itemIndex: itemIdx });
                            e.dataTransfer.setData('text/plain', JSON.stringify({
                              kind: 'accordion-item',
                              blockIndex: index,
                              itemIndex: itemIdx,
                            }));
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragEnd={() => {
                            setDraggedAccordionItem(null);
                            setDragOverAccordionItem(null);
                          }}
                          title="Перетащите для изменения порядка"
                        >
                          <GripVertical size={16} />
                        </div>
                        <div className={styles.moveButtons}>
                          <button
                            type="button"
                            onClick={() => moveAccordionItem(index, itemIdx, -1)}
                            disabled={itemIdx === 0}
                            className={styles.moveBtn}
                            aria-label="Поднять элемент выше"
                            title="Поднять элемент выше"
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveAccordionItem(index, itemIdx, 1)}
                            disabled={itemIdx === (block.data?.items || []).length - 1}
                            className={styles.moveBtn}
                            aria-label="Опустить элемент ниже"
                            title="Опустить элемент ниже"
                          >
                            <ChevronDown size={14} />
                          </button>
                        </div>
                      </div>

                      <div className={styles.accordionItemContent}>
                        <input
                          type="text"
                          value={item.title || ''}
                          onChange={(e) => {
                            const items = [...(block.data.items || [])];
                            items[itemIdx] = { ...items[itemIdx], title: e.target.value };
                            updateBlock(index, { data: { ...block.data, items } });
                          }}
                          className={styles.blockInput}
                          placeholder="Заголовок"
                          style={{ marginBottom: 8 }}
                        />
                        <RichTextEditor
                          value={item.content || ''}
                          onChange={(v) => {
                            const items = [...(block.data.items || [])];
                            items[itemIdx] = { ...items[itemIdx], content: v };
                            updateBlock(index, { data: { ...block.data, items } });
                          }}
                          placeholder="Содержимое..."
                          minHeight={100}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const items = (block.data.items || []).filter((_, i) => i !== itemIdx);
                          updateBlock(index, { data: { ...block.data, items } });
                        }}
                        className={styles.listItemDeleteBtn}
                        aria-label="Удалить элемент"
                        title="Удалить элемент"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const items = block.data?.items || [];
                      updateBlock(index, { data: { ...block.data, items: [...items, { title: '', content: '' }] } });
                    }}
                    className={styles.addListItemBtn}
                  >
                    + Добавить элемент
                  </button>
                </>
              )}

              {block.type === 'tabs' && (
                <>
                  <label className={styles.blockLabel}>Табы</label>
                  {(block.data?.tabs || []).map((tab, tabIdx) => (
                    <div
                      key={tabIdx}
                      className={`${styles.listItemRow} ${draggedTabsItem?.blockIndex === index && draggedTabsItem?.itemIndex === tabIdx ? styles.listItemDragging : ''} ${dragOverTabsItem?.blockIndex === index && dragOverTabsItem?.itemIndex === tabIdx ? styles.listItemDragOver : ''}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        setDragOverTabsItem({ blockIndex: index, itemIndex: tabIdx });
                      }}
                      onDragLeave={() => {
                        setDragOverTabsItem((prev) => (prev?.blockIndex === index && prev?.itemIndex === tabIdx ? null : prev));
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        try {
                          const payload = JSON.parse(e.dataTransfer.getData('text/plain'));
                          if (payload?.kind !== 'tabs-item' || payload.blockIndex !== index) return;
                          moveTabsItemTo(index, payload.itemIndex, tabIdx);
                        } catch (_) {}
                        finally {
                          setDragOverTabsItem(null);
                          setDraggedTabsItem(null);
                        }
                      }}
                    >
                      <div className={styles.listItemControls}>
                        <div
                          className={styles.listItemDragHandle}
                          draggable
                          onDragStart={(e) => {
                            setDraggedTabsItem({ blockIndex: index, itemIndex: tabIdx });
                            e.dataTransfer.setData('text/plain', JSON.stringify({
                              kind: 'tabs-item',
                              blockIndex: index,
                              itemIndex: tabIdx,
                            }));
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragEnd={() => {
                            setDraggedTabsItem(null);
                            setDragOverTabsItem(null);
                          }}
                          title="Перетащите для изменения порядка"
                        >
                          <GripVertical size={16} />
                        </div>
                        <div className={styles.moveButtons}>
                          <button
                            type="button"
                            onClick={() => moveTabsItem(index, tabIdx, -1)}
                            disabled={tabIdx === 0}
                            className={styles.moveBtn}
                            aria-label="Поднять вкладку выше"
                            title="Поднять вкладку выше"
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveTabsItem(index, tabIdx, 1)}
                            disabled={tabIdx === (block.data?.tabs || []).length - 1}
                            className={styles.moveBtn}
                            aria-label="Опустить вкладку ниже"
                            title="Опустить вкладку ниже"
                          >
                            <ChevronDown size={14} />
                          </button>
                        </div>
                      </div>

                      <div className={styles.accordionItemContent}>
                        <input
                          type="text"
                          value={tab.label || ''}
                          onChange={(e) => {
                            const tabs = [...(block.data.tabs || [])];
                            tabs[tabIdx] = { ...tabs[tabIdx], label: e.target.value };
                            updateBlock(index, { data: { ...block.data, tabs } });
                          }}
                          className={styles.blockInput}
                          placeholder="Название вкладки"
                          style={{ marginBottom: 8 }}
                        />
                        <RichTextEditor
                          value={tab.content || ''}
                          onChange={(v) => {
                            const tabs = [...(block.data.tabs || [])];
                            tabs[tabIdx] = { ...tabs[tabIdx], content: v };
                            updateBlock(index, { data: { ...block.data, tabs } });
                          }}
                          placeholder="Содержимое вкладки..."
                          minHeight={100}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const tabs = (block.data.tabs || []).filter((_, i) => i !== tabIdx);
                          updateBlock(index, { data: { ...block.data, tabs } });
                        }}
                        className={styles.listItemDeleteBtn}
                        aria-label="Удалить вкладку"
                        title="Удалить вкладку"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const tabs = block.data?.tabs || [];
                      updateBlock(index, { data: { ...block.data, tabs: [...tabs, { label: '', content: '' }] } });
                    }}
                    className={styles.addListItemBtn}
                  >
                    + Добавить вкладку
                  </button>
                </>
              )}

              {block.type === 'cards' && (
                <>
                  <label className={styles.blockLabel}>Карточки/Grid</label>
                  <button
                    type="button"
                    onClick={() => {
                      const cards = block.data?.cards || [];
                      updateBlock(index, { data: { ...block.data, cards: [...cards, { title: '', description: '', image: '', url: '' }] } });
                    }}
                    className={styles.blockInput}
                    style={{ marginBottom: 12, cursor: 'pointer', background: '#f1f5f9' }}
                  >
                    + Добавить карточку
                  </button>
                  {(block.data?.cards || []).map((card, cardIdx) => (
                    <div key={cardIdx} style={{ marginBottom: 12, padding: 12, border: '1px solid #e2e8f0', borderRadius: 8 }}>
                      <input
                        type="text"
                        value={card.title || ''}
                        onChange={(e) => {
                          const cards = [...(block.data.cards || [])];
                          cards[cardIdx] = { ...cards[cardIdx], title: e.target.value };
                          updateBlock(index, { data: { ...block.data, cards } });
                        }}
                        className={styles.blockInput}
                        placeholder="Заголовок карточки"
                        style={{ marginBottom: 8 }}
                      />
                      <RichTextEditor
                        value={card.description || ''}
                        onChange={(v) => {
                          const cards = [...(block.data.cards || [])];
                          cards[cardIdx] = { ...cards[cardIdx], description: v };
                          updateBlock(index, { data: { ...block.data, cards } });
                        }}
                        placeholder="Описание..."
                        minHeight={80}
                      />
                      <input
                        type="text"
                        value={card.image || ''}
                        onChange={(e) => {
                          const cards = [...(block.data.cards || [])];
                          cards[cardIdx] = { ...cards[cardIdx], image: e.target.value };
                          updateBlock(index, { data: { ...block.data, cards } });
                        }}
                        className={styles.blockInput}
                        placeholder="URL изображения"
                        style={{ marginBottom: 8, marginTop: 8 }}
                      />
                      <input
                        type="text"
                        value={card.url || ''}
                        onChange={(e) => {
                          const cards = [...(block.data.cards || [])];
                          cards[cardIdx] = { ...cards[cardIdx], url: e.target.value };
                          updateBlock(index, { data: { ...block.data, cards } });
                        }}
                        className={styles.blockInput}
                        placeholder="URL ссылки"
                        style={{ marginBottom: 8 }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const cards = (block.data.cards || []).filter((_, i) => i !== cardIdx);
                          updateBlock(index, { data: { ...block.data, cards } });
                        }}
                        style={{ padding: '4px 8px', fontSize: '0.85rem', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                      >
                        Удалить карточку
                      </button>
                    </div>
                  ))}
                </>
              )}

              {block.type === 'team' && (
                <>
                  <label className={styles.blockLabel}>Команда/Персонал</label>
                  <button
                    type="button"
                    onClick={() => {
                      const members = block.data?.members || [];
                      updateBlock(index, { data: { ...block.data, members: [...members, { name: '', position: '', photo: '', social: {} }] } });
                    }}
                    className={styles.blockInput}
                    style={{ marginBottom: 12, cursor: 'pointer', background: '#f1f5f9' }}
                  >
                    + Добавить сотрудника
                  </button>
                  {(block.data?.members || []).map((member, memberIdx) => (
                    <div key={memberIdx} style={{ marginBottom: 12, padding: 12, border: '1px solid #e2e8f0', borderRadius: 8 }}>
                      <input
                        type="text"
                        value={member.name || ''}
                        onChange={(e) => {
                          const members = [...(block.data.members || [])];
                          members[memberIdx] = { ...members[memberIdx], name: e.target.value };
                          updateBlock(index, { data: { ...block.data, members } });
                        }}
                        className={styles.blockInput}
                        placeholder="Имя"
                        style={{ marginBottom: 8 }}
                      />
                      <input
                        type="text"
                        value={member.position || ''}
                        onChange={(e) => {
                          const members = [...(block.data.members || [])];
                          members[memberIdx] = { ...members[memberIdx], position: e.target.value };
                          updateBlock(index, { data: { ...block.data, members } });
                        }}
                        className={styles.blockInput}
                        placeholder="Должность"
                        style={{ marginBottom: 8 }}
                      />
                      <input
                        type="text"
                        value={member.photo || ''}
                        onChange={(e) => {
                          const members = [...(block.data.members || [])];
                          members[memberIdx] = { ...members[memberIdx], photo: e.target.value };
                          updateBlock(index, { data: { ...block.data, members } });
                        }}
                        className={styles.blockInput}
                        placeholder="URL фото"
                        style={{ marginBottom: 8 }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const members = (block.data.members || []).filter((_, i) => i !== memberIdx);
                          updateBlock(index, { data: { ...block.data, members } });
                        }}
                        style={{ padding: '4px 8px', fontSize: '0.85rem', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                      >
                        Удалить сотрудника
                      </button>
                    </div>
                  ))}
                </>
              )}

              {block.type === 'reviews' && (
                <>
                  <label className={styles.blockLabel}>Отзывы/Рейтинги</label>
                  <button
                    type="button"
                    onClick={() => {
                      const reviews = block.data?.reviews || [];
                      updateBlock(index, { data: { ...block.data, reviews: [...reviews, { author: '', text: '', rating: 5, photo: '' }] } });
                    }}
                    className={styles.blockInput}
                    style={{ marginBottom: 12, cursor: 'pointer', background: '#f1f5f9' }}
                  >
                    + Добавить отзыв
                  </button>
                  {(block.data?.reviews || []).map((review, reviewIdx) => (
                    <div key={reviewIdx} style={{ marginBottom: 12, padding: 12, border: '1px solid #e2e8f0', borderRadius: 8 }}>
                      <input
                        type="text"
                        value={review.author || ''}
                        onChange={(e) => {
                          const reviews = [...(block.data.reviews || [])];
                          reviews[reviewIdx] = { ...reviews[reviewIdx], author: e.target.value };
                          updateBlock(index, { data: { ...block.data, reviews } });
                        }}
                        className={styles.blockInput}
                        placeholder="Автор отзыва"
                        style={{ marginBottom: 8 }}
                      />
                      <RichTextEditor
                        value={review.text || ''}
                        onChange={(v) => {
                          const reviews = [...(block.data.reviews || [])];
                          reviews[reviewIdx] = { ...reviews[reviewIdx], text: v };
                          updateBlock(index, { data: { ...block.data, reviews } });
                        }}
                        placeholder="Текст отзыва..."
                        minHeight={80}
                      />
                      <div style={{ display: 'flex', gap: 12, marginTop: 8, marginBottom: 8 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>Рейтинг:</span>
                          <input
                            type="number"
                            min="1"
                            max="5"
                            value={review.rating || 5}
                            onChange={(e) => {
                              const reviews = [...(block.data.reviews || [])];
                              reviews[reviewIdx] = { ...reviews[reviewIdx], rating: parseInt(e.target.value) || 5 };
                              updateBlock(index, { data: { ...block.data, reviews } });
                            }}
                            className={styles.blockInput}
                            style={{ width: 60 }}
                          />
                        </label>
                        <input
                          type="text"
                          value={review.photo || ''}
                          onChange={(e) => {
                            const reviews = [...(block.data.reviews || [])];
                            reviews[reviewIdx] = { ...reviews[reviewIdx], photo: e.target.value };
                            updateBlock(index, { data: { ...block.data, reviews } });
                          }}
                          className={styles.blockInput}
                          placeholder="URL фото автора"
                          style={{ flex: 1 }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const reviews = (block.data.reviews || []).filter((_, i) => i !== reviewIdx);
                          updateBlock(index, { data: { ...block.data, reviews } });
                        }}
                        style={{ padding: '4px 8px', fontSize: '0.85rem', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                      >
                        Удалить отзыв
                      </button>
                    </div>
                  ))}
                </>
              )}

              {block.type === 'partners' && (
                <>
                  <label className={styles.blockLabel}>Логотипы партнеров</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      e.target.value = '';
                      if (files.length === 0) return;
                      const block = sortedBlocks[index];
                      if (!block) return;
                      const prev = pendingBlockFiles[block.id]?.images || [];
                      onPendingBlockFilesChange?.(block.id, { url: undefined, images: [...prev, ...files] });
                    }}
                    style={{ display: 'none' }}
                    id={`block-partners-${block.id}`}
                  />
                  <label htmlFor={`block-partners-${block.id}`} className={styles.uploadArea} style={{ marginBottom: 12 }}>
                    Добавить логотипы партнеров
                  </label>
                  {(() => {
                    const saved = block.data?.logos || [];
                    const pending = pendingBlockFiles[block.id]?.images || [];
                    const total = saved.length + pending.length;
                    if (total === 0) return null;
                    return (
                      <div className={styles.galleryPreview}>
                        {saved.map((logo, i) => (
                          <div key={`s-${i}`} className={styles.galleryItemWrap}>
                            <div className={styles.galleryItem}>
                              <img src={getImageUrl(logo)} alt="" />
                            </div>
                            <div className={styles.galleryActions}>
                              <button
                                type="button"
                                onClick={() => {
                                  const logos = saved.filter((_, idx) => idx !== i);
                                  updateBlock(index, { data: { ...block.data, logos } });
                                }}
                                className={styles.removeBtn}
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                        {pending.map((file, i) => (
                          <div key={`p-${i}`} className={styles.galleryItemWrap}>
                            <div className={styles.galleryItem}>
                              <PendingImage file={file} />
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </>
              )}

              {block.type === 'timeline' && (
                <>
                  <label className={styles.blockLabel}>Временная шкала</label>
                  <button
                    type="button"
                    onClick={() => {
                      const events = block.data?.events || [];
                      updateBlock(index, { data: { ...block.data, events: [...events, { date: '', title: '', description: '' }] } });
                    }}
                    className={styles.blockInput}
                    style={{ marginBottom: 12, cursor: 'pointer', background: '#f1f5f9' }}
                  >
                    + Добавить событие
                  </button>
                  {(block.data?.events || []).map((event, eventIdx) => (
                    <div key={eventIdx} style={{ marginBottom: 12, padding: 12, border: '1px solid #e2e8f0', borderRadius: 8 }}>
                      <input
                        type="text"
                        value={event.date || ''}
                        onChange={(e) => {
                          const events = [...(block.data.events || [])];
                          events[eventIdx] = { ...events[eventIdx], date: e.target.value };
                          updateBlock(index, { data: { ...block.data, events } });
                        }}
                        className={styles.blockInput}
                        placeholder="Дата события"
                        style={{ marginBottom: 8 }}
                      />
                      <input
                        type="text"
                        value={event.title || ''}
                        onChange={(e) => {
                          const events = [...(block.data.events || [])];
                          events[eventIdx] = { ...events[eventIdx], title: e.target.value };
                          updateBlock(index, { data: { ...block.data, events } });
                        }}
                        className={styles.blockInput}
                        placeholder="Заголовок события"
                        style={{ marginBottom: 8 }}
                      />
                      <RichTextEditor
                        value={event.description || ''}
                        onChange={(v) => {
                          const events = [...(block.data.events || [])];
                          events[eventIdx] = { ...events[eventIdx], description: v };
                          updateBlock(index, { data: { ...block.data, events } });
                        }}
                        placeholder="Описание события..."
                        minHeight={80}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const events = (block.data.events || []).filter((_, i) => i !== eventIdx);
                          updateBlock(index, { data: { ...block.data, events } });
                        }}
                        style={{ marginTop: 8, padding: '4px 8px', fontSize: '0.85rem', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                      >
                        Удалить событие
                      </button>
                    </div>
                  ))}
                </>
              )}

              {/* Специализированные блоки */}
              {block.type === 'carousel' && (
                <>
                  <label className={styles.blockLabel}>Карусель/Слайдер</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleGalleryFileSelect(e, index)}
                    style={{ display: 'none' }}
                    id={`block-carousel-${block.id}`}
                  />
                  <label htmlFor={`block-carousel-${block.id}`} className={styles.uploadArea} style={{ marginBottom: 12 }}>
                    Добавить изображения в карусель
                  </label>
                  {(() => {
                    const saved = block.data?.images || [];
                    const pending = pendingBlockFiles[block.id]?.images || [];
                    const total = saved.length + pending.length;
                    if (total === 0) return null;
                    return (
                      <div className={styles.galleryPreview}>
                        {saved.map((img, i) => (
                          <div key={`s-${i}`} className={styles.galleryItemWrap}>
                            <div className={styles.galleryItem}>
                              <img src={getImageUrl(img)} alt="" />
                            </div>
                            <div className={styles.galleryActions}>
                              <button
                                type="button"
                                onClick={() => {
                                  const images = saved.filter((_, idx) => idx !== i);
                                  updateBlock(index, { data: { ...block.data, images } });
                                }}
                                className={styles.removeBtn}
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                        {pending.map((file, i) => (
                          <div key={`p-${i}`} className={styles.galleryItemWrap}>
                            <div className={styles.galleryItem}>
                              <PendingImage file={file} />
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </>
              )}

              {block.type === 'map' && (
                <>
                  <label className={styles.blockLabel}>Карта</label>
                  <input
                    type="text"
                    value={block.data?.coordinates || ''}
                    onChange={(e) => updateBlock(index, { data: { ...block.data, coordinates: e.target.value } })}
                    className={styles.blockInput}
                    placeholder="Координаты (широта, долгота) или адрес"
                    style={{ marginBottom: 12 }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>Масштаб:</span>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={block.data?.zoom || 10}
                        onChange={(e) => updateBlock(index, { data: { ...block.data, zoom: parseInt(e.target.value) || 10 } })}
                        className={styles.blockInput}
                        style={{ width: 80 }}
                      />
                    </label>
                  </div>
                  <p className={styles.hint}>
                    Введите координаты в формате "широта, долгота" (например: 55.7558, 37.6173) или адрес для поиска на карте.
                  </p>
                </>
              )}

              {block.type === 'form' && (
                <>
                  <label className={styles.blockLabel}>Форма обратной связи</label>
                  <button
                    type="button"
                    onClick={() => {
                      const fields = block.data?.fields || [];
                      updateBlock(index, { data: { ...block.data, fields: [...fields, { type: 'text', label: '', placeholder: '', required: false }] } });
                    }}
                    className={styles.blockInput}
                    style={{ marginBottom: 12, cursor: 'pointer', background: '#f1f5f9' }}
                  >
                    + Добавить поле
                  </button>
                  {(block.data?.fields || []).map((field, fieldIdx) => (
                    <div key={fieldIdx} style={{ marginBottom: 12, padding: 12, border: '1px solid #e2e8f0', borderRadius: 8 }}>
                      <select
                        value={field.type || 'text'}
                        onChange={(e) => {
                          const fields = [...(block.data.fields || [])];
                          fields[fieldIdx] = { ...fields[fieldIdx], type: e.target.value };
                          updateBlock(index, { data: { ...block.data, fields } });
                        }}
                        className={styles.blockInput}
                        style={{ marginBottom: 8 }}
                      >
                        <option value="text">Текст</option>
                        <option value="email">Email</option>
                        <option value="tel">Телефон</option>
                        <option value="textarea">Многострочный текст</option>
                        <option value="select">Выпадающий список</option>
                        <option value="checkbox">Чекбокс</option>
                      </select>
                      <input
                        type="text"
                        value={field.label || ''}
                        onChange={(e) => {
                          const fields = [...(block.data.fields || [])];
                          fields[fieldIdx] = { ...fields[fieldIdx], label: e.target.value };
                          updateBlock(index, { data: { ...block.data, fields } });
                        }}
                        className={styles.blockInput}
                        placeholder="Название поля"
                        style={{ marginBottom: 8 }}
                      />
                      <input
                        type="text"
                        value={field.placeholder || ''}
                        onChange={(e) => {
                          const fields = [...(block.data.fields || [])];
                          fields[fieldIdx] = { ...fields[fieldIdx], placeholder: e.target.value };
                          updateBlock(index, { data: { ...block.data, fields } });
                        }}
                        className={styles.blockInput}
                        placeholder="Подсказка (placeholder)"
                        style={{ marginBottom: 8 }}
                      />
                      <label className={styles.visibilityToggle} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                        <input
                          type="checkbox"
                          checked={field.required || false}
                          onChange={(e) => {
                            const fields = [...(block.data.fields || [])];
                            fields[fieldIdx] = { ...fields[fieldIdx], required: e.target.checked };
                            updateBlock(index, { data: { ...block.data, fields } });
                          }}
                        />
                        <span className={styles.visibilitySwitch} />
                        <span className={styles.visibilityLabel}>Обязательное поле</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const fields = (block.data.fields || []).filter((_, i) => i !== fieldIdx);
                          updateBlock(index, { data: { ...block.data, fields } });
                        }}
                        style={{ marginTop: 8, padding: '4px 8px', fontSize: '0.85rem', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                      >
                        Удалить поле
                      </button>
                    </div>
                  ))}
                </>
              )}

              {block.type === 'social' && (
                <>
                  <label className={styles.blockLabel}>Социальные сети</label>
                  <select
                    value={block.data?.platform || ''}
                    onChange={(e) => updateBlock(index, { data: { ...block.data, platform: e.target.value } })}
                    className={styles.blockInput}
                    style={{ marginBottom: 12 }}
                  >
                    <option value="">Выберите платформу</option>
                    <option value="instagram">Instagram</option>
                    <option value="vk">VK</option>
                    <option value="facebook">Facebook</option>
                    <option value="youtube">YouTube</option>
                    <option value="twitter">Twitter</option>
                    <option value="tiktok">TikTok</option>
                  </select>
                  <RichTextEditor
                    value={block.data?.embedCode || ''}
                    onChange={(v) => updateBlock(index, { data: { ...block.data, embedCode: v } })}
                    placeholder="Вставьте код встраивания (embed code) или ссылку на пост"
                    minHeight={150}
                  />
                  <p className={styles.hint} style={{ marginTop: 8 }}>
                    Вставьте код iframe для встраивания поста или прямую ссылку на публикацию в социальной сети.
                  </p>
                </>
              )}

              {block.type === 'pricing' && (
                <>
                  <label className={styles.blockLabel}>Цены/Тарифы</label>
                  <button
                    type="button"
                    onClick={() => {
                      const plans = block.data?.plans || [];
                      updateBlock(index, { data: { ...block.data, plans: [...plans, { name: '', price: '', period: '', features: [], buttonText: '', buttonUrl: '', popular: false }] } });
                    }}
                    className={styles.blockInput}
                    style={{ marginBottom: 12, cursor: 'pointer', background: '#f1f5f9' }}
                  >
                    + Добавить тариф
                  </button>
                  {(block.data?.plans || []).map((plan, planIdx) => (
                    <div key={planIdx} style={{ marginBottom: 12, padding: 12, border: '1px solid #e2e8f0', borderRadius: 8 }}>
                      <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                        <input
                          type="text"
                          value={plan.name || ''}
                          onChange={(e) => {
                            const plans = [...(block.data.plans || [])];
                            plans[planIdx] = { ...plans[planIdx], name: e.target.value };
                            updateBlock(index, { data: { ...block.data, plans } });
                          }}
                          className={styles.blockInput}
                          placeholder="Название тарифа"
                          style={{ flex: 1 }}
                        />
                        <label className={styles.visibilityToggle} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '0 12px' }}>
                          <input
                            type="checkbox"
                            checked={plan.popular || false}
                            onChange={(e) => {
                              const plans = [...(block.data.plans || [])];
                              plans[planIdx] = { ...plans[planIdx], popular: e.target.checked };
                              updateBlock(index, { data: { ...block.data, plans } });
                            }}
                          />
                          <span className={styles.visibilitySwitch} />
                          <span className={styles.visibilityLabel}>Популярный</span>
                        </label>
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                        <input
                          type="text"
                          value={plan.price || ''}
                          onChange={(e) => {
                            const plans = [...(block.data.plans || [])];
                            plans[planIdx] = { ...plans[planIdx], price: e.target.value };
                            updateBlock(index, { data: { ...block.data, plans } });
                          }}
                          className={styles.blockInput}
                          placeholder="Цена"
                          style={{ flex: 1 }}
                        />
                        <input
                          type="text"
                          value={plan.period || ''}
                          onChange={(e) => {
                            const plans = [...(block.data.plans || [])];
                            plans[planIdx] = { ...plans[planIdx], period: e.target.value };
                            updateBlock(index, { data: { ...block.data, plans } });
                          }}
                          className={styles.blockInput}
                          placeholder="Период (мес/год)"
                          style={{ flex: 1 }}
                        />
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <button
                          type="button"
                          onClick={() => {
                            const plans = [...(block.data.plans || [])];
                            const features = plans[planIdx].features || [];
                            plans[planIdx] = { ...plans[planIdx], features: [...features, ''] };
                            updateBlock(index, { data: { ...block.data, plans } });
                          }}
                          className={styles.blockInput}
                          style={{ marginBottom: 12, cursor: 'pointer', background: '#f1f5f9' }}
                        >
                          + Добавить особенность
                        </button>
                        {(plan.features || []).map((feature, featureIdx) => (
                          <div key={featureIdx} style={{ marginBottom: 8, padding: 8, border: '1px solid #e2e8f0', borderRadius: 8, display: 'flex', gap: 8 }}>
                            <input
                              type="text"
                              value={feature}
                              onChange={(e) => {
                                const plans = [...(block.data.plans || [])];
                                const features = [...(plans[planIdx].features || [])];
                                features[featureIdx] = e.target.value;
                                plans[planIdx] = { ...plans[planIdx], features };
                                updateBlock(index, { data: { ...block.data, plans } });
                              }}
                              className={styles.blockInput}
                              placeholder={`Особенность ${featureIdx + 1}`}
                              style={{ flex: 1 }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const plans = [...(block.data.plans || [])];
                                const features = (plans[planIdx].features || []).filter((_, i) => i !== featureIdx);
                                plans[planIdx] = { ...plans[planIdx], features };
                                updateBlock(index, { data: { ...block.data, plans } });
                              }}
                              style={{ padding: '4px 8px', fontSize: '0.85rem', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 4, cursor: 'pointer', flexShrink: 0 }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                        <input
                          type="text"
                          value={plan.buttonText || ''}
                          onChange={(e) => {
                            const plans = [...(block.data.plans || [])];
                            plans[planIdx] = { ...plans[planIdx], buttonText: e.target.value };
                            updateBlock(index, { data: { ...block.data, plans } });
                          }}
                          className={styles.blockInput}
                          placeholder="Текст кнопки"
                          style={{ flex: 1 }}
                        />
                        <input
                          type="text"
                          value={plan.buttonUrl || ''}
                          onChange={(e) => {
                            const plans = [...(block.data.plans || [])];
                            plans[planIdx] = { ...plans[planIdx], buttonUrl: e.target.value };
                            updateBlock(index, { data: { ...block.data, plans } });
                          }}
                          className={styles.blockInput}
                          placeholder="URL кнопки"
                          style={{ flex: 1 }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const plans = (block.data.plans || []).filter((_, i) => i !== planIdx);
                          updateBlock(index, { data: { ...block.data, plans } });
                        }}
                        style={{ padding: '4px 8px', fontSize: '0.85rem', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                      >
                        Удалить тариф
                      </button>
                    </div>
                  ))}
                </>
              )}
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => removeBlock(index)}
              className={styles.deleteBtn}
              title="Удалить блок"
              aria-label="Удалить блок"
            >
              <X size={18} />
            </button>
          </div>
          
          {index < sortedBlocks.length - 1 && (
            <div
              ref={(el) => {
                if (el) insertRefs.current[index] = el;
              }}
              className={`${styles.insertBlockArea} ${(hoveredInsertIndex === index || openInsertIndex === index) ? styles.insertBlockAreaVisible : ''}`}
              onMouseEnter={() => setHoveredInsertIndex(index)}
              onMouseLeave={() => {
                if (openInsertIndex !== index) {
                  setHoveredInsertIndex(null);
                }
              }}
              data-insert-index={index}
            >
            <div className={styles.insertLine} />
            <button
              type="button"
              className={styles.insertPlusBtn}
              onClick={(e) => {
                e.stopPropagation();
                const newIndex = openInsertIndex === index ? null : index;
                setOpenInsertIndex(newIndex);
                if (newIndex !== null) {
                  // Расчет позиции после рендера
                  requestAnimationFrame(() => {
                    const position = calculateDropdownPosition(newIndex);
                    setDropdownPosition(prev => ({ ...prev, [newIndex]: position }));
                  });
                }
              }}
              aria-label="Добавить блок здесь"
              title="Добавить блок здесь"
            >
              <Plus size={20} />
            </button>
            {openInsertIndex === index && (
              <div 
                className={`${styles.insertDropdown} ${dropdownPosition[index] === 'top' ? styles.insertDropdownTop : styles.insertDropdownBottom}`}
                onMouseEnter={() => setHoveredInsertIndex(index)}
                onMouseLeave={() => {
                  if (openInsertIndex !== index) {
                    setHoveredInsertIndex(null);
                  }
                }}
              >
                {BLOCK_TYPES.map(({ type, label, icon: Icon }) => (
                  <button
                    key={type}
                    type="button"
                    className={styles.addBlockOption}
                    onClick={() => addBlockAfter(index, type)}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          )}
          </div>
        ))}
        {sortedBlocks.length > 0 && (
          <div
            ref={(el) => {
              if (el) insertRefs.current[sortedBlocks.length - 1] = el;
            }}
            className={`${styles.insertBlockArea} ${(hoveredInsertIndex === sortedBlocks.length - 1 || openInsertIndex === sortedBlocks.length - 1) ? styles.insertBlockAreaVisible : ''}`}
            onMouseEnter={() => setHoveredInsertIndex(sortedBlocks.length - 1)}
            onMouseLeave={() => {
              if (openInsertIndex !== sortedBlocks.length - 1) {
                setHoveredInsertIndex(null);
              }
            }}
            data-insert-index={sortedBlocks.length - 1}
          >
            <div className={styles.insertLine} />
            <button
              type="button"
              className={styles.insertPlusBtn}
              onClick={(e) => {
                e.stopPropagation();
                const lastIndex = sortedBlocks.length - 1;
                const newIndex = openInsertIndex === lastIndex ? null : lastIndex;
                setOpenInsertIndex(newIndex);
                if (newIndex !== null) {
                  // Расчет позиции после рендера
                  requestAnimationFrame(() => {
                    const position = calculateDropdownPosition(newIndex);
                    setDropdownPosition(prev => ({ ...prev, [newIndex]: position }));
                  });
                }
              }}
              aria-label="Добавить блок здесь"
              title="Добавить блок здесь"
            >
              <Plus size={20} />
            </button>
            {openInsertIndex === sortedBlocks.length - 1 && (
              <div 
                className={`${styles.insertDropdown} ${dropdownPosition[sortedBlocks.length - 1] === 'top' ? styles.insertDropdownTop : styles.insertDropdownBottom}`}
                onMouseEnter={() => setHoveredInsertIndex(sortedBlocks.length - 1)}
                onMouseLeave={() => {
                  if (openInsertIndex !== sortedBlocks.length - 1) {
                    setHoveredInsertIndex(null);
                  }
                }}
              >
                {BLOCK_TYPES.map(({ type, label, icon: Icon }) => (
                  <button
                    key={type}
                    type="button"
                    className={styles.addBlockOption}
                    onClick={() => addBlockAfter(sortedBlocks.length - 1, type)}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {sortedBlocks.length === 0 && (
      <div className={styles.addBlockWrap} ref={addBlockRef}>
        <button
          type="button"
          onClick={() => setAddBlockOpen(!addBlockOpen)}
          className={styles.addBlockBtn}
        >
          + Добавить блок
        </button>
        {addBlockOpen && (
          <div 
            className={styles.addBlockDropdown}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.preventDefault()}
          >
            {BLOCK_TYPES.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                type="button"
                className={styles.addBlockOption}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  addBlock(type);
                }}
                onMouseDown={(e) => e.preventDefault()}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      )}

      {contactIconPicker.open && typeof document !== 'undefined' && createPortal(
        <div
          onClick={(e) => e.target === e.currentTarget && closeContactIconPicker()}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Выбор иконки контакта"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 460,
              background: '#fff',
              borderRadius: 16,
              border: '1px solid #e2e8f0',
              boxShadow: '0 20px 50px rgba(15,23,42,0.25)',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #e2e8f0' }}>
              <strong style={{ color: '#0f172a' }}>Выберите иконку</strong>
              <button type="button" onClick={closeContactIconPicker} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: 12 }}>
              <div className={styles.whatToBringIconFilters}>
                <input
                  type="search"
                  value={contactIconPicker.search}
                  onChange={(e) => setContactIconPicker((prev) => ({ ...prev, search: e.target.value }))}
                  placeholder="Поиск иконки..."
                  className={styles.whatToBringIconSearch}
                />
                <select
                  value={contactIconPicker.group}
                  onChange={(e) => setContactIconPicker((prev) => ({ ...prev, group: e.target.value }))}
                  className={styles.whatToBringIconGroupSelect}
                >
                  <option value="all">Все</option>
                  {getIconGroups().map((group) => (
                    <option key={group.id} value={group.id}>{group.label}</option>
                  ))}
                </select>
              </div>
              {(() => {
                const groups = getIconGroups();
                const baseNames = contactIconPicker.group === 'all'
                  ? MUI_ICON_NAMES
                  : (groups.find((g) => g.id === contactIconPicker.group)?.iconNames || []);
                const query = String(contactIconPicker.search || '').trim().toLowerCase();
                const names = query ? baseNames.filter((name) => name.toLowerCase().includes(query)) : baseNames;
                return (
                  <div className={styles.whatToBringIconGridWrap}>
                    <button
                      type="button"
                      onClick={() => {
                        if (contactIconPicker.blockId) {
                          updateContactBlockById(contactIconPicker.blockId, { icon: '', iconType: 'library' });
                        }
                        closeContactIconPicker();
                      }}
                      className={styles.whatToBringIconGridItem}
                      title="Без иконки"
                    >
                      —
                    </button>
                    {names.map((name) => {
                      const Icon = MUI_ICONS[name];
                      if (!Icon) return null;
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => {
                            if (contactIconPicker.blockId) {
                              updateContactBlockById(contactIconPicker.blockId, { icon: name, iconType: 'library' });
                            }
                            closeContactIconPicker();
                          }}
                          className={styles.whatToBringIconGridItem}
                          title={name}
                        >
                          <Icon size={20} />
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}

export { slugFromText, BLOCK_TYPES, createEmptyBlock, AutoHeightTableTextarea };
