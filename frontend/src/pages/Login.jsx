import { useId, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../AuthContext'
import { getRememberMePreference } from '../services/tokenStorage'
import retailVisual from '../assets/login-retail-visual.png'
import './Login.css'

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [rememberMe, setRememberMe] = useState(getRememberMePreference)
  const { login } = useAuth()
  const navigate = useNavigate()
  const passwordErrorId = useId()

  const updateField = (field, value) => {
    setForm(previous => ({ ...previous, [field]: value }))
    setErrors(previous => {
      if (!previous[field]) return previous
      const next = { ...previous }
      delete next[field]
      return next
    })
  }

  const submit = async event => {
    event.preventDefault()

    const nextErrors = {}
    if (!form.username.trim()) nextErrors.username = 'Username is required'
    else if (form.username.trim().length < 3) nextErrors.username = 'Enter at least 3 characters'
    if (!form.password) nextErrors.password = 'Password is required'
    else if (form.password.length < 4) nextErrors.password = 'Enter a valid password'

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      toast.error('Please check your login details')
      return
    }

    setLoading(true)
    setErrors({})

    try {
      await login(form.username.trim(), form.password, rememberMe)
      toast.success('Welcome back!')
      navigate('/')
    } catch (error) {
      const status = error?.response?.status
      const message = !error?.response
        ? 'Unable to reach the server. Check that the backend is running and try again.'
        : status === 429
          ? 'Too many login attempts. Please wait a minute and try again.'
          : error?.response?.data?.error || 'Invalid username or password. Please try again.'

      setErrors({ form: message })
      toast.error(message)
    } finally {
      setLoading(false)
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
            <div className="login-heading">
              <span className="login-heading-icon" aria-hidden="true">
                <LockKeyhole size={18} />
              </span>
              <h1 id="login-title">Welcome back</h1>
              <p>Sign in to manage your store, billing and inventory.</p>
            </div>

            {errors.form && <div className="login-form-error" role="alert">{errors.form}</div>}

            <form onSubmit={submit} noValidate className="login-form">
              <div className="login-field">
                <label htmlFor="username">Email or username</label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={form.username}
                  placeholder="Enter your email or username"
                  autoComplete="username"
                  autoFocus
                  disabled={loading}
                  aria-invalid={Boolean(errors.username)}
                  aria-describedby={errors.username ? 'username-error' : undefined}
                  onChange={event => updateField('username', event.target.value)}
                />
                {errors.username && <p className="login-field-error" id="username-error">{errors.username}</p>}
              </div>

              <div className="login-field">
                <label htmlFor="password">Password</label>
                <div className="login-password-wrap">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    disabled={loading}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? passwordErrorId : undefined}
                    onChange={event => updateField('password', event.target.value)}
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={() => setShowPassword(value => !value)}
                    disabled={loading}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && <p className="login-field-error" id={passwordErrorId}>{errors.password}</p>}
              </div>

              <div className="login-options">
                <label className="login-remember">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={event => setRememberMe(event.target.checked)}
                    disabled={loading}
                  />
                  <span>Remember me</span>
                </label>
                <button
                  type="button"
                  className="login-forgot"
                  onClick={() => toast('Please contact your administrator to reset your password.')}
                >
                  Forgot password?
                </button>
              </div>

              <button type="submit" className="login-submit" disabled={loading}>
                {loading ? <><span className="login-spinner" aria-hidden="true" />Signing in...</> : 'Sign in'}
              </button>
            </form>

            <div className="login-security-note">
              <ShieldCheck size={15} aria-hidden="true" />
              <span>Secure access to your business workspace</span>
            </div>

            <section className="login-about-mobile" aria-labelledby="login-about-mobile-title">
              <h2 id="login-about-mobile-title">About Dreamwithtech</h2>
              <p>POS and retail ERP tools for billing, inventory, customers, payments and reports.</p>
              <a href="mailto:connectwithvvivek@gmail.com">Contact support</a>
            </section>
          </div>

          

          <footer className="login-footer">
            <span>© {new Date().getFullYear()} Dreamwithtech</span>
            <Link to="/terms-and-conditions">Terms &amp; Conditions</Link>
          </footer>
        </div>
      </section>

      <aside className="login-visual" aria-label="Dreamwithtech retail management system">
        <div className="login-visual-artwork">
          <img
            src={retailVisual}
            alt="Dreamwithtech retail ERP dashboard on a desktop monitor, with rice, flour and cooking oil products."
          />
        </div>
        <div className="login-visual-caption">
          <span>ABOUT DREAMWITHTECH</span>
          <h2>Retail operations, connected.</h2>
          <p>
            Dreamwithtech POS &amp; Billing ERP brings billing, inventory,
            customers, payments and reports into one workspace.
          </p>
          <small>Operated by ShopEase Retail Technologies with Sri Balaji Store.</small>
          <a href="mailto:connectwithvvivek@gmail.com">Contact support</a>
        </div>
      </aside>
    </main>
  )
}
