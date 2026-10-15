import SimpleErrorPage from '../../components/SimpleErrorPage'

export default function NotFound() {
  return (
    <SimpleErrorPage
      title="Page not found"
      message="We couldn't find the page you were looking for."
      to="/"
    />
  )
}
