import loginIllustration from '../../assets/login-illustration.webp'

export default function LoginIllustration({ className = '', uploadedSrc }) {
  return (
    <img
      src={uploadedSrc || loginIllustration}
      alt="Dreamwithtech Billing ERP dashboard, checkout, inventory, and analytics"
      className={`login-illustration-image ${className}`}
      width="1200"
      height="896"
      loading="eager"
      fetchPriority="high"
      decoding="async"
    />
  )
}
