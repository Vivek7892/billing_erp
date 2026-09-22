import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

import { AuthProvider, useAuth } from './AuthContext'
import { ThemeProvider } from './ThemeContext'

import Layout from './components/Layout'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewBill from './pages/NewBill'
import Drafts from './pages/Drafts'
import Bills from './pages/Bills'
import Returns from './pages/Returns'
import Payments from './pages/Payments'
import Products from './pages/Products'
import Stock from './pages/Stock'
import Purchases from './pages/Purchases'
import Customers from './pages/Customers'
import Suppliers from './pages/Suppliers'
import Expenses from './pages/Expenses'
import Reports from './pages/Reports'
import Users from './pages/Users'
import Settings from './pages/Settings'
import Support from './pages/Support'
import InvoicePreview from './pages/InvoicePreview'
import PaymentReconciliation from './pages/PaymentReconciliation'

/* -------------------------------------------------------
   Loading Screen
------------------------------------------------------- */

function LoadingScreen() {
  return (
    <div
      className="
        min-h-screen
        flex
        items-center
        justify-center
        px-6
        transition-colors
        duration-300
      "
      style={{
        background: 'var(--app-bg)',
        color: 'var(--ink)',
      }}
    >
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <div
          className="
            mb-6
            flex
            h-16
            w-16
            items-center
            justify-center
            rounded-2xl
            border
            shadow-sm
          "
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--line)',
          }}
        >
          <div
            className="
              h-8
              w-8
              animate-spin
              rounded-full
              border-[3px]
              border-transparent
            "
            style={{
              borderTopColor: 'var(--primary)',
              borderRightColor: 'var(--primary)',
            }}
          />
        </div>

        <h1
          className="text-lg font-bold tracking-tight"
          style={{ color: 'var(--ink)' }}
        >
          Loading your billing space...
        </h1>

        <p
          className="mt-2 text-sm"
          style={{ color: 'var(--muted)' }}
        >
          Please wait while we securely load your account.
        </p>

        <div
          className="mt-6 h-1.5 w-40 overflow-hidden rounded-full"
          style={{ background: 'var(--line)' }}
        >
          <div
            className="
              h-full
              w-1/2
              animate-pulse
              rounded-full
            "
            style={{ background: 'var(--primary)' }}
          />
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------
   Route Guard
------------------------------------------------------- */

function Guard({ children, adminOnly = false, roles }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return <Layout>{children}</Layout>
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
              'owner',
              'admin',
              'manager',
              'accountant',
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

      {/* -------------------------------------------------
          Miscellaneous
      ------------------------------------------------- */}

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
            <InvoicePreview />
          </Guard>
        }
      />

      <Route
        path="/invoice/:id"
        element={
          <Guard>
            <InvoicePreview />
          </Guard>
        }
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
        path="/inventory"
        element={<Navigate to="/inventory/stock" replace />}
      />

      <Route
        path="/customers"
        element={<Navigate to="/parties/customers" replace />}
      />

      <Route
        path="/purchases"
        element={<Navigate to="/inventory/purchases" replace />}
      />

      {/* Unknown routes return to dashboard */}
      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
    </Routes>
  )
}

/* -------------------------------------------------------
   Main Application
------------------------------------------------------- */

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
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

          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}