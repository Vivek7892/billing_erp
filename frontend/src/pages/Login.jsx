import { useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import toast from 'react-hot-toast'

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  const { login } = useAuth()
  const navigate = useNavigate()

  const validate = () => {
    const nextErrors = {}

    if (!form.username.trim()) {
      nextErrors.username = 'Username is required'
    } else if (form.username.trim().length < 3) {
      nextErrors.username = 'Enter at least 3 characters'
    }

    if (!form.password) {
      nextErrors.password = 'Password is required'
    } else if (form.password.length < 4) {
      nextErrors.password = 'Enter a valid password'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const submit = async (e) => {
    e.preventDefault()

    if (!validate()) {
      toast.error('Please check your login details')
      return
    }

    setLoading(true)

    try {
      await login(form.username.trim(), form.password)
      toast.success('Welcome back!')
      navigate('/')
    } catch (error) {
      const status = error.response?.status
      const message = !error.response
        ? 'Unable to reach the server. Check that the backend is running and try again.'
        : status === 429
          ? 'Too many login attempts. Please wait a minute and try again.'
          : error.response?.data?.error || 'Invalid username or password. Please try again.'
      setErrors({
        form: message,
      })
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[1.08fr_0.92fr]">
        {/* Brand / product panel */}
        <section className="relative hidden overflow-hidden bg-[#08111f] lg:block">
          <div className="absolute inset-0">
            <div className="absolute -left-32 top-[-12rem] h-[34rem] w-[34rem] rounded-full bg-blue-500/20 blur-3xl" />
            <div className="absolute bottom-[-16rem] right-[-10rem] h-[36rem] w-[36rem] rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_18%,rgba(59,130,246,0.16),transparent_30%),linear-gradient(135deg,transparent,rgba(255,255,255,0.02))]" />
            <div className="absolute inset-y-0 right-0 w-px bg-white/10" />
          </div>

          <div className="relative z-10 flex min-h-screen flex-col px-12 py-10 xl:px-20">
            <Brand dark />

            <div className="flex flex-1 items-center">
              <div className="max-w-2xl pb-10">
                <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-2 text-xs font-semibold text-slate-300 backdrop-blur">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
                  Built for modern business
                </div>

                <h1 className="max-w-xl text-5xl font-semibold leading-[1.04] tracking-[-0.04em] text-white xl:text-6xl">
                  Run your business
                  <span className="block text-blue-400">with confidence.</span>
                </h1>

                <p className="mt-7 max-w-xl text-base leading-7 text-slate-400 xl:text-lg">
                  A smarter ERP workspace for billing, inventory, customers,
                  reports and everyday operations — all in one place.
                </p>

                <div className="mt-11 grid max-w-xl gap-3 sm:grid-cols-3">
                  <Feature icon={<CheckIcon />} title="Simple" description="Less effort, more control." />
                  <Feature icon={<ChartIcon />} title="Insightful" description="Decisions backed by data." />
                  <Feature icon={<ShieldIcon />} title="Secure" description="Access you can trust." />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/10 pt-5 text-[11px] font-medium text-slate-500">
              <span>© {new Date().getFullYear()} DreamWithTech</span>
              <span>ERP · Retail · Business Management</span>
            </div>
          </div>
        </section>

        {/* Login panel */}
        <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-8 sm:px-8">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-100/70 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-slate-200/60 blur-3xl" />

          <div className="relative w-full max-w-[430px]">
            <div className="mb-8 lg:hidden">
              <Brand />
            </div>

            <div className="rounded-[28px] border border-slate-200/80 bg-white p-7 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.28)] sm:p-10">
              <div className="mb-9">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <LockIcon large />
                </div>

                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-600">
                  Login to your account
                </p>
                <h2 className="text-[30px] font-semibold tracking-[-0.035em] text-slate-950">
                  Welcome back
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Sign in to access your ERP workspace.
                </p>
              </div>

              {errors.form && (
                <div
                  role="alert"
                  className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-700"
                >
                  <AlertIcon />
                  <span>{errors.form}</span>
                </div>
              )}

              <form onSubmit={submit} noValidate className="space-y-5">
                <Field
                  id="username"
                  label="Username"
                  type="text"
                  value={form.username}
                  error={errors.username}
                  placeholder="Enter your username"
                  autoComplete="username"
                  autoFocus
                  onChange={(e) => updateField('username', e.target.value)}
                  disabled={loading}
                />

                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-800">
                    Password
                  </label>

                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={form.password}
                      onChange={(e) => updateField('password', e.target.value)}
                      disabled={loading}
                      aria-invalid={Boolean(errors.password)}
                      aria-describedby={errors.password ? 'password-error' : undefined}
                      className={`h-12 w-full rounded-2xl border bg-slate-50/70 px-4 pr-12 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${
                        errors.password
                          ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10'
                          : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/10'
                      }`}
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      disabled={loading}
                      className="absolute right-0 top-0 flex h-12 w-12 items-center justify-center rounded-r-2xl text-slate-400 transition hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>

                  {errors.password && (
                    <p id="password-error" className="mt-1.5 text-xs font-medium text-red-600">
                      {errors.password}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-slate-500">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    className="text-xs font-semibold text-blue-600 transition hover:text-blue-700"
                    onClick={() => toast('Please contact your administrator to reset your password Developer-Vivek V-7892409872.')}
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="group relative flex h-12 w-full items-center justify-center overflow-hidden rounded-2xl bg-blue-600 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all duration-200 hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/25 focus:outline-none focus:ring-4 focus:ring-blue-500/20 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner />
                      Signing in...
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      Sign in
                      <ArrowIcon />
                    </span>
                  )}
                </button>
              </form>

              <div className="mt-7 flex items-center justify-center gap-2 text-xs text-slate-400">
                <LockIcon />
                <span>Your connection is secure</span>
              </div>
            </div>

            <p className="mt-6 text-center text-[11px] font-medium text-slate-400">
              © {new Date().getFullYear()} DreamWithTech · Secure ERP access
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}

function Brand({ dark = false }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${dark ? 'bg-white shadow-lg' : 'border border-slate-200 bg-white shadow-sm'}`}>
        <img src="/logo.png" alt="DreamWithTech" className="h-7 w-7 object-contain" />
      </div>

      <div>
        <p className={`text-[15px] font-bold tracking-tight ${dark ? 'text-white' : 'text-slate-950'}`}>
          DreamWithTech
        </p>
        <p className={`mt-0.5 text-[9px] font-bold tracking-[0.18em] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
          SMART BUSINESS
        </p>
      </div>
    </div>
  )
}

function Feature({ icon, title, description }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 backdrop-blur-sm">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300">
        {icon}
      </div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-[11px] leading-5 text-slate-500">{description}</p>
    </div>
  )
}

function Field({ id, label, type, value, error, placeholder, autoComplete, autoFocus, onChange, disabled }) {
  const errorId = useId()

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-slate-800">
        {label}
      </label>

      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        onChange={onChange}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={`h-12 w-full rounded-2xl border bg-slate-50/70 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10'
            : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/10'
        }`}
      />

      {error && (
        <p id={errorId} className="mt-1.5 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

function CheckIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>
}

function ChartIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m7 16 4-5 3 3 5-7" /></svg>
}

function ShieldIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>
}

function EyeIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" /><circle cx="12" cy="12" r="3" /></svg>
}

function EyeOffIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.3 20.3 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a20.14 20.14 0 0 1-2.16 3.19" /><path d="m14.12 14.12-4.24-4.24" /><path d="M9.88 9.88a3 3 0 0 0 4.24 4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
}

function ArrowIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
}

function LockIcon({ large = false }) {
  return <svg width={large ? 19 : 13} height={large ? 19 : 13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
}

function AlertIcon() {
  return <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
}

function Spinner() {
  return <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" /></svg>
}
