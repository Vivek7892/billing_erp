import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import http, { setOnUnauthorizedCallback } from './services/http'
import { clearAuthSession, getAccessToken, getRememberMePreference, getStoredAuthUser, saveAuthSession, saveAuthUser } from './services/tokenStorage'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredAuthUser)
  const [loading, setLoading] = useState(true)

  const logout = useCallback(() => {
    clearAuthSession()
    setUser(null)
  }, [])

  useEffect(() => {
    setOnUnauthorizedCallback(logout)
    const handleAuthLogout = () => logout()
    window.addEventListener('auth:logout', handleAuthLogout)

    const token = getAccessToken()
    if (token) {
      http.get('/auth/me/')
        .then(r => {
          setUser(r.data)
          if (r.data) saveAuthUser(r.data)
        })
        .catch(error => {
          const status = error.response?.status
          if ([401, 403].includes(status)) {
            clearAuthSession()
          }
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }

    return () => {
      window.removeEventListener('auth:logout', handleAuthLogout)
      setOnUnauthorizedCallback(null)
    }
  }, [logout])

  const login = async (username, password, rememberMe = getRememberMePreference()) => {
    const { data } = await http.post('/auth/login/', { username, password })
    saveAuthSession(data, rememberMe)
    setUser(data.user)
    return data.user
  }

  const register = async (payload, rememberMe = getRememberMePreference()) => {
    const { data } = await http.post('/auth/register/', payload)
    if (!data.require_verification && data.access && data.user) {
      saveAuthSession(data, rememberMe)
      setUser(data.user)
    }
    return data
  }

  const updateUser = useCallback(userData => {
    setUser(prev => {
      const updated = typeof userData === 'function' ? userData(prev) : { ...prev, ...userData }
      saveAuthUser(updated)
      return updated
    })
  }, [])

  const refreshMe = useCallback(async () => {
    try {
      const { data } = await http.get('/auth/me/')
      setUser(data)
      saveAuthUser(data)
      return data
    } catch {
      return null
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateUser, refreshMe, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
