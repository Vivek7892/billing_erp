import axios from 'axios'

// ------------------------------------------------------
// API BASE URL
// ------------------------------------------------------
// Vite:
//   Local:      VITE_API_URL=http://127.0.0.1:8000
//   Production: VITE_API_URL=https://your-backend.onrender.com
//
// Do NOT add a trailing slash.
// ------------------------------------------------------

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
).replace(/\/+$/, '')

export { API_BASE_URL }

// ------------------------------------------------------
// Axios instance
// ------------------------------------------------------

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// ------------------------------------------------------
// Request interceptor
// ------------------------------------------------------

api.interceptors.request.use(
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

// ------------------------------------------------------
// Token refresh handling
// ------------------------------------------------------
//
// Prevents multiple API requests from simultaneously
// trying to refresh the JWT token.
//
// Example:
//   Dashboard -> 401
//   Inventory -> 401
//   Reports   -> 401
//
// Only ONE refresh request is sent.
// The other requests wait for it.
// ------------------------------------------------------

let isRefreshing = false
let refreshSubscribers = []

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

// ------------------------------------------------------
// Refresh access token
// ------------------------------------------------------

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
// Logout helper
// ------------------------------------------------------

const forceLogout = () => {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')

  // Prevent redirecting repeatedly
  if (window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
}

// ------------------------------------------------------
// Response interceptor
// ------------------------------------------------------

api.interceptors.response.use(
  response => response,

  async error => {
    const originalRequest = error.config

    // --------------------------------------------------
    // No response = network/server connection problem
    // --------------------------------------------------

    if (!error.response) {
      return Promise.reject(error)
    }

    const status = error.response.status

    // --------------------------------------------------
    // Only handle 401
    // --------------------------------------------------

    if (status !== 401) {
      return Promise.reject(error)
    }

    // --------------------------------------------------
    // Never retry the refresh endpoint itself
    // --------------------------------------------------

    if (originalRequest?.url?.includes('/auth/refresh/')) {
      forceLogout()
      return Promise.reject(error)
    }

    // --------------------------------------------------
    // Prevent infinite retry loop
    // --------------------------------------------------

    if (originalRequest?._retry) {
      forceLogout()
      return Promise.reject(error)
    }

    originalRequest._retry = true

    // --------------------------------------------------
    // If another request is already refreshing,
    // wait for that refresh request.
    // --------------------------------------------------

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        subscribeTokenRefresh((newToken, refreshError) => {
          if (refreshError || !newToken) {
            reject(refreshError || new Error('Token refresh failed'))
            return
          }

          originalRequest.headers = originalRequest.headers || {}
          originalRequest.headers.Authorization = `Bearer ${newToken}`

          resolve(api(originalRequest))
        })
      })
    }

    // --------------------------------------------------
    // Start token refresh
    // --------------------------------------------------

    isRefreshing = true

    try {
      const newAccessToken = await refreshAccessToken()

      isRefreshing = false

      // Release waiting requests
      onRefreshed(newAccessToken)

      // Retry original request
      originalRequest.headers = originalRequest.headers || {}
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`

      return api(originalRequest)

    } catch (refreshError) {
      isRefreshing = false

      // Reject waiting requests
      onRefreshFailed(refreshError)

      // Refresh token expired/invalid
      forceLogout()

      return Promise.reject(refreshError)
    }
  }
)

export default api