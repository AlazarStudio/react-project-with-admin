import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Map, 
  MapPin, 
  Newspaper, 
  Building2, 
  Star,
  Plus
} from 'lucide-react';
import { statsAPI } from '@/lib/api';
import styles from './admin.module.css';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    routes: 0,
    places: 0,
    news: 0,
    services: 0,
    reviews: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await statsAPI.getDashboard();
        setStats(response.data);
      } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
        // Используем моковые данные если API недоступно
        setStats({
          routes: 0,
          places: 0,
          news: 0,
          services: 0,
          reviews: 0,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    { key: 'routes', label: 'Маршруты', icon: Map, color: 'routes' },
    { key: 'places', label: 'Места', icon: MapPin, color: 'places' },
    { key: 'news', label: 'Новости и статьи', icon: Newspaper, color: 'news' },
    { key: 'services', label: 'Услуги', icon: Building2, color: 'services' },
    { key: 'reviews', label: 'Отзывы', icon: Star, color: 'reviews' },
  ];

  const quickActions = [
    { href: '/admin/routes/new', label: 'Добавить маршрут', icon: Plus },
    { href: '/admin/places/new', label: 'Добавить место', icon: Plus },
    { href: '/admin/news/new', label: 'Добавить новость или статью', icon: Plus },
    { href: '/admin/services/new', label: 'Добавить услугу', icon: Plus },
  ];

  return (
    <div className={styles.dashboard}>
      <div className={styles.welcomeCard}>
        <h1>Добро пожаловать в админ панель!</h1>
        <p>Управляйте контентом вашего проекта</p>
      </div>

      <div className={styles.statsGrid}>
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.key} className={styles.statCard}>
              <div className={`${styles.statIcon} ${styles[card.color]}`}>
                <Icon size={24} />
              </div>
              <div className={styles.statInfo}>
                <h3>{isLoading ? '...' : stats[card.key]}</h3>
                <p>{card.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.quickActions}>
        <h2>Быстрые действия</h2>
        <div className={styles.actionsGrid}>
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} to={action.href} className={styles.actionBtn}>
                <Icon size={18} />
                <span>{action.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
