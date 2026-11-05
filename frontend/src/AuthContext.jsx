import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import http, { setOnUnauthorizedCallback } from './services/http'
import {
  clearAuthSession,
  getAccessToken,
  getAuthValue,
  getRememberMePreference,
  getStoredAuthUser,
  saveAuthSession,
  saveAuthUser
} from './services/tokenStorage'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredAuthUser)
  const [loading, setLoading] = useState(true)

  const logout = useCallback(async () => {
    try {
      const refreshToken = getAuthValue('refresh_token')
      if (refreshToken) {
        await http.post('/auth/logout/', { refresh: refreshToken })
      }
    } catch {
      // Ignore network errors on logout
    } finally {
      clearAuthSession()
      setUser(null)
    }
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

  const login = async (mobile, password, rememberMe = getRememberMePreference()) => {
    const { data } = await http.post('/auth/login/', {
      mobile,
      password,
      remember_me: rememberMe,
    })
    if (data?.totp_required) {
      return data
    }
    saveAuthSession(data, rememberMe)
    setUser(data.user)
    return data.user
  }

  const loginWithPIN = async (mobile, pin, rememberMe = getRememberMePreference()) => {
    const { data } = await http.post('/auth/pin-login/', {
      mobile,
      pin,
      remember_me: rememberMe,
    })
    if (data?.totp_required) {
      return data
    }
    saveAuthSession(data, rememberMe)
    setUser(data.user)
    return data.user
  }

  const verify2FA = async ({ temp_token, code, recovery_code }, rememberMe = getRememberMePreference()) => {
    const { data } = await http.post('/auth/verify-2fa/', {
      temp_token,
      code,
      recovery_code,
      remember_me: rememberMe,
    })
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

  const verifyOTP = async ({ identifier, otp, purpose = 'signup' }, rememberMe = getRememberMePreference()) => {
    const { data } = await http.post('/auth/verify-otp/', {
      identifier,
      otp,
      purpose,
    })
    if (data.access && data.user) {
      saveAuthSession(data, rememberMe)
      setUser(data.user)
    }
    return data
  }

  const hasPermission = useCallback((permName) => {
    if (!user) return false
    if (user.role === 'owner') return true
    const effective = user.effective_permissions || []
    return effective.includes(permName)
  }, [user])

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
    <AuthContext.Provider value={{
      user,
      login,
      loginWithPIN,
      verify2FA,
      register,
      verifyOTP,
      logout,
      hasPermission,
      updateUser,
      refreshMe,
      loading
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
