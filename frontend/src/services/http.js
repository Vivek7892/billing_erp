import axios from 'axios'
import toast from 'react-hot-toast'

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

export const forceLogout = (triggerRedirect = true) => {
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
    window.dispatchEvent(new CustomEvent('auth:session-expired'))
    window.dispatchEvent(new CustomEvent('auth:logout'))
    if (triggerRedirect && window.location.pathname !== '/login') {
      const redirectTarget = window.location.pathname + window.location.search
      window.location.href = `/login?redirect=${encodeURIComponent(redirectTarget)}`
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

// Response interceptor: Centralized Error Normalization, Retries & Auth
http.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config

    // 1. Network Failure / Offline Detection
    if (!error.response) {
      error.isNetworkError = true
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        error.isOffline = true
      }
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        error.isTimeout = true
      }
      return Promise.reject(error)
    }

    const status = error.response.status

    // 2. Timeout (HTTP 408)
    if (status === 408) {
      error.isTimeout = true
      return Promise.reject(error)
    }

    // 3. Permission Denied (HTTP 403)
    if (status === 403) {
      error.isForbidden = true
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:forbidden', { detail: error.response?.data }))
      }
      return Promise.reject(error)
    }

    // 4. Server Errors (HTTP 500, 502, 503, 504)
    if (status >= 500) {
      error.isServerError = true
      return Promise.reject(error)
    }

    // 5. Unauthorized (HTTP 401) & Token Refresh
    if (status !== 401) {
      return Promise.reject(error)
    }

    error.isSessionExpired = true

    // Never retry the refresh endpoint itself
    if (originalRequest?.url?.includes('/auth/refresh/')) {
      forceLogout(false)
      return Promise.reject(error)
    }

    // Login credential failures should not trigger refresh/logout loop
    if (originalRequest?.url?.includes('/auth/login/')) {
      return Promise.reject(error)
    }

    // Prevent infinite retry loop
    if (originalRequest?._retry) {
      forceLogout(false)
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
        forceLogout(false)
      }

      return Promise.reject(refreshError)
    }
  }
)

// ------------------------------------------------------
// Payload & Error formatting helpers
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

/**
 * Parses any API error into a clean, human-readable string.
 * Handles DRF serializer errors, nested validation errors, network failures, timeouts, and standard HTTP errors.
 */
export function errorMessage(error, fallback = 'Something went wrong') {
  if (!error) return fallback

  // Network / Offline
  if (error.isOffline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return 'No internet connection. Please verify your network.'
  }
  if (error.isNetworkError) {
    return 'Unable to reach the server. Please check your connection or try again later.'
  }
  if (error.isTimeout || error.code === 'ECONNABORTED') {
    return 'Request timed out. The server took too long to respond.'
  }

  const status = error.response?.status
  const payload = error.response?.data

  // DRF direct detail / message / error string
  if (typeof payload === 'string' && payload.trim()) {
    return payload
  }
  if (typeof payload?.detail === 'string' && payload.detail.trim()) {
    return payload.detail
  }
  if (typeof payload?.message === 'string' && payload.message.trim()) {
    return payload.message
  }
  if (typeof payload?.error === 'string' && payload.error.trim()) {
    return payload.error
  }

  // DRF errors array or object
  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    const first = payload.errors[0]
    return typeof first === 'string' ? first : errorMessage({ response: { data: first } }, fallback)
  }

  if (payload?.errors && typeof payload.errors === 'object') {
    const entries = Object.entries(payload.errors)
    if (entries.length > 0) {
      const [field, messages] = entries[0]
      const msgText = Array.isArray(messages) ? messages[0] : String(messages)
      const fieldName = field === 'non_field_errors' || field === 'detail' ? '' : `${field.replace(/_/g, ' ')}: `
      return `${fieldName}${msgText}`
    }
  }

  // DRF raw validation dictionary: e.g. { username: ["This field is required."] }
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const entries = Object.entries(payload).filter(([k]) => k !== 'status_code' && k !== 'success')
    if (entries.length > 0) {
      const [field, messages] = entries[0]
      const msgText = Array.isArray(messages) ? messages[0] : String(messages)
      const fieldName = field === 'non_field_errors' || field === 'detail' || field === 'error' ? '' : `${field.replace(/_/g, ' ')}: `
      return `${fieldName}${msgText}`
    }
  }

  // HTTP status fallbacks
  if (status === 400) return 'Invalid request data. Please check your inputs.'
  if (status === 401) return 'Session expired. Please sign in again.'
  if (status === 403) return 'Access denied. You do not have permission for this action.'
  if (status === 404) return 'The requested resource was not found.'
  if (status === 429) return 'Too many requests. Please wait a moment and try again.'
  if (status === 500) return 'Internal server error. Please try again later.'
  if (status === 502 || status === 503 || status === 504) {
    return 'The server is temporarily unavailable. Please try again shortly.'
  }

  if (error.message && typeof error.message === 'string') {
    return error.message
  }

  return fallback
}

// ------------------------------------------------------
// Toast Notification Deduplication Helper
// ------------------------------------------------------
const recentToasts = new Set()

export function notifyApiError(error, fallback = 'Something went wrong') {
  const msg = errorMessage(error, fallback)
  if (recentToasts.has(msg)) return
  recentToasts.add(msg)
  toast.error(msg)
  setTimeout(() => {
    recentToasts.delete(msg)
  }, 3500)
}

// ------------------------------------------------------
// Safe Request Retry Utility (Exponential Backoff)
// ------------------------------------------------------
export async function executeWithRetry(asyncFn, options = {}) {
  const {
    maxRetries = 2,
    initialDelayMs = 1000,
    shouldRetry = (err) => err.isNetworkError || err.isTimeout || [502, 503, 504].includes(err?.response?.status),
  } = options

  let attempt = 0
  while (true) {
    try {
      return await asyncFn()
    } catch (err) {
      attempt++
      if (attempt > maxRetries || !shouldRetry(err, attempt)) {
        throw err
      }
      const delay = initialDelayMs * Math.pow(2, attempt - 1)
      await new Promise(r => setTimeout(r, delay))
    }
  }
}

export default http
