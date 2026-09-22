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

  // ============================================================
  // VALIDATION
  // ============================================================

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

  // ============================================================
  // FIELD UPDATE
  // ============================================================

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

  // ============================================================
  // LOGIN
  // ============================================================

  const submit = async (e) => {
    e.preventDefault()

    if (!validate()) {
      toast.error('Please check your login details')
      return
    }

    setLoading(true)
    setErrors({})

    try {
      await login(
        form.username.trim(),
        form.password
      )

      toast.success('Welcome back!')
      navigate('/')
    } catch (error) {
      const status = error?.response?.status

      const message = !error?.response
        ? 'Unable to reach the server. Check that the backend is running and try again.'
        : status === 429
          ? 'Too many login attempts. Please wait a minute and try again.'
          : error?.response?.data?.error ||
            'Invalid username or password. Please try again.'

      setErrors({
        form: message,
      })

      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">

      <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">

        {/* ======================================================
            LEFT INFORMATION PANEL
        ====================================================== */}

        <section className="hidden bg-slate-50 lg:flex">

          <div className="flex min-h-screen w-full flex-col px-12 py-10 xl:px-20">

            {/* ==================================================
                BRAND
            ================================================== */}

            <Brand />


            {/* ==================================================
                SYSTEM INFORMATION
            ================================================== */}

            <div className="flex flex-1 items-center">

              <div className="max-w-[650px]">

                {/* Small Label */}

                <div className="mb-5 flex items-center gap-3">

                  <span className="h-px w-8 bg-blue-600" />

                  <span className="
                    text-xs
                    font-semibold
                    uppercase
                    tracking-[0.16em]
                    text-slate-500
                  ">
                    ERP Billing & Business Management
                  </span>

                </div>


                {/* Main Heading */}

                <h1 className="
                  max-w-xl
                  text-4xl
                  font-bold
                  leading-[1.12]
                  tracking-[-0.035em]
                  text-slate-950
                  xl:text-5xl
                ">
                  Manage your business
                  <span className="block text-slate-700">
                    from one place.
                  </span>
                </h1>


                {/* Description */}

                <p className="
                  mt-6
                  max-w-xl
                  text-[15px]
                  leading-7
                  text-slate-600
                ">
                  A centralized ERP billing system designed to simplify
                  daily business operations. Manage invoices, inventory,
                  customers, purchases, expenses, GST and reports from
                  a single workspace.
                </p>


                {/* ==================================================
                    FEATURES
                ================================================== */}

                <div className="mt-10 grid max-w-xl grid-cols-2 gap-x-10 gap-y-7">

                  <SystemFeature
                    title="Billing & Invoices"
                    description="Create, manage and print invoices."
                  />

                  <SystemFeature
                    title="Inventory Management"
                    description="Track products and stock levels."
                  />

                  <SystemFeature
                    title="Customer Management"
                    description="Maintain customer and transaction records."
                  />

                  <SystemFeature
                    title="Purchases & Expenses"
                    description="Manage suppliers, purchases and expenses."
                  />

                  <SystemFeature
                    title="GST & Tax"
                    description="Maintain tax and GST information."
                  />

                  <SystemFeature
                    title="Business Reports"
                    description="Monitor sales and business activity."
                  />

                </div>

              </div>

            </div>


            {/* ==================================================
                LEFT FOOTER
            ================================================== */}

            <div className="
              flex
              items-center
              justify-between
              border-t
              border-slate-200
              pt-5
            ">

              <span className="text-xs text-slate-500">
                © {new Date().getFullYear()} DreamWithTech
              </span>

              <span className="text-xs text-slate-400">
                ERP · Billing · Business Management
              </span>

            </div>

          </div>

        </section>


        {/* ======================================================
            RIGHT LOGIN PANEL
        ====================================================== */}

        <section className="
          flex
          min-h-screen
          items-center
          justify-center
          bg-white
          px-5
          py-10
          sm:px-8
        ">

          <div className="w-full max-w-[400px]">

            {/* ==================================================
                MOBILE BRAND
            ================================================== */}

            <div className="mb-12 lg:hidden">
              <Brand />
            </div>


            {/* ==================================================
                LOGIN HEADER
            ================================================== */}

            <div className="mb-8">

              {/* Login Icon */}

              <div className="
                mb-5
                flex
                h-11
                w-11
                items-center
                justify-center
                rounded-md
                border
                border-slate-200
                bg-slate-50
                text-slate-700
              ">
                <LockIcon />
              </div>


              <h2 className="
                text-3xl
                font-bold
                tracking-[-0.03em]
                text-slate-950
              ">
                Welcome back
              </h2>


              <p className="
                mt-2
                text-sm
                leading-6
                text-slate-500
              ">
                Sign in to access your ERP workspace.
              </p>

            </div>


            {/* ==================================================
                ERROR MESSAGE
            ================================================== */}

            {errors.form && (

              <div
                role="alert"
                className="
                  mb-5
                  rounded-md
                  border
                  border-red-200
                  bg-red-50
                  px-4
                  py-3
                  text-sm
                  font-medium
                  text-red-700
                "
              >
                {errors.form}
              </div>

            )}


            {/* ==================================================
                LOGIN FORM
            ================================================== */}

            <form
              onSubmit={submit}
              noValidate
              className="space-y-5"
            >

              {/* ==================================================
                  USERNAME
              ================================================== */}

              <Field
                id="username"
                label="Username"
                type="text"
                value={form.username}
                error={errors.username}
                placeholder="Enter your username"
                autoComplete="username"
                autoFocus
                disabled={loading}
                onChange={(e) =>
                  updateField(
                    'username',
                    e.target.value
                  )
                }
              />


              {/* ==================================================
                  PASSWORD
              ================================================== */}

              <div>

                <label
                  htmlFor="password"
                  className="
                    mb-2
                    block
                    text-sm
                    font-medium
                    text-slate-700
                  "
                >
                  Password
                </label>


                <div className="relative">

                  <input
                    id="password"
                    type={
                      showPassword
                        ? 'text'
                        : 'password'
                    }
                    value={form.password}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    disabled={loading}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={
                      errors.password
                        ? 'password-error'
                        : undefined
                    }
                    onChange={(e) =>
                      updateField(
                        'password',
                        e.target.value
                      )
                    }
                    className={`
                      h-12
                      w-full
                      rounded-md
                      border
                      bg-white
                      px-4
                      pr-12
                      text-sm
                      text-slate-900
                      outline-none
                      transition
                      placeholder:text-slate-400
                      disabled:cursor-not-allowed
                      disabled:bg-slate-50
                      focus:ring-2

                      ${
                        errors.password
                          ? `
                            border-red-400
                            focus:border-red-500
                            focus:ring-red-100
                          `
                          : `
                            border-slate-300
                            focus:border-slate-700
                            focus:ring-slate-100
                          `
                      }
                    `}
                  />


                  {/* Show / Hide */}

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (value) => !value
                      )
                    }
                    disabled={loading}
                    aria-label={
                      showPassword
                        ? 'Hide password'
                        : 'Show password'
                    }
                    className="
                      absolute
                      right-0
                      top-0
                      flex
                      h-12
                      w-12
                      items-center
                      justify-center
                      text-slate-400
                      transition
                      hover:text-slate-700
                      focus:outline-none
                    "
                  >

                    {showPassword ? (
                      <EyeOffIcon />
                    ) : (
                      <EyeIcon />
                    )}

                  </button>

                </div>


                {/* Password Error */}

                {errors.password && (

                  <p
                    id="password-error"
                    className="
                      mt-1.5
                      text-xs
                      font-medium
                      text-red-600
                    "
                  >
                    {errors.password}
                  </p>

                )}

              </div>


              {/* ==================================================
                  OPTIONS
              ================================================== */}

              <div className="
                flex
                items-center
                justify-between
                pt-1
              ">

                <label className="
                  flex
                  cursor-pointer
                  items-center
                  gap-2
                  text-sm
                  text-slate-600
                ">

                  <input
                    type="checkbox"
                    className="
                      h-4
                      w-4
                      rounded
                      border-slate-300
                      text-slate-900
                      focus:ring-slate-300
                    "
                  />

                  Remember me

                </label>


                <button
                  type="button"
                  onClick={() =>
                    toast(
                      'Please contact your administrator to reset your password.'
                    )
                  }
                  className="
                    text-sm
                    font-medium
                    text-slate-600
                    transition
                    hover:text-slate-950
                  "
                >
                  Forgot password?
                </button>

              </div>


              {/* ==================================================
                  SIGN IN BUTTON
              ================================================== */}

              <button
                type="submit"
                disabled={loading}
                className="
                  flex
                  h-12
                  w-full
                  items-center
                  justify-center
                  rounded-md
                  bg-slate-900
                  text-sm
                  font-semibold
                  text-white
                  transition
                  hover:bg-slate-800
                  focus:outline-none
                  focus:ring-2
                  focus:ring-slate-300
                  active:bg-slate-950
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                "
              >

                {loading ? (

                  <span className="
                    flex
                    items-center
                    gap-2
                  ">
                    <Spinner />
                    Signing in...
                  </span>

                ) : (

                  'Sign in'

                )}

              </button>

            </form>


            {/* ==================================================
                SECURITY
            ================================================== */}

            <div className="
              mt-8
              flex
              items-center
              justify-center
              gap-2
              text-xs
              text-slate-400
            ">

              <LockIcon small />

              <span>
                Secure ERP access
              </span>

            </div>


            {/* ==================================================
                MOBILE SYSTEM DESCRIPTION
            ================================================== */}

            <div className="
              mt-10
              border-t
              border-slate-200
              pt-6
              text-center
              lg:hidden
            ">

              <p className="
                text-xs
                leading-5
                text-slate-500
              ">
                ERP Billing & Business Management
                <br />
                Billing · Inventory · Customers · Reports
              </p>

            </div>

          </div>

        </section>

      </div>

    </main>
  )
}


