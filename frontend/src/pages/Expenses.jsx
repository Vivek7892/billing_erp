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
const CAT_ICON_CLS = {
  Rent: 'border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400',
  Utilities: 'border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400',
  Salaries: 'border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400',
  Transport: 'border-cyan-200 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400',
  Supplies: 'border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400',
  Marketing: 'border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400',
  Maintenance: 'border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400',
  Other: 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400',
}

const CAT_BADGE = {
  Rent: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60',
  Utilities: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
  Salaries: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800/60',
  Transport: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800/60',
  Supplies: 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/60',
  Marketing: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60',
  Maintenance: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/60',
  Other: 'bg-white text-slate-700 border border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-800',
}

const CAT_COLOR = CAT_BADGE

const EMPTY = {
  description: '',
  amount: '',
  payment_method: 'cash',
  expense_date: new Date().toISOString().slice(0, 10),
  notes: '',
  category_name: 'Other',
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

      {/* =====================================================
          ERP SUMMARY (Table-Based)
      ====================================================== */}
      <section className="erp-table-container">
        <div className="border-b border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
          Expense Tracking Summary
        </div>
        <div className="grid grid-cols-2 divide-y divide-[var(--line)] sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
          <div className="p-3 sm:p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Total Expenses
            </span>
            <p className="mt-1 font-mono text-lg sm:text-xl font-bold text-rose-600 dark:text-rose-400">
              {fmt(totalAll)}
            </p>
            <p className="text-[10px] text-[var(--muted)]">{expenses.length} recorded entries</p>
          </div>

          <div className="p-3 sm:p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              This Month
            </span>
            <p className="mt-1 font-mono text-lg sm:text-xl font-bold text-amber-600 dark:text-amber-400">
              {fmt(thisMonth)}
            </p>
            <p className="text-[10px] text-[var(--muted)]">Current monthly outflow</p>
          </div>

          {catTotals.slice(0, 2).map(({ cat, total }) => (
            <div key={cat} className="p-3 sm:p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                {cat} (Top Spend)
              </span>
              <p className="mt-1 font-mono text-lg sm:text-xl font-bold text-[var(--ink)]">
                {fmt(total)}
              </p>
              <p className="text-[10px] text-[var(--muted)]">Category expenditure</p>
            </div>
          ))}
        </div>
      </section>

      {/* =================================================
          EXPENSES
      ================================================== */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-xs">

        {/* Header + controls */}
        <div className="border-b border-[var(--line-subtle)] px-3 py-3 sm:px-5 sm:py-3.5">
          <div className="flex items-center gap-2">
            <h2 className="shrink-0 text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
              All Expenses
            </h2>

            <div className="ml-auto flex min-w-0 items-center gap-2">
              {/* Search */}
              <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
                <Search
                  size={13}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-light)]"
                />
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Search expenses..."
                  className="h-8 w-full rounded-md border border-[var(--line)] bg-[var(--surface-elevated)] pl-8 pr-3 text-xs text-[var(--ink-secondary)] outline-none placeholder:text-[var(--muted-light)] focus:border-slate-300 focus:bg-[var(--surface)]"
                />
              </div>

              {/* Refresh */}
              <button
                type="button"
                onClick={load}
                disabled={loading}
                className="btn-secondary h-8 w-8 p-0 shrink-0 inline-flex items-center justify-center rounded-md"
                title="Refresh expenses"
                aria-label="Refresh expenses"
              >
                <RefreshCw
                  size={13}
                  className={loading ? 'animate-spin' : ''}
                />
              </button>

              {/* Add */}
              <button
                type="button"
                onClick={openAdd}
                className="btn-primary h-8 px-3 text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Plus size={13} strokeWidth={2} />
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
              className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] px-2.5 text-xs text-[var(--muted)] outline-none sm:w-auto"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {(q || catFilter !== 'all') && (
              <span className="text-[11px] text-[var(--muted-light)]">
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
          <div className="flex flex-col items-center gap-2 px-10 py-20 text-[var(--muted-light)]">
            <IndianRupee size={28} className="opacity-30" />
            <span className="text-sm">No expenses found</span>
            <button
              onClick={openAdd}
             className="mt-2 btn-primary btn-base"
            >
              Add First Expense
            </button>
          </div>
        ) : (
          <>
            {/* Mobile list */}
            <div className="divide-y divide-[var(--line-subtle)] sm:hidden">
              {filtered.map(e => {
                const catName = e.category_name || 'Other'
                const Icon = CAT_ICON[catName] || IndianRupee
                const cls = CAT_COLOR[catName] || 'bg-[var(--surface-elevated)] text-[var(--muted)]'
                const [bg, tx] = cls.split(' ')

                return (
                  <div key={e.id} className="p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--ink)]">
                          {e.description}
                        </p>

                        <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[10px] text-[var(--muted-light)]">
                          <span>
                            {e.expense_date
                              ? new Date(e.expense_date).toLocaleDateString('en-IN')
                              : '—'}
                          </span>
                          <span>•</span>
                          <span className="capitalize">{e.payment_method}</span>
                        </div>
                      </div>

                      <p className="shrink-0 text-sm font-bold text-[var(--ink)]">
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
                          className="icon-btn !h-8 !w-8 text-red-400 hover:bg-red-50 dark:bg-red-950/60 hover:text-red-600 dark:text-red-400"
                          title="Delete expense"
                          aria-label="Delete expense"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {e.notes && (
                      <p className="mt-2 truncate text-[10px] text-[var(--muted-light)]">
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
                    <th className="num-col">Amount</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map(e => {
                    const catName = e.category_name || 'Other'
                    const Icon = CAT_ICON[catName] || IndianRupee
                    const cls = CAT_COLOR[catName] || 'bg-[var(--surface-elevated)] text-[var(--muted)]'
                    const [bg, tx] = cls.split(' ')

                    return (
                      <tr key={e.id}>
                        <td className="font-medium text-sm text-[var(--ink)]">
                          {e.description}
                        </td>

                        <td>
                          <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${bg} ${tx}`}>
                            <Icon size={11} />
                            {catName}
                          </span>
                        </td>

                        <td className="text-sm text-[var(--muted)] font-mono">
                          {e.expense_date
                            ? new Date(e.expense_date).toLocaleDateString('en-IN')
                            : '—'}
                        </td>

                        <td className="text-xs capitalize text-[var(--muted)]">
                          {e.payment_method}
                        </td>

                        <td className="max-w-[160px] truncate text-xs text-[var(--muted-light)]">
                          {e.notes || '—'}
                        </td>

                        <td className="num-col font-mono text-sm font-bold text-red-600">
                          {fmt(e.amount)}
                        </td>

                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
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
                              className="icon-btn text-red-400 hover:bg-red-50 dark:bg-red-950/60 hover:text-red-600 dark:text-red-400"
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
            <button onClick={save} disabled={saving} className="btn-primary flex-1 gap-2">
              {saving ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</> : (form.id ? 'Update Expense' : 'Add Expense')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}