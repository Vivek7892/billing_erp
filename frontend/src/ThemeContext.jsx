import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

/**
 * Theme Context
 * --------------------------------------------------
 * Centralized theme management for the entire ERP app.
 *
 * Supported themes:
 * - light
 * - dark
 */

const ThemeContext = createContext(null)

const STORAGE_KEY = 'app-theme'

const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
}

/**
 * Safely retrieve the saved theme
 */
function getSavedTheme() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const savedTheme = localStorage.getItem(STORAGE_KEY)

    if (
      savedTheme === THEMES.LIGHT ||
      savedTheme === THEMES.DARK
    ) {
      return savedTheme
    }
  } catch (error) {
    console.warn('Unable to access saved theme preference.')
  }

  return null
}

/**
 * Detect system theme preference
 */
function getSystemTheme() {
  if (typeof window === 'undefined') {
    return THEMES.LIGHT
  }

  try {
    return window.matchMedia?.(
      '(prefers-color-scheme: dark)'
    ).matches
      ? THEMES.DARK
      : THEMES.LIGHT
  } catch {
    return THEMES.LIGHT
  }
}

/**
 * Determine initial theme
 */
function getInitialTheme() {
  return getSavedTheme() || getSystemTheme()
}

/**
 * Theme Provider
 */
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme)

  const isDark = theme === THEMES.DARK

  /**
   * Apply theme to document
   */
  useEffect(() => {
    const root = document.documentElement

    // Apply Tailwind dark mode class
    root.classList.toggle('dark', isDark)

    // Apply data attribute for custom CSS
    root.setAttribute('data-theme', theme)

    // Improve native browser controls
    root.style.colorScheme = theme

    // Persist selected theme
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      console.warn('Unable to save theme preference.')
    }
  }, [theme, isDark])

  /**
   * Smooth transition between themes
   */
  useEffect(() => {
    const root = document.documentElement

    root.classList.add('theme-transition')

    const timer = window.setTimeout(() => {
      root.classList.remove('theme-transition')
    }, 250)

    return () => {
      window.clearTimeout(timer)
      root.classList.remove('theme-transition')
    }
  }, [theme])

  /**
   * Update theme manually
   */
  const setTheme = useCallback((newTheme) => {
    if (
      newTheme !== THEMES.LIGHT &&
      newTheme !== THEMES.DARK
    ) {
      console.warn(
        `Invalid theme "${newTheme}". Use "light" or "dark".`
      )
      return
    }

    setThemeState(newTheme)
  }, [])

  /**
   * Toggle between light and dark
   */
  const toggleTheme = useCallback(() => {
    setThemeState((currentTheme) =>
      currentTheme === THEMES.DARK
        ? THEMES.LIGHT
        : THEMES.DARK
    )
  }, [])

  /**
   * Memoized context value
   */
  const value = useMemo(
    () => ({
      theme,
      isDark,
      setTheme,
      toggleTheme,
      themes: THEMES,
    }),
    [theme, isDark, setTheme, toggleTheme]
  )

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

/**
 * Custom Theme Hook
 */
export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error(
      'useTheme must be used inside a ThemeProvider'
    )
  }

  return context
}