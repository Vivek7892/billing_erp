import { useNetworkStatus } from '../../context/NetworkStatusContext'
import SimpleErrorPage from '../../components/SimpleErrorPage'

export default function OfflineState({ onRetry }) {
  const { isOnline, isReconnecting, checkConnection } = useNetworkStatus()

  const handleCheck = async () => {
    if (typeof onRetry === 'function') await onRetry()
    else await checkConnection()
  }

  return (
    <SimpleErrorPage
      title={isOnline ? 'Connection restored' : 'You are offline'}
      message={isOnline ? 'Your connection is back. Please try again.' : 'Check your internet connection, then try again.'}
      actionLabel={isReconnecting ? 'Checking…' : 'Try again'}
      onAction={handleCheck}
      disabled={isReconnecting}
    />
  )
}
