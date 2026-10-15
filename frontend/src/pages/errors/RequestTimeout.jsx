import SimpleErrorPage from '../../components/SimpleErrorPage'

export default function RequestTimeout({ onRetry }) {
  return (
    <SimpleErrorPage
      title="Please try again"
      message="That took too long. Check your connection and try again."
      actionLabel="Try again"
      onAction={onRetry || (() => window.location.reload())}
    />
  )
}
