'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Pencil, Check, FolderPlus, Upload } from 'lucide-react';
import { placeFiltersAPI, mediaAPI, getImageUrl } from '@/lib/api';
import { MUI_ICON_NAMES, MUI_ICONS, getMuiIconComponent, getIconGroups } from './WhatToBringIcons';
import ConfirmModal from './ConfirmModal';
import styles from '../admin.module.css';

const FIXED_GROUP_KEYS = ['directions', 'seasons', 'objectTypes', 'accessibility'];
const FIXED_GROUP_LABELS = {
  directions: 'Направление',
  seasons: 'Сезон',
  objectTypes: 'Вид объекта',
  accessibility: 'Доступность',
};

const emptyConfig = () => ({
  directions: [],
  seasons: [],
  objectTypes: [],
  accessibility: [],
});

function normalizeExtraGroups(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter((g) => g && typeof g.key === 'string' && g.key.trim()).map((g) => {
    const icon = typeof g.icon === 'string' && g.icon.trim() ? g.icon.trim() : null;
    const iconType = g.iconType === 'upload' || g.iconType === 'library' ? g.iconType : (icon && (icon.startsWith('http') || icon.startsWith('/')) ? 'upload' : 'library');
    return {
      key: String(g.key).trim().replace(/\s+/g, '_'),
      label: typeof g.label === 'string' ? g.label.trim() || g.key : String(g.key),
      icon,
      iconType,
      values: Array.isArray(g.values) ? g.values.filter((v) => typeof v === 'string' && v.trim()) : [],
    };
  });
}

