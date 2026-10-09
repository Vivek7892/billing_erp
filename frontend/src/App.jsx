import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

import { AuthProvider, useAuth } from './AuthContext'
import { ThemeProvider } from './ThemeContext'
import { NetworkStatusProvider } from './context/NetworkStatusContext'
import { ROLES } from './constants'

import Layout from './components/Layout'
import { PageSkeleton } from './components/UI'
import NetworkOfflineBanner from './components/NetworkOfflineBanner'
import SessionExpiredModal from './components/SessionExpiredModal'

// Lazy-loaded pages for route-level code splitting
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const NewBill = lazy(() => import('./pages/NewBill'))
const Drafts = lazy(() => import('./pages/Drafts'))
const Bills = lazy(() => import('./pages/Bills'))
const Returns = lazy(() => import('./pages/Returns'))
const Payments = lazy(() => import('./pages/Payments'))
const Products = lazy(() => import('./pages/Products'))
const Stock = lazy(() => import('./pages/Stock'))
const Purchases = lazy(() => import('./pages/Purchases'))
const Customers = lazy(() => import('./pages/Customers'))
const Suppliers = lazy(() => import('./pages/Suppliers'))
const Expenses = lazy(() => import('./pages/Expenses'))
const Reports = lazy(() => import('./pages/Reports'))
const Users = lazy(() => import('./pages/Users'))
const Settings = lazy(() => import('./pages/Settings'))
const Support = lazy(() => import('./pages/Support'))
const PaymentReconciliation = lazy(() => import('./pages/PaymentReconciliation'))
const Notifications = lazy(() => import('./pages/Notifications'))
const PublicBill = lazy(() => import('./pages/PublicBill'))
const AuditTrail = lazy(() => import('./pages/AuditTrail'))
const RecycleBin = lazy(() => import('./pages/RecycleBin'))

// Error and Diagnostic Pages
const NotFound = lazy(() => import('./pages/errors/NotFound'))
const Forbidden = lazy(() => import('./pages/errors/Forbidden'))
const ServerError = lazy(() => import('./pages/errors/ServerError'))
const ServiceUnavailable = lazy(() => import('./pages/errors/ServiceUnavailable'))
const SessionExpired = lazy(() => import('./pages/errors/SessionExpired'))
const RequestTimeout = lazy(() => import('./pages/errors/RequestTimeout'))
const OfflineState = lazy(() => import('./pages/errors/OfflineState'))

/* -------------------------------------------------------
   Loading Screen
------------------------------------------------------- */

function LoadingScreen() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <PageSkeleton />
      <div
        className="absolute inset-x-0 bottom-6 flex justify-center px-6"
        role="status"
        aria-live="polite"
        aria-label="Loading your billing space"
      >
        <p className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-xs font-medium text-[var(--muted)] shadow-sm">
          Loading your billing space...
        </p>
      </div>
    </div>
  )
}

/* -------------------------------------------------------
   Route Guard with Role Protection & Forbidden State
------------------------------------------------------- */

function Guard({ children, adminOnly = false, roles }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  if (!user) {
    const currentPath = window.location.pathname + window.location.search
    return <Navigate to={`/login?redirect=${encodeURIComponent(currentPath)}`} replace />
  }

  if (adminOnly && ![ROLES.ADMIN, ROLES.OWNER].includes(user.role)) {
    return <Layout><Forbidden /></Layout>
  }

  if (roles && !roles.includes(user.role)) {
    return <Layout><Forbidden /></Layout>
  }

  return <Layout>{children}</Layout>
}

/* -------------------------------------------------------
   Error Page Layout Wrapper (embeds in Layout if logged in)
------------------------------------------------------- */

function ErrorPageLayout({ children }) {
  const { user } = useAuth()
  if (user) {
    return <Layout>{children}</Layout>
  }
  return children
}

/* -------------------------------------------------------
   Application Routes
------------------------------------------------------- */

