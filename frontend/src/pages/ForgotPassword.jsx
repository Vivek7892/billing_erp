import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  IconMail,
  IconPhone,
  IconLock,
  IconEye,
  IconEyeOff,
  IconDeviceMobile,
  IconArrowLeft,
  IconCheck,
} from '@tabler/icons-react'
import toast from 'react-hot-toast'
import http from '../api'
import { LoginIllustration } from '../components/visuals'
import './Login.css'

export default function ForgotPassword() {
  const [resetMethod, setResetMethod] = useState('totp') // 'totp' | 'email'
  
  // TOTP Direct Reset State
  const [mobile, setMobile] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Email Reset State
  const [email, setEmail] = useState('')
  const [emailSubmitted, setEmailSubmitted] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const navigate = useNavigate()

  // Handle Direct Password Reset via TOTP (No Email Needed)
  const handleTotpReset = async e => {
    e.preventDefault()
    if (loading) return

    const cleanDigits = mobile.replace(/\D/g, '')
    if (!cleanDigits || cleanDigits.length !== 10) {
      setError('Please enter a valid 10-digit registered mobile number.')
      return
    }

    const cleanCode = totpCode.trim()
    if (!cleanCode || cleanCode.length < 6) {
      setError('Please enter the 6-digit authenticator code or recovery code.')
      return
    }

    if (!newPassword || newPassword.length < 6) {
      setError('New password must be at least 6 characters.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const fullPhone = `+91${cleanDigits}`
      const { data } = await http.post('/auth/password-reset-totp/', {
        identifier: fullPhone,
        code: cleanCode,
        new_password: newPassword,
      })

      setSuccessMsg(data.message || 'Password reset successfully!')
      toast.success('Password updated successfully!')
      setTimeout(() => {
        navigate('/login', { replace: true })
      }, 1500)
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Failed to reset password. Check your details.'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  // Handle Traditional Email Password Reset
  const handleEmailReset = async e => {
    e.preventDefault()
    if (loading) return
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
      setEmailSubmitted(true)
      toast.success(data.detail || 'Password reset link sent to your email.')
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
                <IconLock size={20} />
              </span>
              <h1 id="forgot-title">Reset Password</h1>
              <p>Reset your password instantly using Google Authenticator without email.</p>
            </div>

            {/* Method switch tabs */}
            <div className="login-tabs">
              <button
                type="button"
                onClick={() => {
                  setResetMethod('totp')
                  setError('')
                }}
                className={`login-tab-btn ${resetMethod === 'totp' ? 'active' : ''}`}
              >
                Instant TOTP Reset (No Email)
              </button>
              <button
                type="button"
                onClick={() => {
                  setResetMethod('email')
                  setError('')
                }}
                className={`login-tab-btn ${resetMethod === 'email' ? 'active' : ''}`}
              >
                Email Reset Link
              </button>
            </div>

            {error && (
              <div className="login-form-error" role="alert">
                {error}
              </div>
            )}

            {successMsg && (
              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center gap-2">
                <IconCheck size={18} className="text-emerald-600 shrink-0" />
                <span>{successMsg} Redirecting to sign in…</span>
              </div>
            )}

            {resetMethod === 'totp' ? (
              /* Direct TOTP Password Reset (No Email required) */
              <form onSubmit={handleTotpReset} noValidate className="login-form">
                <div className="login-field">
                  <label htmlFor="totp-phone">Registered Mobile Number *</label>
                  <div className="login-phone-group">
                    <div className="login-phone-badge">🇮🇳 +91</div>
                    <div className="login-input-wrap">
                      <span className="login-input-icon">
                        <IconPhone size={18} aria-hidden="true" />
                      </span>
                      <input
                        id="totp-phone"
                        type="tel"
                        value={mobile}
                        onChange={e => {
                          setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))
                          if (error) setError('')
                        }}
                        placeholder="98765 43210"
                        autoFocus
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>

                <div className="login-field">
                  <label htmlFor="totp-code">6-Digit Google Authenticator Code *</label>
                  <div className="login-input-wrap">
                    <span className="login-input-icon">
                      <IconDeviceMobile size={18} aria-hidden="true" />
                    </span>
                    <input
                      id="totp-code"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={8}
                      value={totpCode}
                      onChange={e => {
                        setTotpCode(e.target.value)
                        if (error) setError('')
                      }}
                      placeholder="Enter 6-digit code or recovery code"
                      disabled={loading}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Open Google Authenticator, Microsoft Authenticator, or 2FAS.
                  </p>
                </div>

                <div className="login-field">
                  <label htmlFor="new-password">New Password (min 6 characters) *</label>
                  <div className="login-password-wrap">
                    <span className="login-input-icon">
                      <IconLock size={18} aria-hidden="true" />
                    </span>
                    <input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => {
                        setNewPassword(e.target.value)
                        if (error) setError('')
                      }}
                      placeholder="••••••••"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="login-password-toggle"
                      onClick={() => setShowPassword(v => !v)}
                    >
                      {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="login-field">
                  <label htmlFor="confirm-new-password">Confirm New Password *</label>
                  <div className="login-password-wrap">
                    <span className="login-input-icon">
                      <IconLock size={18} aria-hidden="true" />
                    </span>
                    <input
                      id="confirm-new-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => {
                        setConfirmPassword(e.target.value)
                        if (error) setError('')
                      }}
                      placeholder="••••••••"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="login-password-toggle"
                      onClick={() => setShowConfirmPassword(v => !v)}
                    >
                      {showConfirmPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                    </button>
                  </div>
                </div>

                <button type="submit" className="login-submit-btn" disabled={loading}>
                  {loading ? (
                    <span className="login-submit-loading">
                      <span className="login-spinner" aria-hidden="true" />
                      Resetting Password…
                    </span>
                  ) : (
                    'Reset Password Instantly'
                  )}
                </button>
              </form>
            ) : (
              /* Traditional Email Password Reset */
              emailSubmitted ? (
                <div className="login-form space-y-4">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-emerald-900">
                    <p className="text-xs leading-relaxed">
                      If an account is associated with <strong>{email}</strong>, a password reset link has been sent to your email.
                    </p>
                  </div>
                  <Link to="/login" className="login-submit-btn text-center">
                    Return to Sign In
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleEmailReset} noValidate className="login-form">
                  <div className="login-field">
                    <label htmlFor="email">Registered Email Address</label>
                    <div className="login-input-wrap">
                      <span className="login-input-icon">
                        <IconMail size={18} aria-hidden="true" />
                      </span>
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={e => {
                          setEmail(e.target.value)
                          if (error) setError('')
                        }}
                        placeholder="owner@example.com"
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <button type="submit" className="login-submit-btn" disabled={loading}>
                    {loading ? 'Sending link…' : 'Send Password Reset Link'}
                  </button>
                </form>
              )
            )}

            <div className="login-footer">
              <Link to="/login" className="login-link flex items-center justify-center gap-1.5 text-xs font-semibold">
                <IconArrowLeft size={14} /> Back to Sign In
              </Link>
            </div>
          </div>

          <footer className="login-footer-bottom">
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
          <h2>Instant TOTP password reset.</h2>
          <p>
            Reset your password instantly using your registered Google Authenticator code without waiting for emails.
          </p>
          <small>Dreamwithtech Enterprise Technologies &copy; {new Date().getFullYear()}</small>
        </div>
      </aside>
    </main>
  )
}
