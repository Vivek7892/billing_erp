import { useId, useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, UserPlus, ShieldCheck, Check, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../AuthContext'
import { LoginIllustration } from '../components/visuals'
import './Login.css'

function calculateStrength(pwd) {
  if (!pwd) return { score: 0, label: '', color: '' }
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

export default function Register() {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    username: '',
    password: '',
    confirmPassword: '',
    termsAccepted: false,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [usernameManuallyEdited, setUsernameManuallyEdited] = useState(false)

  const { user, register } = useAuth()
  const navigate = useNavigate()
  const passwordErrorId = useId()

  // Redirect authenticated users away from register
  useEffect(() => {
    if (user) {
      if (!user.onboarding_completed) {
        navigate('/onboarding', { replace: true })
      } else {
        navigate('/', { replace: true })
      }
    }
  }, [user, navigate])

  const updateField = (field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value }

      // Auto-suggest username from email prefix or name if not manually changed
      if (field === 'email' && !usernameManuallyEdited) {
        const prefix = value.split('@')[0].toLowerCase().replace(/[^a-z0-9_.]/g, '')
        if (prefix.length >= 3) {
          next.username = prefix
        }
      }

      return next
    })

    if (field === 'username') {
      setUsernameManuallyEdited(true)
    }

    setErrors(prev => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const strength = calculateStrength(form.password)

  const submit = async event => {
    event.preventDefault()

    const nextErrors = {}
    if (!form.fullName.trim()) nextErrors.fullName = 'Full name is required'
    if (!form.email.trim()) {
      nextErrors.email = 'Email address is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = 'Please enter a valid email address'
    }

    if (form.phone.trim()) {
      const cleanPhone = form.phone.replace(/\D/g, '')
      if (cleanPhone.length !== 10) {
        nextErrors.phone = 'Enter a valid 10-digit Indian mobile number'
      }
    }

    const cleanUsername = form.username.trim().toLowerCase()
    if (!cleanUsername) {
      nextErrors.username = 'Username is required'
    } else if (cleanUsername.length < 3) {
      nextErrors.username = 'Username must be at least 3 characters'
    } else if (!/^[a-z0-9_.]+$/.test(cleanUsername)) {
      nextErrors.username = 'Only lowercase letters, numbers, dots, and underscores allowed'
    }

    if (!form.password) {
      nextErrors.password = 'Password is required'
    } else if (form.password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters'
    } else if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
      nextErrors.password = 'Password must contain at least one letter and one number'
    }

    if (form.password !== form.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match'
    }

    if (!form.termsAccepted) {
      nextErrors.termsAccepted = 'You must accept the terms and conditions'
    }

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      toast.error('Please check the registration form errors')
      return
    }

    setLoading(true)
    setErrors({})

    try {
      const payload = {
        full_name: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim().replace(/\D/g, ''),
        username: cleanUsername,
        password: form.password,
        confirm_password: form.confirmPassword,
        terms_accepted: true,
      }

      const res = await register(payload)

      if (res?.require_verification) {
        toast.success('Account created! Please verify your email.')
        navigate(`/verify-otp?identifier=${encodeURIComponent(res.identifier)}&purpose=signup`)
      } else {
        toast.success('Account created! Welcome to Dreamwithtech.')
        navigate('/onboarding', { replace: true })
      }
    } catch (error) {
      const data = error?.response?.data
      if (data && typeof data === 'object') {
        const fieldErrors = {}
        Object.entries(data).forEach(([key, val]) => {
          fieldErrors[key] = Array.isArray(val) ? val[0] : String(val)
        })
        setErrors(fieldErrors)
        toast.error(fieldErrors.detail || fieldErrors.error || 'Registration failed. Please review errors.')
      } else {
        const msg = !error?.response
          ? 'Unable to reach the server. Please check your connection.'
          : 'Registration failed. Please try again.'
        setErrors({ form: msg })
        toast.error(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel" aria-labelledby="register-title">
        <div className="login-panel-inner">
          <div className="login-brand">
            <img src="/logo.png" alt="" className="login-brand-mark" />
            <span className="login-brand-text">
              <strong>Dreamwithtech</strong>
              <small>POS &amp; RETAIL ERP</small>
            </span>
          </div>

          <div className="login-content !max-w-[440px] my-6">
            <div className="login-heading mb-5">
              <span className="login-heading-icon" aria-hidden="true">
                <UserPlus size={18} />
              </span>
              <h1 id="register-title">Create your account</h1>
              <p>Set up your business workspace in under two minutes.</p>
            </div>

            {errors.form && <div className="login-form-error" role="alert">{errors.form}</div>}

            <form onSubmit={submit} noValidate className="login-form flex flex-col gap-3.5">
              {/* Full Name */}
              <div className="login-field">
                <label htmlFor="fullName">Full Name</label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  value={form.fullName}
                  placeholder="e.g. Ramesh Kumar"
                  autoComplete="name"
                  autoFocus
                  disabled={loading}
                  aria-invalid={Boolean(errors.fullName)}
                  onChange={e => updateField('fullName', e.target.value)}
                />
                {errors.fullName && <p className="login-field-error">{errors.fullName}</p>}
              </div>

              {/* Email Address */}
              <div className="login-field">
                <label htmlFor="email">Email Address</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  placeholder="name@company.com"
                  autoComplete="email"
                  disabled={loading}
                  aria-invalid={Boolean(errors.email)}
                  onChange={e => updateField('email', e.target.value)}
                />
                {errors.email && <p className="login-field-error">{errors.email}</p>}
              </div>

              {/* Mobile Number with Indian Country Code */}
              <div className="login-field">
                <label htmlFor="phone">Mobile Number</label>
                <div className="login-phone-wrap">
                  <span className="login-phone-prefix">🇮🇳 +91</span>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={form.phone}
                    placeholder="98765 43210"
                    autoComplete="tel-national"
                    maxLength={10}
                    disabled={loading}
                    aria-invalid={Boolean(errors.phone)}
                    onChange={e => updateField('phone', e.target.value.replace(/\D/g, ''))}
                  />
                </div>
                {errors.phone && <p className="login-field-error">{errors.phone}</p>}
              </div>

              {/* Username */}
              <div className="login-field">
                <label htmlFor="username">Username</label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={form.username}
                  placeholder="e.g. ramesh_store"
                  autoComplete="username"
                  disabled={loading}
                  aria-invalid={Boolean(errors.username)}
                  onChange={e => updateField('username', e.target.value.toLowerCase())}
                />
                {errors.username && <p className="login-field-error">{errors.username}</p>}
              </div>

              {/* Password */}
              <div className="login-field">
                <label htmlFor="password">Password</label>
                <div className="login-password-wrap">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                    disabled={loading}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? passwordErrorId : undefined}
                    onChange={e => updateField('password', e.target.value)}
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
                {/* Password strength feedback */}
                {form.password && (
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

              {/* Confirm Password */}
              <div className="login-field">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <div className="login-password-wrap">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={form.confirmPassword}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    disabled={loading}
                    aria-invalid={Boolean(errors.confirmPassword)}
                    onChange={e => updateField('confirmPassword', e.target.value)}
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

              {/* Terms and Privacy Consent */}
              <label className="login-consent-label">
                <input
                  type="checkbox"
                  checked={form.termsAccepted}
                  onChange={e => updateField('termsAccepted', e.target.checked)}
                  disabled={loading}
                />
                <span>
                  I agree to Dreamwithtech's{' '}
                  <Link to="/terms-and-conditions" target="_blank" rel="noopener noreferrer">
                    Terms of Service
                  </Link>{' '}
                  and Privacy Policy.
                </span>
              </label>
              {errors.termsAccepted && <p className="login-field-error">{errors.termsAccepted}</p>}

              {/* Submit Button */}
              <button type="submit" className="login-submit mt-2" disabled={loading}>
                {loading ? (
                  <>
                    <span className="login-spinner" aria-hidden="true" />
                    Creating account...
                  </>
                ) : (
                  'Create Account'
                )}
              </button>

              <div className="login-switch-action">
                <span>Already have an account?</span>{' '}
                <Link to="/login" className="login-switch-link">
                  Sign in
                </Link>
              </div>
            </form>

            <div className="login-security-note">
              <ShieldCheck size={15} aria-hidden="true" />
              <span>Bank-grade encryption &amp; multi-tenant data isolation</span>
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
          <span>START YOUR BUSINESS JOURNEY</span>
          <h2>All-in-one ERP built for retail &amp; commerce.</h2>
          <p>
            Join modern businesses managing POS counter checkout, automated tax calculations, inventory stock tracking, and financial analytics.
          </p>
          <small>Dreamwithtech Enterprise Technologies &copy; {new Date().getFullYear()}</small>
          <a href="mailto:connectwithvvivek@gmail.com">Need help? Contact support</a>
        </div>
      </aside>
    </main>
  )
}

