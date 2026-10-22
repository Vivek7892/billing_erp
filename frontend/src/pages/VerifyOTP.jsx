import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  IconKey,
  IconShieldCheck,
} from '@tabler/icons-react'
import toast from 'react-hot-toast'
import http, { errorMessage } from '../api'
import { saveAuthSession } from '../services/tokenStorage'
import { useAuth } from '../AuthContext'
import { LoginIllustration } from '../components/visuals'
import './Login.css'

export default function VerifyOTP() {
  const [searchParams] = useSearchParams()
  const identifierParam = searchParams.get('identifier') || ''
  const purposeParam = searchParams.get('purpose') || 'signup'

  const [identifier, setIdentifier] = useState(identifierParam)
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(60)
  const [errors, setErrors] = useState({})

  const { updateUser } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => setCooldown(prev => prev - 1), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const handleVerify = async e => {
    e.preventDefault()
    if (loading) return

    if (!otp.trim()) {
      setErrors({ otp: 'Please enter the 6-digit verification code' })
      return
    }
    if (otp.trim().length !== 6) {
      setErrors({ otp: 'Code must be 6 digits' })
      return
    }

    setLoading(true)
    setErrors({})

    try {
      const { data } = await http.post('/auth/verify-otp/', {
        identifier: identifier.trim(),
        otp: otp.trim(),
        purpose: purposeParam,
      })

      toast.success(data.message || 'Verification successful!')

      if (purposeParam === 'reset' && data.uid && data.token) {
        navigate(`/reset-password?uid=${encodeURIComponent(data.uid)}&token=${encodeURIComponent(data.token)}`, { replace: true })
        return
      }

      if (data.access && data.user) {
        saveAuthSession(data, true)
        updateUser(data.user)
        if (!data.user.onboarding_completed) {
          navigate('/onboarding', { replace: true })
        } else {
          navigate('/', { replace: true })
        }
      } else {
        navigate('/login', { replace: true })
      }
    } catch (err) {
      const payload = err.response?.data
      const nestedPayload = payload?.data
      const normalizedError = nestedPayload && typeof nestedPayload === 'object'
        ? { ...err, response: { ...err.response, data: nestedPayload } }
        : err
      const msg = errorMessage(normalizedError, 'Could not verify the code. Please try again.')
      setErrors({ form: msg })
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (cooldown > 0 || resending) return
    setResending(true)
    try {
      const { data } = await http.post('/auth/resend-verification/', {
        identifier: identifier.trim(),
        purpose: purposeParam,
      })
      toast.success(data.message || 'New verification code sent!')
      setCooldown(60)
    } catch (err) {
      const data = err.response?.data
      if (err.response?.status === 429 && data?.wait_seconds) {
        setCooldown(data.wait_seconds)
      }
      const msg = data?.error || data?.detail || 'Unable to resend verification code.'
      toast.error(msg)
    } finally {
      setResending(false)
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel" aria-labelledby="verify-title">
        <div className="login-panel-inner">
          <div className="login-brand">
            <img src="/logo.png" alt="" className="login-brand-mark" />
            <span className="login-brand-text">
              <strong>Dreamwithtech</strong>
              <small>POS &amp; RETAIL ERP</small>
            </span>
          </div>

          <div className="login-content">
            <div className="login-heading">
              <span className="login-heading-icon" aria-hidden="true">
                <IconKey size={18} />
              </span>
              <h1 id="verify-title">{purposeParam === 'reset' ? 'Verify your email' : 'Verify your account'}</h1>
              <p>
                Enter the 6-digit {purposeParam === 'reset' ? 'password reset code' : 'verification code'} sent to{' '}
                <strong className="text-slate-800 font-semibold">{identifier || 'your email'}</strong>.
              </p>
            </div>

            {errors.form && <div className="login-form-error" role="alert">{errors.form}</div>}

            <form onSubmit={handleVerify} noValidate className="login-form">
              {!identifierParam && (
                <div className="login-field">
                  <label htmlFor="identifier">Email or mobile number</label>
                  <input
                    id="identifier"
                    type="text"
                    value={identifier}
                    onChange={e => {
                      setIdentifier(e.target.value)
                      setErrors({})
                    }}
                    placeholder="Enter email or phone"
                    disabled={loading}
                  />
                </div>
              )}

              <div className="login-field">
                <label htmlFor="otp">Verification Code</label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={e => {
                    setOtp(e.target.value.replace(/\D/g, ''))
                    setErrors({})
                  }}
                  placeholder="• • • • • •"
                  className="!text-center !tracking-widest !text-xl !font-mono font-bold"
                  autoFocus
                  disabled={loading}
                />
                {errors.otp && <p className="login-field-error">{errors.otp}</p>}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 my-1">
                <span>Didn't receive the code?</span>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || resending}
                  className={`font-semibold transition-colors ${
                    cooldown > 0
                      ? 'text-slate-400 cursor-not-allowed'
                      : 'text-[#0057B8] hover:text-[#003F8F] cursor-pointer'
                  }`}
                >
                  {resending ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                </button>
              </div>

              <button type="submit" className="login-submit mt-2" disabled={loading}>
                {loading ? (
                  <>
                    <span className="login-spinner" aria-hidden="true" />
                    Verifying...
                  </>
                ) : (
                  purposeParam === 'reset' ? 'Verify & Reset Password' : 'Verify & Continue'
                )}
              </button>

              <div className="login-switch-action">
                <Link to="/login" className="login-switch-link">
                  ← Back to sign in
                </Link>
              </div>
            </form>

            <div className="login-security-note">
              <IconShieldCheck size={15} aria-hidden="true" />
              <span>{purposeParam === 'reset' ? 'Your code expires in 10 minutes.' : 'Multi-factor verification for authorized store owners'}</span>
            </div>
          </div>

          <footer className="login-footer">
            <span>© {new Date().getFullYear()} Dreamwithtech</span>
            <Link to="/terms-and-conditions">Terms &amp; Conditions</Link>
          </footer>
        </div>
      </section>

      <aside className="login-visual" aria-label="Dreamwithtech Billing ERP System">
        <div className="login-visual-artwork !p-0">
          <LoginIllustration />
        </div>
        <div className="login-visual-caption">
          <span>ACCOUNT SECURITY</span>
          <h2>Protecting your commercial workspace.</h2>
          <p>
            Dreamwithtech implements strict tenant isolation, encrypted sessions, and verified owner privileges for every retail establishment.
          </p>
          <small>Dreamwithtech  &copy; {new Date().getFullYear()}</small>
        </div>
      </aside>
    </main>
  )
}

