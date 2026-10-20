import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import http from '../api'
import { LoginIllustration } from '../components/visuals'
import './Login.css'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async e => {
    e.preventDefault()
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data } = await http.post('/auth/password-reset/', {
        email: email.trim().toLowerCase(),
      })
      toast.success(data.detail || 'If the account exists, a verification code has been sent.')
      navigate(`/verify-otp?identifier=${encodeURIComponent(email.trim().toLowerCase())}&purpose=reset`)
    } catch (err) {
      const msg = err.response?.data?.email?.[0] || err.response?.data?.detail || 'Unable to request password reset.'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel" aria-labelledby="forgot-title">
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
                <Mail size={18} />
              </span>
              <h1 id="forgot-title">Reset your password</h1>
              <p>Enter the email address registered with your business account.</p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="login-form">
                {error && <div className="login-form-error" role="alert">{error}</div>}

                <div className="login-field">
                  <label htmlFor="email">Registered Email Address</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => {
                      setEmail(e.target.value)
                      setError('')
                    }}
                    placeholder="name@company.com"
                    autoComplete="email"
                    autoFocus
                    disabled={loading}
                    aria-invalid={Boolean(error)}
                  />
                </div>

                <button type="submit" className="login-submit mt-2" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="login-spinner" aria-hidden="true" />
                      Sending verification code...
                    </>
                  ) : (
                    'Send Verification Code'
                  )}
                </button>

                <div className="login-switch-action">
                  <span>Remember your credentials?</span>{' '}
                  <Link to="/login" className="login-switch-link">
                    Sign in
                  </Link>
                </div>
            </form>

            <div className="login-security-note">
              <ShieldCheck size={15} aria-hidden="true" />
              <span>Your verification code expires in 10 minutes.</span>
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
          <span>ACCOUNT RECOVERY</span>
          <h2>Get back into your workspace securely.</h2>
          <p>
            We will send a one-time code to your registered email. Verify it to choose a new password.
          </p>
          <small>Dreamwithtech Enterprise Technologies &copy; {new Date().getFullYear()}</small>
        </div>
      </aside>
    </main>
  )
}

