import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import http, { setOnUnauthorizedCallback } from './services/http'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('auth_user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(true)

  const logout = useCallback(() => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('auth_user')
    setUser(null)
  }, [])

  useEffect(() => {
    setOnUnauthorizedCallback(logout)
    const handleAuthLogout = () => logout()
    window.addEventListener('auth:logout', handleAuthLogout)

    const token = localStorage.getItem('access_token')
    if (token) {
      http.get('/auth/me/')
        .then(r => {
          setUser(r.data)
          if (r.data) localStorage.setItem('auth_user', JSON.stringify(r.data))
        })
        .catch(error => {
          const status = error.response?.status
          if ([401, 403].includes(status)) {
            localStorage.removeItem('access_token')
            localStorage.removeItem('refresh_token')
            localStorage.removeItem('auth_user')
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

  const login = async (username, password) => {
    const { data } = await http.post('/auth/login/', { username, password })
    localStorage.setItem('access_token', data.access)
    localStorage.setItem('refresh_token', data.refresh)
    if (data.user) localStorage.setItem('auth_user', JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
