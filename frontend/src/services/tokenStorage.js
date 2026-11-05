const TOKEN_KEYS = ['access_token', 'refresh_token']
const CROSS_DOMAIN_COOKIE = 'dwt_auth_transfer'

export function getRememberMePreference() {
  const saved = localStorage.getItem('remember_me')
  if (saved !== null) return saved === 'true'
  // Keep existing sessions persistent when upgrading from the old behavior.
  return Boolean(localStorage.getItem('access_token'))
}

export function getAuthValue(key) {
  return sessionStorage.getItem(key) || localStorage.getItem(key)
}

export function getAccessToken() {
  return getAuthValue('access_token')
}

export function setAccessToken(token) {
  const storage = getRememberMePreference() ? localStorage : sessionStorage
  storage.setItem('access_token', token)
}

export function saveAuthSession({ access, refresh, user }, rememberMe) {
  const destination = rememberMe ? localStorage : sessionStorage
  const previous = rememberMe ? sessionStorage : localStorage

  localStorage.setItem('remember_me', String(rememberMe))
  TOKEN_KEYS.forEach(key => previous.removeItem(key))
  previous.removeItem('auth_user')
  destination.setItem('access_token', access)
  destination.setItem('refresh_token', refresh)
  if (user) destination.setItem('auth_user', JSON.stringify(user))
}

export function saveAuthUser(user) {
  const storage = getRememberMePreference() ? localStorage : sessionStorage
  if (user) storage.setItem('auth_user', JSON.stringify(user))
  else storage.removeItem('auth_user')
}

export function getStoredAuthUser() {
  try {
    const value = getAuthValue('auth_user')
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

/**
 * Set a cross-domain session transfer cookie for subdomains on .dreamwithtech.dev
 */
export function setCrossDomainAuthCookie({ access, refresh, user }, rememberMe = true) {
  if (typeof document === 'undefined') return
  const hostname = window.location.hostname.toLowerCase()
  if (!hostname.endsWith('dreamwithtech.dev')) return

  try {
    const maxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24 // 30 days or 1 day
    const payload = JSON.stringify({ access, refresh, user, rememberMe })
    const isSecure = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${CROSS_DOMAIN_COOKIE}=${encodeURIComponent(payload)}; path=/; domain=.dreamwithtech.dev; max-age=${maxAge}; SameSite=Lax${isSecure}`
  } catch (err) {
    console.error('Failed to set cross-domain auth cookie:', err)
  }
}

/**
 * Remove cross-domain transfer cookies across all domains
 */
export function clearCrossDomainAuthCookie() {
  if (typeof document === 'undefined') return
  try {
    const isSecure = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${CROSS_DOMAIN_COOKIE}=; path=/; domain=.dreamwithtech.dev; max-age=0; SameSite=Lax${isSecure}`
    document.cookie = `${CROSS_DOMAIN_COOKIE}=; path=/; max-age=0; SameSite=Lax${isSecure}`
  } catch {
    // Ignore cookie clear errors
  }
}

export function clearAuthSession() {
  const stores = [localStorage, sessionStorage]
  stores.forEach(storage => {
    TOKEN_KEYS.forEach(key => storage.removeItem(key))
    storage.removeItem('auth_user')
  })
  clearCrossDomainAuthCookie()
}

/**
 * Checks for incoming session transfer when transitioning from accounts.dreamwithtech.dev
 * to app.dreamwithtech.dev. Handles URL hash parameters and root domain cookies.
 */
export function syncIncomingCrossDomainAuth() {
  if (typeof window === 'undefined') return false

  // 1. Check URL hash parameters (#access_token=...&refresh_token=...&remember=...)
  if (window.location.hash && window.location.hash.includes('access_token=')) {
    try {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const access = hashParams.get('access_token')
      const refresh = hashParams.get('refresh_token')
      const rememberParam = hashParams.get('remember')
      const rememberMe = rememberParam === null ? true : rememberParam === '1' || rememberParam === 'true'

      if (access && refresh) {
        saveAuthSession({ access, refresh }, rememberMe)

        // Clean the hash from the browser address bar without triggering a reload
        const cleanUrl = window.location.pathname + window.location.search
        window.history.replaceState(null, '', cleanUrl)
        return true
      }
    } catch (err) {
      console.error('Error syncing auth from URL hash:', err)
    }
  }

  // 2. Check cross-domain transfer cookie on .dreamwithtech.dev
  if (typeof document !== 'undefined' && document.cookie.includes(CROSS_DOMAIN_COOKIE)) {
    try {
      const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${CROSS_DOMAIN_COOKIE}=([^;]+)`))
      if (match && match[1]) {
        const decoded = decodeURIComponent(match[1])
        const data = JSON.parse(decoded)
        if (data?.access && data?.refresh) {
          saveAuthSession(data, data.rememberMe ?? true)
          if (data.user) saveAuthUser(data.user)
          clearCrossDomainAuthCookie()
          return true
        }
      }
    } catch (err) {
      console.error('Error syncing auth from transfer cookie:', err)
    }
  }

  return false
}

// Automatically sync on initial script load
syncIncomingCrossDomainAuth()
