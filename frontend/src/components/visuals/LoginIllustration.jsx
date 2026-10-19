import DreamVisualContainer from './DreamVisualContainer'
import loginIllustration from '../../assets/login-illustration.png'

export default function LoginIllustration({ className = '', uploadedSrc }) {
  return (
    <DreamVisualContainer
      slotKey="login-illustration"
      title="Dreamwithtech Billing ERP"
      uploadedSrc={uploadedSrc || loginIllustration}
      className={`w-full h-full min-h-[480px] bg-white border-0 rounded-none shadow-none ${className}`}
      hideBadge
    >
      <div className="w-full h-full flex items-center justify-center bg-white overflow-hidden" />
    </DreamVisualContainer>
  )
}
