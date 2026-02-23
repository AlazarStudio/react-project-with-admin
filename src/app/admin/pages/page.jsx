'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import AdminRegionPage from '../region/page';
import AdminFooterPage from '../footer/page';
import AdminHomePage from '../home/page';
import AdminRoutesPage from './routes/page';
import AdminPlacesPage from './places/page';
import AdminNewsPage from './news/page';
import AdminServicesPage from './services/page';
import styles from '../admin.module.css';

const TABS = ['home', 'region', 'footer', 'routes', 'places', 'news', 'services'];

export default function AdminPagesPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tabFromUrl = searchParams.get('tab') || 'home';
  const [activeTab, setActiveTab] = useState(TABS.includes(tabFromUrl) ? tabFromUrl : 'home');

  useEffect(() => {
    const tab = searchParams.get('tab') || 'home';
    setActiveTab(TABS.includes(tab) ? tab : 'home');
  }, [searchParams]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    navigate(`/admin/pages?tab=${tab}`, { replace: true });
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Страницы сайта</h1>
          <p className={styles.pageSubtitle}>Редактирование страниц сайта</p>
        </div>
      </div>

      <div className={styles.pageTabs}>
        <button
          type="button"
          className={`${styles.pageTab} ${activeTab === 'home' ? styles.pageTabActive : ''}`}
          onClick={() => handleTabChange('home')}
        >
          Главная
        </button>
        <button
          type="button"
          className={`${styles.pageTab} ${activeTab === 'region' ? styles.pageTabActive : ''}`}
          onClick={() => handleTabChange('region')}
        >
          О регионе
        </button>
        
        <button
          type="button"
          className={`${styles.pageTab} ${activeTab === 'routes' ? styles.pageTabActive : ''}`}
          onClick={() => handleTabChange('routes')}
        >
          Маршруты
        </button>
        <button
          type="button"
          className={`${styles.pageTab} ${activeTab === 'places' ? styles.pageTabActive : ''}`}
          onClick={() => handleTabChange('places')}
        >
          Интересные места
        </button>
        <button
          type="button"
          className={`${styles.pageTab} ${activeTab === 'news' ? styles.pageTabActive : ''}`}
          onClick={() => handleTabChange('news')}
        >
          Новости
        </button>
        <button
          type="button"
          className={`${styles.pageTab} ${activeTab === 'services' ? styles.pageTabActive : ''}`}
          onClick={() => handleTabChange('services')}
        >
          Сервис и услуги
        </button>
        <button
          type="button"
          className={`${styles.pageTab} ${activeTab === 'footer' ? styles.pageTabActive : ''}`}
          onClick={() => handleTabChange('footer')}
        >
          Подвал сайта
        </button>
      </div>

      <div className={styles.tabContent}>
        {activeTab === 'home' && <AdminHomePage />}
        {activeTab === 'region' && <AdminRegionPage />}
        {activeTab === 'footer' && <AdminFooterPage />}
        {activeTab === 'routes' && <AdminRoutesPage />}
        {activeTab === 'places' && <AdminPlacesPage />}
        {activeTab === 'news' && <AdminNewsPage />}
        {activeTab === 'services' && <AdminServicesPage />}
      </div>
    </div>
  );
}
