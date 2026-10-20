import { useState, useId } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { LockKeyhole, Eye, EyeOff, ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import http from '../api'
import { LoginIllustration } from '../components/visuals'
import './Login.css'

function calculateStrength(pwd) {
  if (!pwd) return { score: 0, label: '', className: '' }
  let score = 0
  if (pwd.length >= 8) score += 1
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score += 1
  if (/\d/.test(pwd)) score += 1
  if (/[^a-zA-Z0-9]/.test(pwd)) score += 1

  if (score === 1) return { score: 1, label: 'Weak', className: 'strength-weak' }
  if (score === 2) return { score: 2, label: 'Fair', className: 'strength-fair' }
  if (score === 3) return { score: 3, label: 'Good', className: 'strength-good' }
  if (score >= 4) return { score: 4, label: 'Strong', className: 'strength-strong' }
  return { score: 1, label: 'Too short', className: 'strength-weak' }
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const uid = searchParams.get('uid') || ''
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errors, setErrors] = useState({})

  const navigate = useNavigate()
  const passwordErrorId = useId()
  const strength = calculateStrength(password)

  const handleSubmit = async e => {
    e.preventDefault()

    if (!uid || !token) {
      setErrors({ form: 'Password reset verification is missing or expired. Request a new code to continue.' })
      return
    }

    const nextErrors = {}
    if (!password) {
      nextErrors.password = 'New password is required'
    } else if (password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters'
    } else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      nextErrors.password = 'Password must contain at least one letter and one number'
    }

    if (password !== confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match'
    }

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }

    setLoading(true)
    setErrors({})

    try {
      const { data } = await http.post('/auth/password-reset-confirm/', {
        uid,
        token,
        new_password: password,
        confirm_password: confirmPassword,
      })
      setSuccess(true)
      toast.success(data.detail || 'Password successfully reset!')
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Failed to reset password. Link may be expired.'
      setErrors({ form: msg })
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel" aria-labelledby="reset-title">
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
                <LockKeyhole size={18} />
              </span>
              <h1 id="reset-title">Create new password</h1>
              <p>Choose a strong, secure password for your store account.</p>
            </div>

            {!uid || !token ? (
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs flex items-start gap-2.5">
                <AlertTriangle size={18} className="shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <strong className="block font-semibold mb-1">Verification Required</strong>
                  This password reset session is missing its verification details or has expired. Request a new code from the forgot password page.
                  <div className="mt-3">
                    <Link to="/forgot-password" className="font-bold underline text-amber-900">
                      Request New Code →
                    </Link>
                  </div>
                </div>
              </div>
            ) : success ? (
              <div className="p-5 rounded-xl border border-emerald-200 bg-emerald-50 text-center flex flex-col items-center gap-3">
                <CheckCircle2 size={36} className="text-emerald-600" />
                <h2 className="text-base font-bold text-slate-800">Password Updated!</h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Your password has been securely reset. You can now log into your Dreamwithtech ERP account with your new credentials.
                </p>
                <div className="mt-2 w-full pt-3 border-t border-emerald-100">
                  <Link to="/login" className="login-submit inline-flex items-center justify-center !no-underline">
                    Sign In Now
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="login-form flex flex-col gap-3.5">
                {errors.form && <div className="login-form-error" role="alert">{errors.form}</div>}

                <div className="login-field">
                  <label htmlFor="newPassword">New Password</label>
                  <div className="login-password-wrap">
                    <input
                      id="newPassword"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => {
                        setPassword(e.target.value)
                        setErrors(prev => ({ ...prev, password: '' }))
                      }}
                      placeholder="Minimum 8 characters"
                      autoComplete="new-password"
                      autoFocus
                      disabled={loading}
                      aria-invalid={Boolean(errors.password)}
                      aria-describedby={errors.password ? passwordErrorId : undefined}
                    />
                    <button
                      type="button"
                      className="login-password-toggle"
                      onClick={() => setShowPassword(v => !v)}
                      disabled={loading}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  {password && (
                    <div className="password-strength-container">
                      <div className="password-strength-bars">
                        {[1, 2, 3, 4].map(step => (
                          <div
                            key={step}
                            className={`password-strength-segment ${
                              step <= strength.score ? strength.className : ''
                            }`}
                            style={{
                              backgroundColor:
                                step <= strength.score
                                  ? strength.score === 1
                                    ? '#EF4444'
                                    : strength.score === 2
                                      ? '#F59E0B'
                                      : strength.score === 3
                                        ? '#10B981'
                                        : '#0057B8'
                                  : '#E2E8F0',
                            }}
                          />
                        ))}
                      </div>
                      <div className="password-strength-label">
                        <span className={strength.className}>Strength: {strength.label}</span>
                        <span className="text-[11px] text-slate-400">At least 8 chars &amp; 1 number</span>
                      </div>
                    </div>
                  )}
                  {errors.password && <p className="login-field-error" id={passwordErrorId}>{errors.password}</p>}
                </div>

                <div className="login-field">
                  <label htmlFor="confirmNewPassword">Confirm New Password</label>
                  <div className="login-password-wrap">
                    <input
                      id="confirmNewPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => {
                        setConfirmPassword(e.target.value)
                        setErrors(prev => ({ ...prev, confirmPassword: '' }))
                      }}
                      placeholder="Re-enter your new password"
                      autoComplete="new-password"
                      disabled={loading}
                      aria-invalid={Boolean(errors.confirmPassword)}
                    />
                    <button
                      type="button"
                      className="login-password-toggle"
                      onClick={() => setShowConfirmPassword(v => !v)}
                      disabled={loading}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="login-field-error">{errors.confirmPassword}</p>}
                </div>

                <button type="submit" className="login-submit mt-2" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="login-spinner" aria-hidden="true" />
                      Updating password...
                    </>
                  ) : (
                    'Set New Password'
                  )}
                </button>

                <div className="login-switch-action">
                  <Link to="/login" className="login-switch-link">
                    ← Back to sign in
                  </Link>
                </div>
              </form>
            )}

            <div className="login-security-note">
              <ShieldCheck size={15} aria-hidden="true" />
              <span>Password reset is available only after email OTP verification.</span>
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
          <h2>Encrypted credential synchronization.</h2>
          <p>
            Your account credentials are protected by industry-standard PBKDF2 password hashing and expiring recovery signatures.
          </p>
          <small>Dreamwithtech Enterprise Technologies &copy; {new Date().getFullYear()}</small>
        </div>
      </aside>
    </main>
  )
}

