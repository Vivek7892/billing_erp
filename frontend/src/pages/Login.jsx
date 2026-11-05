import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  IconEye,
  IconEyeOff,
  IconLock,
  IconPhone,
  IconMail,
  IconShieldCheck,
  IconArrowLeft,
  IconDeviceMobile,
  IconLifebuoy,
} from '@tabler/icons-react'
import toast from 'react-hot-toast'
import { useAuth } from '../AuthContext'
import {
  getAccessToken,
  getAuthValue,
  getRememberMePreference,
  setCrossDomainAuthCookie,
} from '../services/tokenStorage'
import { LoginIllustration } from '../components/visuals'
import './Login.css'

export default function Login() {
  const [loginMethod, setLoginMethod] = useState('mobile') // 'mobile' | 'email'
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [rememberMe, setRememberMe] = useState(getRememberMePreference)

  // 2FA TOTP state
  const [is2FARequired, setIs2FARequired] = useState(false)
  const [tempToken, setTempToken] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [isRecoveryMode, setIsRecoveryMode] = useState(false)

  const { user, login, verify2FA } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleRedirectAfterLogin = loggedUser => {
    let targetPath = '/'
    if (loggedUser && !loggedUser.onboarding_completed) {
      targetPath = '/onboarding'
    } else {
      const params = new URLSearchParams(location.search)
      const redirect = params.get('redirect')
      if (
        redirect &&
        redirect.startsWith('/') &&
        !redirect.startsWith('//') &&
        !redirect.includes('/login') &&
        !redirect.includes('/register')
      ) {
        targetPath = redirect
      } else {
        if (loggedUser?.role === 'cashier') {
          targetPath = '/new-bill'
        } else {
          targetPath = '/'
        }
      }
    }

    // Check if user is logging in from accounts.dreamwithtech.dev
    const hostname = window.location.hostname.toLowerCase()
    const isAccountsDomain = hostname === 'accounts.dreamwithtech.dev' || hostname.startsWith('accounts.')

    if (isAccountsDomain) {
      const access = getAccessToken()
      const refresh = getAuthValue('refresh_token')
      const remember = getRememberMePreference()

      // 1. Set cross-domain session transfer cookie on .dreamwithtech.dev
      setCrossDomainAuthCookie({ access, refresh, user: loggedUser }, remember)

      // 2. Redirect to app.dreamwithtech.dev with hash transfer for guaranteed cross-subdomain SSO
      const appBase = 'https://app.dreamwithtech.dev'
      const hash = access && refresh
        ? `#access_token=${encodeURIComponent(access)}&refresh_token=${encodeURIComponent(refresh)}&remember=${remember ? '1' : '0'}`
        : ''
      const destination = `${appBase}${targetPath}${hash}`
      window.location.replace(destination)
      return
    }

    navigate(targetPath, { replace: true })
  }

  // Redirect authenticated users away from login
  useEffect(() => {
    if (user) {
      handleRedirectAfterLogin(user)
    }
  }, [user])

  const handleMobileChange = e => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
    setMobile(digits)
    if (errors.mobile || errors.form) {
      setErrors(prev => ({ ...prev, mobile: undefined, form: undefined }))
    }
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (loading) return

    const nextErrors = {}
    let identifier = ''

    if (loginMethod === 'mobile') {
      const cleanDigits = mobile.replace(/\D/g, '')
      if (!cleanDigits) {
        nextErrors.mobile = 'Mobile number is required'
      } else if (cleanDigits.length !== 10) {
        nextErrors.mobile = 'Enter a valid 10-digit mobile number'
      } else {
        identifier = `+91${cleanDigits}`
      }
    } else {
      const cleanEmail = email.trim().toLowerCase()
      if (!cleanEmail) {
        nextErrors.email = 'Email address is required'
      } else if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
        nextErrors.email = 'Enter a valid email address'
      } else {
        identifier = cleanEmail
      }
    }

    if (!password) {
      nextErrors.password = 'Password is required'
    } else if (password.length < 6) {
      nextErrors.password = 'Enter a valid password'
    }

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      toast.error('Please check your login details')
      return
    }

    setLoading(true)
    setErrors({})

    try {
      const res = await login(identifier, password, rememberMe)

      // If 2FA is required, challenge user
      if (res?.totp_required) {
        setTempToken(res.temp_token)
        setIs2FARequired(true)
        setTotpCode('')
        setRecoveryCode('')
        setIsRecoveryMode(false)
        toast('Two-factor authentication code required', { icon: '🔐' })
        return
      }

      toast.success('Welcome back!')
      handleRedirectAfterLogin(res)
    } catch (error) {
      const status = error?.response?.status
      const errData = error?.response?.data
      let message = 'Invalid mobile number, email, or password.'

      if (!error?.response) {
        message = 'Unable to reach the server. Please check your connection.'
      } else if (status === 429) {
        message = 'Too many attempts. Please wait a minute and try again.'
      } else if (errData?.error) {
        message = errData.error
      }

      setErrors({ form: message })
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerify2FA = async e => {
    if (e) e.preventDefault()
    const cleanCode = isRecoveryMode ? recoveryCode.trim() : totpCode.trim()

    if (!cleanCode) {
      toast.error(isRecoveryMode ? 'Enter a recovery code' : 'Enter the 6-digit authenticator code')
      return
    }

    if (!isRecoveryMode && cleanCode.length !== 6) {
      toast.error('Authenticator code must be 6 digits')
      return
    }

    setLoading(true)
    setErrors({})

    try {
      const loggedUser = await verify2FA(
        {
          temp_token: tempToken,
          code: !isRecoveryMode ? cleanCode : '',
          recovery_code: isRecoveryMode ? cleanCode : '',
        },
        rememberMe
      )

      toast.success('Authentication verified!')
      handleRedirectAfterLogin(loggedUser)
    } catch (err) {
      const msg = err?.response?.data?.error || 'Invalid verification code. Please try again.'
      setErrors({ form: msg })
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleTotpCodeChange = e => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
    setTotpCode(val)
    if (val.length === 6) {
      setTimeout(() => {
        handleVerify2FA()
      }, 50)
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-panel-inner">
          <div className="login-brand">
            <img src="/logo.png" alt="" className="login-brand-mark" />
            <span className="login-brand-text">
              <strong>Dreamwithtech</strong>
              <small>POS &amp; RETAIL ERP</small>
            </span>
          </div>

          <div className="login-content">
            {/* 2FA Mode */}
            {is2FARequired ? (
              <div className="space-y-4">
                <div className="login-heading">
                  <span className="login-heading-icon" aria-hidden="true">
                    <IconShieldCheck size={22} className="text-[#1597D4]" />
                  </span>
                  <h1 id="login-title">Two-Factor Authentication</h1>
                  <p>
                    {isRecoveryMode
                      ? 'Enter one of your 8-character single-use backup recovery codes.'
                      : 'Open Google Authenticator, Microsoft Authenticator, or 2FAS and enter the 6-digit code.'}
                  </p>
                </div>

                {errors.form && (
                  <div className="login-form-error" role="alert">
                    {errors.form}
                  </div>
                )}

                <form onSubmit={handleVerify2FA} noValidate className="login-form space-y-4">
                  {!isRecoveryMode ? (
                    <div className="login-field">
                      <label htmlFor="totp-code">6-Digit Authenticator Code</label>
                      <div className="login-input-wrap">
                        <span className="login-input-icon">
                          <IconDeviceMobile size={18} aria-hidden="true" />
                        </span>
                        <input
                          id="totp-code"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          value={totpCode}
                          onChange={handleTotpCodeChange}
                          placeholder="••••••"
                          autoComplete="one-time-code"
                          autoFocus
                          disabled={loading}
                          className="text-center font-mono text-2xl tracking-[0.3em] font-bold"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="login-field">
                      <label htmlFor="recovery-code">Backup Recovery Code</label>
                      <div className="login-input-wrap">
                        <span className="login-input-icon">
                          <IconLifebuoy size={18} aria-hidden="true" />
                        </span>
                        <input
                          id="recovery-code"
                          type="text"
                          value={recoveryCode}
                          onChange={e => setRecoveryCode(e.target.value.toUpperCase())}
                          placeholder="e.g. A1B2-C3D4"
                          autoFocus
                          disabled={loading}
                          className="text-center font-mono text-base uppercase tracking-widest font-semibold"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="login-submit-btn"
                    disabled={loading || (!isRecoveryMode && totpCode.length !== 6)}
                  >
                    {loading ? (
                      <span className="login-submit-loading">
                        <span className="login-spinner" aria-hidden="true" />
                        Verifying…
                      </span>
                    ) : (
                      'Verify & Sign In'
                    )}
                  </button>

                  <div className="flex flex-col gap-2 pt-2 text-center text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setIsRecoveryMode(v => !v)
                        setErrors({})
                      }}
                      className="text-[#1597D4] hover:underline font-semibold"
                    >
                      {isRecoveryMode
                        ? 'Use Google Authenticator 6-digit code instead'
                        : 'Lost authenticator access? Use backup recovery code'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIs2FARequired(false)
                        setTempToken('')
                        setErrors({})
                      }}
                      className="text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1 mt-1 font-medium"
                    >
                      <IconArrowLeft size={14} /> Back to sign in
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* Standard Login Screen */
              <>
                <div className="login-heading">
                  <span className="login-heading-icon" aria-hidden="true">
                    <IconLock size={20} />
                  </span>
                  <h1 id="login-title">Sign In</h1>
                  <p>Access your store dashboard and point of sale.</p>
                </div>

                {/* Switch between Mobile Number and Email */}
                <div className="login-tabs">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginMethod('mobile')
                      setErrors({})
                    }}
                    className={`login-tab-btn ${loginMethod === 'mobile' ? 'active' : ''}`}
                  >
                    Mobile Number
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginMethod('email')
                      setErrors({})
                    }}
                    className={`login-tab-btn ${loginMethod === 'email' ? 'active' : ''}`}
                  >
                    Email Address
                  </button>
                </div>

                {errors.form && (
                  <div className="login-form-error" role="alert">
                    {errors.form}
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate className="login-form">
                  {/* Mobile Identifier with Fixed +91 Badge */}
                  {loginMethod === 'mobile' ? (
                    <div className="login-field">
                      <label htmlFor="mobile">Mobile Number *</label>
                      <div className="login-phone-group">
                        <div className="login-phone-badge">
                          🇮🇳 +91
                        </div>
                        <div className="login-input-wrap">
                          <span className="login-input-icon">
                            <IconPhone size={18} aria-hidden="true" />
                          </span>
                          <input
                            id="mobile"
                            name="mobile"
                            type="tel"
                            value={mobile}
                            placeholder="98765 43210"
                            autoComplete="tel-national"
                            autoFocus
                            disabled={loading}
                            onChange={handleMobileChange}
                          />
                        </div>
                      </div>
                      {errors.mobile && <p className="login-field-error">{errors.mobile}</p>}
                    </div>
                  ) : (
                    /* Email Identifier */
                    <div className="login-field">
                      <label htmlFor="email">Email Address *</label>
                      <div className="login-input-wrap">
                        <span className="login-input-icon">
                          <IconMail size={18} aria-hidden="true" />
                        </span>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          value={email}
                          placeholder="owner@example.com"
                          autoComplete="email"
                          autoFocus
                          disabled={loading}
                          onChange={e => {
                            setEmail(e.target.value)
                            if (errors.email) setErrors(prev => ({ ...prev, email: undefined }))
                          }}
                        />
                      </div>
                      {errors.email && <p className="login-field-error">{errors.email}</p>}
                    </div>
                  )}

                  {/* Password */}
                  <div className="login-field">
                    <label htmlFor="password">Password *</label>
                    <div className="login-password-wrap">
                      <span className="login-input-icon">
                        <IconLock size={18} aria-hidden="true" />
                      </span>
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        disabled={loading}
                        onChange={e => {
                          setPassword(e.target.value)
                          if (errors.password) setErrors(prev => ({ ...prev, password: undefined }))
                        }}
                      />
                      <button
                        type="button"
                        className="login-password-toggle"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword(v => !v)}
                      >
                        {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                      </button>
                    </div>
                    {errors.password && <p className="login-field-error">{errors.password}</p>}
                  </div>

                  <div className="login-options">
                    <label className="login-remember">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={e => setRememberMe(e.target.checked)}
                        disabled={loading}
                      />
                      <span>Remember me</span>
                    </label>

                    <Link to="/forgot-password" className="login-forgot">
                      Forgot password?
                    </Link>
                  </div>

                  <button type="submit" className="login-submit-btn" disabled={loading}>
                    {loading ? (
                      <span className="login-submit-loading">
                        <span className="login-spinner" aria-hidden="true" />
                        Signing in…
                      </span>
                    ) : (
                      'Sign In'
                    )}
                  </button>
                </form>

                <div className="login-security-note">
                  <IconShieldCheck size={16} aria-hidden="true" />
                  <span>Secure bank-grade 256-bit encrypted authentication</span>
                </div>

                <div className="login-footer">
                  <p>
                    New business?{' '}
                    <Link to="/register" className="login-link font-semibold">
                      Register your shop
                    </Link>
                  </p>
                </div>
              </>
            )}
          </div>

          <footer className="login-footer-bottom">
            <span>© {new Date().getFullYear()} Dreamwithtech</span>
            <Link to="/terms-and-conditions">Terms &amp; Conditions</Link>
          </footer>
        </div>
      </section>

      {/* Professional Visual Sidebar with Login Illustration */}
      <aside className="login-visual" aria-label="Dreamwithtech Billing ERP System">
        <div className="login-visual-artwork !p-0">
          <LoginIllustration />
        </div>
        <div className="login-visual-caption">
          <span>ABOUT DREAMWITHTECH</span>
          <h2>Enterprise operations, connected.</h2>
          <p>
            Dreamwithtech Billing ERP brings billing, inventory,
            customers, payments, credit collection and analytics into one workspace.
          </p>
          <small>Dreamwithtech Enterprise Technologies &copy; {new Date().getFullYear()}</small>
        </div>
      </aside>
    </main>
  )
}
