import { useState, useEffect, createContext, useCallback } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  LayoutDashboard, 
  Map, 
  MapPin, 
  Newspaper, 
  Building2, 
  Star,
  LogOut,
  ChevronLeft,
  ChevronRight,
  FileText,
  Users,
  Settings,
  CircleHelp,
  Copy,
  Check,
  X
} from 'lucide-react';
import { dynamicPageRecordsAPI, menuAPI, getImageUrl, getBackendDisplayUrl } from '@/lib/api';
import { getMuiIconComponent } from './components/WhatToBringIcons';
import styles from './admin.module.css';

export const AdminHeaderRightContext = createContext(null);
export const AdminBreadcrumbContext = createContext(null);
export const AdminCountsContext = createContext(null);

// Системный пункт меню (всегда видим, не управляется через настройки)
const SYSTEM_MENU_ITEM = {
  href: '/admin/settings',
  label: 'Настройки',
  icon: Settings
};

// Маппинг иконок для динамических пунктов меню
const ICON_MAP = {
  MapPin,
  Map,
  Newspaper,
  Building2,
  Star,
  Users,
};

export default function AdminLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading, logout } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [headerRight, setHeaderRight] = useState(null);
  const [breadcrumbLabel, setBreadcrumbLabel] = useState(null);
  const [docsModalOpen, setDocsModalOpen] = useState(false);
  const [docsTab, setDocsTab] = useState('install');
  const [copiedDocBlock, setCopiedDocBlock] = useState(null);
  const [counts, setCounts] = useState({});
  const [dynamicMenuItems, setDynamicMenuItems] = useState([]);
  const hideTopHeader = pathname === '/admin/settings' || pathname.startsWith('/admin/settings/');
  const rawPathParts = pathname.split('/').filter(Boolean);
  const breadcrumbParts = rawPathParts.filter(part => part !== 'dynamic');
  const breadcrumbRawIndices = rawPathParts.reduce((acc, part, idx) => {
    if (part !== 'dynamic') {
      acc.push(idx);
    }
    return acc;
  }, []);

  useEffect(() => {
    // Ждем загрузки AuthContext
    if (authLoading) {
      return;
    }

    // Если пользователь не авторизован, редиректим на логин с returnUrl
    if (!user) {
      if (pathname !== '/admin/login') {
        navigate(`/admin/login?returnUrl=${encodeURIComponent(pathname)}`);
      }
      setIsLoading(false);
      return;
    }

    // Проверяем роль пользователя
    if (user.role !== 'SUPERADMIN' && user.role !== 'ADMIN') {
      // Если не админ, редиректим на главную
      navigate('/admin/login');
      setIsLoading(false);
      return;
    }

    // Пользователь авторизован и имеет права админа
    setIsAuthenticated(true);
    setIsLoading(false);
  }, [user, authLoading, pathname, navigate]);

  const loadMenu = useCallback(async () => {
    try {
      let menuItems = [];
      // Всегда загружаем меню с бэка
      const menuRes = await menuAPI.get();
      menuItems = menuRes.data?.items || [];
      
      // Загружаем все пункты меню из настроек (исключая системный пункт Настройки)
      const allMenuItems = menuItems
        .filter(item => 
          item.isVisible !== false && 
          item.url && 
          item.url.startsWith('/admin') &&
          item.url !== '/admin/settings' // Исключаем системный пункт Настройки
        )
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(item => {
          const iconType = item.iconType || (item.icon && (item.icon.startsWith('http') || item.icon.startsWith('/')) ? 'upload' : 'library');
          // Все страницы теперь динамические, кроме settings
          let href = item.url;
          const slug = item.url?.replace('/admin/', '') || '';
          // Если это не settings, используем динамический роут /admin/dynamic/[slug]
          if (slug && slug !== 'settings' && item.url.startsWith('/admin/')) {
            href = `/admin/dynamic/${slug}`;
          }
          
          return {
            href: href,
            slug,
            label: item.label,
            icon: MapPin, // Fallback иконка
            iconData: item.icon ? { icon: item.icon, iconType } : null, // Сохраняем данные иконки для рендеринга
            key: null
          };
        });
      setDynamicMenuItems(allMenuItems);

      // Загружаем реальные счетчики для каждого пункта меню
      const countEntries = await Promise.all(
        allMenuItems.map(async (item) => {
          try {
            const res = await dynamicPageRecordsAPI.getAll(item.slug, { page: 1, limit: 1 });
            const total = Number.isFinite(Number(res?.data?.total))
              ? Number(res.data.total)
              : (Array.isArray(res?.data?.records) ? res.data.records.length : 0);
            return [item.href, total];
          } catch (_) {
            return [item.href, 0];
          }
        })
      );
      setCounts(Object.fromEntries(countEntries));
    } catch (error) {
      console.error('Ошибка загрузки меню:', error);
      setCounts({});
    }
  }, []);

  // Загрузка меню и счетчиков
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchData = async () => {
      try {
        await loadMenu();
      } catch (error) {
        console.error('Ошибка загрузки данных:', error);
      }
    };

    fetchData();
  }, [isAuthenticated, loadMenu, pathname]);

  // Слушаем обновления меню
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const handleMenuUpdate = () => {
      console.log('📢 Событие menuUpdated получено, перезагружаю меню...');
      loadMenu();
    };
    
    window.addEventListener('menuUpdated', handleMenuUpdate);
    return () => {
      window.removeEventListener('menuUpdated', handleMenuUpdate);
    };
  }, [isAuthenticated, loadMenu]);

  const handleLogout = () => {
    // Используем logout из AuthContext, который очистит все токены
    logout();
    navigate('/admin/login');
  };

  const copyDocBlock = useCallback(async (blockKey, content) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = content;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedDocBlock(blockKey);
      window.setTimeout(() => setCopiedDocBlock(null), 1800);
    } catch (error) {
      console.error('Не удалось скопировать блок документации:', error);
    }
  }, []);

  const getDocsForCurrentPage = () => {
    const backendBase = getBackendDisplayUrl();
    const docBase = backendBase ? `${backendBase}/api` : 'URL_ИЗ_НАСТРОЕК/api';

    const buildDoc = ({ title, description, endpoint, resourcePath, resourceLabel, notes }) => ({
      title,
      description,
      endpoint,
      resourcePath,
      resourceLabel,
      notes,
    });

    const defaultDoc = {
      title: 'Как получать данные на фронте',
      description: 'Готовый пример для отдельного проекта: установили axios, вставили код, подставили URL бэкенда и получили данные.',
      endpoint: `${docBase}/<resource>`,
      readExample: `import axios from 'axios';

const BACKEND_URL = '${backendBase || 'http://your-backend'}'; // только из настроек (Настройки → URL бэкенда)
const api = axios.create({
  baseURL: \`\${BACKEND_URL}/api\`,
  timeout: 10000,
});

export async function getResourceList() {
  const { data } = await api.get('/<resource>', { params: { page: 1, limit: 10 } });
  return data;
}

export async function getResourceById(id) {
  const { data } = await api.get(\`/<resource>/\${id}\`);
  return data;
}`,
      notes: [
        'Это пример для любого отдельного проекта, не привязан к админке.',
        'URL бэкенда задаётся только в Настройках (backendApiUrl), без дефолтов.',
        `Список: GET ${docBase}/<resource>`,
        `Одна запись: GET ${docBase}/<resource>/:id`,
      ],
    };

    if (pathname.startsWith('/admin/dynamic/')) {
      const parts = pathname.split('/').filter(Boolean);
      const slug = parts[2] || '';
      const resourceRoute = slug.replace(/-/g, '').toLowerCase();
      const pageLabel = breadcrumbLabel || slug;
      return buildDoc({
        title: `Документация для "${pageLabel}"`,
        description: `Готовые примеры для отдельного проекта: с Authorization, с полным URL, для списка и одной записи.`,
        endpoint: `${docBase}/${resourceRoute}`,
        resourcePath: resourceRoute,
        resourceLabel: pageLabel,
        notes: [
          `Список "${pageLabel}": GET ${docBase}/${resourceRoute}`,
          `Одна запись "${pageLabel}": GET ${docBase}/${resourceRoute}/:id`,
          'Вставьте ваш JWT-токен в AUTH_TOKEN.',
          'Для endpoints без авторизации уберите заголовок Authorization.',
        ],
      });
    }

    if (pathname.startsWith('/admin/settings')) {
      return buildDoc({
        title: 'Документация: Настройки',
        description: 'Полностью автономные примеры для отдельного проекта.',
        endpoint: `${docBase}/menu`,
        resourcePath: 'menu',
        resourceLabel: 'пунктов меню',
        notes: [
          `Список меню: GET ${docBase}/menu`,
          `Конфиг: GET ${docBase}/config`,
          'Вынесите axios-клиент в отдельный модуль (api.js).',
          'Этот шаблон подходит для любого вашего endpoint.',
        ],
      });
    }

    return buildDoc({
      ...defaultDoc,
      resourcePath: '<resource>',
      resourceLabel: 'ресурса',
    });
  };

  const docs = getDocsForCurrentPage();
  const docsResourceFn = docs.resourcePath.charAt(0).toUpperCase() + docs.resourcePath.slice(1);
  const installSnippet = `npm i axios`;
  const backendForSnippet = getBackendDisplayUrl() || 'http://your-backend';
  const baseClientSnippet = `import axios from 'axios';

const BACKEND_URL = '${backendForSnippet}'; // только из настроек (config.json → backendApiUrl)
const AUTH_TOKEN = 'PASTE_JWT_TOKEN_HERE'; // если endpoint публичный — удалите Authorization

export const api = axios.create({
  baseURL: \`\${BACKEND_URL}/api\`,
  timeout: 10000,
  headers: {
    Authorization: \`Bearer \${AUTH_TOKEN}\`,
  },
});`;
  const listNoPaginationSnippet = `import { api } from './api';

export async function get${docsResourceFn}List() {
  // Без пагинации
  const { data } = await api.get('/${docs.resourcePath}');
  return data;
}`;
  const listWithPaginationSnippet = `import { api } from './api';

export async function get${docsResourceFn}ListPaginated(page = 1, limit = 10) {
  const { data } = await api.get('/${docs.resourcePath}', {
    params: { page, limit },
  });
  return data;
}`;
  const oneRecordSnippet = `import { api } from './api';

export async function get${docsResourceFn}ById(id) {
  const { data } = await api.get(\`/${docs.resourcePath}/\${id}\`);
  return data;
}`;
  const fullExampleSnippet = `import axios from 'axios';

const BACKEND_URL = '${backendForSnippet}'; // только из настроек
const AUTH_TOKEN = 'PASTE_JWT_TOKEN_HERE';

const api = axios.create({
  baseURL: \`\${BACKEND_URL}/api\`,
  timeout: 10000,
  headers: {
    Authorization: \`Bearer \${AUTH_TOKEN}\`,
  },
});

async function run() {
  // Все записи (без пагинации)
  const list = await api.get('/${docs.resourcePath}');
  console.log('LIST:', list.data);

  // Одна запись по id
  const one = await api.get('/${docs.resourcePath}/PASTE_REAL_ID_HERE');
  console.log('ONE:', one.data);
}

run().catch(console.error);`;

  useEffect(() => {
    if (docsModalOpen) {
      setDocsTab('install');
      setCopiedDocBlock(null);
    }
  }, [docsModalOpen, docs.title]);

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Загрузка...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className={styles.adminContainer}>
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.open : styles.closed}`}>
        <div className={styles.sidebarHeader}>
          <Link to="/admin" className={styles.logo}>Админ панель</Link>
          <button 
            className={styles.toggleBtn}
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>
        
        <nav className={styles.nav}>
          {/* Все пункты меню из настроек */}
          {dynamicMenuItems.map((item) => {
            // Используем сохраненную иконку из меню, если она есть
            const renderIcon = () => {
              if (item.iconData) {
                const iconType = item.iconData.iconType || (item.iconData.icon && (item.iconData.icon.startsWith('http') || item.iconData.icon.startsWith('/')) ? 'upload' : 'library');
                if (iconType === 'upload') {
                  return <img src={getImageUrl(item.iconData.icon)} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />;
                } else if (getMuiIconComponent(item.iconData.icon)) {
                  const MuiIcon = getMuiIconComponent(item.iconData.icon);
                  return <MuiIcon size={20} />;
                }
              }
              // Fallback на компонент иконки или дефолтную
              if (item.icon && typeof item.icon === 'function') {
                return <item.icon size={20} />;
              }
              return <MapPin size={20} />;
            };
            
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            
            const count = counts[item.href] ?? 0;
            
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`${styles.navItem} ${isActive ? styles.active : ''}`}
              >
                <span className={styles.navIcon}>{renderIcon()}</span>
                {sidebarOpen && (
                  <>
                    <span className={styles.navLabel}>{item.label}</span>
                    <span className={styles.navCount}>{count}</span>
                  </>
                )}
              </Link>
            );
          })}
          
          {/* Системный пункт Настройки (всегда в конце, не управляется через настройки) */}
          <Link
            to={SYSTEM_MENU_ITEM.href}
            className={`${styles.navItem} ${pathname === SYSTEM_MENU_ITEM.href || pathname.startsWith(SYSTEM_MENU_ITEM.href + '/') ? styles.active : ''}`}
          >
            <span className={styles.navIcon}><SYSTEM_MENU_ITEM.icon size={20} /></span>
            {sidebarOpen && (
              <span className={styles.navLabel}>{SYSTEM_MENU_ITEM.label}</span>
            )}
          </Link>
        </nav>

        <div className={styles.sidebarFooter}>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            <span className={styles.navIcon}><LogOut size={20} /></span>
            {sidebarOpen && <span>Выйти</span>}
          </button>
        </div>
      </aside>

      <main className={styles.mainContent}>
        {!hideTopHeader && (
          <header className={styles.header}>
            <div className={styles.breadcrumbWrap}>
              <div className={styles.breadcrumb}>
                {breadcrumbParts.map((part, index) => {
                  const isLast = index === breadcrumbParts.length - 1;
                  let label;
                  
                  if (isLast && breadcrumbLabel != null && breadcrumbLabel !== '') {
                    label = breadcrumbLabel;
                  } else if (part === 'admin') {
                    label = 'Админ панель';
                  } else if (part === 'settings') {
                    label = 'Настройки';
                  } else if (part === 'login') {
                    label = 'Вход';
                  } else {
                    // Для динамических страниц используем название из меню или slug
                    label = part;
                  }
                  
                  const rawIndex = breadcrumbRawIndices[index];
                  const href = '/' + rawPathParts.slice(0, rawIndex + 1).join('/');
                  return (
                    <span key={index}>
                      {index > 0 && ' / '}
                      {isLast ? (
                        <span className={styles.currentPage}>{label}</span>
                      ) : (
                        <Link
                          to={href}
                          style={{ color: 'inherit', textDecoration: 'none' }}
                        >
                          {label}
                        </Link>
                      )}
                    </span>
                  );
                })}
              </div>
              <button
                type="button"
                className={styles.breadcrumbHelpBtn}
                onClick={() => setDocsModalOpen(true)}
                title="Как получать данные на фронте"
                aria-label="Как получать данные на фронте"
              >
                <CircleHelp size={16} />
              </button>
            </div>
            {headerRight && <div className={styles.headerRight}>{headerRight}</div>}
          </header>
        )}
        
        <div className={styles.content}>
          <AdminHeaderRightContext.Provider value={{ setHeaderRight }}>
            <AdminBreadcrumbContext.Provider value={{ setBreadcrumbLabel }}>
              <AdminCountsContext.Provider value={{ counts, setCounts }}>
                <Outlet />
              </AdminCountsContext.Provider>
            </AdminBreadcrumbContext.Provider>
          </AdminHeaderRightContext.Provider>
        </div>
      </main>

      {docsModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={(e) => e.target === e.currentTarget && setDocsModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Документация для фронтенда"
        >
          <div className={styles.modalDialog} style={{ maxWidth: 850 }}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{docs.title}</h3>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setDocsModalOpen(false)}
                aria-label="Закрыть"
              >
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.docsText}>{docs.description}</p>
              <div className={styles.docsTabs}>
                <button type="button" onClick={() => setDocsTab('install')} className={`${styles.docsTabBtn} ${docsTab === 'install' ? styles.docsTabBtnActive : ''}`}>Установка</button>
                <button type="button" onClick={() => setDocsTab('list')} className={`${styles.docsTabBtn} ${docsTab === 'list' ? styles.docsTabBtnActive : ''}`}>Для всех записей</button>
                <button type="button" onClick={() => setDocsTab('one')} className={`${styles.docsTabBtn} ${docsTab === 'one' ? styles.docsTabBtnActive : ''}`}>Для одной записи</button>
                <button type="button" onClick={() => setDocsTab('extra')} className={`${styles.docsTabBtn} ${docsTab === 'extra' ? styles.docsTabBtnActive : ''}`}>Дополнительно</button>
              </div>

              {docsTab === 'install' && (
                <div className={styles.docsGrid}>
                  {[
                    { id: 'install-cmd', title: 'Установить пакет', code: installSnippet },
                    { id: 'install-client', title: 'Создать api-клиент (с Authorization)', code: baseClientSnippet },
                  ].map((snippet) => {
                    const blockKey = `${docs.title}-${snippet.id}`;
                    const isCopied = copiedDocBlock === blockKey;
                    return (
                      <div key={snippet.id} className={styles.docsCard}>
                        <div className={styles.docsCardHeader}>
                          <div className={styles.docsLabel}>{snippet.title}</div>
                          <button type="button" className={styles.docsCopyBtn} onClick={() => copyDocBlock(blockKey, snippet.code)}>
                            {isCopied ? <Check size={14} /> : <Copy size={14} />}
                            <span>{isCopied ? 'Скопировано' : 'Копировать'}</span>
                          </button>
                        </div>
                        <pre className={styles.docsPre}><code>{snippet.code}</code></pre>
                      </div>
                    );
                  })}
                </div>
              )}

              {docsTab === 'list' && (
                <div className={styles.docsGrid}>
                  {[
                    { id: 'list-no-pagination', title: 'Получить все записи (без пагинации)', code: listNoPaginationSnippet },
                    { id: 'list-with-pagination', title: 'Если нужна пагинация', code: listWithPaginationSnippet },
                  ].map((snippet) => {
                    const blockKey = `${docs.title}-${snippet.id}`;
                    const isCopied = copiedDocBlock === blockKey;
                    return (
                      <div key={snippet.id} className={styles.docsCard}>
                        <div className={styles.docsCardHeader}>
                          <div className={styles.docsLabel}>{snippet.title}</div>
                          <button type="button" className={styles.docsCopyBtn} onClick={() => copyDocBlock(blockKey, snippet.code)}>
                            {isCopied ? <Check size={14} /> : <Copy size={14} />}
                            <span>{isCopied ? 'Скопировано' : 'Копировать'}</span>
                          </button>
                        </div>
                        <pre className={styles.docsPre}><code>{snippet.code}</code></pre>
                      </div>
                    );
                  })}
                </div>
              )}

              {docsTab === 'one' && (
                <div className={styles.docsGrid}>
                  {[
                    { id: 'one-record', title: 'Получить одну запись по id', code: oneRecordSnippet },
                  ].map((snippet) => {
                    const blockKey = `${docs.title}-${snippet.id}`;
                    const isCopied = copiedDocBlock === blockKey;
                    return (
                      <div key={snippet.id} className={styles.docsCard}>
                        <div className={styles.docsCardHeader}>
                          <div className={styles.docsLabel}>{snippet.title}</div>
                          <button type="button" className={styles.docsCopyBtn} onClick={() => copyDocBlock(blockKey, snippet.code)}>
                            {isCopied ? <Check size={14} /> : <Copy size={14} />}
                            <span>{isCopied ? 'Скопировано' : 'Копировать'}</span>
                          </button>
                        </div>
                        <pre className={styles.docsPre}><code>{snippet.code}</code></pre>
                      </div>
                    );
                  })}
                </div>
              )}

              {docsTab === 'extra' && (
                <div className={styles.docsGrid}>
                  {[
                    { id: 'full-example', title: 'Полный пример файла', code: fullExampleSnippet },
                  ].map((snippet) => {
                    const blockKey = `${docs.title}-${snippet.id}`;
                    const isCopied = copiedDocBlock === blockKey;
                    return (
                      <div key={snippet.id} className={styles.docsCard}>
                        <div className={styles.docsCardHeader}>
                          <div className={styles.docsLabel}>{snippet.title}</div>
                          <button type="button" className={styles.docsCopyBtn} onClick={() => copyDocBlock(blockKey, snippet.code)}>
                            {isCopied ? <Check size={14} /> : <Copy size={14} />}
                            <span>{isCopied ? 'Скопировано' : 'Копировать'}</span>
                          </button>
                        </div>
                        <pre className={styles.docsPre}><code>{snippet.code}</code></pre>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className={styles.docsBlock}>
                <div className={styles.docsLabel}>Endpoint</div>
                <code className={styles.docsCode}>{docs.endpoint}</code>
              </div>
              <div className={styles.docsBlock}>
                <div className={styles.docsLabel}>Дополнительно</div>
                <ul className={styles.docsList}>
                  {docs.notes.map((note, idx) => (
                    <li key={idx}>{note}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
