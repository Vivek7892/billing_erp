const TOKEN_KEYS = ['access_token', 'refresh_token']

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

export function clearAuthSession() {
  const stores = [localStorage, sessionStorage]
  stores.forEach(storage => {
    TOKEN_KEYS.forEach(key => storage.removeItem(key))
    storage.removeItem('auth_user')
  })
}
