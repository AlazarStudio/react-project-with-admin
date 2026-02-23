'use client';

import { useState, useEffect, useContext, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Eye, EyeOff, Plus, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { dynamicPagesAPI, menuAPI, dynamicPageRecordsAPI, structureAPI, getImageUrl } from '@/lib/api';
import { AdminHeaderRightContext, AdminBreadcrumbContext } from '../../layout';
import { ConfirmModal } from '../../components';
import { BLOCK_TYPES, slugFromText } from '../../components/NewsBlockEditor';
import styles from '../../admin.module.css';

const TABLE_FIELD_TYPE_PRIORITY = ['image', 'heading', 'text'];
const MAX_TABLE_COLUMNS = 4;
const VISIBILITY_COLUMN_WIDTH_PX = 140;
const ACTIONS_COLUMN_WIDTH_PX = 200;
const DEFAULT_LIMIT = 10;

function getBlockLabel(field) {
  if (field.label && String(field.label).trim()) return field.label;
  return BLOCK_TYPES.find(b => b.type === field.type)?.label ?? field.type;
}

function labelToFieldKey(label) {
  if (!label || !String(label).trim()) return '';
  // В редакторе записи используется slugFromText (транслит) + '_' вместо '-'.
  // Здесь повторяем то же правило для чтения данных.
  const slug = slugFromText(label);
  if (!slug) return '';
  return slug.replace(/-/g, '_');
}

function buildStructureFields(raw) {
  const fields = (raw || [])
    .filter((f) => f?.type !== 'additionalBlocks')
    .map((f, i) => ({ type: f.type || 'text', order: f.order ?? i, label: f.label ?? '' }))
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

function buildVisibleTableFields(fields) {
  if (!Array.isArray(fields) || fields.length === 0) return [];

  const selected = [];
  const selectedKeys = new Set();

  for (const type of TABLE_FIELD_TYPE_PRIORITY) {
    const match = fields.find((field) => field.type === type && !selectedKeys.has(field.fieldKey));
    if (match) {
      selected.push(match);
      selectedKeys.add(match.fieldKey);
    }
  }

  for (const field of fields) {
    if (selected.length >= MAX_TABLE_COLUMNS) break;
    if (selectedKeys.has(field.fieldKey)) continue;
    if (field.type === 'image' && selected.some((item) => item.type === 'image')) continue;
    selected.push(field);
    selectedKeys.add(field.fieldKey);
  }

  return selected.slice(0, MAX_TABLE_COLUMNS);
}

function getDynamicColumnClass(field) {
  if (!field?.type) return '';
  if (field.type === 'image') return styles.dynamicImageCell;
  if (field.type === 'gallery') return styles.dynamicGalleryCell;
  if (field.type === 'heading') return `${styles.dynamicContentCell} ${styles.dynamicTitleCell}`;
  if (field.type === 'text') return `${styles.dynamicContentCell} ${styles.dynamicDescriptionCell}`;
  return styles.dynamicDefaultCell;
}

function getDynamicColumnWidth(field, visibleFields) {
  if (!Array.isArray(visibleFields) || visibleFields.length === 0) return '100%';

  const titleField = visibleFields.find((item) => item.type === 'heading');
  const imageField = visibleFields.find((item) => item.type === 'image');
  const otherFields = visibleFields.filter(
    (item) =>
      (!titleField || item.fieldKey !== titleField.fieldKey) &&
      (!imageField || item.fieldKey !== imageField.fieldKey)
  );

  if (imageField && field.fieldKey === imageField.fieldKey) {
    return '120px';
  }

  if (titleField && field.fieldKey === titleField.fieldKey) {
    return '20%';
  }

  if (otherFields.length === 0) return 'auto';

  const reservedParts = [`${VISIBILITY_COLUMN_WIDTH_PX}px`, `${ACTIONS_COLUMN_WIDTH_PX}px`];
  if (imageField) reservedParts.push('120px');
  if (titleField) reservedParts.push('20%');
  const restExpression = reservedParts.length > 0 ? `100% - ${reservedParts.join(' - ')}` : '100%';
  return `calc((${restExpression}) / ${otherFields.length})`;
}

function getRecordFieldValue(record, field) {
  return (
    record?.[field.fieldKey] ??
    record?.[`${field.type}-${field.order ?? 0}`] ??
    record?.[field.type]
  );
}

function toComparableValue(value, fieldType) {
  if (fieldType === 'image') {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value?.url || value?.value || '';
  }

  if (fieldType === 'gallery') {
    return Array.isArray(value) ? value.length : 0;
  }

  if (fieldType === 'heading') {
    if (!value) return '';
    if (typeof value === 'object' && value !== null && 'text' in value) return String(value.text || '');
    return typeof value === 'string' ? value : '';
  }

  if (fieldType === 'text') {
    if (!value) return '';
    const text = typeof value === 'object' && value !== null && 'content' in value
      ? String(value.content || '')
      : (typeof value === 'string' ? value : '');
    return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  if (value == null) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.length;
  return JSON.stringify(value);
}

export default function DynamicPageEditor() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pageTitle, setPageTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [structureFields, setStructureFields] = useState([]);
  const [records, setRecords] = useState([]);
  const [visibilityUpdatingId, setVisibilityUpdatingId] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc');
  const setHeaderRight = useContext(AdminHeaderRightContext)?.setHeaderRight;
  const setBreadcrumbLabel = useContext(AdminBreadcrumbContext)?.setBreadcrumbLabel;
  const tableFields = buildVisibleTableFields(structureFields);
  const returnPageStorageKey = `admin_dynamic_return_page_${slug}`;

  const sortedRecords = useMemo(() => {
    if (!Array.isArray(records) || records.length === 0) return [];
    if (!sortBy) return records;

    const cloned = [...records];
    const direction = sortOrder === 'asc' ? 1 : -1;
    const sortField = tableFields.find((field) => field.fieldKey === sortBy) || null;

    cloned.sort((a, b) => {
      let aValue;
      let bValue;

      if (sortBy === '__visibility') {
        aValue = a.isPublished !== false ? 1 : 0;
        bValue = b.isPublished !== false ? 1 : 0;
      } else if (sortField) {
        aValue = toComparableValue(getRecordFieldValue(a, sortField), sortField.type);
        bValue = toComparableValue(getRecordFieldValue(b, sortField), sortField.type);
      } else {
        aValue = '';
        bValue = '';
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return (aValue - bValue) * direction;
      }

      if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        return (Number(aValue) - Number(bValue)) * direction;
      }

      return String(aValue).localeCompare(String(bValue), 'ru', { sensitivity: 'base', numeric: true }) * direction;
    });

    return cloned;
  }, [records, sortBy, sortOrder, tableFields]);

  const pagination = useMemo(() => {
    const total = sortedRecords.length;
    const pages = Math.max(1, Math.ceil(total / limit));
    return { total, pages, page: currentPage };
  }, [sortedRecords.length, limit, currentPage]);

  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * limit;
    return sortedRecords.slice(start, start + limit);
  }, [sortedRecords, currentPage, limit]);

  const handleSort = (fieldKey) => {
    handlePageChange(1);
    if (sortBy === fieldKey) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(fieldKey);
    setSortOrder('asc');
  };

  const handleResetSort = () => {
    setSortBy(null);
    setSortOrder('asc');
    handlePageChange(1);
  };

  const handleLimitChange = (newLimit) => {
    setLimit(newLimit);
    handlePageChange(1);
    localStorage.setItem(`admin_dynamic_limit_${slug}`, String(newLimit));
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.pages) return;
    setCurrentPage(newPage);
    const newParams = new URLSearchParams(searchParams);
    if (newPage === 1) {
      newParams.delete('page');
    } else {
      newParams.set('page', String(newPage));
    }
    setSearchParams(newParams, { replace: true });
  };

  useEffect(() => {
    if (slug === 'settings') {
      navigate('/admin/settings', { replace: true });
      return;
    }
    loadPageData();
  }, [slug, navigate]);

  useEffect(() => {
    const savedLimit = parseInt(localStorage.getItem(`admin_dynamic_limit_${slug}`) || '', 10);
    setLimit(Number.isFinite(savedLimit) && savedLimit > 0 ? savedLimit : DEFAULT_LIMIT);
    const urlPageRaw = parseInt(searchParams.get('page') || '1', 10);
    const urlPage = Number.isFinite(urlPageRaw) && urlPageRaw > 0 ? urlPageRaw : 1;
    const savedReturnPage = parseInt(localStorage.getItem(returnPageStorageKey) || '', 10);
    if (Number.isFinite(savedReturnPage) && savedReturnPage > 0) {
      setCurrentPage(savedReturnPage);
      const newParams = new URLSearchParams(searchParams);
      if (savedReturnPage === 1) {
        newParams.delete('page');
      } else {
        newParams.set('page', String(savedReturnPage));
      }
      setSearchParams(newParams, { replace: true });
      localStorage.removeItem(returnPageStorageKey);
      return;
    }
    setCurrentPage(urlPage);
  }, [slug]);

  useEffect(() => {
    const urlPageRaw = parseInt(searchParams.get('page') || '1', 10);
    const urlPage = Number.isFinite(urlPageRaw) && urlPageRaw > 0 ? urlPageRaw : 1;
    if (urlPage !== currentPage) {
      setCurrentPage(urlPage);
    }
  }, [searchParams, currentPage]);

  useEffect(() => {
    if (isLoading) return;
    if (currentPage > pagination.pages) {
      const fallbackPage = pagination.pages;
      setCurrentPage(fallbackPage);
      const newParams = new URLSearchParams(searchParams);
      if (fallbackPage === 1) {
        newParams.delete('page');
      } else {
        newParams.set('page', String(fallbackPage));
      }
      setSearchParams(newParams, { replace: true });
    }
  }, [currentPage, pagination.pages, isLoading]);

  const loadPageData = async () => {
    setIsLoading(true);
    try {
      // Загружаем название из меню (сначала с бэка, потом из localStorage)
      let menuItems = [];
      
      try {
        const menuRes = await menuAPI.get();
        
        // Проверяем статус ответа - если 404, значит ресурс еще не сгенерирован
        if (menuRes.status === 404) {
          // Ресурс еще не сгенерирован - это нормально, продолжаем загрузку из localStorage
        } else {
          // Ресурс существует, загружаем данные
          menuItems = menuRes.data?.items || [];
          
        }
      } catch (error) {
        // Если произошла другая ошибка (не 404), тихо обрабатываем
      }
      
      // Ищем пункт меню по slug
      console.log('🔍 Ищу пункт меню для slug:', slug);
      console.log('🔍 Всего пунктов меню:', menuItems.length);
      console.log('🔍 Пункты меню:', menuItems.map(item => ({
        label: item.label,
        url: item.url,
        slug: item.url?.replace(/^\/admin\/?/, '').replace(/^\/+/, '').replace(/\/+$/, '') || ''
      })));
      
      const menuItem = menuItems.find(item => {
        if (!item.url) return false;
        
        // Убираем префикс /admin/ и сравниваем со slug из URL
        let itemSlug = item.url.replace(/^\/admin\/?/, '').replace(/^\/+/, '').replace(/\/+$/, '');
        const normalizedSlug = slug?.replace(/^\/+/, '').replace(/\/+$/, '') || '';
        
        const match = itemSlug === normalizedSlug || itemSlug === slug;
        if (match) {
          console.log('✅ Найден пункт меню:', item.label, 'для slug:', slug, '(itemSlug:', itemSlug, ')');
        }
        return match;
      });
      
      if (!menuItem) {
        console.warn('❌ Пункт меню не найден для slug:', slug);
        console.warn('Доступные slug из меню:', menuItems.map(item => ({
          url: item.url,
          slug: item.url?.replace(/^\/admin\/?/, '').replace(/^\/+/, '').replace(/\/+$/, '') || ''
        })));
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
      } catch (error) {
        try {
          const pageRes = await dynamicPagesAPI.get(slug).catch(() => ({
            data: { structure: { fields: [] } },
          }));
          raw = pageRes.data?.structure?.fields || [];
        } catch (fallbackError) {
          console.warn('⚠️ Не удалось загрузить структуру с бэка:', fallbackError.message);
        }
      }

      const fields = buildStructureFields(raw);
      setStructureFields(fields);
      
      // Загружаем записи, если есть структура
      if (fields.length > 0) {
        try {
          const recordsRes = await dynamicPageRecordsAPI.getAll(slug, { page: 1, limit: 5000 }).catch(() => ({ data: { records: [] } }));
          setRecords(recordsRes.data?.records || []);
        } catch (error) {
          console.error('Ошибка загрузки записей:', error);
          setRecords([]);
        }
      }
      
      // Устанавливаем название в хлебные крошки
      if (setBreadcrumbLabel) {
        setBreadcrumbLabel(title);
      }
    } catch (error) {
      console.error('Ошибка загрузки страницы:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = (recordId) => {
    setConfirmModal({
      open: true,
      title: 'Удалить запись?',
      message: 'Вы уверены, что хотите удалить эту запись?',
      onConfirm: async () => {
        try {
          await dynamicPageRecordsAPI.delete(slug, recordId);
          setRecords((prev) => prev.filter((r) => r.id !== recordId));
          setConfirmModal(null);
        } catch (error) {
          console.error('Ошибка удаления:', error);
          alert('Не удалось удалить запись');
        }
      },
      onCancel: () => setConfirmModal(null),
    });
  };

  const handleToggleVisibility = async (record) => {
    if (!record?.id || visibilityUpdatingId) return;

    const nextIsPublished = !(record.isPublished !== false);
    setVisibilityUpdatingId(record.id);

    try {
      await dynamicPageRecordsAPI.update(slug, record.id, {
        ...record,
        isPublished: nextIsPublished,
      });

      setRecords((prev) =>
        prev.map((item) =>
          item.id === record.id ? { ...item, isPublished: nextIsPublished } : item
        )
      );
    } catch (error) {
      console.error('Ошибка изменения видимости:', error);
      alert('Не удалось изменить видимость записи');
    } finally {
      setVisibilityUpdatingId(null);
    }
  };

  const renderSortIcon = (fieldKey) => {
    if (sortBy !== fieldKey) return <ArrowUpDown size={14} className={styles.sortIconInactive} />;
    return sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
  };

  const renderPagination = () => (
    <>
      <div className={styles.paginationLimit}>
        <label htmlFor="dynamic-limit-select">Показывать:</label>
        <select
          id="dynamic-limit-select"
          value={limit}
          onChange={(e) => handleLimitChange(parseInt(e.target.value, 10))}
          className={styles.limitSelect}
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>
      {pagination.pages > 1 && (
        <div className={styles.pagination}>
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={styles.pageBtn}
            aria-label="Предыдущая страница"
          >
            <ChevronLeft size={18} />
          </button>
          {(() => {
            const pages = [];
            const totalPages = pagination.pages;
            const current = currentPage;
            if (current > 3) {
              pages.push(<button key={1} onClick={() => handlePageChange(1)} className={styles.pageBtn}>1</button>);
              if (current > 4) pages.push(<span key="ellipsis1" className={styles.ellipsis}>...</span>);
            }
            const start = Math.max(1, current - 2);
            const end = Math.min(totalPages, current + 2);
            for (let i = start; i <= end; i++) {
              pages.push(
                <button key={i} onClick={() => handlePageChange(i)} className={`${styles.pageBtn} ${current === i ? styles.active : ''}`}>{i}</button>
              );
            }
            if (current < totalPages - 2) {
              if (current < totalPages - 3) pages.push(<span key="ellipsis2" className={styles.ellipsis}>...</span>);
              pages.push(<button key={totalPages} onClick={() => handlePageChange(totalPages)} className={styles.pageBtn}>{totalPages}</button>);
            }
            return pages;
          })()}
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === pagination.pages}
            className={styles.pageBtn}
            aria-label="Следующая страница"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </>
  );

  // Устанавливаем кнопку "Добавить" в header
  useEffect(() => {
    if (!setHeaderRight || !structureFields.length) {
      if (setHeaderRight) setHeaderRight(null);
      return;
    }
    
    setHeaderRight(
      <button
        type="button"
        className={styles.addBtn}
        onClick={() => {
          localStorage.setItem(returnPageStorageKey, String(currentPage));
          navigate(`/admin/dynamic/${slug}/new`);
        }}
      >
        <Plus size={18} /> Добавить
      </button>
    );
    
    return () => setHeaderRight(null);
  }, [setHeaderRight, structureFields.length, slug, navigate, currentPage, returnPageStorageKey]);

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Загрузка...</p>
      </div>
    );
  }

  // Если структура не настроена
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

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.tableWrapper}>
        <div className={`${styles.tableContainer} ${styles.dynamicTableContainer}`}>
          {records.length === 0 ? (
            <div className={styles.emptyState}>
              <h3>Записей пока нет</h3>
              <p>Добавьте первую запись</p>
            </div>
          ) : (
            <table className={`${styles.table} ${styles.dynamicTable}`}>
              <colgroup>
                {tableFields.map((field) => (
                  <col key={`col-${field.fieldKey}`} style={{ width: getDynamicColumnWidth(field, tableFields) }} />
                ))}
                <col style={{ width: `${VISIBILITY_COLUMN_WIDTH_PX}px` }} />
                <col style={{ width: `${ACTIONS_COLUMN_WIDTH_PX}px` }} />
              </colgroup>
              <thead>
                <tr>
                  {tableFields.map((field) => (
                    <th
                      key={field.fieldKey}
                      className={`${getDynamicColumnClass(field)} ${styles.sortableHeader}`}
                      onClick={() => handleSort(field.fieldKey)}
                    >
                      <span className={styles.sortHeaderInner}>
                        <span>{getBlockLabel(field)}</span>
                        {renderSortIcon(field.fieldKey)}
                      </span>
                    </th>
                  ))}
                  <th className={`${styles.dynamicVisibilityCell} ${styles.sortableHeader}`} onClick={() => handleSort('__visibility')}>
                    <span className={styles.sortHeaderInner}>
                      <span>Видимость</span>
                      {renderSortIcon('__visibility')}
                    </span>
                  </th>
                  <th className={`${styles.actionsCell} ${styles.dynamicActionsCell}`}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>Действия</span>
                      {sortBy && (
                        <button
                          type="button"
                          onClick={handleResetSort}
                          className={styles.resetSortIconBtn}
                          title="Сбросить сортировку"
                          aria-label="Сбросить сортировку"
                        >
                          <RotateCcw size={14} className={styles.sortIconInactive} />
                        </button>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecords.map((record) => (
                  <tr key={record.id}>
                    {tableFields.map((field) => {
                      const val = getRecordFieldValue(record, field);
                      const isImage = field.type === 'image' && Boolean(val);
                      const isGallery = field.type === 'gallery' && Array.isArray(val);
                      const isHeading = field.type === 'heading';
                      const isText = field.type === 'text';
                      
                      // Для heading: объект {text: "..."} или строка
                      const headingText = isHeading && val
                        ? (typeof val === 'object' && val !== null && 'text' in val ? val.text : (typeof val === 'string' ? val : null))
                        : null;
                      
                      // Для text: объект {content: "<p>...</p>"} или строка
                      const richTextContent = isText && val
                        ? (typeof val === 'object' && val !== null && 'content' in val ? val.content : (typeof val === 'string' ? val : null))
                        : null;
                      const plainRichText = typeof richTextContent === 'string'
                        ? richTextContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
                        : null;
                      
                      // Для image: строка URL или объект {url, value, ...}
                      const imageUrl = isImage && val
                        ? (typeof val === 'string' ? getImageUrl(val) : (val?.url ? getImageUrl(val.url) : (val?.value ? getImageUrl(val.value) : null)))
                        : null;
                      
                      return (
                        <td key={field.fieldKey} className={getDynamicColumnClass(field)}>
                          <div className={styles.cellInner}>
                            {isImage && imageUrl ? (
                              <img
                                src={imageUrl}
                                alt=""
                                className={styles.tableImage}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling && (e.target.nextSibling.textContent = 'Ошибка загрузки');
                                }}
                              />
                            ) : isGallery ? (
                              `${val.length} фото`
                            ) : headingText ? (
                              <span className={styles.dynamicTextClamp}>{headingText || '-'}</span>
                            ) : plainRichText ? (
                              <span className={styles.dynamicTextClamp}>
                                {(plainRichText.length > 120 ? `${plainRichText.slice(0, 120)}…` : plainRichText) || '-'}
                              </span>
                            ) : typeof val === 'object' && val !== null && !Array.isArray(val) ? (
                              <span className={styles.dynamicTextClamp}>
                                {JSON.stringify(val).slice(0, 100) + (JSON.stringify(val).length > 100 ? '…' : '')}
                              </span>
                            ) : (
                              <span className={styles.dynamicTextClamp}>{String(val ?? '-')}</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className={styles.dynamicVisibilityCell}>
                      <div className={styles.cellInner}>
                        <span className={`${styles.badge} ${styles[record.isPublished !== false ? 'active' : 'inactive']}`}>
                          {record.isPublished !== false ? 'Включено' : 'Скрыто'}
                        </span>
                      </div>
                    </td>
                    <td className={`${styles.actionsCell} ${styles.dynamicActionsCell}`}>
                      <div className={styles.cellInner}>
                        <div className={styles.actions}>
                          <button
                            type="button"
                            onClick={() => handleToggleVisibility(record)}
                            className={record.isPublished !== false ? styles.deleteBtn : styles.viewBtn}
                            title={record.isPublished !== false ? 'Скрыть на сайте' : 'Показать на сайте'}
                            disabled={visibilityUpdatingId === record.id}
                          >
                            {record.isPublished !== false ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              localStorage.setItem(returnPageStorageKey, String(currentPage));
                              navigate(`/admin/dynamic/${slug}/${record.id}`);
                            }}
                            className={styles.editBtn}
                            title="Редактировать"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(record.id)}
                            className={styles.deleteBtn}
                            title="Удалить"
                          >
                            <Trash2 size={16} />
                          </button>
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

      {(pagination.pages > 1 || pagination.total > 0) && (
        <div className={styles.paginationFooter}>
          {renderPagination()}
        </div>
      )}

      {confirmModal && (
        <ConfirmModal
          open={confirmModal.open}
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={confirmModal.onCancel}
        />
      )}
    </div>
  );
}
