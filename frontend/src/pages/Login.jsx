import { useId, useState } from 'react'
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
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))

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
    <main className="min-h-screen bg-slate-50">
      <div className="min-h-screen lg:grid lg:grid-cols-2">

        {/* =========================================================
            DESKTOP BRAND SECTION
        ========================================================== */}
        <section className="relative hidden overflow-hidden bg-slate-950 lg:flex">
          {/* Subtle background */}
          <div className="absolute inset-0">
            <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />

            <div className="absolute -bottom-40 -right-32 h-[30rem] w-[30rem] rounded-full bg-cyan-500/10 blur-3xl" />

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_35%)]" />
          </div>

          <div className="relative z-10 flex min-h-screen w-full flex-col justify-between px-12 py-10 xl:px-20">

            {/* Logo */}
            <Brand dark />

            {/* Main content */}
            <div className="max-w-xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

                <span className="text-xs font-medium text-slate-300">
                  Smart Retail Management
                </span>
              </div>

              <h1 className="text-5xl font-bold leading-[1.08] tracking-tight text-white xl:text-6xl">
                Everything your
                <br />
                business needs.
              </h1>

              <p className="mt-6 max-w-lg text-base leading-7 text-slate-400 xl:text-lg">
                Manage billing, inventory, customers and business
                operations from one simple workspace.
              </p>

              {/* Features */}
              <div className="mt-10 space-y-4">
                <Feature
                  icon={<CheckIcon />}
                  title="Fast & simple billing"
                  description="Create invoices and complete checkout quickly."
                />

                <Feature
                  icon={<ChartIcon />}
                  title="Business insights"
                  description="Keep track of sales, stock and performance."
                />

                <Feature
                  icon={<ShieldIcon />}
                  title="Secure access"
                  description="Protect your business with controlled access."
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>© {new Date().getFullYear()} DreamWithTech</span>
              <span>GST Ready · Built for Retail</span>
            </div>
          </div>
        </section>

        {/* =========================================================
            LOGIN SECTION
        ========================================================== */}
        <section className="relative flex min-h-screen items-center justify-center px-5 py-8 sm:px-8">

          {/* Mobile background decoration */}
          <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-blue-100/60 blur-3xl lg:hidden" />

          <div className="relative w-full max-w-md">

            {/* Mobile Logo */}
            <div className="mb-10 flex justify-center lg:hidden">
              <Brand />
            </div>

            {/* Login Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-25px_rgba(15,23,42,0.25)] sm:p-9">

              {/* Heading */}
              <div className="mb-8">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-blue-600">
                  Account Login
                </p>

                <h2 className="text-3xl font-bold tracking-tight text-slate-950">
                  Welcome back
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Sign in to continue to your workspace.
                </p>
              </div>

              {/* Error */}
              {errors.form && (
                <div
                  role="alert"
                  className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  <AlertIcon />

                  <span>{errors.form}</span>
                </div>
              )}

              {/* Form */}
              <form
                onSubmit={submit}
                noValidate
                className="space-y-5"
              >

                {/* Username */}
                <Field
                  id="username"
                  label="Username"
                  type="text"
                  value={form.username}
                  error={errors.username}
                  placeholder="Enter your username"
                  autoComplete="username"
                  autoFocus
                  onChange={(e) =>
                    updateField('username', e.target.value)
                  }
                  disabled={loading}
                />

                {/* Password */}
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
                      onChange={(e) =>
                        updateField('password', e.target.value)
                      }
                      disabled={loading}
                      aria-invalid={Boolean(errors.password)}
                      aria-describedby={
                        errors.password
                          ? 'password-error'
                          : undefined
                      }
                      className={`
                        h-12 w-full rounded-xl border
                        bg-slate-50 px-4 pr-12
                        text-sm text-slate-950
                        outline-none transition
                        placeholder:text-slate-400
                        focus:bg-white
                        focus:ring-4
                        disabled:cursor-not-allowed
                        disabled:opacity-60
                        ${
                          errors.password
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10'
                            : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/10'
                        }
                      `}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword((value) => !value)
                      }
                      disabled={loading}
                      className="absolute right-0 top-0 flex h-12 w-12 items-center justify-center rounded-r-xl text-slate-400 transition hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      aria-label={
                        showPassword
                          ? 'Hide password'
                          : 'Show password'
                      }
                    >
                      {showPassword ? (
                        <EyeOffIcon />
                      ) : (
                        <EyeIcon />
                      )}
                    </button>
                  </div>

                  {errors.password && (
                    <p
                      id="password-error"
                      className="mt-1.5 text-xs font-medium text-red-600"
                    >
                      {errors.password}
                    </p>
                  )}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="
                    group relative flex h-12 w-full
                    items-center justify-center
                    overflow-hidden rounded-xl
                    bg-blue-600
                    text-sm font-bold text-white
                    shadow-lg shadow-blue-600/20
                    transition-all duration-200
                    hover:bg-blue-700
                    hover:shadow-xl
                    focus:outline-none
                    focus:ring-4
                    focus:ring-blue-500/20
                    active:scale-[0.99]
                    disabled:cursor-not-allowed
                    disabled:opacity-60
                  "
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

              {/* Security */}
              <div className="mt-7 flex items-center justify-center gap-2 text-xs text-slate-400">
                <LockIcon />

                <span>
                  Your connection is secure
                </span>
              </div>
            </div>

            {/* Mobile footer */}
            <p className="mt-6 text-center text-xs text-slate-400 lg:hidden">
              © {new Date().getFullYear()} DreamWithTech
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}


/* =========================================================
   BRAND
========================================================= */

function Brand({ dark = false }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-md">
        <img
          src="/logo.png"
          alt="DreamWithTech"
          className="h-8 w-8 object-contain"
        />
      </div>

      <div>
        <p
          className={`text-base font-bold tracking-tight ${
            dark
              ? 'text-white'
              : 'text-slate-950'
          }`}
        >
          DreamWithTech
        </p>

        <p
          className={`text-[10px] font-semibold tracking-[0.16em] ${
            dark
              ? 'text-slate-500'
              : 'text-slate-400'
          }`}
        >
          SMART RETAIL
        </p>
      </div>
    </div>
  )
}


/* =========================================================
   FEATURE
========================================================= */

function Feature({ icon, title, description }) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-blue-300">
        {icon}
      </div>

      <div>
        <p className="text-sm font-semibold text-white">
          {title}
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          {description}
        </p>
      </div>
    </div>
  )
}


/* =========================================================
   INPUT FIELD
========================================================= */

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
        aria-describedby={
          error ? errorId : undefined
        }
        className={`
          h-12 w-full rounded-xl border
          bg-slate-50 px-4
          text-sm text-slate-950
          outline-none transition
          placeholder:text-slate-400
          focus:bg-white
          focus:ring-4
          disabled:cursor-not-allowed
          disabled:opacity-60
          ${
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10'
              : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/10'
          }
        `}
      />

      {error && (
        <p
          id={errorId}
          className="mt-1.5 text-xs font-medium text-red-600"
        >
          {error}
        </p>
      )}
    </div>
  )
}


/* =========================================================
   ICONS
========================================================= */

function CheckIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3v18h18" />
      <path d="m7 16 4-5 3 3 5-7" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
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
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect
        width="18"
        height="11"
        x="3"
        y="11"
        rx="2"
      />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg
      className="mt-0.5 h-4 w-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />

      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
      />
    </svg>
  )
}