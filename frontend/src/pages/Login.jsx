import { useEffect, useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import toast from 'react-hot-toast'

export default function Login() {
  const [form, setForm] = useState({
    username: '',
    password: '',
  })
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
    } catch {
      setErrors({
        form: 'Invalid username or password. Please try again.',
      })
      toast.error('Unable to sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-900 lg:grid lg:grid-cols-[1.08fr_0.92fr]">
      {/* Brand panel */}
      <section className="relative hidden min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-900 lg:flex">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -right-20 h-[30rem] w-[30rem] rounded-full bg-blue-500/20 blur-3xl" />

          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)',
              backgroundSize: '42px 42px',
            }}
          />

          <div className="absolute left-[15%] top-[24%] h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_24px_8px_rgba(103,232,249,.35)] animate-ping" />
          <div className="absolute bottom-[24%] right-[18%] h-2 w-2 rounded-full bg-blue-300 shadow-[0_0_24px_8px_rgba(147,197,253,.3)] animate-pulse" />
        </div>

        <div className="relative z-10 flex w-full flex-col justify-between px-12 py-10 xl:px-20 xl:py-12">
          <Brand />

          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-cyan-100 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]" />
              Smart retail management
            </div>

            <h1 className="max-w-xl text-5xl font-bold leading-[1.02] tracking-[-0.04em] text-white xl:text-6xl">
              Your shop.
              <br />
              <span className="bg-gradient-to-r from-cyan-200 via-sky-200 to-white bg-clip-text text-transparent">
                One smarter system.
              </span>
            </h1>

            <p className="mt-6 max-w-lg text-base leading-7 text-slate-300 xl:text-lg">
              GST billing, inventory, staff access and business insights in
              one clean workspace built for fast-moving shops.
            </p>

            <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-3">
              <Feature
                icon={<CheckoutIcon />}
                title="Fast billing"
                desc="Checkout in seconds"
              />
              <Feature
                icon={<ChartIcon />}
                title="Live insights"
                desc="Sales & stock at a glance"
              />
              <Feature
                icon={<ShieldIcon />}
                title="Secure access"
                desc="Role-based permissions"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-6 text-xs text-slate-400">
            <span>Amounts in INR · GST supported</span>
            <span className="hidden xl:inline">Built for modern retail</span>
          </div>
        </div>
      </section>

      {/* Login panel */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-5 py-8 sm:px-8 lg:bg-white">
        <div className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-blue-100/70 blur-3xl lg:hidden" />
        <div className="pointer-events-none absolute -bottom-32 -left-28 h-72 w-72 rounded-full bg-cyan-100/60 blur-3xl lg:hidden" />

        <div className="relative w-full max-w-md animate-[fadeIn_.5s_ease-out]">
          {/* Mobile brand */}
          <div className="mb-9 lg:hidden">
            <Brand compact />
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_70px_-30px_rgba(15,23,42,.28)] sm:p-9 lg:border-0 lg:p-0 lg:shadow-none">
            <div className="mb-8">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                Retail workspace
              </p>
              <h2 className="text-3xl font-bold tracking-[-0.03em] text-slate-950">
                Welcome back
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Sign in to open your register and manage your shop.
              </p>
            </div>

            {errors.form && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 animate-[shake_.35s_ease-in-out]"
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
                placeholder="e.g. admin"
                autoComplete="username"
                autoFocus
                onChange={(e) => updateField('username', e.target.value)}
                disabled={loading}
              />

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-semibold text-slate-800"
                >
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
                    className={`h-12 w-full rounded-xl border bg-slate-50 px-3.5 pr-12 text-sm text-slate-950 outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${
                      errors.password
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10'
                        : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/10'
                    }`}
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={loading}
                    className="absolute right-0 top-0 flex h-12 w-12 items-center justify-center rounded-r-xl text-slate-400 transition hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed"
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

              <button
                type="submit"
                disabled={loading}
                className="group relative flex h-12 w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-600/25 focus:outline-none focus:ring-4 focus:ring-blue-500/20 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                <span className="absolute inset-0 -translate-x-full bg-white/10 transition-transform duration-700 group-hover:translate-x-full" />

                {loading ? (
                  <span className="relative inline-flex items-center gap-2">
                    <Spinner />
                    Signing in...
                  </span>
                ) : (
                  <span className="relative inline-flex items-center gap-2">
                    Sign in
                    <ArrowIcon />
                  </span>
                )}
              </button>
            </form>

            <div className="mt-7 flex items-center justify-center gap-2 text-center text-xs text-slate-400">
              <LockIcon />
              <span>Your session is protected</span>
            </div>
          </div>
        </div>
      </section>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </main>
  )
}

function Brand({ compact = false }) {
  return (
    <div className={`flex items-center ${compact ? 'gap-3' : 'gap-3.5'}`}>
      <div
        className={`flex items-center justify-center rounded-2xl bg-white shadow-lg shadow-black/10 ${
          compact ? 'h-12 w-12' : 'h-14 w-14'
        }`}
      >
        <img
          src="/logo.png"
          alt="DreamWithTech"
          className={compact ? 'h-9 w-9 object-contain' : 'h-10 w-10 object-contain'}
        />
      </div>

      <div>
        <p className="text-base font-bold tracking-tight text-slate-950 lg:text-white">
          DreamWithTech
        </p>
        <p className="text-[11px] font-medium tracking-wide text-slate-500 lg:text-slate-400">
          SMART RETAIL
        </p>
      </div>
    </div>
  )
}

function Feature({ icon, title, desc }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:bg-white/[0.09]">
      <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-cyan-100">
        {icon}
      </div>
      <p className="text-sm font-bold text-white">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{desc}</p>
    </div>
  )
}

function Field({
  id,
  label,
  type,
  value,
  error,
  placeholder,
  autoComplete,
  autoFocus,
  onChange,
  disabled,
}) {
  const errorId = useId()

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-semibold text-slate-800"
      >
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
        className={`h-12 w-full rounded-xl border bg-slate-50 px-3.5 text-sm text-slate-950 outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${
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

function CheckoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18" />
      <path d="M3 12h18" />
      <path d="m17 7 4 5-4 5" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="m7 16 4-5 3 3 5-7" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6-8 10-8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.3 20.3 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a20.14 20.14 0 0 1-2.16 3.19" />
      <path d="m14.12 14.12-4.24-4.24" />
      <path d="M9.88 9.88a3 3 0 0 0 4.24 4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-200 group-hover:translate-x-0.5">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
  )
}