/* ================================================================
   BRAND
================================================================ */

function Brand() {
  return (
    <div className=" mb-12 flex items-center gap-3">

      {/* Square Logo */}

      <div className="
   
      ">

        <img
          src="/logo.png"
          alt="DreamWithTech"
          className="
            h-7
            w-7
            object-contain
          "
        />

      </div>


      {/* Brand Text */}

      <div>

        <p className="
          text-[15px]
          font-bold
          tracking-tight
          text-slate-950
        ">
          DreamWithTech
        </p>

        <p className="
          mt-0.5
          text-[9px]
          font-semibold
          tracking-[0.18em]
          text-slate-400
        ">
          SMART BUSINESS
        </p>

      </div>

    </div>
  )
}


/* ================================================================
   SYSTEM FEATURE
================================================================ */

function SystemFeature({
  title,
  description,
}) {
  return (
    <div className="flex gap-3">

      {/* Square Check */}

      <div className="
        mt-0.5
        flex
        h-5
        w-5
        shrink-0
        items-center
        justify-center
        rounded-md
        border
        border-slate-300
        bg-white
        text-blue-600
      ">
        <CheckIcon />
      </div>


      <div>

        <p className="
          text-sm
          font-semibold
          text-slate-900
        ">
          {title}
        </p>

        <p className="
          mt-1
          text-xs
          leading-5
          text-slate-500
        ">
          {description}
        </p>

      </div>

    </div>
  )
}


