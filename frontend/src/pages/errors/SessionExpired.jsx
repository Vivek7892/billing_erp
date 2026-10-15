import { useLocation } from 'react-router-dom'
import SimpleErrorPage from '../../components/SimpleErrorPage'

export default function SessionExpired() {
  const location = useLocation()
  const redirectTarget = location.state?.from || location.pathname || '/'
  const loginUrl = `/login?redirect=${encodeURIComponent(redirectTarget)}`

  return (
    <SimpleErrorPage
      title="Please sign in again"
      message="Your session has ended. Sign in to continue."
      actionLabel="Sign in"
      to={loginUrl}
    />
  )
}