export default function PlaceFiltersModal({ open, onClose }) {
  const [config, setConfig] = useState(emptyConfig);
  const [initialConfig, setInitialConfig] = useState(emptyConfig);
  const [extraGroups, setExtraGroups] = useState([]);
  const [initialExtraGroups, setInitialExtraGroups] = useState([]);
  const [fixedGroupMeta, setFixedGroupMeta] = useState({});
  const [hiddenFixedGroups, setHiddenFixedGroups] = useState([]);
  const [newValues, setNewValues] = useState({});
  const [editing, setEditing] = useState(null);
  const [editingInput, setEditingInput] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const editInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('');
  const [newGroupLabel, setNewGroupLabel] = useState('');
  const [newGroupIconType, setNewGroupIconType] = useState('library');
  const [newGroupIcon, setNewGroupIcon] = useState('');
  const [addingGroup, setAddingGroup] = useState(false);
  const [removingGroupKey, setRemovingGroupKey] = useState(null);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconPickerGroup, setIconPickerGroup] = useState('all');
  const [iconPickerSearch, setIconPickerSearch] = useState('');
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [editingGroupKey, setEditingGroupKey] = useState(null);
  const [editGroupLabel, setEditGroupLabel] = useState('');
  const [editGroupIcon, setEditGroupIcon] = useState('');
  const [editGroupIconType, setEditGroupIconType] = useState('library');
  const [removeGroupConfirmKey, setRemoveGroupConfirmKey] = useState(null);
  const [savingGroupMeta, setSavingGroupMeta] = useState(false);

  const ADD_GROUP_TAB = '__add__';

  const getValues = useCallback((group) => {
    if (FIXED_GROUP_KEYS.includes(group)) return config[group] || [];
    const g = extraGroups.find((e) => e.key === group);
    return g ? (g.values || []) : [];
  }, [config, extraGroups]);

  const loadFilters = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await placeFiltersAPI.get();
      const data = res.data || {};
      const normalized = {
        directions: Array.isArray(data.directions) ? [...data.directions] : [],
        seasons: Array.isArray(data.seasons) ? [...data.seasons] : [],
        objectTypes: Array.isArray(data.objectTypes) ? [...data.objectTypes] : [],
        accessibility: Array.isArray(data.accessibility) ? [...data.accessibility] : [],
      };
      const extra = normalizeExtraGroups(data.extraGroups);
      const fgm = data.fixedGroupMeta && typeof data.fixedGroupMeta === 'object' ? data.fixedGroupMeta : {};
      const hfg = Array.isArray(data.hiddenFixedGroups) ? data.hiddenFixedGroups : [];
      setConfig(normalized);
      setInitialConfig(normalized);
      setExtraGroups(extra);
      setInitialExtraGroups(extra);
      setFixedGroupMeta(fgm);
      setHiddenFixedGroups(hfg);
      const visibleFixed = FIXED_GROUP_KEYS.filter((k) => !hfg.includes(k));
      const keys = [...visibleFixed, ...extra.map((g) => g.key)];
      setNewValues(keys.reduce((acc, k) => ({ ...acc, [k]: '' }), {}));
      setIconPickerOpen(false);
    } catch (err) {
      console.error('Ошибка загрузки фильтров:', err);
      setError('Не удалось загрузить фильтры');
      setConfig(emptyConfig());
      setInitialConfig(emptyConfig());
      setExtraGroups([]);
      setInitialExtraGroups([]);
      setFixedGroupMeta({});
      setHiddenFixedGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadFilters();
      setEditing(null);
      setNewGroupLabel('');
      setNewGroupIconType('library');
      setNewGroupIcon('');
      setActiveTab('');
      setIconPickerOpen(false);
      setIconPickerGroup('all');
      setIconPickerSearch('');
      setHintOpen(false);
      setEditingGroupKey(null);
      setRemoveGroupConfirmKey(null);
    }
  }, [open, loadFilters]);

  useEffect(() => {
    if (iconPickerOpen) setIconPickerSearch('');
  }, [iconPickerOpen]);

  const groupList = [
    ...FIXED_GROUP_KEYS.filter((key) => !hiddenFixedGroups.includes(key)).map((key) => {
      const meta = fixedGroupMeta[key];
      return {
        key,
        label: (meta && typeof meta.label === 'string' && meta.label.trim()) ? meta.label.trim() : FIXED_GROUP_LABELS[key],
        icon: meta?.icon ?? null,
        iconType: meta?.iconType ?? null,
      };
    }),
    ...extraGroups.map((g) => ({ key: g.key, label: g.label, icon: g.icon || null, iconType: g.iconType || null })),
  ];

  useEffect(() => {
    if (loading) return;
    const keys = groupList.map((g) => g.key);
    if (!activeTab || (activeTab !== ADD_GROUP_TAB && !keys.includes(activeTab))) {
      setActiveTab(keys[0] || ADD_GROUP_TAB);
    }
  }, [loading, config, extraGroups, activeTab]);

  useEffect(() => {
    if (editing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editing]);

  const addValue = (group, value) => {
    const trimmed = (value || '').trim();
    if (!trimmed) return;
    if (FIXED_GROUP_KEYS.includes(group)) {
      const arr = config[group] || [];
      if (arr.includes(trimmed)) return;
      setConfig((prev) => ({ ...prev, [group]: [...(prev[group] || []), trimmed] }));
    } else {
      const g = extraGroups.find((e) => e.key === group);
      if (!g || (g.values || []).includes(trimmed)) return;
      setExtraGroups((prev) => prev.map((e) => (e.key === group ? { ...e, values: [...(e.values || []), trimmed] } : e)));
    }
    setNewValues((prev) => ({ ...prev, [group]: '' }));
  };

  const removeValue = (group, value) => {
    if (editing?.group === group && editing?.value === value) setEditing(null);
    if (FIXED_GROUP_KEYS.includes(group)) {
      setConfig((prev) => ({ ...prev, [group]: (prev[group] || []).filter((v) => v !== value) }));
    } else {
      setExtraGroups((prev) => prev.map((e) => (e.key === group ? { ...e, values: (e.values || []).filter((v) => v !== value) } : e)));
    }
  };

  const startEdit = (group, value) => {
    setEditing({ group, value });
    setEditingInput(value);
    setError('');
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditingInput('');
  };

  const applyEdit = async () => {
    if (!editing) return;
    const { group, value: oldValue } = editing;
    const newValue = (editingInput || '').trim();
    if (!newValue) {
      cancelEdit();
      return;
    }
    if (newValue === oldValue) {
      cancelEdit();
      return;
    }
    const arr = getValues(group);
    if (arr.includes(newValue)) {
      setError(`Значение «${newValue}» уже есть в группе`);
      return;
    }
    setSavingEdit(true);
    setError('');
    try {
      await placeFiltersAPI.replaceValue(group, oldValue, newValue);
      if (FIXED_GROUP_KEYS.includes(group)) {
        setConfig((prev) => ({ ...prev, [group]: (prev[group] || []).map((v) => (v === oldValue ? newValue : v)) }));
        setInitialConfig((prev) => ({ ...prev, [group]: (prev[group] || []).map((v) => (v === oldValue ? newValue : v)) }));
      } else {
        setExtraGroups((prev) => prev.map((e) => (e.key === group ? { ...e, values: (e.values || []).map((v) => (v === oldValue ? newValue : v)) } : e)));
        setInitialExtraGroups((prev) => prev.map((e) => (e.key === group ? { ...e, values: (e.values || []).map((v) => (v === oldValue ? newValue : v)) } : e)));
      }
      cancelEdit();
    } catch (err) {
      console.error('Ошибка переименования:', err);
      setError(err.response?.data?.message || 'Не удалось переименовать значение');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await placeFiltersAPI.update({
        directions: config.directions,
        seasons: config.seasons,
        objectTypes: config.objectTypes,
        accessibility: config.accessibility,
        extraGroups: extraGroups.map((g) => ({ key: g.key, label: g.label, icon: g.icon || null, iconType: g.iconType || null, values: g.values || [] })),
        fixedGroupMeta: Object.keys(fixedGroupMeta).length ? fixedGroupMeta : null,
        hiddenFixedGroups,
      });
      setInitialConfig({ ...config });
      setInitialExtraGroups([...extraGroups]);
      onClose?.();
    } catch (err) {
      console.error('Ошибка сохранения фильтров:', err);
      setError(err.response?.data?.message || 'Не удалось сохранить фильтры');
    } finally {
      setSaving(false);
    }
  };

  const handleAddGroup = async () => {
    const label = newGroupLabel.trim();
    if (!label) {
      setError('Введите название группы');
      return;
    }
    setAddingGroup(true);
    setError('');
    try {
      const res = await placeFiltersAPI.addGroup(label, newGroupIcon || null, newGroupIconType || null, []);
      const extra = normalizeExtraGroups((res.data || {}).extraGroups);
      const newKey = extra.length ? extra[extra.length - 1].key : null;
      setNewGroupLabel('');
      setNewGroupIconType('library');
      setNewGroupIcon('');
      await loadFilters();
      setActiveTab(newKey || ADD_GROUP_TAB);
    } catch (err) {
      setError(err.response?.data?.message || 'Не удалось добавить группу');
    } finally {
      setAddingGroup(false);
    }
  };

  const handleRemoveGroup = async (key) => {
    setRemovingGroupKey(key);
    setError('');
    try {
      await placeFiltersAPI.removeGroup(key);
      await loadFilters();
    } catch (err) {
      setError(err.response?.data?.message || 'Не удалось удалить группу');
    } finally {
      setRemovingGroupKey(null);
    }
  };

  const startEditGroup = (g) => {
    setEditingGroupKey(g.key);
    setEditGroupLabel(g.label || g.key);
    setEditGroupIcon(g.icon || '');
    setEditGroupIconType(g.iconType || (g.icon && (g.icon.startsWith('http') || g.icon.startsWith('/')) ? 'upload' : 'library'));
  };

  const cancelEditGroup = () => {
    setEditingGroupKey(null);
    setEditGroupLabel('');
    setEditGroupIcon('');
    setEditGroupIconType('library');
  };

  const applyEditGroup = async () => {
    if (!editingGroupKey) return;
    const label = editGroupLabel.trim();
    if (!label) return;
    setSavingGroupMeta(true);
    setError('');
    try {
      await placeFiltersAPI.updateGroupMeta(editingGroupKey, {
        label,
        icon: editGroupIcon || null,
        iconType: editGroupIconType || null,
      });
      if (FIXED_GROUP_KEYS.includes(editingGroupKey)) {
        setFixedGroupMeta((prev) => ({
          ...prev,
          [editingGroupKey]: { label, icon: editGroupIcon || null, iconType: editGroupIconType || null },
        }));
      } else {
        setExtraGroups((prev) =>
          prev.map((g) =>
            g.key === editingGroupKey
              ? { ...g, label, icon: editGroupIcon || null, iconType: editGroupIconType || null }
              : g
          )
        );
      }
      cancelEditGroup();
    } catch (err) {
      console.error('Ошибка сохранения группы:', err);
      setError(err.response?.data?.message || 'Не удалось сохранить изменения группы');
    } finally {
      setSavingGroupMeta(false);
    }
  };

  if (!open) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  const currentGroup = groupList.find((g) => g.key === activeTab);

  return (
    <div
      className={styles.modalOverlay}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="place-filters-title"
    >
      <div
        className={styles.modalDialog}
        style={{ maxWidth: 1000 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h2 id="place-filters-title" className={styles.modalTitle} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Фильтры мест
            <button
              type="button"
              onClick={() => setHintOpen((prev) => !prev)}
              className={styles.routeFilterHintBtn}
              aria-label={hintOpen ? 'Скрыть подсказку' : 'Показать подсказку'}
              aria-expanded={hintOpen}
              title={hintOpen ? 'Скрыть подсказку' : 'Подсказка'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>
            </button>
          </h2>
          <button type="button" onClick={onClose} className={styles.modalClose} aria-label="Закрыть">
            <X size={20} />
          </button>
        </div>
        <div className={styles.modalBody}>
          {hintOpen && (
            <div className={styles.routeFilterHintBlock}>
              <p style={{ margin: 0 }}>
                Опции для фильтра мест и карточки места. Переключайте группы по вкладкам.
              </p>
              <p style={{ margin: '8px 0 0 0' }}>
                Если создаёте новую группу (вкладка «Добавить группу») и не добавляете в неё значения — при создании и редактировании места для этой группы будет показано поле для ввода.
              </p>
            </div>
          )}
          {loading ? (
            <div className={styles.emptyState}>
              <div className={styles.spinner} />
              <p>Загрузка...</p>
            </div>
          ) : (
            <>
              {error && (
                <div style={{ marginBottom: 16, padding: 12, background: '#fef2f2', color: '#dc2626', borderRadius: 8, fontSize: '0.9rem' }}>
                  {error}
                </div>
              )}
              <div className={styles.filterModalTabs} role="tablist">
                {groupList.map(({ key: group, label, icon: groupIcon, iconType: groupIconType }) => {
                  const isUploadIcon = groupIconType === 'upload' && groupIcon;
                  const IconComponent = !isUploadIcon && groupIcon ? getMuiIconComponent(groupIcon) : null;
                  return (
                    <div
                      key={group}
                      className={`${styles.filterModalTabWrap} ${activeTab === group ? styles.filterModalTabActive : ''}`}
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === group}
                        aria-controls={`panel-${group}`}
                        id={`tab-${group}`}
                        className={styles.filterModalTab}
                        onClick={() => setActiveTab(group)}
                      >
                        {isUploadIcon ? (
                          <span className={styles.filterModalTabIcon}><img src={getImageUrl(groupIcon)} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} /></span>
                        ) : IconComponent ? (
                          <span className={styles.filterModalTabIcon}><IconComponent size={18} /></span>
                        ) : null}
                        {label}
                      </button>
                      <span className={styles.filterModalTabActions} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className={styles.filterModalTabActionBtn}
                          title="Редактировать группу"
                          aria-label="Редактировать группу"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveTab(group);
                            startEditGroup({ key: group, label, icon: groupIcon, iconType: groupIconType });
                          }}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className={styles.filterModalTabActionBtn}
                          title="Удалить группу"
                          aria-label="Удалить группу"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRemoveGroupConfirmKey(group);
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </span>
                    </div>
                  );
                })}
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === ADD_GROUP_TAB}
                  aria-label="Добавить группу"
                  title="Добавить группу"
                  className={`${styles.filterModalTab} ${activeTab === ADD_GROUP_TAB ? styles.filterModalTabActive : ''}`}
                  onClick={() => setActiveTab(ADD_GROUP_TAB)}
                >
                  <FolderPlus size={18} />
                </button>
              </div>
              <div className={styles.filterModalTabPanel} role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={activeTab !== ADD_GROUP_TAB ? `tab-${activeTab}` : undefined}>
                {activeTab === ADD_GROUP_TAB ? (
                  <div className={styles.filterModalGroup} style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div className={styles.whatToBringBlock}>
                        <div className={styles.whatToBringIconCell}>
                          <div className={styles.whatToBringTypeSwitcher} role="group" aria-label="Источник иконки">
                            <button
                              type="button"
                              className={`${styles.whatToBringTypeSegment} ${newGroupIconType === 'upload' ? styles.whatToBringTypeSegmentActive : ''}`}
                              onClick={() => { setNewGroupIconType('upload'); setNewGroupIcon(''); }}
                            >
                              Загрузить
                            </button>
                            <button
                              type="button"
                              className={`${styles.whatToBringTypeSegment} ${newGroupIconType === 'library' ? styles.whatToBringTypeSegmentActive : ''}`}
                              onClick={() => { setNewGroupIconType('library'); setNewGroupIcon(''); }}
                            >
                              Библиотека
                            </button>
                          </div>
                          <div className={styles.whatToBringIconPreview}>
                            {newGroupIconType === 'upload' ? (
                              <>
                                <input
                                  type="file"
                                  accept="image/*"
                                  style={{ display: 'none' }}
                                  id="place-filter-group-icon-upload"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    setUploadingIcon(true);
                                    try {
                                      const fd = new FormData();
                                      fd.append('file', file);
                                      const res = await mediaAPI.upload(fd);
                                      setNewGroupIcon(res.data?.url ?? '');
                                    } catch (err) {
                                      console.error(err);
                                    } finally {
                                      setUploadingIcon(false);
                                    }
                                    e.target.value = '';
                                  }}
                                />
                                <label htmlFor="place-filter-group-icon-upload" className={styles.whatToBringUploadBtn}>
                                  {newGroupIcon ? (
                                    <img src={getImageUrl(newGroupIcon)} alt="" className={styles.whatToBringUploadImg} />
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
                                {newGroupIcon && getMuiIconComponent(newGroupIcon) ? (
                                  (() => {
                                    const Icon = getMuiIconComponent(newGroupIcon);
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
                          value={newGroupLabel}
                          onChange={(e) => setNewGroupLabel(e.target.value)}
                          placeholder="Название группы (например: Длина)"
                          aria-label="Название группы"
                        />
                      </div>
                      {uploadingIcon && <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Загрузка…</span>}
                      <button type="button" onClick={handleAddGroup} disabled={addingGroup || !newGroupLabel.trim()} className={styles.submitBtn} style={{ alignSelf: 'flex-start' }}>
                        {addingGroup ? '…' : 'Создать группу'}
                      </button>
                    </div>
                  </div>
                ) : currentGroup ? (
                  (() => {
                    const group = currentGroup.key;
                    const label = currentGroup.label;
                    const isEditingThisGroup = editingGroupKey === group;
                    return (
                      <div className={styles.filterModalGroup}>
                        <div className={styles.filterModalGroupTitle}>
                          <span>{label}</span>
                        </div>
                        {isEditingThisGroup && (
                          <div className={styles.filterModalEditGroupForm}>
                            <div className={styles.whatToBringBlock}>
                              <div className={styles.whatToBringIconCell}>
                                <div className={styles.whatToBringTypeSwitcher} role="group" aria-label="Источник иконки">
                                  <button
                                    type="button"
                                    className={`${styles.whatToBringTypeSegment} ${editGroupIconType === 'upload' ? styles.whatToBringTypeSegmentActive : ''}`}
                                    onClick={() => { setEditGroupIconType('upload'); setEditGroupIcon(''); }}
                                  >
                                    Загрузить
                                  </button>
                                  <button
                                    type="button"
                                    className={`${styles.whatToBringTypeSegment} ${editGroupIconType === 'library' ? styles.whatToBringTypeSegmentActive : ''}`}
                                    onClick={() => { setEditGroupIconType('library'); setEditGroupIcon(''); }}
                                  >
                                    Библиотека
                                  </button>
                                </div>
                                <div className={styles.whatToBringIconPreview}>
                                  {editGroupIconType === 'upload' ? (
                                    <>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                        id="place-filter-edit-group-icon-upload"
                                        onChange={async (e) => {
                                          const file = e.target.files?.[0];
                                          if (!file) return;
                                          setUploadingIcon(true);
                                          try {
                                            const fd = new FormData();
                                            fd.append('file', file);
                                            const res = await mediaAPI.upload(fd);
                                            setEditGroupIcon(res.data?.url ?? '');
                                          } catch (err) {
                                            console.error(err);
                                          } finally {
                                            setUploadingIcon(false);
                                          }
                                          e.target.value = '';
                                        }}
                                      />
                                      <label htmlFor="place-filter-edit-group-icon-upload" className={styles.whatToBringUploadBtn}>
                                        {editGroupIcon ? (
                                          <img src={getImageUrl(editGroupIcon)} alt="" className={styles.whatToBringUploadImg} />
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
                                      {editGroupIcon && getMuiIconComponent(editGroupIcon) ? (
                                        (() => {
                                          const Icon = getMuiIconComponent(editGroupIcon);
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
                                value={editGroupLabel}
                                onChange={(e) => setEditGroupLabel(e.target.value)}
                                placeholder="Название группы"
                                aria-label="Название группы"
                              />
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                              <button type="button" onClick={applyEditGroup} className={styles.submitBtn} disabled={!editGroupLabel.trim() || savingGroupMeta}>
                                {savingGroupMeta ? 'Сохранение...' : 'Сохранить изменения'}
                              </button>
                              <button type="button" onClick={cancelEditGroup} className={styles.cancelBtn}>
                                Отмена
                              </button>
                            </div>
                          </div>
                        )}
                        {!isEditingThisGroup && (
                        <>
                        <div className={styles.filterModalValues}>
                          {(getValues(group) || []).map((v) => {
                            const isEditing = editing?.group === group && editing?.value === v;
                            return (
                              <div key={v} className={styles.filterModalValueRow} style={isEditing ? { minWidth: 220, flex: '1 1 220px' } : undefined}>
                                {isEditing ? (
                                  <>
                                    <input
                                      ref={editInputRef}
                                      type="text"
                                      value={editingInput}
                                      onChange={(e) => setEditingInput(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') { e.preventDefault(); applyEdit(); }
                                        if (e.key === 'Escape') cancelEdit();
                                      }}
                                      className={styles.filterModalAddInput}
                                      style={{ minWidth: 120, flex: 1 }}
                                      aria-label="Новое значение"
                                    />
                                    <button type="button" onClick={applyEdit} disabled={savingEdit || !editingInput.trim() || editingInput.trim() === v} className={styles.filterModalValueApply} title="Применить" aria-label="Применить"><Check size={14} /></button>
                                    <button type="button" onClick={cancelEdit} className={styles.filterModalValueCancel} title="Отмена" aria-label="Отмена"><X size={14} /></button>
                                  </>
                                ) : (
                                  <>
                                    <span>{v}</span>
                                    <button type="button" onClick={() => startEdit(group, v)} className={styles.filterModalValueEdit} title="Изменить" aria-label={`Изменить ${v}`}><Pencil size={14} /></button>
                                    <button type="button" onClick={() => removeValue(group, v)} className={styles.filterModalValueDelete} title="Удалить" aria-label={`Удалить ${v}`}><Trash2 size={14} /></button>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className={styles.filterModalAddRow}>
                          <input
                            type="text"
                            value={newValues[group] ?? ''}
                            onChange={(e) => setNewValues((prev) => ({ ...prev, [group]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addValue(group, newValues[group]); } }}
                            placeholder={`Добавить в ${label.toLowerCase()}...`}
                            className={styles.filterModalAddInput}
                            aria-label={`Добавить значение в ${label}`}
                          />
                          <button type="button" onClick={() => addValue(group, newValues[group])} className={styles.addBtn} style={{ flexShrink: 0 }}>
                            <Plus size={16} /> Добавить
                          </button>
                        </div>
                        </>
                        )}
                      </div>
                    );
                  })()
                ) : null}
              </div>
            </>
          )}
        </div>
        <div className={styles.modalFooter}>
          <button type="button" onClick={onClose} className={styles.cancelBtn}>
            Отмена
          </button>
          <button type="button" onClick={handleSave} disabled={loading || saving} className={styles.submitBtn}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
      <ConfirmModal
        open={!!removeGroupConfirmKey}
        title="Удалить группу?"
        message={removeGroupConfirmKey ? `Удалить группу «${groupList.find((g) => g.key === removeGroupConfirmKey)?.label ?? removeGroupConfirmKey}»? Значения будут удалены у всех мест.` : ''}
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        variant="danger"
        onConfirm={() => {
          const k = removeGroupConfirmKey;
          setRemoveGroupConfirmKey(null);
          if (k) handleRemoveGroup(k);
        }}
        onCancel={() => setRemoveGroupConfirmKey(null)}
      />
      {open && iconPickerOpen && typeof document !== 'undefined' && createPortal(
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
                const currentPickingIcon = editingGroupKey ? editGroupIcon : newGroupIcon;
                const setPickingIcon = (name) => {
                  if (editingGroupKey) {
                    setEditGroupIcon(name);
                  } else {
                    setNewGroupIcon(name);
                  }
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
                            className={`${styles.whatToBringIconGridItem} ${currentPickingIcon === name ? styles.routeFilterIconSelected : ''}`}
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
    </div>
  );
}
