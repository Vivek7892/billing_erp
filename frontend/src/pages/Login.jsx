import { useState } from 'react'
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

  const { login } = useAuth()
  const navigate = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      await login(form.username, form.password)
      navigate('/')
    } catch {
      toast.error('Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-white">

      {/* ================= LEFT BRAND PANEL ================= */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500">

        {/* Dotted background */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, white 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Soft glow */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-400/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-300/20 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
              <img
                src="/logo.png"
                alt="DreamWithTech"
                className="w-8 h-8 object-contain"
              />
            </div>

            <span className="text-white font-semibold text-lg tracking-tight">
              DreamWithTech
            </span>
          </div>

          {/* Main content */}
          <div className="max-w-xl">

            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-[1.05] tracking-tight">
              Bill faster.
              <br />
              Manage smarter.
            </h1>

            <p className="mt-5 text-blue-100 text-base xl:text-lg leading-relaxed max-w-md">
              GST billing, inventory and staff access — all in one
              place, built for your shop.
            </p>

            {/* Features */}
            <div className="mt-10 space-y-6">

              <Feature
                icon={<CheckoutIcon />}
                title="Two-click checkout"
                desc="Scan, quantity, pay — done."
              />

              <Feature
                icon={<ChartIcon />}
                title="Live business insight"
                desc="Sales, profit and stock in one view."
              />

              <Feature
                icon={<ShieldIcon />}
                title="Role-based access"
                desc="Admin, manager and cashier permissions."
              />

            </div>
          </div>

          {/* Footer */}
          <p className="text-blue-100/70 text-xs">
            Amounts in INR · GST optional per product
          </p>

        </div>
      </div>

      {/* ================= RIGHT LOGIN PANEL ================= */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-gray-50 lg:bg-white">

        <div className="w-full max-w-[390px]">

          {/* Mobile logo */}
          <div className="flex justify-center lg:hidden mb-8">
            <img
              src="/logo.png"
              alt="DreamWithTech"
              className="w-14 h-14 object-contain"
            />
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
              Welcome back
            </h2>

            <p className="text-gray-500 mt-1.5 text-sm">
              Sign in to open your register
            </p>
          </div>

          {/* Login form */}
          <form onSubmit={submit} className="space-y-5">

            {/* Username */}
            <div>
              <label
                htmlFor="username"
                className="block text-xs font-semibold text-gray-700 mb-2"
              >
                Username
              </label>

              <input
                id="username"
                type="text"
                autoComplete="username"
                placeholder="Enter username"
                value={form.username}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    username: e.target.value,
                  }))
                }
                required
                autoFocus
                className="
                  w-full
                  h-11
                  rounded-lg
                  border border-gray-300
                  bg-white
                  px-3.5
                  text-sm
                  text-gray-900
                  placeholder:text-gray-400
                  outline-none
                  transition
                  focus:border-blue-500
                  focus:ring-2
                  focus:ring-blue-500/20
                "
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-gray-700 mb-2"
              >
                Password
              </label>

              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter password"
                  value={form.password}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                  required
                  className="
                    w-full
                    h-11
                    rounded-lg
                    border border-gray-300
                    bg-white
                    px-3.5
                    pr-11
                    text-sm
                    text-gray-900
                    placeholder:text-gray-400
                    outline-none
                    transition
                    focus:border-blue-500
                    focus:ring-2
                    focus:ring-blue-500/20
                  "
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="
                    absolute
                    right-0
                    top-0
                    h-11
                    w-11
                    flex
                    items-center
                    justify-center
                    text-gray-400
                    hover:text-gray-600
                    transition
                  "
                  aria-label={
                    showPassword
                      ? 'Hide password'
                      : 'Show password'
                  }
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {/* Sign in */}
            <button
              type="submit"
              disabled={loading}
              className="
                w-full
                h-11
                rounded-lg
                bg-gradient-to-r
                from-blue-700
                to-cyan-500
                hover:from-blue-800
                hover:to-cyan-600
                text-white
                font-semibold
                text-sm
                transition
                shadow-sm
                disabled:opacity-60
                disabled:cursor-not-allowed
                flex
                items-center
                justify-center
              "
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>

          </form>

          {/* ================= DEMO ACCESS ================= */}
          <div className="mt-8 rounded-xl border border-gray-200 bg-gray-50 p-3">

            <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-400 px-2 mb-2">
              Demo Access
            </p>

            {/* Admin */}
            <button
              type="button"
              onClick={() =>
                setForm({
                  username: 'admin',
                  password: 'admin123',
                })
              }
              className="
                w-full
                flex
                items-center
                justify-between
                rounded-lg
                bg-white
                border border-gray-100
                px-3
                py-2.5
                mb-2
                text-left
                hover:border-blue-200
                hover:bg-blue-50/50
                transition
              "
            >
              <span className="text-xs font-medium text-gray-700">
                Admin
              </span>

              <span className="text-[11px] text-gray-400">
                admin / admin123
              </span>
            </button>

            {/* Cashier */}
            <button
              type="button"
              onClick={() =>
                setForm({
                  username: 'cashier',
                  password: 'cashier123',
                })
              }
              className="
                w-full
                flex
                items-center
                justify-between
                rounded-lg
                bg-white
                border border-gray-100
                px-3
                py-2.5
                text-left
                hover:border-blue-200
                hover:bg-blue-50/50
                transition
              "
            >
              <span className="text-xs font-medium text-gray-700">
                Cashier
              </span>

              <span className="text-[11px] text-gray-400">
                cashier / cashier123
              </span>
            </button>

          </div>

        </div>
      </div>
    </div>
  )
}

/* ================= FEATURE ================= */

function Feature({ icon, title, desc }) {
  return (
    <div className="flex items-start gap-3.5">

      <div className="
        w-8
        h-8
        shrink-0
        rounded-lg
        bg-white/10
        border
        border-white/10
        flex
        items-center
        justify-center
        text-white
      ">
        {icon}
      </div>

      <div>
        <p className="text-white font-semibold text-sm">
          {title}
        </p>

        <p className="text-blue-100/80 text-xs mt-1">
          {desc}
        </p>
      </div>

    </div>
  )
}

/* ================= ICONS ================= */

function CheckoutIcon() {
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
      <path d="M12 3v18" />
      <path d="M3 12h18" />
      <path d="m17 7 4 5-4 5" />
    </svg>
  )
}

function ChartIcon() {
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
      <path d="M3 3v18h18" />
      <path d="m7 16 4-5 3 3 5-7" />
    </svg>
  )
}

function ShieldIcon() {
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

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-white"
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
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  )
}

