import SimpleErrorPage from '../../components/SimpleErrorPage'

export default function ServerError({ onReload }) {
  return (
    <SimpleErrorPage
      title="Something went wrong"
      message="Please try again. If the problem continues, contact support."
      actionLabel="Try again"
      onAction={onReload || (() => window.location.reload())}
    />
  )
}
