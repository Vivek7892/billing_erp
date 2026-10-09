import axios from 'axios'

// ------------------------------------------------------
// API BASE URL
// ------------------------------------------------------
const _base = (
  import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
).replace(/\/+$/, '')

export const API_BASE_URL = _base.endsWith('/api') ? _base : `${_base}/api`

// ------------------------------------------------------
// Token refresh & auth synchronization
// ------------------------------------------------------
let isRefreshing = false
let refreshSubscribers = []
let onUnauthorizedCallback = null

export function setOnUnauthorizedCallback(cb) {
  onUnauthorizedCallback = cb
}

const subscribeTokenRefresh = callback => {
  refreshSubscribers.push(callback)
}

const onRefreshed = token => {
  refreshSubscribers.forEach(callback => callback(token))
  refreshSubscribers = []
}

const onRefreshFailed = error => {
  refreshSubscribers.forEach(callback => callback(null, error))
  refreshSubscribers = []
}

export const forceLogout = () => {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')

  if (typeof onUnauthorizedCallback === 'function') {
    try {
      onUnauthorizedCallback()
    } catch {
      // ignore
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth:logout'))
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
  }
}

const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem('refresh_token')

  if (!refreshToken) {
    throw new Error('No refresh token available')
  }

  const response = await axios.post(
    `${API_BASE_URL}/auth/refresh/`,
    {
      refresh: refreshToken,
    },
    {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    }
  )

  const newAccessToken = response.data?.access

  if (!newAccessToken) {
    throw new Error('Refresh response did not contain an access token')
  }

  localStorage.setItem('access_token', newAccessToken)
  return newAccessToken
}

// ------------------------------------------------------
// HTTP Axios instance
// ------------------------------------------------------
export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// Request interceptor: Inject Authorization header
http.interceptors.request.use(
  config => {
    const accessToken = localStorage.getItem('access_token')
    if (accessToken) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${accessToken}`
    }
    return config
  },
  error => Promise.reject(error)
)

// Response interceptor: Handle 401 & token refresh
http.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config

    if (!error.response) {
      return Promise.reject(error)
    }

    const status = error.response.status

    if (status !== 401) {
      return Promise.reject(error)
    }

    // Never retry the refresh endpoint itself
    if (originalRequest?.url?.includes('/auth/refresh/')) {
      forceLogout()
      return Promise.reject(error)
    }

    // Login credential failures should not trigger refresh/logout loop
    if (originalRequest?.url?.includes('/auth/login/')) {
      return Promise.reject(error)
    }

    // Prevent infinite retry loop
    if (originalRequest?._retry) {
      forceLogout()
      return Promise.reject(error)
    }

    originalRequest._retry = true

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        subscribeTokenRefresh((newToken, refreshError) => {
          if (refreshError || !newToken) {
            reject(refreshError || new Error('Token refresh failed'))
            return
          }

          originalRequest.headers = originalRequest.headers || {}
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          resolve(http(originalRequest))
        })
      })
    }

    isRefreshing = true

    try {
      const newAccessToken = await refreshAccessToken()
      isRefreshing = false
      onRefreshed(newAccessToken)

      originalRequest.headers = originalRequest.headers || {}
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
      return http(originalRequest)
    } catch (refreshError) {
      isRefreshing = false
      onRefreshFailed(refreshError)

      const refreshStatus = refreshError?.response?.status
      if ([400, 401, 403].includes(refreshStatus)) {
        forceLogout()
      }

      return Promise.reject(refreshError)
    }
  }
)

// ------------------------------------------------------
// Payload helpers
// ------------------------------------------------------
export function unwrapResponse(response) {
  const payload = response?.data
  if (payload?.success === true && Object.prototype.hasOwnProperty.call(payload, 'data')) {
    return payload.data
  }
  return payload
}

export function listData(response) {
  const payload = unwrapResponse(response)
  return payload?.results ?? payload ?? []
}

export function errorMessage(error, fallback = 'Something went wrong') {
  const payload = error?.response?.data
  if (typeof payload?.message === 'string' && payload.message) return payload.message
  if (typeof payload?.detail === 'string' && payload.detail) return payload.detail
  if (typeof payload?.error === 'string' && payload.error) return payload.error
  if (Array.isArray(payload?.errors)) return payload.errors[0] || fallback
  if (error?.message) return error.message
  return fallback
}

export default http
