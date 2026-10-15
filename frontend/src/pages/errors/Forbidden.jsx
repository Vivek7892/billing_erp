import SimpleErrorPage from '../../components/SimpleErrorPage'

export default function Forbidden() {
  return (
    <SimpleErrorPage
      title="Access unavailable"
      message="You don't have access to this page."
      to="/"
    />
  )
}
