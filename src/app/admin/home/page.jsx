'use client';

import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { Upload, Plus, X, Pencil, GripVertical, Image, Route, Calendar, HelpCircle, Briefcase, MapPin, Layers, Megaphone, ExternalLink } from 'lucide-react';
import { homeAPI, mediaAPI, placesAPI, newsAPI, getImageUrl } from '@/lib/api';
import { stripHtml } from '@/lib/utils';
import { AdminHeaderRightContext } from '../layout';
import ImageCropModal from '../components/ImageCropModal';
import FooterLinkSelector from '../footer/FooterLinkSelector';
import RichTextEditor from '@/components/RichTextEditor';
import styles from '../admin.module.css';

// Ссылки из хедера сайта для выпадающих списков кнопок
const HEADER_LINKS = [
  { value: '/', label: 'Главная' },
  { value: '/region', label: 'О регионе' },
  { value: '/routes', label: 'Маршруты' },
  { value: '/places', label: 'Места' },
  { value: '/news', label: 'Новости' },
  { value: '/services', label: 'Услуги' },
  { value: '/search', label: 'Поиск' },
];

const DEFAULT_CONTENT = {
  routesTitle: 'Маршруты',
  routesButtonLink: '/routes',
  seasons: [
    {
      title: 'Зима',
      bgColor: '#73BFE7',
      patternColor: '#296587',
      logo: 'logoPattern1.png',
      routeLink: '/routes?seasons=Зима',
    },
    {
      title: 'Весна',
      bgColor: '#FF9397',
      patternColor: '#DB224A',
      logo: 'logoPattern2.png',
      routeLink: '/routes?seasons=Весна',
    },
    {
      title: 'Лето',
      bgColor: '#66D7CA',
      patternColor: '#156A60',
      logo: 'logoPattern3.png',
      routeLink: '/routes?seasons=Лето',
    },
    {
      title: 'Осень',
      bgColor: '#CD8A67',
      patternColor: '#7C4B42',
      logo: 'logoPattern4.png',
      routeLink: '/routes?seasons=Осень',
    },
  ],
  firstTimeTitle: 'ВПЕРВЫЕ В КЧР?',
  firstTimeDesc: 'Специально для вас мы создали раздел, в котором собрали всю полезную информацию, чтобы помочь сделать ваше путешествие по нашей удивительной республике комфортным, интересным и незабываемым!',
  firstTimeArticles: [], // Массив выбранных статей для секции "ВПЕРВЫЕ В КЧР?"
  servicesTitle: 'СЕРВИС И УСЛУГИ',
  servicesButtonLink: '/services',
  servicesCardsLimit: 8, // Максимальное количество карточек услуг в каждом табе
  placesTitle: 'КУДА ПОЕХАТЬ?',
  placesButtonLink: '/places',
  placesItems: [], // Массив выбранных мест для блока "Куда поехать?"
  backgroundImage: '/mountainBG.png',
  sliderPlaces: [], // Массив выбранных мест для главного слайдера
  banners: [], // Массив баннеров: [{ id, image, link, isActive, isPermanent }]
};

function ensureContent(c) {
  return {
    routesTitle: c?.routesTitle ?? DEFAULT_CONTENT.routesTitle,
    routesButtonLink: c?.routesButtonLink ?? DEFAULT_CONTENT.routesButtonLink,
    seasons: Array.isArray(c?.seasons) && c.seasons.length === 4
      ? c.seasons.map((s, i) => ({
          title: s.title ?? DEFAULT_CONTENT.seasons[i].title,
          bgColor: s.bgColor ?? DEFAULT_CONTENT.seasons[i].bgColor,
          patternColor: s.patternColor ?? DEFAULT_CONTENT.seasons[i].patternColor,
          logo: s.logo ?? DEFAULT_CONTENT.seasons[i].logo,
          routeLink: s.routeLink ?? DEFAULT_CONTENT.seasons[i].routeLink,
        }))
      : DEFAULT_CONTENT.seasons,
    firstTimeTitle: c?.firstTimeTitle ?? DEFAULT_CONTENT.firstTimeTitle,
    firstTimeDesc: c?.firstTimeDesc ?? DEFAULT_CONTENT.firstTimeDesc,
    firstTimeArticles: Array.isArray(c?.firstTimeArticles) ? c.firstTimeArticles : [],
    servicesTitle: c?.servicesTitle ?? DEFAULT_CONTENT.servicesTitle,
    servicesButtonLink: c?.servicesButtonLink ?? DEFAULT_CONTENT.servicesButtonLink,
    servicesCardsLimit: typeof c?.servicesCardsLimit === 'number' && c.servicesCardsLimit > 0 ? c.servicesCardsLimit : DEFAULT_CONTENT.servicesCardsLimit,
    placesTitle: c?.placesTitle ?? DEFAULT_CONTENT.placesTitle,
    banners: Array.isArray(c?.banners) ? c.banners : DEFAULT_CONTENT.banners,
    placesButtonLink: c?.placesButtonLink ?? DEFAULT_CONTENT.placesButtonLink,
    placesItems: Array.isArray(c?.placesItems) ? c.placesItems : [],
    backgroundImage: c?.backgroundImage ?? DEFAULT_CONTENT.backgroundImage,
    sliderPlaces: Array.isArray(c?.sliderPlaces) ? c.sliderPlaces : [],
  };
}

