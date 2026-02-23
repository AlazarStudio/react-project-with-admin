'use client'

import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { updateApiBaseUrl, configAPI } from '@/lib/api'
import styles from './login.module.css'

export default function AdminLoginPage() {
  const [searchParams] = useSearchParams()
  const returnUrl = searchParams.get('returnUrl') || '/admin'
  const navigate = useNavigate()
  const { login } = useAuth()
  const [formData, setFormData] = useState({ login: '', password: '' })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  // Состояние для формы ввода URL бэкенда
  const [showBackendUrlForm, setShowBackendUrlForm] = useState(false)
  const [backendUrl, setBackendUrl] = useState('')
  const [backendUrlSaving, setBackendUrlSaving] = useState(false)
  const [backendUrlError, setBackendUrlError] = useState('')
  
  // Проверяем, есть ли конфиг при загрузке страницы
  useEffect(() => {
    const checkConfig = async () => {
      // Проверяем дефолтный URL из env
      const envUrl = import.meta.env.VITE_API_URL
      if (envUrl && envUrl.trim() && !envUrl.startsWith('/')) {
        return // Есть полный URL в env, показываем форму логина
      }
      
      // Пробуем загрузить конфиг с бэка
      try {
        const axios = (await import('axios')).default
        const testAxios = axios.create({
          baseURL: '/api',
          timeout: 3000,
        })
        const response = await testAxios.get('/config')
        if (response.data?.backendApiUrl) {
          return // Конфиг есть, показываем форму логина
        }
      } catch (e) {
        // Если не удалось загрузить конфиг - показываем форму ввода URL
      }
      
      // Если конфига нет - показываем форму ввода URL
      setShowBackendUrlForm(true)
    }
    
    checkConfig()
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    setError('')
  }
  
  const handleBackendUrlSubmit = async (e) => {
    e.preventDefault()
    if (!backendUrl.trim()) {
      setBackendUrlError('Введите URL backend')
      return
    }
    
    setBackendUrlSaving(true)
    setBackendUrlError('')
    
    try {
      const testUrl = backendUrl.trim()
      
      // ВАЛИДАЦИЯ: Проверяем что это валидный URL
      let fullUrl
      try {
        // Пробуем создать URL объект - если невалидный, выбросит ошибку
        if (testUrl.startsWith('http://') || testUrl.startsWith('https://')) {
          fullUrl = new URL(testUrl)
        } else {
          // Если нет протокола, добавляем http://
          fullUrl = new URL(`http://${testUrl}`)
        }
        
        // Проверяем что это http или https
        if (!['http:', 'https:'].includes(fullUrl.protocol)) {
          throw new Error('URL должен начинаться с http:// или https://')
        }
        
        // Проверяем что есть hostname (не пустой)
        if (!fullUrl.hostname || fullUrl.hostname.trim() === '') {
          throw new Error('URL должен содержать домен или IP адрес')
        }
        
        // Проверяем что hostname валидный (IP адрес, localhost, или домен с точкой)
        const hostname = fullUrl.hostname
        const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)
        const isLocalhost = hostname === 'localhost'
        const hasDomain = hostname.includes('.') && hostname.split('.').length >= 2
        
        if (!isIP && !isLocalhost && !hasDomain) {
          throw new Error('URL должен содержать валидный домен (например: example.com) или IP адрес')
        }
      } catch (urlError) {
        setBackendUrlError(urlError.message || 'Введите корректный URL (например: http://localhost:5000 или https://back.example.com)')
        setBackendUrlSaving(false)
        return
      }
      
      // Формируем полный URL для проверки (без /api в конце)
      const baseUrl = fullUrl.toString().replace(/\/+$/, '') // Убираем trailing slash
      const testApiUrl = `${baseUrl}/api`
      const urlToSave = baseUrl // Сохраняем без /api
      
      console.log('🔍 Проверяю подключение к:', testApiUrl)
      
      // Создаем временный axios для проверки подключения
      const axios = (await import('axios')).default
      const testAxios = axios.create({
        baseURL: testApiUrl,
        timeout: 5000,
      })
      
      // Пробуем подключиться к НАШЕМУ бэкенду - проверяем endpoint /api/config
      let connectionSuccessful = false
      let isOurBackend = false
      
      try {
        console.log(`  Пробую подключиться к нашему бэкенду через /api/config...`)
        const response = await testAxios.get('/config', {
          timeout: 5000,
          validateStatus: (status) => status === 200,
        })
        
        // Проверяем что ответ имеет правильную структуру (наш бэкенд возвращает { backendApiUrl: ... })
        if (response.data && typeof response.data === 'object' && 'backendApiUrl' in response.data) {
          console.log(`  ✅ Это наш бэкенд! Получен ответ от /api/config`)
          connectionSuccessful = true
          isOurBackend = true
        } else {
          console.log(`  ⚠️ Сервер доступен, но это не наш бэкенд (неправильный формат ответа)`)
        }
      } catch (testError) {
        if (testError.code === 'ECONNREFUSED' || testError.code === 'ETIMEDOUT' || testError.code === 'ENOTFOUND') {
          console.log(`  ❌ Ошибка сети:`, testError.code, testError.message)
        } else if (testError.response) {
          console.log(`  ⚠️ Сервер доступен, но вернул статус ${testError.response.status}`)
          if (testError.response.status === 404) {
            console.log(`  ❌ Endpoint /api/config не найден - это не наш бэкенд`)
          }
        } else {
          console.log(`  ❌ Ошибка:`, testError.message)
        }
      }
      
      if (!connectionSuccessful || !isOurBackend) {
        console.error('❌ Не удалось подключиться к бэкенду')
        setBackendUrlError('Не удалось подключиться к бэкенду. Убедитесь, что указан правильный адрес сервера.')
        setBackendUrlSaving(false)
        return
      }
      
      // Если подключение успешно - сохраняем URL в БД
      console.log('💾 Сохраняю URL в БД...')
      try {
        const axios = (await import('axios')).default
        const saveApi = axios.create({
          baseURL: testApiUrl,
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        })
        // Передаем URL фронтенда для обновления config.json через PHP
        const frontendUrl = typeof window !== 'undefined' ? window.location.origin : '';
        console.log('📤 Отправляю данные:', { backendApiUrl: urlToSave, frontendUrl: frontendUrl })
        const response = await saveApi.put('/config', { 
          backendApiUrl: urlToSave,
          frontendUrl: frontendUrl
        })
        console.log('✅ URL сохранен в БД:', response.data)
      } catch (saveError) {
        console.error('❌ Ошибка сохранения в БД:', saveError)
        throw saveError
      }
      
      // Обновляем baseURL
      console.log('💾 Обновляю baseURL...')
      updateApiBaseUrl(urlToSave)
      console.log('✅ URL backend обновлен:', urlToSave)
      
      // Скрываем форму ввода URL и показываем форму логина
      setShowBackendUrlForm(false)
    } catch (error) {
      console.error('Ошибка сохранения URL backend:', error)
      setBackendUrlError(
        error.response?.data?.message || error.message || 'Не удалось подключиться к указанному backend'
      )
    } finally {
      setBackendUrlSaving(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    try {
      // console.log('Попытка входа с данными:', { login: formData.login, password: '***' })
      const user = await login(formData)
      // console.log('Получен пользователь:', user)
      
      // Проверяем роль пользователя
      if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
        setError('У вас нет доступа к админ панели')
        setIsLoading(false)
        return
      }
      
      // Редиректим в админку
      navigate(returnUrl, { replace: true })
    } catch (err) {
      console.error('Ошибка входа:', err)
      console.error('Детали ошибки:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        config: err.config
      })
      setError(
        err.response?.data?.message || err.message || 'Ошибка входа. Проверьте логин и пароль.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Если нужно показать форму ввода URL бэкенда
  if (showBackendUrlForm) {
    return (
      <main className={styles.loginContainer}>
        <div className={styles.loginCard}>
          <div className={styles.loginHeader}>
            <h1>Настройка подключения</h1>
            <p>Укажите адрес вашего backend сервера</p>
          </div>
          <form onSubmit={handleBackendUrlSubmit} className={styles.loginForm}>
            {backendUrlError && <div className={styles.error}>{backendUrlError}</div>}
            <div className={styles.formGroup}>
              <label htmlFor="backendUrl" className={styles.label}>URL Backend</label>
              <input
                type="text"
                id="backendUrl"
                name="backendUrl"
                value={backendUrl}
                onChange={(e) => setBackendUrl(e.target.value)}
                className={styles.input}
                placeholder="http://localhost:5000 или https://back.alazarstudio.ru (без /api в конце)"
                required
                autoFocus
              />
              <p style={{ 
                marginTop: 8, 
                fontSize: '0.85rem', 
                color: '#64748b' 
              }}>
                Укажите базовый URL вашего backend сервера без /api в конце. Например: <code style={{ 
                  background: '#e2e8f0', 
                  padding: '2px 6px', 
                  borderRadius: 4,
                  fontSize: '0.85rem'
                }}>http://localhost:5000</code> или <code style={{ 
                  background: '#e2e8f0', 
                  padding: '2px 6px', 
                  borderRadius: 4,
                  fontSize: '0.85rem'
                }}>https://your-backend.com</code>
              </p>
            </div>
            <button type="submit" className={styles.submitBtn} disabled={backendUrlSaving}>
              {backendUrlSaving ? 'Подключение...' : 'Продолжить'}
            </button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <div className={styles.loginHeader}>
          <h1>Вход в админ панель</h1>
          <p>Войдите для управления контентом</p>
        </div>
        <form onSubmit={handleSubmit} className={styles.loginForm}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.formGroup}>
            <label htmlFor="login" className={styles.label}>Логин</label>
            <input
              type="text"
              id="login"
              name="login"
              value={formData.login}
              onChange={handleChange}
              className={styles.input}
              placeholder="Введите логин"
              required
              autoComplete="username"
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}>Пароль</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={styles.input}
              placeholder="Введите пароль"
              required
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className={styles.submitBtn} disabled={isLoading}>
            {isLoading ? 'Вход...' : 'Войти'}
          </button>
          <button 
            type="button" 
            onClick={() => setShowBackendUrlForm(true)}
            style={{
              marginTop: '12px',
              padding: '8px 16px',
              fontSize: '0.875rem',
              color: '#64748b',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Изменить URL backend
          </button>
        </form>
      </div>
    </main>
  )
}
