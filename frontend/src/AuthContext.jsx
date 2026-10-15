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

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