export default function AdminHomePage() {
  const [content, setContent] = useState(ensureContent(null));
  const [pendingImages, setPendingImages] = useState({}); // { path: { file, preview } }
  const [allPlaces, setAllPlaces] = useState([]);
  const [filteredPlaces, setFilteredPlaces] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [addSliderPlacesModalOpen, setAddSliderPlacesModalOpen] = useState(false);
  const [sliderDraggedIndex, setSliderDraggedIndex] = useState(null);
  const [sliderDragOverIndex, setSliderDragOverIndex] = useState(null);
  const sliderLastDragOverRef = useRef(null);
  const [addPlacesItemsModalOpen, setAddPlacesItemsModalOpen] = useState(false);
  const [placesItemsSearchQuery, setPlacesItemsSearchQuery] = useState('');
  const [placesItemsDraggedIndex, setPlacesItemsDraggedIndex] = useState(null);
  const [placesItemsDragOverIndex, setPlacesItemsDragOverIndex] = useState(null);
  const placesItemsLastDragOverRef = useRef(null);
  const [allArticles, setAllArticles] = useState([]);
  const [filteredArticles, setFilteredArticles] = useState([]);
  const [articlesSearchQuery, setArticlesSearchQuery] = useState('');
  const [addArticlesModalOpen, setAddArticlesModalOpen] = useState(false);
  const [articlesDraggedIndex, setArticlesDraggedIndex] = useState(null);
  const [articlesDragOverIndex, setArticlesDragOverIndex] = useState(null);
  const articlesLastDragOverRef = useRef(null);
  const [seasonCropModalOpen, setSeasonCropModalOpen] = useState(false);
  const [seasonCropModalImageSrc, setSeasonCropModalImageSrc] = useState(null);
  const [seasonCropModalIndex, setSeasonCropModalIndex] = useState(null);
  const seasonCropModalFileUrlRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [savedVersion, setSavedVersion] = useState(0);
  const savedContentRef = useRef(null);
  const setHeaderRight = useContext(AdminHeaderRightContext)?.setHeaderRight;

  const hasPendingImages = Object.keys(pendingImages).length > 0;
  const isDirty = savedContentRef.current != null && (JSON.stringify(content) !== JSON.stringify(savedContentRef.current) || hasPendingImages);

  const fetchHome = useCallback(async () => {
    try {
      const res = await homeAPI.get();
      const c = ensureContent(res.data?.content);
      setContent(c);
      savedContentRef.current = JSON.parse(JSON.stringify(c));
    } catch (e) {
      console.error('Ошибка загрузки главной:', e);
      setContent(ensureContent(DEFAULT_CONTENT));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHome();
  }, [fetchHome]);

  const fetchPlaces = useCallback(async () => {
    try {
      const res = await placesAPI.getAll({ page: 1, limit: 500 });
      // Фильтруем только активные места
      const activePlaces = (res.data?.items || []).filter(place => place.isActive === true);
      setAllPlaces(activePlaces);
      setFilteredPlaces(activePlaces);
    } catch (e) {
      console.error('Ошибка загрузки мест:', e);
      setAllPlaces([]);
      setFilteredPlaces([]);
    }
  }, []);

  useEffect(() => {
    fetchPlaces();
  }, [fetchPlaces]);

  // Фильтрация мест по поисковому запросу для слайдера
  useEffect(() => {
    if (!searchQuery.trim()) {
      // Если нет поиска для слайдера, но есть для блока мест, используем общий список
      if (!placesItemsSearchQuery.trim()) {
        setFilteredPlaces(allPlaces);
      }
      return;
    }
    const query = searchQuery.toLowerCase().trim();
    const filtered = allPlaces.filter(place => {
      const title = (place.title || '').toLowerCase();
      const location = (place.location || '').toLowerCase();
      const description = stripHtml(place.description || place.shortDescription || '').toLowerCase();
      return title.includes(query) || location.includes(query) || description.includes(query);
    });
    setFilteredPlaces(filtered);
  }, [searchQuery, allPlaces, placesItemsSearchQuery]);

  // Фильтрация мест по поисковому запросу для блока "Куда поехать?"
  const getFilteredPlacesForItems = useCallback(() => {
    if (!placesItemsSearchQuery.trim()) {
      return allPlaces;
    }
    const query = placesItemsSearchQuery.toLowerCase().trim();
    return allPlaces.filter(place => {
      const title = (place.title || '').toLowerCase();
      const location = (place.location || '').toLowerCase();
      const description = stripHtml(place.description || place.shortDescription || '').toLowerCase();
      return title.includes(query) || location.includes(query) || description.includes(query);
    });
  }, [placesItemsSearchQuery, allPlaces]);

  const fetchArticles = useCallback(async () => {
    try {
      const res = await newsAPI.getAll({ page: 1, limit: 500 });
      // Фильтруем только активные статьи (type: 'article')
      const activeArticles = (res.data?.items || []).filter(article => 
        article.isActive === true && article.type === 'article'
      );
      setAllArticles(activeArticles);
      setFilteredArticles(activeArticles);
    } catch (e) {
      console.error('Ошибка загрузки статей:', e);
      setAllArticles([]);
      setFilteredArticles([]);
    }
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  // Фильтрация статей по поисковому запросу
  useEffect(() => {
    if (!articlesSearchQuery.trim()) {
      setFilteredArticles(allArticles);
      return;
    }
    const query = articlesSearchQuery.toLowerCase().trim();
    const filtered = allArticles.filter(article => {
      const title = (article.title || '').toLowerCase();
      const description = stripHtml(article.shortDescription || article.description || '').toLowerCase();
      return title.includes(query) || description.includes(query);
    });
    setFilteredArticles(filtered);
  }, [articlesSearchQuery, allArticles]);

  const pendingImagesRef = useRef(pendingImages);
  pendingImagesRef.current = pendingImages;
  useEffect(() => {
    return () => {
      for (const { preview } of Object.values(pendingImagesRef.current)) {
        URL.revokeObjectURL(preview);
      }
      if (seasonCropModalFileUrlRef.current) {
        URL.revokeObjectURL(seasonCropModalFileUrlRef.current);
      }
    };
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
      const res = await homeAPI.update(contentToSave);
      for (const path of paths) {
        URL.revokeObjectURL(pendingImages[path].preview);
      }
      setPendingImages({});
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
  }, [content, pendingImages]);

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
        if (!isNaN(idx)) {
          cur = cur[idx];
        } else {
          if (!cur[p]) cur[p] = {};
          cur = cur[p];
        }
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
    setContent((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const parts = path.split('.');
      let cur = next;
      for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
      cur[parts[parts.length - 1]].splice(index, 1);
      return next;
    });
  };

  const placeToSliderItem = (p) => ({
    placeId: p.id,
    slug: p.slug || p.id,
    title: p.title || '',
    location: p.location || '',
    image: p.images?.[0] || p.image || '',
    shortDescription: stripHtml(p.shortDescription || p.description || '') || '',
    rating: p.rating != null ? String(p.rating) : null,
    reviewsCount: p.reviewsCount ?? 0,
    sliderVideo: p.sliderVideo || null,
  });

  const addPlaceToSlider = (place) => {
    const currentIds = new Set((content.sliderPlaces || []).map((i) => i.placeId).filter(Boolean));
    if (currentIds.has(place.id)) return;
    addArrayItem('sliderPlaces', placeToSliderItem(place));
  };

  const moveSliderPlaceByDrag = (draggedIndex, targetIndex) => {
    if (draggedIndex === targetIndex) return;
    setContent((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const places = [...(next.sliderPlaces || [])];
      const [removed] = places.splice(draggedIndex, 1);
      places.splice(targetIndex, 0, removed);
      next.sliderPlaces = places;
      return next;
    });
  };

  const articleToSliderItem = (a) => ({
    articleId: a.id,
    slug: a.slug || a.id,
    title: a.title || '',
    image: a.images?.[0] || a.image || a.preview || '',
  });

  const addArticleToSlider = (article) => {
    const currentIds = new Set((content.firstTimeArticles || []).map((i) => i.articleId).filter(Boolean));
    if (currentIds.has(article.id)) return;
    addArrayItem('firstTimeArticles', articleToSliderItem(article));
  };

  const moveArticleByDrag = (draggedIndex, targetIndex) => {
    if (draggedIndex === targetIndex) return;
    setContent((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const articles = [...(next.firstTimeArticles || [])];
      const [removed] = articles.splice(draggedIndex, 1);
      articles.splice(targetIndex, 0, removed);
      next.firstTimeArticles = articles;
      return next;
    });
  };

  const placeToPlacesItem = (p) => ({
    placeId: p.id,
    slug: p.slug || p.id,
    title: p.title || '',
    location: p.location || '',
    image: p.images?.[0] || p.image || '',
    shortDescription: stripHtml(p.shortDescription || p.description || '') || '',
    rating: p.rating != null ? String(p.rating) : null,
    reviewsCount: p.reviewsCount ?? 0,
  });

  const addPlaceToPlacesItems = (place) => {
    const currentIds = new Set((content.placesItems || []).map((i) => i.placeId).filter(Boolean));
    if (currentIds.has(place.id)) return;
    addArrayItem('placesItems', placeToPlacesItem(place));
  };

  const movePlaceItemByDrag = (draggedIndex, targetIndex) => {
    if (draggedIndex === targetIndex) return;
    setContent((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const places = [...(next.placesItems || [])];
      const [removed] = places.splice(draggedIndex, 1);
      places.splice(targetIndex, 0, removed);
      next.placesItems = places;
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

  const handleSeasonLogoFileSelect = (seasonIndex, e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (seasonCropModalFileUrlRef.current) URL.revokeObjectURL(seasonCropModalFileUrlRef.current);
    const url = URL.createObjectURL(file);
    seasonCropModalFileUrlRef.current = url;
    setSeasonCropModalImageSrc(url);
    setSeasonCropModalIndex(seasonIndex);
    setSeasonCropModalOpen(true);
  };

  const openSeasonLogoCropModal = (seasonIndex) => {
    const logoPath = `seasons.${seasonIndex}.logo`;
    const src = getImageSrc(logoPath);
    if (!src) return;
    if (seasonCropModalFileUrlRef.current) URL.revokeObjectURL(seasonCropModalFileUrlRef.current);
    seasonCropModalFileUrlRef.current = null;
    setSeasonCropModalImageSrc(src);
    setSeasonCropModalIndex(seasonIndex);
    setSeasonCropModalOpen(true);
  };

  const handleSeasonCropComplete = (blob) => {
    if (seasonCropModalIndex == null) return;
    const file = new File([blob], `season-${seasonCropModalIndex}-logo.png`, { type: 'image/png' });
    const logoPath = `seasons.${seasonCropModalIndex}.logo`;
    setPendingImages((prev) => {
      const old = prev[logoPath];
      if (old) URL.revokeObjectURL(old.preview);
      return { ...prev, [logoPath]: { file, preview: URL.createObjectURL(file) } };
    });
    setSeasonCropModalOpen(false);
    setSeasonCropModalImageSrc(null);
    setSeasonCropModalIndex(null);
    if (seasonCropModalFileUrlRef.current) {
      URL.revokeObjectURL(seasonCropModalFileUrlRef.current);
      seasonCropModalFileUrlRef.current = null;
    }
  };

  const handleSeasonCropCancel = () => {
    setSeasonCropModalOpen(false);
    setSeasonCropModalImageSrc(null);
    setSeasonCropModalIndex(null);
    if (seasonCropModalFileUrlRef.current) {
      URL.revokeObjectURL(seasonCropModalFileUrlRef.current);
      seasonCropModalFileUrlRef.current = null;
    }
  };

  const clearSeasonLogo = (seasonIndex) => {
    const logoPath = `seasons.${seasonIndex}.logo`;
    clearImage(logoPath);
  };

  // Функции для управления баннерами
  const addBanner = () => {
    const newBanner = {
      id: `banner-${Date.now()}`,
      image: '',
      link: '',
      linkType: undefined,
      linkValue: undefined,
      isActive: true,
    };
    setContent((prev) => ({
      ...prev,
      banners: [...(prev.banners || []), newBanner],
    }));
  };

  // Преобразует banner.link в формат для FooterLinkSelector
  const getBannerLinkValue = (banner) => {
    if (!banner.link) {
      return { text: '', url: '', linkType: undefined, linkValue: undefined };
    }
    
    // Если уже есть linkType и linkValue, используем их
    if (banner.linkType && banner.linkValue !== undefined) {
      return {
        text: banner.linkText || '',
        url: banner.link,
        linkType: banner.linkType,
        linkValue: banner.linkValue,
      };
    }
    
    // Определяем тип ссылки из URL
    const isExternal = banner.link.startsWith('http://') || banner.link.startsWith('https://');
    if (isExternal) {
      return {
        text: '',
        url: banner.link,
        linkType: 'external',
        linkValue: '',
      };
    }
    
    // Проверяем, является ли это статической страницей
    const staticPage = HEADER_LINKS.find(opt => opt.value === banner.link);
    if (staticPage) {
      return {
        text: staticPage.label,
        url: banner.link,
        linkType: 'static',
        linkValue: banner.link,
      };
    }
    
    // Пытаемся определить тип по паттерну URL
    if (banner.link.startsWith('/news/')) {
      const slug = banner.link.replace('/news/', '');
      return {
        text: '',
        url: banner.link,
        linkType: 'news',
        linkValue: slug,
      };
    }
    if (banner.link.startsWith('/places/')) {
      const slug = banner.link.replace('/places/', '');
      return {
        text: '',
        url: banner.link,
        linkType: 'place',
        linkValue: slug,
      };
    }
    if (banner.link.startsWith('/routes/')) {
      const slug = banner.link.replace('/routes/', '');
      return {
        text: '',
        url: banner.link,
        linkType: 'route',
        linkValue: slug,
      };
    }
    if (banner.link.startsWith('/services/')) {
      const slug = banner.link.replace('/services/', '');
      return {
        text: '',
        url: banner.link,
        linkType: 'service',
        linkValue: slug,
      };
    }
    
    // По умолчанию считаем статической страницей
    return {
      text: '',
      url: banner.link,
      linkType: 'static',
      linkValue: banner.link,
    };
  };

  const handleBannerLinkChange = (index, linkData) => {
    setContent((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next.banners) next.banners = [];
      if (next.banners[index]) {
        next.banners[index].link = linkData.url || '';
        next.banners[index].linkType = linkData.linkType;
        next.banners[index].linkValue = linkData.linkValue;
        next.banners[index].linkText = linkData.text;
      }
      return next;
    });
  };

  const updateBanner = (index, field, value) => {
    setContent((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next.banners) next.banners = [];
      if (next.banners[index]) {
        next.banners[index][field] = value;
      }
      return next;
    });
  };

  const removeBanner = (index) => {
    setContent((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const banner = next.banners?.[index];
      if (banner?.image) {
        const imagePath = `banners.${index}.image`;
        if (pendingImages[imagePath]) {
          URL.revokeObjectURL(pendingImages[imagePath].preview);
          const newPending = { ...pendingImages };
          delete newPending[imagePath];
          setPendingImages(newPending);
        }
      }
      next.banners = next.banners.filter((_, i) => i !== index);
      return next;
    });
  };

  const handleBannerImageFileSelect = (bannerIndex, e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const imagePath = `banners.${bannerIndex}.image`;
    setPendingImages((prev) => {
      const old = prev[imagePath];
      if (old) URL.revokeObjectURL(old.preview);
      return { ...prev, [imagePath]: { file, preview: URL.createObjectURL(file) } };
    });
  };

  const clearBannerImage = (bannerIndex) => {
    const imagePath = `banners.${bannerIndex}.image`;
    clearImage(imagePath);
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
          <h1 className={styles.pageTitle}>Главная</h1>
          <p className={styles.pageSubtitle}>Редактирование контента главной страницы</p>
        </div>
      </div>

      <div className={styles.formContainer}>
        {/* Hero Slider Section */}
        <div style={{ 
          background: '#fff', 
          borderRadius: 12, 
          padding: 24, 
          marginBottom: 24,
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ 
              width: 40, 
              height: 40, 
              borderRadius: 8, 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white'
            }}>
              <Image size={20} />
            </div>
            <div>
              <h2 className={styles.sectionTitle} style={{ marginBottom: 4 }}>Главный слайдер</h2>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>Большой слайдер в верхней части главной страницы</p>
            </div>
          </div>
          <div style={{ marginTop: 20 }}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Выбранные места для слайдера</label>
            <p className={styles.imageHint} style={{ marginBottom: 12 }}>
              Выберите места из списка ниже. Порядок можно изменить перетаскиванием. Рекомендуется выбрать до 6 мест.
            </p>
            {(content.sliderPlaces ?? []).length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                {(content.sliderPlaces ?? []).map((item, i) => (
                  <div
                    key={`${item.placeId}-${i}`}
                    draggable
                    onDragStart={(e) => {
                      const img = document.createElement('canvas');
                      img.width = 1;
                      img.height = 1;
                      e.dataTransfer.setDragImage(img, 0, 0);
                      e.dataTransfer.setData('text/plain', String(i));
                      e.dataTransfer.effectAllowed = 'move';
                      setSliderDraggedIndex(i);
                      sliderLastDragOverRef.current = null;
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (
                        sliderDraggedIndex != null &&
                        sliderDraggedIndex !== i &&
                        sliderLastDragOverRef.current !== i
                      ) {
                        sliderLastDragOverRef.current = i;
                        moveSliderPlaceByDrag(sliderDraggedIndex, i);
                        setSliderDraggedIndex(i);
                      }
                      setSliderDragOverIndex(i);
                    }}
                    onDragLeave={() => setSliderDragOverIndex((idx) => (idx === i ? null : idx))}
                    onDrop={(e) => {
                      e.preventDefault();
                      setSliderDraggedIndex(null);
                      setSliderDragOverIndex(null);
                      sliderLastDragOverRef.current = null;
                    }}
                    onDragEnd={() => {
                      setSliderDraggedIndex(null);
                      setSliderDragOverIndex(null);
                      sliderLastDragOverRef.current = null;
                    }}
                    style={{
                      width: 140,
                      position: 'relative',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      overflow: 'hidden',
                      cursor: 'move',
                      opacity: sliderDraggedIndex === i ? 0.5 : 1,
                      borderColor: sliderDragOverIndex === i ? '#3b82f6' : '#e5e7eb',
                      boxShadow: sliderDragOverIndex === i ? '0 0 0 2px #3b82f6' : 'none',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ position: 'absolute', top: 4, left: 4, zIndex: 2, background: 'rgba(255,255,255,0.9)', borderRadius: 4, padding: 2 }}>
                      <GripVertical size={14} color="#6b7280" />
                    </div>
                    <img src={getImageUrl(item.image)} alt="" style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />
                    <div style={{ padding: 8, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.title}>{item.title || item.location || 'Место'}</div>
                    <button type="button" onClick={() => removeArrayItem('sliderPlaces', i)} className={styles.removeImage} style={{ position: 'absolute', top: 4, right: 4, zIndex: 2 }} aria-label="Удалить" title="Удалить"><X size={14} /></button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#6b7280', marginBottom: 12 }}>Места не выбраны. Если не выбрано ни одного места, будут показаны первые активные места из базы данных.</p>
            )}
            <button type="button" onClick={() => { setAddSliderPlacesModalOpen(true); setSearchQuery(''); }} className={styles.addBtn}>
              <Plus size={18} /> Выбрать места для слайдера
            </button>
          </div>

          {addSliderPlacesModalOpen && (
            <div
              className={styles.modalOverlay}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setAddSliderPlacesModalOpen(false);
                  setSearchQuery('');
                }
              }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-slider-places-title"
            >
              <div className={styles.modalDialog} style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                  <h2 id="add-slider-places-title" className={styles.modalTitle}>Выбрать места для слайдера</h2>
                  <button type="button" onClick={() => { setAddSliderPlacesModalOpen(false); setSearchQuery(''); }} className={styles.modalClose} aria-label="Закрыть"><X size={20} /></button>
                </div>
                <div className={styles.modalBody}>
                  <div className={styles.formAddPlaceSearch}>
                    <input
                      type="text"
                      placeholder="Поиск мест для добавления..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={styles.formInput}
                      aria-label="Поиск мест"
                    />
                  </div>
                  {filteredPlaces.filter((p) => !(content.sliderPlaces ?? []).some((i) => i.placeId === p.id)).length > 0 ? (
                    <div className={styles.formAddPlaceList} style={{ maxHeight: 360 }}>
                      {filteredPlaces
                        .filter((p) => !(content.sliderPlaces ?? []).some((i) => i.placeId === p.id))
                        .map((p) => (
                          <div
                            key={p.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => addPlaceToSlider(p)}
                            onKeyDown={(e) => e.key === 'Enter' && addPlaceToSlider(p)}
                            className={styles.formAddPlaceItem}
                          >
                            {(p.images?.[0] || p.image) && (
                              <img src={getImageUrl(p.images?.[0] || p.image)} alt="" />
                            )}
                            <div className={styles.formAddPlaceItemTitle}>
                              <div>{p.title}</div>
                              {p.location && (
                                <div className={styles.formAddPlaceItemSub}>{p.location}</div>
                              )}
                            </div>
                            <span className={styles.formAddPlaceLabel}>+ Добавить</span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className={styles.formEmptyHint}>
                      {searchQuery ? 'Ничего не найдено' : 'Все активные места уже добавлены'}
                    </div>
                  )}
                </div>
                <div className={styles.modalFooter}>
                  <button type="button" onClick={() => { setAddSliderPlacesModalOpen(false); setSearchQuery(''); }} className={styles.submitBtn}>Готово</button>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Content Sections Group */}
        <div style={{ 
          background: '#fff', 
          borderRadius: 12, 
          padding: 24, 
          marginBottom: 24,
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ 
              width: 40, 
              height: 40, 
              borderRadius: 8, 
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white'
            }}>
              <Layers size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Секции контента</h2>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>Настройки заголовков и ссылок основных разделов</p>
            </div>
          </div>

          {/* Routes Section */}
          <section className={styles.formSection} style={{ marginBottom: 32, paddingBottom: 24, borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Route size={18} color="#2563eb" />
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', margin: 0 }}>Секция «Маршруты»</h3>
            </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Заголовок</label>
            <input
              type="text"
              value={content.routesTitle ?? ''}
              onChange={(e) => update('routesTitle', e.target.value)}
              className={styles.formInput}
              placeholder="Маршруты"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Ссылка кнопки</label>
            <select
              value={content.routesButtonLink ?? '/routes'}
              onChange={(e) => update('routesButtonLink', e.target.value)}
              className={styles.formSelect}
            >
              {HEADER_LINKS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          </section>

          {/* Seasons */}
          <section className={styles.formSection} style={{ marginBottom: 32, paddingBottom: 24, borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Calendar size={18} color="#10b981" />
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', margin: 0 }}>Баннеры сезонов</h3>
            </div>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: 16 }}>Четыре баннера для разных сезонов года</p>
          {(content.seasons ?? []).map((season, i) => (
            <div key={i} className={styles.formGroup} style={{ border: '1px solid #e5e7eb', padding: 16, borderRadius: 10, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span className={styles.formLabel}>Сезон: {season.title}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label className={styles.formLabel}>Название</label>
                  <input
                    type="text"
                    value={season.title ?? ''}
                    onChange={(e) => updateArray('seasons', i, 'title', e.target.value)}
                    className={styles.formInput}
                    placeholder="Зима"
                  />
                </div>
                <div>
                  <label className={styles.formLabel}>Ссылка</label>
                  <input
                    type="text"
                    value={season.routeLink ?? ''}
                    onChange={(e) => updateArray('seasons', i, 'routeLink', e.target.value)}
                    className={styles.formInput}
                    placeholder="/routes?seasons=Зима"
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label className={styles.formLabel}>Цвет фона</label>
                  <input
                    type="color"
                    value={season.bgColor ?? '#73BFE7'}
                    onChange={(e) => updateArray('seasons', i, 'bgColor', e.target.value)}
                    className={styles.formInput}
                    style={{ height: 40 }}
                  />
                </div>
                <div>
                  <label className={styles.formLabel}>Цвет паттерна</label>
                  <input
                    type="color"
                    value={season.patternColor ?? '#296587'}
                    onChange={(e) => updateArray('seasons', i, 'patternColor', e.target.value)}
                    className={styles.formInput}
                    style={{ height: 40 }}
                  />
                </div>
              </div>
              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label className={styles.formLabel}>Логотип</label>
                <p className={styles.imageHint} style={{ marginBottom: 12 }}>
                  Изображение для баннера сезона. Рекомендуется квадратное изображение.
                </p>
                <div className={styles.imageUpload}>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    id={`seasonLogoUpload-${i}`}
                    onChange={(e) => handleSeasonLogoFileSelect(i, e)}
                  />
                  <label
                    htmlFor={`seasonLogoUpload-${i}`}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}
                  >
                    <Upload size={20} /> Загрузить логотип
                  </label>
                </div>
                {hasImage(`seasons.${i}.logo`) && (
                  <div className={styles.imagePreview} style={{ marginTop: 12 }}>
                    <div className={styles.previewItem} style={{ width: 200, aspectRatio: '1/1', position: 'relative', overflow: 'hidden', borderRadius: 8 }}>
                      <img src={getImageSrc(`seasons.${i}.logo`)} alt={`Логотип ${season.title}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', flexDirection: 'row', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => openSeasonLogoCropModal(i)}
                          className={styles.removeImage}
                          style={{ position: 'relative', top: 0, right: 0 }}
                          aria-label="Обрезать"
                          title="Обрезать"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => document.getElementById(`seasonLogoUpload-${i}`)?.click()}
                          className={styles.removeImage}
                          style={{ position: 'relative', top: 0, right: 0 }}
                          aria-label="Заменить файл"
                          title="Заменить файл"
                        >
                          <Upload size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => clearSeasonLogo(i)}
                          className={styles.removeImage}
                          style={{ position: 'relative', top: 0, right: 0 }}
                          aria-label="Удалить"
                          title="Удалить"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          </section>

          {/* First Time Section */}
          <section className={styles.formSection} style={{ marginBottom: 32, paddingBottom: 24, borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <HelpCircle size={18} color="#f59e0b" />
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', margin: 0 }}>Секция «ВПЕРВЫЕ В КЧР?»</h3>
            </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Заголовок</label>
            <input
              type="text"
              value={content.firstTimeTitle ?? ''}
              onChange={(e) => update('firstTimeTitle', e.target.value)}
              className={styles.formInput}
              placeholder="ВПЕРВЫЕ В КЧР?"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Описание</label>
            <RichTextEditor
              value={content.firstTimeDesc ?? ''}
              onChange={(val) => update('firstTimeDesc', val)}
              placeholder="Специально для вас мы создали раздел..."
              minHeight={200}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Выбранные статьи</label>
            <p className={styles.imageHint} style={{ marginBottom: 12 }}>
              Выберите статьи из списка ниже. Порядок можно изменить перетаскиванием. Рекомендуется выбрать до 8 статей.
            </p>
            {(content.firstTimeArticles ?? []).length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                {(content.firstTimeArticles ?? []).map((item, i) => (
                  <div
                    key={`${item.articleId}-${i}`}
                    draggable
                    onDragStart={(e) => {
                      const img = document.createElement('canvas');
                      img.width = 1;
                      img.height = 1;
                      e.dataTransfer.setDragImage(img, 0, 0);
                      e.dataTransfer.setData('text/plain', String(i));
                      e.dataTransfer.effectAllowed = 'move';
                      setArticlesDraggedIndex(i);
                      articlesLastDragOverRef.current = null;
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (
                        articlesDraggedIndex != null &&
                        articlesDraggedIndex !== i &&
                        articlesLastDragOverRef.current !== i
                      ) {
                        articlesLastDragOverRef.current = i;
                        moveArticleByDrag(articlesDraggedIndex, i);
                        setArticlesDraggedIndex(i);
                      }
                      setArticlesDragOverIndex(i);
                    }}
                    onDragLeave={() => setArticlesDragOverIndex((idx) => (idx === i ? null : idx))}
                    onDrop={(e) => {
                      e.preventDefault();
                      setArticlesDraggedIndex(null);
                      setArticlesDragOverIndex(null);
                      articlesLastDragOverRef.current = null;
                    }}
                    onDragEnd={() => {
                      setArticlesDraggedIndex(null);
                      setArticlesDragOverIndex(null);
                      articlesLastDragOverRef.current = null;
                    }}
                    style={{
                      width: 140,
                      position: 'relative',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      overflow: 'hidden',
                      cursor: 'move',
                      opacity: articlesDraggedIndex === i ? 0.5 : 1,
                      borderColor: articlesDragOverIndex === i ? '#3b82f6' : '#e5e7eb',
                      boxShadow: articlesDragOverIndex === i ? '0 0 0 2px #3b82f6' : 'none',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ position: 'absolute', top: 4, left: 4, zIndex: 2, background: 'rgba(255,255,255,0.9)', borderRadius: 4, padding: 2 }}>
                      <GripVertical size={14} color="#6b7280" />
                    </div>
                    <img src={getImageUrl(item.image)} alt="" style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />
                    <div style={{ padding: 8, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.title}>{item.title || 'Статья'}</div>
                    <button type="button" onClick={() => removeArrayItem('firstTimeArticles', i)} className={styles.removeImage} style={{ position: 'absolute', top: 4, right: 4, zIndex: 2 }} aria-label="Удалить" title="Удалить"><X size={14} /></button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#6b7280', marginBottom: 12 }}>Статьи не выбраны. Если не выбрано ни одной статьи, будут показаны первые активные статьи из базы данных.</p>
            )}
            <button type="button" onClick={() => { setAddArticlesModalOpen(true); setArticlesSearchQuery(''); }} className={styles.addBtn}>
              <Plus size={18} /> Выбрать статьи
            </button>
          </div>

          {addArticlesModalOpen && (
            <div
              className={styles.modalOverlay}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setAddArticlesModalOpen(false);
                  setArticlesSearchQuery('');
                }
              }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-articles-title"
            >
              <div className={styles.modalDialog} style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                  <h2 id="add-articles-title" className={styles.modalTitle}>Выбрать статьи</h2>
                  <button type="button" onClick={() => { setAddArticlesModalOpen(false); setArticlesSearchQuery(''); }} className={styles.modalClose} aria-label="Закрыть"><X size={20} /></button>
                </div>
                <div className={styles.modalBody}>
                  <div className={styles.formAddPlaceSearch}>
                    <input
                      type="text"
                      placeholder="Поиск статей для добавления..."
                      value={articlesSearchQuery}
                      onChange={(e) => setArticlesSearchQuery(e.target.value)}
                      className={styles.formInput}
                      aria-label="Поиск статей"
                    />
                  </div>
                  {filteredArticles.filter((a) => !(content.firstTimeArticles ?? []).some((i) => i.articleId === a.id)).length > 0 ? (
                    <div className={styles.formAddPlaceList} style={{ maxHeight: 360 }}>
                      {filteredArticles
                        .filter((a) => !(content.firstTimeArticles ?? []).some((i) => i.articleId === a.id))
                        .map((a) => (
                          <div
                            key={a.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => addArticleToSlider(a)}
                            onKeyDown={(e) => e.key === 'Enter' && addArticleToSlider(a)}
                            className={styles.formAddPlaceItem}
                          >
                            {(a.images?.[0] || a.image || a.preview) && (
                              <img src={getImageUrl(a.images?.[0] || a.image || a.preview)} alt="" />
                            )}
                            <div className={styles.formAddPlaceItemTitle}>
                              <div>{a.title}</div>
                              {a.shortDescription && (
                                <div className={styles.formAddPlaceItemSub}>{stripHtml(a.shortDescription).substring(0, 50)}...</div>
                              )}
                            </div>
                            <span className={styles.formAddPlaceLabel}>+ Добавить</span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className={styles.formEmptyHint}>
                      {articlesSearchQuery ? 'Ничего не найдено' : 'Все активные статьи уже добавлены'}
                    </div>
                  )}
                </div>
                <div className={styles.modalFooter}>
                  <button type="button" onClick={() => { setAddArticlesModalOpen(false); setArticlesSearchQuery(''); }} className={styles.submitBtn}>Готово</button>
                </div>
              </div>
            </div>
          )}
          </section>

          {/* Services Section */}
          <section className={styles.formSection} style={{ marginBottom: 32, paddingBottom: 24, borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Briefcase size={18} color="#8b5cf6" />
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', margin: 0 }}>Секция «Сервис и услуги»</h3>
            </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Заголовок</label>
            <input
              type="text"
              value={content.servicesTitle ?? ''}
              onChange={(e) => update('servicesTitle', e.target.value)}
              className={styles.formInput}
              placeholder="СЕРВИС И УСЛУГИ"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Ссылка кнопки</label>
            <select
              value={content.servicesButtonLink ?? '/services'}
              onChange={(e) => update('servicesButtonLink', e.target.value)}
              className={styles.formSelect}
            >
              {HEADER_LINKS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Максимальное количество карточек в каждом табе</label>
            <p className={styles.imageHint} style={{ marginBottom: 8 }}>
              Количество услуг, отображаемых в каждом табе. Услуги сортируются по популярности (по количеству просмотров).
            </p>
            <input
              type="number"
              min="1"
              max="20"
              value={content.servicesCardsLimit ?? 8}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (!isNaN(value) && value > 0 && value <= 20) {
                  update('servicesCardsLimit', value);
                }
              }}
              className={styles.formInput}
              style={{ maxWidth: 200 }}
            />
          </div>
          </section>

          {/* Places Section */}
          <section className={styles.formSection} style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <MapPin size={18} color="#ef4444" />
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', margin: 0 }}>Секция «Куда поехать?»</h3>
            </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Заголовок</label>
            <input
              type="text"
              value={content.placesTitle ?? ''}
              onChange={(e) => update('placesTitle', e.target.value)}
              className={styles.formInput}
              placeholder="КУДА ПОЕХАТЬ?"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Ссылка кнопки</label>
            <select
              value={content.placesButtonLink ?? '/places'}
              onChange={(e) => update('placesButtonLink', e.target.value)}
              className={styles.formSelect}
            >
              {HEADER_LINKS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Выбранные места</label>
            <p className={styles.imageHint} style={{ marginBottom: 12 }}>
              Выберите места из списка ниже. Порядок можно изменить перетаскиванием. Рекомендуется выбрать до 4 мест.
            </p>
            {(content.placesItems ?? []).length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                {(content.placesItems ?? []).map((item, i) => (
                  <div
                    key={`${item.placeId}-${i}`}
                    draggable
                    onDragStart={(e) => {
                      const img = document.createElement('canvas');
                      img.width = 1;
                      img.height = 1;
                      e.dataTransfer.setDragImage(img, 0, 0);
                      e.dataTransfer.setData('text/plain', String(i));
                      e.dataTransfer.effectAllowed = 'move';
                      setPlacesItemsDraggedIndex(i);
                      placesItemsLastDragOverRef.current = null;
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (
                        placesItemsDraggedIndex != null &&
                        placesItemsDraggedIndex !== i &&
                        placesItemsLastDragOverRef.current !== i
                      ) {
                        placesItemsLastDragOverRef.current = i;
                        movePlaceItemByDrag(placesItemsDraggedIndex, i);
                        setPlacesItemsDraggedIndex(i);
                      }
                      setPlacesItemsDragOverIndex(i);
                    }}
                    onDragLeave={() => setPlacesItemsDragOverIndex((idx) => (idx === i ? null : idx))}
                    onDrop={(e) => {
                      e.preventDefault();
                      setPlacesItemsDraggedIndex(null);
                      setPlacesItemsDragOverIndex(null);
                      placesItemsLastDragOverRef.current = null;
                    }}
                    onDragEnd={() => {
                      setPlacesItemsDraggedIndex(null);
                      setPlacesItemsDragOverIndex(null);
                      placesItemsLastDragOverRef.current = null;
                    }}
                    style={{
                      width: 140,
                      position: 'relative',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      overflow: 'hidden',
                      cursor: 'move',
                      opacity: placesItemsDraggedIndex === i ? 0.5 : 1,
                      borderColor: placesItemsDragOverIndex === i ? '#3b82f6' : '#e5e7eb',
                      boxShadow: placesItemsDragOverIndex === i ? '0 0 0 2px #3b82f6' : 'none',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ position: 'absolute', top: 4, left: 4, zIndex: 2, background: 'rgba(255,255,255,0.9)', borderRadius: 4, padding: 2 }}>
                      <GripVertical size={14} color="#6b7280" />
                    </div>
                    <img src={getImageUrl(item.image)} alt="" style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />
                    <div style={{ padding: 8, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.title}>{item.title || item.location || 'Место'}</div>
                    <button type="button" onClick={() => removeArrayItem('placesItems', i)} className={styles.removeImage} style={{ position: 'absolute', top: 4, right: 4, zIndex: 2 }} aria-label="Удалить" title="Удалить"><X size={14} /></button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#6b7280', marginBottom: 12 }}>Места не выбраны. Если не выбрано ни одного места, будут показаны первые активные места из базы данных.</p>
            )}
            <button type="button" onClick={() => { setAddPlacesItemsModalOpen(true); setPlacesItemsSearchQuery(''); }} className={styles.addBtn}>
              <Plus size={18} /> Выбрать места
            </button>
          </div>

          {addPlacesItemsModalOpen && (
            <div
              className={styles.modalOverlay}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setAddPlacesItemsModalOpen(false);
                  setPlacesItemsSearchQuery('');
                }
              }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-places-items-title"
            >
              <div className={styles.modalDialog} style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                  <h2 id="add-places-items-title" className={styles.modalTitle}>Выбрать места</h2>
                  <button type="button" onClick={() => { setAddPlacesItemsModalOpen(false); setPlacesItemsSearchQuery(''); }} className={styles.modalClose} aria-label="Закрыть"><X size={20} /></button>
                </div>
                <div className={styles.modalBody}>
                  <div className={styles.formAddPlaceSearch}>
                    <input
                      type="text"
                      placeholder="Поиск мест для добавления..."
                      value={placesItemsSearchQuery}
                      onChange={(e) => setPlacesItemsSearchQuery(e.target.value)}
                      className={styles.formInput}
                      aria-label="Поиск мест"
                    />
                  </div>
                  {getFilteredPlacesForItems().filter((p) => !(content.placesItems ?? []).some((i) => i.placeId === p.id)).length > 0 ? (
                    <div className={styles.formAddPlaceList} style={{ maxHeight: 360 }}>
                      {getFilteredPlacesForItems()
                        .filter((p) => !(content.placesItems ?? []).some((i) => i.placeId === p.id))
                        .map((p) => (
                          <div
                            key={p.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => addPlaceToPlacesItems(p)}
                            onKeyDown={(e) => e.key === 'Enter' && addPlaceToPlacesItems(p)}
                            className={styles.formAddPlaceItem}
                          >
                            {(p.images?.[0] || p.image) && (
                              <img src={getImageUrl(p.images?.[0] || p.image)} alt="" />
                            )}
                            <div className={styles.formAddPlaceItemTitle}>
                              <div>{p.title}</div>
                              {p.location && (
                                <div className={styles.formAddPlaceItemSub}>{p.location}</div>
                              )}
                            </div>
                            <span className={styles.formAddPlaceLabel}>+ Добавить</span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className={styles.formEmptyHint}>
                      {placesItemsSearchQuery ? 'Ничего не найдено' : 'Все активные места уже добавлены'}
                    </div>
                  )}
                </div>
                <div className={styles.modalFooter}>
                  <button type="button" onClick={() => { setAddPlacesItemsModalOpen(false); setPlacesItemsSearchQuery(''); }} className={styles.submitBtn}>Готово</button>
                </div>
              </div>
            </div>
          )}
          </section>
        </div>

        {/* Banners Section */}
        <section className={styles.formSection} style={{ marginBottom: 32, paddingBottom: 24, borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Megaphone size={18} color="#f59e0b" />
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', margin: 0 }}>Баннеры</h3>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: 16 }}>
            Управление баннерами на главной странице. Баннеры могут быть временными или постоянными.
          </p>
          
          {(content.banners || []).map((banner, i) => (
            <div key={banner.id || i} className={styles.formGroup} style={{ border: '1px solid #e5e7eb', padding: 16, borderRadius: 10, marginBottom: 12, position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                  <span className={styles.formLabel} style={{ margin: 0 }}>Баннер #{i + 1}</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Активен</span>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => updateBanner(i, 'isActive', !(banner.isActive ?? true))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          updateBanner(i, 'isActive', !(banner.isActive ?? true));
                        }
                      }}
                      style={{
                        position: 'relative',
                        width: 44,
                        height: 24,
                        borderRadius: 12,
                        background: (banner.isActive ?? true) ? '#10b981' : '#d1d5db',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: 2,
                          left: (banner.isActive ?? true) ? 22 : 2,
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: '#ffffff',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                          transition: 'left 0.2s',
                        }}
                      />
                    </div>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => removeBanner(i)}
                  style={{ 
                    background: '#fee2e2', 
                    color: '#dc2626', 
                    border: 'none', 
                    padding: '6px 12px', 
                    borderRadius: 6,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    transition: 'all 0.2s',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#fecaca';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#fee2e2';
                  }}
                  aria-label="Удалить баннер"
                  title="Удалить баннер"
                >
                  <X size={14} /> Удалить
                </button>
              </div>

              <div className={styles.formGroup} style={{ marginBottom: 12 }}>
                <label className={styles.formLabel}>Изображение баннера</label>
                <div className={styles.imageUpload}>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    id={`bannerImageUpload-${i}`}
                    onChange={(e) => handleBannerImageFileSelect(i, e)}
                  />
                  <label
                    htmlFor={`bannerImageUpload-${i}`}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}
                  >
                    <Upload size={20} /> Загрузить изображение
                  </label>
                </div>
                {hasImage(`banners.${i}.image`) && (
                  <div className={styles.imagePreview} style={{ marginTop: 12 }}>
                    <div className={styles.previewItem} style={{ width: '100%', maxWidth: 600, aspectRatio: '16 / 9', position: 'relative', overflow: 'hidden', borderRadius: 8 }}>
                      <img src={getImageSrc(`banners.${i}.image`)} alt={`Баннер ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', flexDirection: 'row', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => document.getElementById(`bannerImageUpload-${i}`)?.click()}
                          className={styles.removeImage}
                          style={{ position: 'relative', top: 0, right: 0 }}
                          aria-label="Заменить файл"
                          title="Заменить файл"
                        >
                          <Upload size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => clearBannerImage(i)}
                          className={styles.removeImage}
                          style={{ position: 'relative', top: 0, right: 0 }}
                          aria-label="Удалить"
                          title="Удалить"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label className={styles.formLabel}>Ссылка</label>
                <FooterLinkSelector
                  value={getBannerLinkValue(banner)}
                  onChange={(linkData) => handleBannerLinkChange(i, linkData)}
                />
              </div>
            </div>
          ))}

          <button type="button" onClick={addBanner} className={styles.addBtn} style={{ marginTop: 12 }}>
            <Plus size={18} /> Добавить баннер
          </button>
        </section>

        {/* Background Image */}
        <div style={{ 
          background: '#fff', 
          borderRadius: 12, 
          padding: 24, 
          marginBottom: 24,
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ 
              width: 40, 
              height: 40, 
              borderRadius: 8, 
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white'
            }}>
              <Image size={20} />
            </div>
            <div>
              <h2 className={styles.sectionTitle} style={{ marginBottom: 4 }}>Фоновое изображение</h2>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>Декоративное изображение в нижней части страницы</p>
            </div>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Изображение</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileSelect('backgroundImage', e)}
              style={{ display: 'none' }}
              id="backgroundImage"
            />
            {hasImage('backgroundImage') ? (
              <div className={`${styles.previewItem} ${styles.previewItemMain}`} style={{ width: 280, aspectRatio: '16/9', position: 'relative', overflow: 'hidden', borderRadius: 8 }}>
                <img src={getImageSrc('backgroundImage')} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <span className={styles.previewItemBadge}>Фон</span>
                <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', flexDirection: 'row', gap: 6 }}>
                  <button type="button" onClick={() => document.getElementById('backgroundImage')?.click()} className={styles.removeImage} style={{ position: 'relative', top: 0, right: 0 }} aria-label="Изменить" title="Изменить"><Pencil size={14} /></button>
                  <button type="button" onClick={() => clearImage('backgroundImage')} className={styles.removeImage} style={{ position: 'relative', top: 0, right: 0 }} aria-label="Удалить" title="Удалить"><X size={14} /></button>
                </div>
              </div>
            ) : (
              <div className={styles.imageUpload} onClick={() => document.getElementById('backgroundImage')?.click()} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') document.getElementById('backgroundImage')?.click(); }}>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                  <Upload size={20} /> Загрузить изображение
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {showToast && <div className={styles.toast}>Сохранено</div>}

      <ImageCropModal
        open={seasonCropModalOpen}
        imageSrc={seasonCropModalImageSrc}
        title="Обрезка логотипа сезона"
        aspect={330 / 464}
        onComplete={handleSeasonCropComplete}
        onCancel={handleSeasonCropCancel}
      />
    </div>
  );
}