function AppRoutes() {
  return (
    <Routes>
      {/* Authentication */}
      <Route path="/login" element={<Login />} />

      {/* Dashboard */}
      <Route
        path="/"
        element={
          <Guard>
            <Dashboard />
          </Guard>
        }
      />

      {/* -------------------------------------------------
          Billing
      ------------------------------------------------- */}

      <Route
        path="/billing/new"
        element={
          <Guard>
            <NewBill />
          </Guard>
        }
      />

      <Route
        path="/billing/drafts"
        element={
          <Guard>
            <Drafts />
          </Guard>
        }
      />

      {/* -------------------------------------------------
          Sales
      ------------------------------------------------- */}

      <Route
        path="/sales/invoices"
        element={
          <Guard>
            <Bills />
          </Guard>
        }
      />

      <Route
        path="/sales/returns"
        element={
          <Guard>
            <Returns />
          </Guard>
        }
      />

      <Route
        path="/sales/payments"
        element={
          <Guard>
            <Payments />
          </Guard>
        }
      />

      {/* -------------------------------------------------
          Inventory
      ------------------------------------------------- */}

      <Route
        path="/inventory/products"
        element={
          <Guard>
            <Products />
          </Guard>
        }
      />

      <Route
        path="/inventory/stock"
        element={
          <Guard>
            <Stock />
          </Guard>
        }
      />

      <Route
        path="/inventory/purchases"
        element={
          <Guard>
            <Purchases />
          </Guard>
        }
      />

      {/* -------------------------------------------------
          Parties
      ------------------------------------------------- */}

      <Route
        path="/parties/customers"
        element={
          <Guard>
            <Customers />
          </Guard>
        }
      />

      <Route
        path="/parties/suppliers"
        element={
          <Guard>
            <Suppliers />
          </Guard>
        }
      />

      {/* -------------------------------------------------
          Finance
      ------------------------------------------------- */}

      <Route
        path="/expenses"
        element={
          <Guard>
            <Expenses />
          </Guard>
        }
      />

      <Route
        path="/reports"
        element={
          <Guard
            roles={[
              ROLES.OWNER,
              ROLES.ADMIN,
              ROLES.MANAGER,
              ROLES.ACCOUNTANT,
            ]}
          >
            <Reports />
          </Guard>
        }
      />

      {/* -------------------------------------------------
          System Administration
      ------------------------------------------------- */}

      <Route
        path="/users"
        element={
          <Guard adminOnly>
            <Users />
          </Guard>
        }
      />

      <Route
        path="/settings"
        element={
          <Guard adminOnly>
            <Settings />
          </Guard>
        }
      />

      <Route
        path="/payments/reconciliation"
        element={
          <Guard adminOnly>
            <PaymentReconciliation />
          </Guard>
        }
      />

      <Route
        path="/audit-trail"
        element={
          <Guard adminOnly>
            <AuditTrail />
          </Guard>
        }
      />

      <Route
        path="/recycle-bin"
        element={
          <Guard adminOnly>
            <RecycleBin />
          </Guard>
        }
      />

      {/* -------------------------------------------------
          Miscellaneous
      ------------------------------------------------- */}

      <Route
        path="/notifications"
        element={
          <Guard>
            <Notifications />
          </Guard>
        }
      />

      <Route
        path="/support"
        element={
          <Guard>
            <Support />
          </Guard>
        }
      />

      <Route
        path="/invoice-preview"
        element={
          <Guard>
            <PublicBill />
          </Guard>
        }
      />

      <Route
        path="/invoice/:id"
        element={
          <Guard>
            <PublicBill />
          </Guard>
        }
      />

      {/* Public Digital Bill Route (Customer Scanning QR Code) */}
      <Route
        path="/bill/:token"
        element={<PublicBill />}
      />

      {/* -------------------------------------------------
          Legacy Route Redirects
      ------------------------------------------------- */}

      <Route
        path="/new-bill"
        element={<Navigate to="/billing/new" replace />}
      />

      <Route
        path="/bills"
        element={<Navigate to="/sales/invoices" replace />}
      />

      <Route
        path="/products"
        element={<Navigate to="/inventory/products" replace />}
      />

      <Route
        path="/stock"
        element={<Navigate to="/inventory/stock" replace />}
      />

      <Route
        path="/purchases"
        element={<Navigate to="/inventory/purchases" replace />}
      />

      <Route
        path="/customers"
        element={<Navigate to="/parties/customers" replace />}
      />

      <Route
        path="/suppliers"
        element={<Navigate to="/parties/suppliers" replace />}
      />

      {/* -------------------------------------------------
          Error and Diagnostic Routes
      ------------------------------------------------- */}
      <Route
        path="/403"
        element={
          <ErrorPageLayout>
            <Forbidden />
          </ErrorPageLayout>
        }
      />

      <Route
        path="/404"
        element={
          <ErrorPageLayout>
            <NotFound />
          </ErrorPageLayout>
        }
      />

      <Route
        path="/500"
        element={
          <ErrorPageLayout>
            <ServerError />
          </ErrorPageLayout>
        }
      />

      <Route
        path="/502"
        element={
          <ErrorPageLayout>
            <ServiceUnavailable />
          </ErrorPageLayout>
        }
      />

      <Route
        path="/503"
        element={
          <ErrorPageLayout>
            <ServiceUnavailable />
          </ErrorPageLayout>
        }
      />

      <Route
        path="/session-expired"
        element={<SessionExpired />}
      />

      <Route
        path="/timeout"
        element={
          <ErrorPageLayout>
            <RequestTimeout />
          </ErrorPageLayout>
        }
      />

      <Route
        path="/offline"
        element={<OfflineState />}
      />

      {/* Catch-all: 404 Page Not Found */}
      <Route
        path="*"
        element={
          <ErrorPageLayout>
            <NotFound />
          </ErrorPageLayout>
        }
      />
    </Routes>
  )
}

/* -------------------------------------------------------
   Root Application
------------------------------------------------------- */

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NetworkStatusProvider>
          <BrowserRouter>
            <NetworkOfflineBanner />
            <SessionExpiredModal />
            <Toaster
              position="top-right"
              reverseOrder={false}
              gutter={10}
              toastOptions={{
                duration: 3000,

                style: {
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  lineHeight: 1.5,
                  borderRadius: '0.875rem',
                  padding: '0.875rem 1rem',
                  maxWidth: '420px',
                  background: 'var(--surface)',
                  color: 'var(--ink)',
                  border: '1px solid var(--line)',
                  boxShadow:
                    '0 16px 40px rgba(15, 23, 42, 0.12), 0 4px 12px rgba(15, 23, 42, 0.06)',
                },

                success: {
                  iconTheme: {
                    primary: '#16a34a',
                    secondary: '#f0fdf4',
                  },

                  style: {
                    borderColor: '#bbf7d0',
                  },
                },

                error: {
                  iconTheme: {
                    primary: '#dc2626',
                    secondary: '#fef2f2',
                  },

                  style: {
                    borderColor: '#fecaca',
                  },
                },

                loading: {
                  iconTheme: {
                    primary: 'var(--primary)',
                    secondary: 'var(--surface)',
                  },
                },
              }}
            />

            <Suspense fallback={<LoadingScreen />}>
              <AppRoutes />
            </Suspense>
          </BrowserRouter>
        </NetworkStatusProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}