import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './AuthContext'
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
import Inventory from './pages/Inventory'
import Purchases from './pages/Purchases'
import Customers from './pages/Customers'
import Suppliers from './pages/Suppliers'
import Expenses from './pages/Expenses'
import Reports from './pages/Reports'
import Users from './pages/Users'
import Settings from './pages/Settings'
import Support from './pages/Support'
import InvoicePreview from './pages/InvoicePreview'
import { supabase } from './utils/supabase'

function Guard({ children, adminOnly }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />
  return <Layout>{children}</Layout>
}

export default function App() {
  const [_todos, setTodos] = useState([])

  useEffect(() => {
    async function getTodos() {
      const { data } = await supabase.from('todos').select()

      if (data) setTodos(data)
    }

    getTodos()
  }, [])

  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Guard><Dashboard /></Guard>} />

          {/* Billing */}
          <Route path="/billing/new" element={<Guard><NewBill /></Guard>} />
          <Route path="/billing/drafts" element={<Guard><Drafts /></Guard>} />

          {/* Sales */}
          <Route path="/sales/invoices" element={<Guard><Bills /></Guard>} />
          <Route path="/sales/returns" element={<Guard><Returns /></Guard>} />
          <Route path="/sales/payments" element={<Guard><Payments /></Guard>} />

          {/* Inventory */}
          <Route path="/inventory/products" element={<Guard><Products /></Guard>} />
          <Route path="/inventory/stock" element={<Guard><Stock /></Guard>} />
          <Route path="/inventory/purchases" element={<Guard><Purchases /></Guard>} />

          {/* Parties */}
          <Route path="/parties/customers" element={<Guard><Customers /></Guard>} />
          <Route path="/parties/suppliers" element={<Guard><Suppliers /></Guard>} />

          {/* Finance */}
          <Route path="/expenses" element={<Guard><Expenses /></Guard>} />
          <Route path="/reports" element={<Guard adminOnly><Reports /></Guard>} />

          {/* System */}
          <Route path="/users" element={<Guard adminOnly><Users /></Guard>} />
          <Route path="/settings" element={<Guard adminOnly><Settings /></Guard>} />

          {/* Misc */}
          <Route path="/support" element={<Guard><Support /></Guard>} />
          <Route path="/invoice-preview" element={<Guard><InvoicePreview /></Guard>} />

          {/* Legacy redirects */}
          <Route path="/new-bill" element={<Navigate to="/billing/new" replace />} />
          <Route path="/bills" element={<Navigate to="/sales/invoices" replace />} />
          <Route path="/products" element={<Navigate to="/inventory/products" replace />} />
          <Route path="/inventory" element={<Navigate to="/inventory/stock" replace />} />
          <Route path="/customers" element={<Navigate to="/parties/customers" replace />} />
          <Route path="/purchases" element={<Navigate to="/inventory/purchases" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
