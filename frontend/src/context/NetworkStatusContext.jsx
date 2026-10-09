import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { API_BASE_URL } from '../services/http'

const NetworkStatusContext = createContext({
  isOnline: true,
  wasOffline: false,
  isReconnecting: false,
  checkConnection: async () => true,
  lastOnlineAt: null,
})

export function NetworkStatusProvider({ children }) {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true))
  const [wasOffline, setWasOffline] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [lastOnlineAt, setLastOnlineAt] = useState(() => (navigator.onLine ? new Date() : null))
  const wasOfflineTimerRef = useRef(null)

  const checkConnection = useCallback(async () => {
    if (!navigator.onLine) {
      setIsOnline(false)
      return false
    }

    setIsReconnecting(true)
    try {
      // Lightweight cache-busted ping to verify actual internet connectivity
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 4000)

      const pingUrl = `${API_BASE_URL.replace(/\/api$/, '')}/api/auth/me/?_t=${Date.now()}`
      const response = await fetch(pingUrl, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store',
      }).catch(async () => {
        // Fallback GET if HEAD is not supported by endpoint
        return fetch(pingUrl, {
          method: 'GET',
          signal: controller.signal,
          cache: 'no-store',
        })
      })

      clearTimeout(timeoutId)
      const healthy = response.status < 500
      setIsOnline(healthy)
      if (healthy) {
        setLastOnlineAt(new Date())
      }
      return healthy
    } catch {
      // Network unreachable
      setIsOnline(false)
      return false
    } finally {
      setIsReconnecting(false)
    }
  }, [])

  useEffect(() => {
    const handleOnline = () => {
      // Browser reports online; verify real connectivity
      setIsOnline(true)
      setWasOffline(true)
      setLastOnlineAt(new Date())

      // Auto-dismiss the "back online" confirmation banner after 4 seconds
      if (wasOfflineTimerRef.current) clearTimeout(wasOfflineTimerRef.current)
      wasOfflineTimerRef.current = setTimeout(() => {
        setWasOffline(false)
      }, 4000)

      // Verify connection in background
      checkConnection()
    }

    const handleOffline = () => {
      setIsOnline(false)
      if (wasOfflineTimerRef.current) clearTimeout(wasOfflineTimerRef.current)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Periodic lightweight heartbeat (every 60s when active) to catch silent drops
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        checkConnection()
      }
    }, 60000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(intervalId)
      if (wasOfflineTimerRef.current) clearTimeout(wasOfflineTimerRef.current)
    }
  }, [checkConnection])

  return (
    <NetworkStatusContext.Provider
      value={{
        isOnline,
        wasOffline,
        isReconnecting,
        checkConnection,
        lastOnlineAt,
      }}
    >
      {children}
    </NetworkStatusContext.Provider>
  )
}

export const useNetworkStatus = () => useContext(NetworkStatusContext)
export default NetworkStatusContext

