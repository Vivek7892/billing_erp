import { useEffect, useState } from 'react'
import api from '../api'
import { Spinner, Modal } from '../components/UI'
import {
  IndianRupee, Plus, RefreshCw, Search, Pencil, Trash2,
  ShoppingBag, Zap, Car, Users, MoreHorizontal, TrendingDown
} from 'lucide-react'
import toast from 'react-hot-toast'

const fmt = v => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

const CATEGORIES = ['Rent', 'Utilities', 'Salaries', 'Transport', 'Supplies', 'Marketing', 'Maintenance', 'Other']
const METHODS = ['cash', 'upi', 'card', 'online']

const CAT_ICON = {
  Rent: ShoppingBag, Utilities: Zap, Salaries: Users,
  Transport: Car, Supplies: ShoppingBag, Marketing: TrendingDown,
  Maintenance: MoreHorizontal, Other: IndianRupee,
}
const CAT_COLOR = {
  Rent: 'bg-blue-50 text-blue-600', Utilities: 'bg-yellow-50 text-yellow-600',
  Salaries: 'bg-violet-50 text-violet-600', Transport: 'bg-cyan-50 text-cyan-600',
  Supplies: 'bg-emerald-50 text-emerald-600', Marketing: 'bg-pink-50 text-pink-600',
  Maintenance: 'bg-orange-50 text-orange-600', Other: 'bg-slate-50 text-slate-600',
}

const EMPTY = {
  description: '', amount: '', payment_method: 'cash',
  expense_date: new Date().toISOString().slice(0, 10), notes: '', category_name: 'Other'
}

