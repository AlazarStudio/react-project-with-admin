import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <main
      style={{
        padding: '2rem',
        textAlign: 'center',
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <h1 style={{ fontSize: '4rem', margin: 0 }}>404</h1>
      <p style={{ fontSize: '1.25rem', color: '#64748b' }}>
        Страница не найдена
      </p>
      <p>
        <Link to="/" style={{ color: '#2563eb', textDecoration: 'underline' }}>
          На главную
        </Link>
        {' · '}
        <Link to="/admin" style={{ color: '#2563eb', textDecoration: 'underline' }}>
          В админ-панель
        </Link>
      </p>
    </main>
  )
}
