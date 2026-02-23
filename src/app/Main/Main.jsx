import { Link } from 'react-router-dom'
import styles from './Main.module.css'

export default function Main() {
  return (
    <main className={styles.wrapper}>
      <div className={styles.card}>
        <h1 className={styles.title}>Добро пожаловать</h1>
        <p className={styles.lead}>
          Это универсальная админ-панель на React для управления контентом. Здесь вы настраиваете
          подключение к бэкенду, а вся работа с данными — маршруты, страницы, материалы и настройки —
          выполняется в разделе админки.
        </p>
        <p className={styles.note}>
          Укажите URL бэкенда в настройках (если ещё не указан), войдите в панель и управляйте
          контентом через удобное меню. Структура разделов настраивается в админке.
        </p>
        <Link to="/admin" className={styles.cta}>
          Перейти в админ-панель
        </Link>
      </div>
    </main>
  )
}