export default function Expenses() {
  const [expenses, setExpenses] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const load = () => {
    setLoading(true)
    Promise.all([
      api.get('/expenses/?page_size=500&ordering=-expense_date'),
      api.get('/expense-categories/'),
    ]).then(([er, cr]) => {
      setExpenses(er.data?.results || er.data || [])
      setCategories(cr.data?.results || cr.data || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const openAdd = () => { setForm(EMPTY); setModal(true) }
  const openEdit = e => {
    setForm({
      ...e,
      expense_date: e.expense_date?.slice(0, 10) || '',
      category_name: e.category_name || 'Other',
    })
    setModal(true)
  }

  const save = async () => {
    if (!form.description?.trim()) return toast.error('Description is required')
    if (!form.amount || Number(form.amount) <= 0) return toast.error('Enter a valid amount')
    setSaving(true)
    try {
      // Resolve or create category
      let catId = null
      const catName = form.category_name || 'Other'
      let existing = categories.find(c => c.name === catName)
      if (!existing) {
        const res = await api.post('/expense-categories/', { name: catName })
        existing = res.data
        setCategories(prev => [...prev, existing])
      }
      catId = existing.id

      const payload = {
        description: form.description,
        amount: form.amount,
        payment_method: form.payment_method,
        expense_date: form.expense_date,
        notes: form.notes || '',
        category: catId,
      }
      if (form.id) {
        await api.put(`/expenses/${form.id}/`, payload)
        toast.success('Expense updated')
      } else {
        await api.post('/expenses/', payload)
        toast.success('Expense added')
      }
      setModal(false)
      load()
    } catch (e) {
      toast.error(e.response?.data?.detail || JSON.stringify(e.response?.data) || 'Failed to save expense')
    } finally { setSaving(false) }
  }

  const del = async id => {
    setDeleting(id)
    try { await api.delete(`/expenses/${id}/`); toast.success('Deleted'); load() }
    catch { toast.error('Failed to delete') }
    finally { setDeleting(null) }
  }

  const filtered = expenses
    .filter(e => catFilter === 'all' || e.category_name === catFilter)
    .filter(e => !q || e.description?.toLowerCase().includes(q.toLowerCase()))

  const totalAll = expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
  const thisMonth = expenses.filter(e => {
    const d = new Date(e.expense_date); const n = new Date()
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
  }).reduce((s, e) => s + Number(e.amount || 0), 0)

  const catTotals = CATEGORIES.map(cat => ({
    cat, total: expenses.filter(e => e.category_name === cat).reduce((s, e) => s + Number(e.amount || 0), 0)
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total).slice(0, 2)

  return (
    <div className="space-y-3 sm:space-y-5">

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <div className="bg-white rounded-xl border border-rose-100 p-3 sm:p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[9px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wide truncate">Total Expenses</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
              <IndianRupee size={15} className="text-rose-600" />
            </div>
          </div>
          <div className="text-base sm:text-xl font-bold text-slate-800">{fmt(totalAll)}</div>
          <div className="text-xs text-slate-400">{expenses.length} records</div>
        </div>
        <div className="bg-white rounded-xl border border-orange-100 p-3 sm:p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[9px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wide truncate">This Month</span>
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
              <TrendingDown size={15} className="text-orange-600" />
            </div>
          </div>
          <div className="text-base sm:text-xl font-bold text-slate-800">{fmt(thisMonth)}</div>
          <div className="text-xs text-slate-400">Current month spend</div>
        </div>
        {catTotals.map(({ cat, total }) => {
          const Icon = CAT_ICON[cat] || IndianRupee
          const cls = CAT_COLOR[cat] || 'bg-slate-50 text-slate-600'
          const [bg, tx] = cls.split(' ')
          return (
            <div key={cat} className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wide truncate">{cat}</span>
                <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon size={15} className={tx} />
                </div>
              </div>
              <div className="text-base sm:text-xl font-bold text-slate-800">{fmt(total)}</div>
              <div className="text-xs text-slate-400">Top category</div>
            </div>
          )
        })}
      </div>

      {/* =================================================
          EXPENSES
      ================================================== */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

        {/* Header + controls */}
        <div className="border-b border-slate-100 px-3 py-3 sm:px-5 sm:py-4">
          <div className="flex items-center gap-2">
            <h2 className="shrink-0 text-sm font-semibold text-slate-800">
              All Expenses
            </h2>

            <div className="ml-auto flex min-w-0 items-center gap-2">
              {/* Search */}
              <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
                <Search
                  size={13}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Search expenses..."
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
                />
              </div>

              {/* Refresh */}
              <button
                type="button"
                onClick={load}
                disabled={loading}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
                title="Refresh expenses"
                aria-label="Refresh expenses"
              >
                <RefreshCw
                  size={14}
                  className={loading ? 'animate-spin' : ''}
                />
              </button>

              {/* Add */}
              <button
                type="button"
                onClick={openAdd}
                className="btn-primary flex h-9 shrink-0 items-center justify-center gap-1.5 px-2.5 text-xs sm:px-3"
              >
                <Plus size={13} />
                <span className="hidden sm:inline">Add Expense</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>
          </div>

          {/* Category filter */}
          <div className="mt-2.5 flex items-center gap-2">
            <select
              value={catFilter}
              onChange={e => setCatFilter(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-600 outline-none sm:w-auto"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {(q || catFilter !== 'all') && (
              <span className="text-[11px] text-slate-400">
                {filtered.length} result{filtered.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-14">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-slate-400">
            <IndianRupee size={28} className="opacity-30" />
            <span className="text-sm">No expenses found</span>
            <button
              onClick={openAdd}
              className="btn-primary mt-1 text-xs"
            >
              Add First Expense
            </button>
          </div>
        ) : (
          <>
            {/* Mobile list */}
            <div className="divide-y divide-slate-100 sm:hidden">
              {filtered.map(e => {
                const catName = e.category_name || 'Other'
                const Icon = CAT_ICON[catName] || IndianRupee
                const cls = CAT_COLOR[catName] || 'bg-slate-50 text-slate-600'
                const [bg, tx] = cls.split(' ')

                return (
                  <div key={e.id} className="p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {e.description}
                        </p>

                        <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[10px] text-slate-400">
                          <span>
                            {e.expense_date
                              ? new Date(e.expense_date).toLocaleDateString('en-IN')
                              : '—'}
                          </span>
                          <span>•</span>
                          <span className="capitalize">{e.payment_method}</span>
                        </div>
                      </div>

                      <p className="shrink-0 text-sm font-bold text-slate-800">
                        {fmt(e.amount)}
                      </p>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className={`inline-flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-semibold ${bg} ${tx}`}>
                        <Icon size={11} />
                        <span className="truncate">{catName}</span>
                      </span>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(e)}
                          className="icon-btn !h-8 !w-8"
                          title="Edit expense"
                          aria-label="Edit expense"
                        >
                          <Pencil size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={() => del(e.id)}
                          disabled={deleting === e.id}
                          className="icon-btn !h-8 !w-8 text-red-400 hover:bg-red-50 hover:text-red-600"
                          title="Delete expense"
                          aria-label="Delete expense"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {e.notes && (
                      <p className="mt-2 truncate text-[10px] text-slate-400">
                        {e.notes}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Desktop/tablet table */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Date</th>
                    <th>Method</th>
                    <th>Notes</th>
                    <th>Amount</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map(e => {
                    const catName = e.category_name || 'Other'
                    const Icon = CAT_ICON[catName] || IndianRupee
                    const cls = CAT_COLOR[catName] || 'bg-slate-50 text-slate-600'
                    const [bg, tx] = cls.split(' ')

                    return (
                      <tr key={e.id}>
                        <td className="font-medium text-sm text-slate-800">
                          {e.description}
                        </td>

                        <td>
                          <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${bg} ${tx}`}>
                            <Icon size={11} />
                            {catName}
                          </span>
                        </td>

                        <td className="text-sm text-slate-500">
                          {e.expense_date
                            ? new Date(e.expense_date).toLocaleDateString('en-IN')
                            : '—'}
                        </td>

                        <td className="text-xs capitalize text-slate-500">
                          {e.payment_method}
                        </td>

                        <td className="max-w-[160px] truncate text-xs text-slate-400">
                          {e.notes || '—'}
                        </td>

                        <td className="text-sm font-bold text-slate-800">
                          {fmt(e.amount)}
                        </td>

                        <td>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(e)}
                              className="icon-btn"
                              title="Edit expense"
                              aria-label="Edit expense"
                            >
                              <Pencil size={13} />
                            </button>

                            <button
                              type="button"
                              onClick={() => del(e.id)}
                              disabled={deleting === e.id}
                              className="icon-btn text-red-400 hover:bg-red-50 hover:text-red-600"
                              title="Delete expense"
                              aria-label="Delete expense"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={form.id ? 'Edit Expense' : 'Add Expense'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Description *</label>
            <input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Office Rent" autoFocus />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Amount (₹) *</label>
              <input className="input" type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category_name} onChange={e => setForm(f => ({ ...f, category_name: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Payment Method</label>
              <select className="input" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                {METHODS.map(m => <option key={m} value={m} className="capitalize">{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes…" />
          </div>
          <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
            <button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving…' : form.id ? 'Update' : 'Add Expense'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}