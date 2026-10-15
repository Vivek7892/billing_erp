import SimpleErrorPage from '../../components/SimpleErrorPage'

export default function ServiceUnavailable({ onRetry }) {
  return (
    <SimpleErrorPage
      title="Service temporarily unavailable"
      message="Please wait a moment, then try again."
      actionLabel="Try again"
      onAction={onRetry || (() => window.location.reload())}
    />
  )
}
