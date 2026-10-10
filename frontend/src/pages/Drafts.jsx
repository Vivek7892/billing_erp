import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Layers,
  Trash2,
  RotateCcw,
  Clock,
  ShoppingCart,
  User,
  ChevronRight,
  ReceiptText,
  ArrowLeft,
  Clock3,
} from 'lucide-react'

const DRAFT_KEY = 'pos_drafts'

function loadDrafts() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) || '[]')
  } catch {
    return []
  }
}

function saveDrafts(drafts) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts))
}

const fmt = v =>
  `₹${Number(v || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

export default function Drafts() {
  const [drafts, setDrafts] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    setDrafts(loadDrafts())
  }, [])

  const discard = id => {
    const updated = drafts.filter(d => d.id !== id)
    saveDrafts(updated)
    setDrafts(updated)
  }

  const resume = draft => {
    sessionStorage.setItem('pos_resume_draft', JSON.stringify(draft))
    navigate('/billing/new')
  }

  const clearAll = () => {
    saveDrafts([])
    setDrafts([])
  }

  const totalLineItems = drafts.reduce(
    (sum, draft) => sum + (draft.cart?.length || 0),
    0
  )

  const totalDraftValue = drafts.reduce(
    (sum, draft) =>
      sum +
      (draft.cart?.reduce((s, item) => s + (item.total || 0), 0) || 0),
    0
  )

  if (drafts.length === 0) {
    return (
      <div className="min-h-[calc(100vh-120px)] bg-[var(--app-bg)] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="mx-auto mb-4 w-14 h-14 rounded-lg bg-[var(--surface-elevated)] border border-[var(--line)] flex items-center justify-center text-[#1E3A5F] dark:text-slate-200">
            <ReceiptText size={26} />
          </div>

          <h2 className="text-lg font-bold text-[var(--ink)]">
            No Parked Bills
          </h2>

          <p className="mt-1 text-xs text-[var(--muted)] leading-5">
            Bills saved as drafts will appear here. Resume a parked bill
            whenever the customer is ready to continue checkout.
          </p>

          <button
            onClick={() => navigate('/billing/new')}
            className="btn-primary mt-4 inline-flex items-center gap-2 h-9 px-4 rounded-md text-xs font-semibold transition-colors"
          >
            <ShoppingCart size={14} />
            Create New Bill
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full min-h-full bg-[var(--app-bg)] pb-8">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-md bg-[var(--surface-elevated)] border border-[var(--line)] flex items-center justify-center text-[#1E3A5F] dark:text-slate-200 shrink-0">
            <Layers size={18} />
          </div>

          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--ink)]">
              Parked Bills
            </h1>
            <p className="text-xs text-[var(--muted)]">
              {drafts.length} bill{drafts.length !== 1 ? 's' : ''} waiting to be resumed
            </p>
          </div>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
          <button
            type="button"
            onClick={() => navigate('/billing/new')}
            className="btn-secondary inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-semibold shadow-none transition"
          >
            <ArrowLeft size={13} />
            <span>New Bill</span>
          </button>

          <button
            type="button"
            onClick={clearAll}
            className="btn-danger inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-semibold shadow-none transition"
          >
            <Trash2 size={13} />
            <span>Clear All</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip (Strict ERP Standard) */}
      <div className="overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)] mb-4">
        <div className="grid grid-cols-1 divide-y divide-[var(--line)] sm:grid-cols-3 sm:divide-y-0 sm:divide-x">
          <div className="p-3 sm:p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Parked Invoices
            </span>
            <p className="mt-1 font-mono text-lg font-bold text-[var(--ink)]">
              {drafts.length}
            </p>
            <p className="text-[10px] text-[var(--muted)]">Awaiting resumption</p>
          </div>

          <div className="p-3 sm:p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Total Line Items
            </span>
            <p className="mt-1 font-mono text-lg font-bold text-[var(--ink)]">
              {totalLineItems}
            </p>
            <p className="text-[10px] text-[var(--muted)]">Products across drafts</p>
          </div>

          <div className="p-3 sm:p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Estimated Draft Value
            </span>
            <p className="mt-1 font-mono text-lg font-bold text-teal-600 dark:text-teal-400">
              {fmt(totalDraftValue)}
            </p>
            <p className="text-[10px] text-[var(--muted)]">Estimated gross total</p>
          </div>
        </div>
      </div>

      {/* Draft List Container with ERP Table */}
      <div className="overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)]">
        {/* Table topbar */}
        <div className="flex items-center justify-between border-b border-[var(--line-subtle)] px-3.5 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <h2 className="font-mono text-sm font-semibold tabular-nums text-[var(--ink)]">
              Draft Invoices
            </h2>
            <span className="rounded-sm bg-[var(--surface-elevated)] border border-[var(--line)] px-2 py-0.5 text-[10px] font-bold text-[var(--muted)]">
              {drafts.length}
            </span>
          </div>

          <div className="hidden items-center gap-1.5 text-[11px] text-[var(--muted)] sm:flex">
            <Clock3 size={12} />
            <span>Saved in browser storage</span>
          </div>
        </div>

        {/* Mobile card list (md:hidden) */}
        <div className="space-y-2.5 p-2.5 md:hidden">
          {drafts.map(draft => {
            const total =
              draft.cart?.reduce((s, i) => s + (i.total || 0), 0) || 0
            const itemCount = draft.cart?.length || 0
            const savedAt = draft.savedAt
              ? new Date(draft.savedAt).toLocaleString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                })
              : '—'
            const preview =
              draft.cart
                ?.slice(0, 3)
                .map(item => `${item.product_name} ×${item.qty}`)
                .join(', ') || 'No items'

            return (
              <div
                key={draft.id}
                className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-3 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-[var(--ink)] truncate">
                      {draft.customerName || 'Walk-in Customer'}
                    </div>
                    {draft.customerPhone && (
                      <div className="text-[11px] text-[var(--muted)] font-mono">
                        {draft.customerPhone}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-bold text-[var(--ink)] tabular-nums">
                      {fmt(total)}
                    </div>
                    <div className="text-[10px] text-[var(--muted)]">Draft total</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-[var(--muted)] border-t border-[var(--line-subtle)] pt-2">
                  <div className="flex items-center gap-1 text-[11px]">
                    <Clock size={11} />
                    <span>{savedAt}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--surface-elevated)] border border-[var(--line)] text-[11px] font-semibold text-[var(--ink)]">
                    <ShoppingCart size={11} />
                    {itemCount} item{itemCount !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="text-[11px] text-[var(--muted)] truncate">
                  {preview}
                  {itemCount > 3 && ` +${itemCount - 3} more`}
                </div>

                <div className="flex items-center gap-2 pt-1.5">
                  <button
                    type="button"
                    onClick={() => resume(draft)}
                    className="flex-1 btn-primary min-h-[42px] px-3.5 text-xs font-bold flex items-center justify-center gap-1.5 rounded-md shadow-xs active:scale-[0.99] transition"
                  >
                    <RotateCcw size={13} />
                    <span>Resume Bill</span>
                    <ChevronRight size={13} />
                  </button>

                  <button
                    type="button"
                    onClick={() => discard(draft.id)}
                    title="Discard bill"
                    className="w-11 min-h-[42px] rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-red-600 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center transition-colors active:scale-95"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Desktop / Tablet Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="erp-table w-full text-left text-xs min-w-[760px]">
            <thead>
              <tr>
                <th className="w-12 text-center">#</th>
                <th className="min-w-[190px]">Customer</th>
                <th className="min-w-[140px]">Parked At</th>
                <th className="w-28 text-center">Items</th>
                <th>Items Preview</th>
                <th className="w-32 text-right">Draft Total</th>
                <th className="w-36 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--line-subtle)]">
              {drafts.map((draft, index) => {
                const total =
                  draft.cart?.reduce((s, i) => s + (i.total || 0), 0) || 0
                const itemCount = draft.cart?.length || 0
                const savedAt = draft.savedAt
                  ? new Date(draft.savedAt).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    })
                  : '—'
                const preview =
                  draft.cart
                    ?.slice(0, 3)
                    .map(item => `${item.product_name} ×${item.qty}`)
                    .join(', ') || 'No items'

                return (
                  <tr
                    key={draft.id}
                    className="hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    {/* Index */}
                    <td className="text-center font-mono text-[11px] text-[var(--muted)]">
                      {index + 1}
                    </td>

                    {/* Customer */}
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded bg-[var(--surface-elevated)] border border-[var(--line)] flex items-center justify-center text-[var(--muted)] shrink-0">
                          <User size={13} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-xs text-[var(--ink)] truncate">
                            {draft.customerName || 'Walk-in Customer'}
                          </div>
                          {draft.customerPhone && (
                            <div className="text-[10px] text-[var(--muted)] font-mono">
                              {draft.customerPhone}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Parked At */}
                    <td>
                      <div className="flex items-center gap-1.5 text-xs text-[var(--ink-secondary)]">
                        <Clock size={12} className="text-[var(--muted)] shrink-0" />
                        <span>{savedAt}</span>
                      </div>
                    </td>

                    {/* Items Count */}
                    <td className="text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--surface-elevated)] border border-[var(--line)] text-xs font-semibold text-[var(--ink)]">
                        <ShoppingCart size={11} className="text-[#1E3A5F] dark:text-blue-400" />
                        {itemCount}
                      </span>
                    </td>

                    {/* Items Preview */}
                    <td>
                      <div className="max-w-[280px] text-xs text-[var(--muted)] truncate">
                        {preview}
                        {itemCount > 3 && ` +${itemCount - 3} more`}
                      </div>
                    </td>

                    {/* Draft Total */}
                    <td className="text-right">
                      <div className="font-mono text-sm font-bold text-[var(--ink)] tabular-nums">
                        {fmt(total)}
                      </div>
                      <div className="text-[10px] text-[var(--muted)]">
                        Gross total
                      </div>
                    </td>

                    {/* Actions */}
                    <td>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => resume(draft)}
                          className="btn-primary h-7 px-2.5 rounded text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                          title="Resume bill in POS"
                        >
                          <RotateCcw size={12} />
                          Resume
                        </button>

                        <button
                          onClick={() => discard(draft.id)}
                          title="Discard draft bill"
                          className="w-7 h-7 rounded border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-red-600 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 inline-flex items-center justify-center transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}