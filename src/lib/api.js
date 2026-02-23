import axios from 'axios';

// Глобальная переменная для хранения загруженного URL (избегаем повторных запросов)
let cachedBackendUrl = null;

// Функция для получения базового URL API
// Единственный источник: backendApiUrl из config (кэш) или полный VITE_API_URL в env. Без fallback на /api.
function getApiBaseUrl() {
  if (cachedBackendUrl) {
    return cachedBackendUrl.endsWith('/api') ? cachedBackendUrl : `${cachedBackendUrl}/api`;
  }
  const env = import.meta.env.VITE_API_URL;
  if (env && typeof env === 'string' && env.startsWith('http')) {
    return env.endsWith('/api') ? env : `${env.replace(/\/+$/, '')}/api`;
  }
  return '';
}

// Функция для загрузки публичного конфига (вызывается при старте приложения)
export async function loadPublicConfig() {
  if (typeof window === 'undefined') return null;
  
  // В ПЕРВУЮ ОЧЕРЕДЬ пробуем загрузить config.json (глобальная настройка)
  try {
    // Пробуем загрузить статический файл /config.json с фронтенда
    // Этот файл обновляется через PHP скрипт при сохранении URL в админке
    try {
      const configResponse = await axios.get('/config.json', {
        timeout: 3000,
        validateStatus: (status) => status === 200,
      });
      
      const backendApiUrl = configResponse.data?.backendApiUrl;
      console.log('📄 Загружен config.json:', { backendApiUrl });
      if (backendApiUrl && backendApiUrl.trim()) {
        const url = backendApiUrl.trim();
        cachedBackendUrl = url;
        const apiUrl = url.endsWith('/api') ? url : `${url}/api`;
        api.defaults.baseURL = apiUrl;
        console.log('✅ Применен URL из config.json:', apiUrl);
        return url;
      } else {
        console.log('⚠️ config.json пустой или содержит пустую строку');
      }
    } catch (configFileError) {
      console.log('config.json не найден');
    }

    // Пробуем /api/config только если в env задан полный URL бэкенда (не используем /api)
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.startsWith('http')) {
      const baseUrl = envUrl.replace(/\/api\/?$/, '');
      try {
        const publicConfigApi = axios.create({
          baseURL: baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`,
          timeout: 3000,
        });
        const response = await publicConfigApi.get('/config');
        const backendApiUrl = response.data?.backendApiUrl;
        if (backendApiUrl && backendApiUrl.trim()) {
          const url = backendApiUrl.trim();
          cachedBackendUrl = url;
          const apiUrl = url.endsWith('/api') ? url : `${url}/api`;
          api.defaults.baseURL = apiUrl;
          console.log('✅ Применен URL из API:', apiUrl);
          return url;
        }
      } catch (e) {
        console.log('Не удалось загрузить конфиг через API');
      }
    }
  } catch (error) {
    console.log('Не удалось загрузить конфиг:', error?.message);
  }

  const defaultUrl = import.meta.env.VITE_API_URL;
  if (defaultUrl && typeof defaultUrl === 'string' && defaultUrl.startsWith('http')) {
    cachedBackendUrl = defaultUrl.replace(/\/api\/?$/, '');
    api.defaults.baseURL = defaultUrl.endsWith('/api') ? defaultUrl : `${defaultUrl.replace(/\/+$/, '')}/api`;
    return cachedBackendUrl;
  }

  // Нет backendApiUrl — запросы к бэку не должны уходить
  cachedBackendUrl = null;
  api.defaults.baseURL = '';
  return null;
}

// Функция для обновления baseURL (вызывается при сохранении URL в настройках)
export function updateApiBaseUrl(backendUrl) {
  if (!backendUrl || !backendUrl.trim()) {
    cachedBackendUrl = null;
    const env = import.meta.env.VITE_API_URL;
    api.defaults.baseURL = (env && typeof env === 'string' && env.startsWith('http'))
      ? (env.endsWith('/api') ? env : `${env.replace(/\/+$/, '')}/api`)
      : '';
    return;
  }
  
  const url = backendUrl.trim();
  cachedBackendUrl = url; // Сохраняем в кэш (только в памяти)
  
  // Обновляем baseURL в axios
  // Если URL не содержит /api, добавляем его
  const apiUrl = url.endsWith('/api') ? url : `${url}/api`;
  api.defaults.baseURL = apiUrl;
  console.log('🔧 updateApiBaseUrl: обновлен api.defaults.baseURL:', apiUrl);
}

// Для отображения в UI (документация и т.д.) — только backendApiUrl, без дефолта
export function getBackendDisplayUrl() {
  if (cachedBackendUrl) return cachedBackendUrl;
  const u = getApiBaseUrl();
  if (u.startsWith('http')) return u.replace(/\/api\/?$/, '');
  return '';
}

// Получаем начальный baseURL
const API_URL = getApiBaseUrl();

// Базовый URL бэкенда (без /api) — для картинок подставляется при каждом вызове getImageUrl
function getBaseUrl() {
  const apiUrl = getApiBaseUrl();
  if (apiUrl.startsWith('http')) {
    return apiUrl.replace(/\/api\/?$/, '');
  }
  return '';
}

// Хелпер для получения полного URL изображения: спереди подставляется путь до бэка
export const getImageUrl = (path) => {
  if (!path) return '/placeholder.jpg';
  if (path.startsWith('http')) return path;
  const base = getBaseUrl();
  if (!base) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base.replace(/\/+$/, '')}${normalizedPath}`;
};

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Включаем отправку cookies
});

const USER_TOKEN_KEY = 'token';

// Request interceptor: используем один токен для всех запросов
api.interceptors.request.use(
  (config) => {
    if (typeof window === 'undefined') return config;
    // Используем основной токен для всех запросов
    const token = localStorage.getItem(USER_TOKEN_KEY) || localStorage.getItem('adminToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Логирование для отладки
    // console.log(`[API Request] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, {
    //   data: config.data,
    //   hasToken: !!config.headers.Authorization,
    //   baseURL: config.baseURL
    // });
    return config;
  },
  (error) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

// Response interceptor: 401 — очищаем токены и редиректим
api.interceptors.response.use(
  (response) => {
    // Логирование для отладки (закомментировано, раскомментируйте при необходимости)
    // console.log(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.url}`, {
    //   status: response.status,
    //   data: response.data
    // });
    return response;
  },
  (error) => {
    // Не логируем 404 - это нормальное поведение для ресурсов, которые еще не сгенерированы
    const status = error.response?.status;
    if (status === 404) {
      // Полностью игнорируем 404 ошибки - они ожидаемы для несуществующих ресурсов
      // Просто возвращаем ошибку без логирования
    } else {
      // Для всех остальных ошибок логируем как ошибку
      console.error(`[API Error] ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
        status: status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
    }
    
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const url = error.config?.url || '';
      // Очищаем все токены
      localStorage.removeItem(USER_TOKEN_KEY);
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      
      // Отправляем событие для AuthContext
      window.dispatchEvent(new CustomEvent('user-unauthorized'));
      
      // Редиректим на логин с returnUrl
      if (url.includes('/admin')) {
        const currentPath = window.location.pathname;
        window.location.href = `/admin/login?returnUrl=${encodeURIComponent(currentPath)}`;
      }
    }
    return Promise.reject(error);
  }
);

// Auth API (public user)
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
};

// User API (profile + favorites, requires user token)
export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data),
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/users/profile/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getFavorites: () => api.get('/users/profile/favorites'),
  getConstructorPoints: () => api.get('/users/constructor-points'),
  updateConstructorPoints: (placeIds) =>
    api.put('/users/constructor-points', { placeIds }),
  addFavorite: (entityType, entityId) =>
    api.post(`/users/favorites/${entityType}/${entityId}`),
  removeFavorite: (entityType, entityId) =>
    api.delete(`/users/favorites/${entityType}/${entityId}`),
};

export { USER_TOKEN_KEY };

// User Routes API (пользовательские маршруты в профиле)
export const userRoutesAPI = {
  getAll: () => api.get('/users/routes'),
  getById: (id) => api.get(`/users/routes/${id}`),
  create: (data) => api.post('/users/routes', data),
  update: (id, data) => api.put(`/users/routes/${id}`, data),
  delete: (id) => api.delete(`/users/routes/${id}`),
};

// Routes API
export const routesAPI = {
  getAll: (params) => api.get('/admin/routes', { params }),
  getById: (id) => api.get(`/admin/routes/${id}`),
  create: (data) => api.post('/admin/routes', data),
  update: (id, data) => api.put(`/admin/routes/${id}`, data),
  delete: (id) => api.delete(`/admin/routes/${id}`),
};

// Places API (admin)
export const placesAPI = {
  getAll: (params) => api.get('/admin/places', { params }),
  getById: (id) => api.get(`/admin/places/${id}`),
  create: (data) => api.post('/admin/places', data),
  update: (id, data) => api.put(`/admin/places/${id}`, data),
  delete: (id) => api.delete(`/admin/places/${id}`),
}

// Places API (public, для страницы «Интересные места»)
export const publicPlacesAPI = {
  getAll: (params) => api.get('/places', { params }),
  getByIdOrSlug: (idOrSlug) => api.get(`/places/${idOrSlug}`),
  getFilters: () => api.get('/places/filters'),
  createReview: (placeId, data) => api.post(`/places/${placeId}/reviews`, data),
};

// Routes API (public, для страницы «Маршруты» и страницы маршрута)
export const publicRoutesAPI = {
  getAll: (params) => api.get('/routes', { params }),
  getByIdOrSlug: (idOrSlug) => api.get(`/routes/${idOrSlug}`),
  getFilters: () => api.get('/routes/filters'),
  createReview: (routeId, data) => api.post(`/routes/${routeId}/reviews`, data),
};

// Place filters API (админка — управление опциями фильтров)
export const placeFiltersAPI = {
  get: () => api.get('/admin/place-filters'),
  update: (data) => api.put('/admin/place-filters', data),
  addGroup: (label, icon = null, iconType = null, values = []) =>
    api.post('/admin/place-filters/add-group', { label, icon: icon || undefined, iconType: iconType || undefined, values }),
  removeGroup: (key) => api.post('/admin/place-filters/remove-group', { key }),
  updateGroupMeta: (key, { label, icon, iconType }) =>
    api.patch('/admin/place-filters/group-meta', { key, label, icon, iconType }),
  replaceValue: (group, oldValue, newValue) =>
    api.post('/admin/place-filters/replace-value', { group, oldValue, newValue }),
  removeValue: (group, value) => api.post('/admin/place-filters/remove-value', { group, value }),
};

// Route filters API (админка — управление опциями фильтров маршрутов)
export const routeFiltersAPI = {
  get: () => api.get('/admin/route-filters'),
  update: (data) => api.put('/admin/route-filters', data),
  addGroup: (label, icon = null, iconType = null, values = []) =>
    api.post('/admin/route-filters/add-group', { label, icon: icon || undefined, iconType: iconType || undefined, values }),
  removeGroup: (key) => api.post('/admin/route-filters/remove-group', { key }),
  updateGroupMeta: (key, { label, icon, iconType }) =>
    api.patch('/admin/route-filters/group-meta', { key, label, icon, iconType }),
  replaceValue: (group, oldValue, newValue) =>
    api.post('/admin/route-filters/replace-value', { group, oldValue, newValue }),
  removeValue: (group, value) => api.post('/admin/route-filters/remove-value', { group, value }),
};

// News API (admin)
export const newsAPI = {
  getAll: (params) => api.get('/admin/news', { params }),
  getById: (id) => api.get(`/admin/news/${id}`),
  create: (data) => api.post('/admin/news', data),
  update: (id, data) => api.put(`/admin/news/${id}`, data),
  delete: (id) => api.delete(`/admin/news/${id}`),
};

// News API (public — для страницы «Новости и статьи»)
export const publicNewsAPI = {
  getAll: (params) => api.get('/news', { params }),
  getByIdOrSlug: (idOrSlug) => api.get(`/news/${idOrSlug}`),
};

// Services API (admin)
export const servicesAPI = {
  getAll: (params) => api.get('/admin/services', { params }),
  getById: (id) => api.get(`/admin/services/${id}`),
  create: (data) => api.post('/admin/services', data),
  update: (id, data) => api.put(`/admin/services/${id}`, data),
  delete: (id) => api.delete(`/admin/services/${id}`),
};

// Services API (public — для страницы «Услуги» на сайте)
export const publicServicesAPI = {
  getAll: (params) => api.get('/services', { params }),
  getByIdOrSlug: (idOrSlug) => api.get(`/services/${idOrSlug}`),
  createReview: (serviceId, data) => api.post(`/services/${serviceId}/reviews`, data),
};

// Reviews API
export const reviewsAPI = {
  getAll: (params) => api.get('/admin/reviews', { params }),
  getById: (id) => api.get(`/admin/reviews/${id}`),
  update: (id, data) => api.put(`/admin/reviews/${id}`, data),
  delete: (id) => api.delete(`/admin/reviews/${id}`),
};

// Media API
export const mediaAPI = {
  upload: (formData, { onUploadProgress } = {}) => api.post('/admin/media/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  }),
  uploadDocument: (formData) => api.post('/admin/media/upload-document', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  uploadVideo: (formData, { onUploadProgress } = {}) => api.post('/admin/media/upload-video', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  }),
  delete: (id) => api.delete(`/admin/media/${id}`),
};

// Statistics API
export const statsAPI = {
  getDashboard: () => api.get('/admin/stats'),
};

// Region API (страница «О регионе»)
export const regionAPI = {
  get: () => api.get('/admin/region'),
  update: (content) => api.put('/admin/region', { content }),
};

// Region API (public — для страницы «О регионе»)
export const publicRegionAPI = {
  get: () => api.get('/region'),
};

// Home API (главная страница)
export const homeAPI = {
  get: () => api.get('/admin/home'),
  update: (content) => api.put('/admin/home', { content }),
};

// Home API (public — для главной страницы)
export const publicHomeAPI = {
  get: () => api.get('/home'),
};

// Footer API (admin)
export const footerAPI = {
  get: () => api.get('/admin/footer'),
  update: (content) => api.put('/admin/footer', { content }),
};

// Footer API (public — для футера сайта)
export const publicFooterAPI = {
  get: () => api.get('/footer', { params: { _t: Date.now() }, headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } }),
};

// Feedback API (форма обратной связи в футере)
export const feedbackAPI = {
  send: (data) => api.post('/footer/feedback', data),
};

// Pages API (admin — для управления страницами сайта)
export const pagesAPI = {
  get: (pageName) => api.get(`/admin/pages/${pageName}`),
  update: (pageName, content) => api.put(`/admin/pages/${pageName}`, { content }),
};

// Dynamic Pages API (для динамических страниц из меню)
export const dynamicPagesAPI = {
  get: (slug) => api.get(`/admin/dynamic-pages/${slug}`),
  update: (slug, data) => api.put(`/admin/dynamic-pages/${slug}`, data),
  create: (slug, data) => api.post(`/admin/dynamic-pages/${slug}`, data),
};

// Structure API (для структуры ресурсов)
export const structureAPI = {
  get: (resourceName) => api.get(`/${resourceName.toLowerCase()}Structure`),
  update: (resourceName, fields) => api.put(`/${resourceName.toLowerCase()}Structure`, { fields }),
};

// Dynamic Page Records API (для записей динамических страниц)
function slugToResourceRoute(slug) {
  return String(slug || '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/-/g, '')
    .toLowerCase();
}

function extractRecordsList(data, slug) {
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data.records)) return data.records;
  if (Array.isArray(data.items)) return data.items;

  const routeKey = slugToResourceRoute(slug);
  if (routeKey && Array.isArray(data[routeKey])) return data[routeKey];

  const firstArrayValue = Object.values(data).find((v) => Array.isArray(v));
  return Array.isArray(firstArrayValue) ? firstArrayValue : [];
}

export const dynamicPageRecordsAPI = {
  getAll: (slug, params = {}) => {
    const resourceRoute = slugToResourceRoute(slug);
    return api.get(`/${resourceRoute}`, { params }).then((response) => ({
      ...response,
      data: {
        ...response.data,
        records: extractRecordsList(response.data, slug),
      },
    }));
  },
  getById: (slug, recordId) => {
    const resourceRoute = slugToResourceRoute(slug);
    return api.get(`/${resourceRoute}/${recordId}`);
  },
  create: (slug, data) => {
    const resourceRoute = slugToResourceRoute(slug);
    return api.post(`/${resourceRoute}`, data);
  },
  update: (slug, recordId, data) => {
    const resourceRoute = slugToResourceRoute(slug);
    return api.put(`/${resourceRoute}/${recordId}`, data);
  },
  delete: (slug, recordId) => {
    const resourceRoute = slugToResourceRoute(slug);
    return api.delete(`/${resourceRoute}/${recordId}`);
  },
};

// Users API (admin — для управления пользователями)
export const adminUsersAPI = {
  getAll: (params) => api.get('/admin/users', { params }),
  getById: (id) => api.get(`/admin/users/${id}`),
  updateRole: (id, role) => api.put(`/admin/users/${id}/role`, { role }),
  ban: (id) => api.put(`/admin/users/${id}/ban`),
  unban: (id) => api.put(`/admin/users/${id}/unban`),
};

// Pages API (public — для страниц сайта)
export const publicPagesAPI = {
  get: (pageName) => api.get(`/pages/${pageName}`),
};

// Menu API (admin — для управления главным меню сайта)
export const menuAPI = {
  get: () => {
    // ВСЕГДА делаем запрос на бэк
    // Menu регистрируется под /api/menu (не /api/admin/menu)
    return api.get('/menu').then(response => {
      return response;
    }).catch(error => {
      // Если 404 - значит ресурс еще не сгенерирован, возвращаем пустой массив
      if (error.response?.status === 404) {
        return { 
          status: 404, 
          data: { items: [] },
          config: { url: '/menu', method: 'GET' }
        };
      }
      // Для других ошибок пробрасываем дальше
      return Promise.reject(error);
    });
  },
  update: (items) => {
    // При обновлении всегда пытаемся отправить на бэк
    // Menu регистрируется под /api/menu (не /api/admin/menu)
    return api.put('/menu', { items }).catch(error => {
      // Если это ошибка сети (ERR_CONNECTION_RESET, ECONNRESET и т.д.), 
      // это может означать, что сервер перезапускается
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNRESET' || error.message?.includes('Network Error')) {
        // Пробрасываем ошибку, чтобы вызывающий код мог повторить попытку
        return Promise.reject(error);
      }
      // Для остальных ошибок тоже пробрасываем
      return Promise.reject(error);
    });
  },
};

// Config API (публичный — для управления конфигурацией)
export const configAPI = {
  get: () => api.get('/config'),
  update: (config) => api.put('/config', config),
};

// Menu API (public — для главного меню сайта)
export const publicMenuAPI = {
  get: () => api.get('/menu'),
};

// Generate Resource API (admin — для генерации ресурсов на бэкенде)
export const generateResourceAPI = {
  generate: (data) => api.post('/admin/generate/resource', data),
};

export const adminDataAPI = {
  exportSnapshot: () => api.get('/admin/data/export'),
  importSnapshot: (snapshot) => api.post('/admin/data/import', { snapshot }),
};

export default api;