/* ================================================================
   INPUT FIELD
================================================================ */

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
        className="
          mb-2
          block
          text-sm
          font-medium
          text-slate-700
        "
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
          error
            ? errorId
            : undefined
        }
        className={`
          h-12
          w-full
          rounded-md
          border
          bg-white
          px-4
          text-sm
          text-slate-900
          outline-none
          transition
          placeholder:text-slate-400
          disabled:cursor-not-allowed
          disabled:bg-slate-50
          focus:ring-2

          ${
            error
              ? `
                border-red-400
                focus:border-red-500
                focus:ring-red-100
              `
              : `
                border-slate-300
                focus:border-slate-700
                focus:ring-slate-100
              `
          }
        `}
      />


      {error && (

        <p
          id={errorId}
          className="
            mt-1.5
            text-xs
            font-medium
            text-red-600
          "
        >
          {error}
        </p>

      )}

    </div>
  )
}


/* ================================================================
   CHECK ICON
================================================================ */

function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  )
}


/* ================================================================
   EYE ICON
================================================================ */

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

      <circle
        cx="12"
        cy="12"
        r="3"
      />
    </svg>
  )
}


/* ================================================================
   EYE OFF ICON
================================================================ */

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

      <line
        x1="1"
        y1="1"
        x2="23"
        y2="23"
      />
    </svg>
  )
}


/* ================================================================
   LOCK ICON
================================================================ */

function LockIcon({ small = false }) {
  return (
    <svg
      width={small ? 13 : 18}
      height={small ? 13 : 18}
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


/* ================================================================
   SPINNER
================================================================ */

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
