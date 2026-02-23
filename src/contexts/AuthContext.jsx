'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authAPI, userAPI, USER_TOKEN_KEY } from '@/lib/api'

const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const favorites = {
    route: user?.favoriteRouteIds || [],
    place: user?.favoritePlaceIds || [],
    service: user?.favoriteServiceIds || [],
  }

  const refreshProfile = useCallback(async () => {
    const token = typeof window !== 'undefined' 
      ? (localStorage.getItem(USER_TOKEN_KEY) || localStorage.getItem('adminToken'))
      : null
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const { data } = await userAPI.getProfile()
      setUser(data)
      // Синхронизируем с админскими токенами для совместимости
      if (typeof window !== 'undefined') {
        localStorage.setItem('adminToken', token)
        localStorage.setItem('adminUser', JSON.stringify(data))
      }
    } catch {
      setUser(null)
      if (typeof window !== 'undefined') {
        localStorage.removeItem(USER_TOKEN_KEY)
        localStorage.removeItem('adminToken')
        localStorage.removeItem('adminUser')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const token = typeof window !== 'undefined' 
      ? (localStorage.getItem(USER_TOKEN_KEY) || localStorage.getItem('adminToken'))
      : null
    if (!token) {
      setLoading(false)
      return
    }
    // Если есть adminToken но нет USER_TOKEN_KEY, синхронизируем
    if (typeof window !== 'undefined' && localStorage.getItem('adminToken') && !localStorage.getItem(USER_TOKEN_KEY)) {
      localStorage.setItem(USER_TOKEN_KEY, localStorage.getItem('adminToken'))
    }
    refreshProfile()
  }, [refreshProfile])

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null)
    }
    window.addEventListener('user-unauthorized', handleUnauthorized)
    return () => window.removeEventListener('user-unauthorized', handleUnauthorized)
  }, [])

  const login = useCallback(async (loginData) => {
    try {
      // console.log('AuthContext: отправка запроса на /auth/login', loginData)
      const response = await authAPI.login(loginData)
      // console.log('AuthContext: получен ответ', response.data)
      const { user: u, token } = response.data
      if (!u || !token) {
        throw new Error('Неверный формат ответа от сервера')
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem(USER_TOKEN_KEY, token)
        // Также сохраняем для совместимости с админкой
        localStorage.setItem('adminToken', token)
        localStorage.setItem('adminUser', JSON.stringify(u))
      }
      setUser(u)
      return u
    } catch (error) {
      console.error('AuthContext: ошибка при логине', error)
      throw error
    }
  }, [])

  const register = useCallback(async (registerData) => {
    const response = await authAPI.register(registerData)
    const { user: u, token } = response.data
    if (typeof window !== 'undefined') localStorage.setItem(USER_TOKEN_KEY, token)
    setUser(u)
    return u
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    if (typeof window !== 'undefined') {
      localStorage.removeItem(USER_TOKEN_KEY)
      // Также удаляем админские токены
      localStorage.removeItem('adminToken')
      localStorage.removeItem('adminUser')
    }
  }, [])

  const isFavorite = useCallback(
    (entityType, entityId) => {
      const list = favorites[entityType]
      return Array.isArray(list) && list.includes(entityId)
    },
    [favorites.route, favorites.place, favorites.service]
  )

  const toggleFavorite = useCallback(
    async (entityType, entityId) => {
      if (!user) return null
      const isFav = isFavorite(entityType, entityId)
      try {
        if (isFav) {
          const { data } = await userAPI.removeFavorite(entityType, entityId)
          setUser(data)
          return false
        } else {
          const { data } = await userAPI.addFavorite(entityType, entityId)
          setUser(data)
          return true
        }
      } catch (err) {
        console.error('[Favorites] toggle failed:', err?.response?.data || err)
        return null
      }
    },
    [user, isFavorite]
  )

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    refreshProfile,
    favorites,
    isFavorite,
    toggleFavorite,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
