import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  IconEye,
  IconEyeOff,
  IconBuildingStore,
  IconPhone,
  IconLock,
  IconArrowRight,
  IconShieldCheck,
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

export default function Register() {
  const [businessName, setBusinessName] = useState('')
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  const { user, register } = useAuth()
  const navigate = useNavigate()

  const redirectToApp = useCallback((path = '/') => {
    const hostname = window.location.hostname.toLowerCase()
    const isAccountsDomain = hostname === 'accounts.dreamwithtech.dev' || hostname.startsWith('accounts.')

    if (isAccountsDomain) {
      const access = getAccessToken()
      const refresh = getAuthValue('refresh_token')
      const remember = getRememberMePreference()

      setCrossDomainAuthCookie({ access, refresh, user }, remember)
      const appBase = 'https://app.dreamwithtech.dev'
      const hash = access && refresh
        ? `#access_token=${encodeURIComponent(access)}&refresh_token=${encodeURIComponent(refresh)}&remember=${remember ? '1' : '0'}`
        : ''
      window.location.replace(`${appBase}${path}${hash}`)
      return
    }

    navigate(path, { replace: true })
  }, [user, navigate])

  useEffect(() => {
    if (user) {
      redirectToApp('/')
    }
  }, [user, redirectToApp])

  const handleMobileChange = e => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
    setMobile(digits)
    if (errors.mobile) {
      setErrors(prev => ({ ...prev, mobile: undefined }))
    }
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (loading) return

    const nextErrors = {}
    const trimmedBusiness = businessName.trim()
    const cleanDigits = mobile.replace(/\D/g, '')

    if (!trimmedBusiness) {
      nextErrors.businessName = 'Shop or business name is required'
    }

    if (!cleanDigits) {
      nextErrors.mobile = 'Mobile number is required'
    } else if (cleanDigits.length !== 10) {
      nextErrors.mobile = 'Enter a valid 10-digit mobile number'
    }

    if (!password) {
      nextErrors.password = 'Password is required'
    } else if (password.length < 6) {
      nextErrors.password = 'Password must be at least 6 characters'
    }

    if (password && confirmPassword && password !== confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match'
    }

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      toast.error('Please complete all required fields')
      return
    }

    setLoading(true)
    setErrors({})

    try {
      const fullPhone = `+91${cleanDigits}`
      await register({
        business_name: trimmedBusiness,
        mobile: fullPhone,
        password: password,
        confirm_password: confirmPassword || password,
      })

      toast.success('Shop registered successfully! Welcome to DreamWithTech.')
      redirectToApp('/onboarding')
    } catch (err) {
      const errData = err?.response?.data
      let message = 'Registration failed. Please check your details.'

      if (typeof errData === 'string') {
        message = errData
      } else if (errData?.error) {
        message = errData.error
      } else if (errData?.mobile) {
        message = Array.isArray(errData.mobile) ? errData.mobile[0] : errData.mobile
      } else if (errData?.password) {
        message = Array.isArray(errData.password) ? errData.password[0] : errData.password
      } else if (errData?.business_name) {
        message = Array.isArray(errData.business_name) ? errData.business_name[0] : errData.business_name
      }

      setErrors({ form: message })
      toast.error(message)
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

          <div className="login-content">
            <div className="login-heading">
              <span className="login-heading-icon" aria-hidden="true">
                <IconBuildingStore size={22} />
              </span>
              <h1 id="register-title">Register Your Shop</h1>
              <p>Create your shop account and start generating bills in seconds.</p>
            </div>

            {errors.form && (
              <div className="login-form-error" role="alert">
                {errors.form}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="login-form">
              {/* Business / Shop Name */}
              <div className="login-field">
                <label htmlFor="businessName">Shop / Business Name *</label>
                <div className="login-input-wrap">
                  <span className="login-input-icon">
                    <IconBuildingStore size={18} aria-hidden="true" />
                  </span>
                  <input
                    id="businessName"
                    type="text"
                    value={businessName}
                    onChange={e => {
                      setBusinessName(e.target.value)
                      if (errors.businessName) setErrors(prev => ({ ...prev, businessName: undefined }))
                    }}
                    placeholder="e.g. Sri Balaji Supermarket"
                    autoFocus
                    disabled={loading}
                  />
                </div>
                {errors.businessName && <p className="login-field-error">{errors.businessName}</p>}
              </div>

              {/* Mobile Number with Fixed +91 Badge */}
              <div className="login-field">
                <label htmlFor="reg-mobile">Registered Mobile Number *</label>
                <div className="login-phone-group">
                  <div className="login-phone-badge">
                    🇮🇳 +91
                  </div>
                  <div className="login-input-wrap">
                    <span className="login-input-icon">
                      <IconPhone size={18} aria-hidden="true" />
                    </span>
                    <input
                      id="reg-mobile"
                      type="tel"
                      value={mobile}
                      onChange={handleMobileChange}
                      placeholder="98765 43210"
                      disabled={loading}
                    />
                  </div>
                </div>
                {errors.mobile && <p className="login-field-error">{errors.mobile}</p>}
              </div>

              {/* Password */}
              <div className="login-field">
                <label htmlFor="reg-password">Password (min 6 characters) *</label>
                <div className="login-password-wrap">
                  <span className="login-input-icon">
                    <IconLock size={18} aria-hidden="true" />
                  </span>
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => {
                      setPassword(e.target.value)
                      if (errors.password) setErrors(prev => ({ ...prev, password: undefined }))
                    }}
                    placeholder="••••••••"
                    disabled={loading}
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

              {/* Confirm Password */}
              <div className="login-field">
                <label htmlFor="reg-confirm-password">Confirm Password *</label>
                <div className="login-password-wrap">
                  <span className="login-input-icon">
                    <IconLock size={18} aria-hidden="true" />
                  </span>
                  <input
                    id="reg-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => {
                      setConfirmPassword(e.target.value)
                      if (errors.confirmPassword) setErrors(prev => ({ ...prev, confirmPassword: undefined }))
                    }}
                    placeholder="••••••••"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowConfirmPassword(v => !v)}
                  >
                    {showConfirmPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="login-field-error">{errors.confirmPassword}</p>}
              </div>

              <button type="submit" className="login-submit-btn" disabled={loading}>
                {loading ? (
                  <span className="login-submit-loading">
                    <span className="login-spinner" aria-hidden="true" />
                    Registering…
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <span>Create Shop Account</span>
                    <IconArrowRight size={16} />
                  </span>
                )}
              </button>
            </form>

            <div className="login-security-note">
              <IconShieldCheck size={16} aria-hidden="true" />
              <span>Instant setup • No credit card required • GST ready</span>
            </div>

            <div className="login-footer">
              <p>
                Already have an account?{' '}
                <Link to="/login" className="login-link font-semibold">
                  Sign in
                </Link>
              </p>
            </div>
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
          <span>START YOUR BUSINESS</span>
          <h2>Everything you need to sell &amp; grow.</h2>
          <p>
            Register your store in seconds. Instant GST invoices, thermal barcode billing, inventory tracking, and payment processing.
          </p>
          <small>Dreamwithtech Enterprise Technologies &copy; {new Date().getFullYear()}</small>
        </div>
      </aside>
    </main>
  )
}
