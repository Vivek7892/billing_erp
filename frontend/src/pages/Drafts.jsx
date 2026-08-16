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
    navigate('/new-bill')
  }

  const clearAll = () => {
    saveDrafts([])
    setDrafts([])
  }

  if (drafts.length === 0) {
    return (
      <div className="min-h-[calc(100vh-120px)] bg-[#F8F9FA] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="mx-auto mb-5 w-16 h-16 rounded-2xl bg-[#E9F2FC] border border-[#D6E7FA] flex items-center justify-center">
            <ReceiptText size={27} className="text-[#1471D8]" />
          </div>

          <h2 className="text-lg font-bold text-[#212529]">
            No Parked Bills
          </h2>

          <p className="mt-2 text-sm text-[#6C757D] leading-6">
            Bills saved as drafts will appear here. Resume a parked bill
            whenever the customer is ready to continue.
          </p>

          <button
            onClick={() => navigate('/new-bill')}
            className="mt-5 inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#1471D8] hover:bg-[#0F5FB8] text-white text-sm font-semibold transition-colors shadow-sm"
          >
            <ShoppingCart size={15} />
            Create New Bill
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full min-h-full bg-[#F8F9FA]">
      {/* Page header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E9F2FC] border border-[#D6E7FA] flex items-center justify-center">
            <Layers size={19} className="text-[#1471D8]" />
          </div>

          <div>
            <h2 className="text-xl font-bold tracking-tight text-[#212529]">
              Parked Bills
            </h2>
            <p className="text-xs text-[#6C757D] mt-0.5">
              {drafts.length} bill{drafts.length !== 1 ? 's' : ''} waiting to be resumed
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/new-bill')}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-[#CED4DA] bg-[#FFFFFF] text-[#495057] hover:bg-[#F1F3F5] text-xs font-semibold transition-colors"
          >
            <ArrowLeft size={13} />
            New Bill
          </button>

          <button
            onClick={clearAll}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[#FFF5F5] border border-[#FFD6D6] text-[#C92A2A] hover:bg-[#FFE3E3] text-xs font-semibold transition-colors"
          >
            <Trash2 size={13} />
            Clear All
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <div className="bg-[#FFFFFF] border border-[#DEE2E6] rounded-xl px-4 py-3 shadow-sm">
          <div className="text-[10px] uppercase tracking-[0.12em] font-bold text-[#6C757D]">
            Parked Bills
          </div>
          <div className="mt-1 text-xl font-bold text-[#212529]">
            {drafts.length}
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#DEE2E6] rounded-xl px-4 py-3 shadow-sm">
          <div className="text-[10px] uppercase tracking-[0.12em] font-bold text-[#6C757D]">
            Total Items
          </div>
          <div className="mt-1 text-xl font-bold text-[#212529]">
            {drafts.reduce((sum, draft) => sum + (draft.cart?.length || 0), 0)}
          </div>
        </div>

        <div className="hidden md:block bg-[#FFFFFF] border border-[#DEE2E6] rounded-xl px-4 py-3 shadow-sm">
          <div className="text-[10px] uppercase tracking-[0.12em] font-bold text-[#6C757D]">
            Draft Value
          </div>
          <div className="mt-1 text-xl font-bold text-[#1471D8]">
            {fmt(
              drafts.reduce(
                (sum, draft) =>
                  sum +
                  (draft.cart?.reduce((s, item) => s + (item.total || 0), 0) || 0),
                0
              )
            )}
          </div>
        </div>
      </div>

      {/* Draft list */}
      <div className="bg-[#FFFFFF] border border-[#DEE2E6] rounded-xl overflow-hidden shadow-sm">
        {/* Desktop list header */}
        <div className="hidden md:grid grid-cols-[minmax(220px,1.5fr)_1fr_140px_150px] gap-5 px-5 py-3 bg-[#F1F3F5] border-b border-[#DEE2E6] text-[10px] font-bold uppercase tracking-[0.12em] text-[#6C757D]">
          <span>Customer</span>
          <span>Items</span>
          <span className="text-right">Amount</span>
          <span className="text-right">Actions</span>
        </div>

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
              ?.slice(0, 2)
              .map(item => `${item.product_name} ×${item.qty}`)
              .join(', ') || 'No items'

          return (
            <div
              key={draft.id}
              className={`group px-4 sm:px-5 py-4 transition-colors hover:bg-[#F8F9FA] ${
                index !== drafts.length - 1
                  ? 'border-b border-[#E9ECEF]'
                  : ''
              }`}
            >
              <div className="grid grid-cols-1 md:grid-cols-[minmax(220px,1.5fr)_1fr_140px_150px] gap-3 md:gap-5 items-center">
                {/* Customer */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-[#F1F3F5] border border-[#E9ECEF] flex items-center justify-center">
                    <User size={16} className="text-[#6C757D]" />
                  </div>

                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-[#343A40] truncate">
                      {draft.customerName || 'Walk-in Customer'}
                    </div>

                    <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[#868E96]">
                      <Clock size={10} />
                      Parked {savedAt}
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-[#495057]">
                    <ShoppingCart size={13} className="text-[#1471D8] shrink-0" />
                    <span>
                      {itemCount} item{itemCount !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="text-[11px] text-[#868E96] truncate mt-1">
                    {preview}
                    {itemCount > 2 && ` +${itemCount - 2} more`}
                  </div>
                </div>

                {/* Amount */}
                <div className="md:text-right">
                  <div className="font-bold text-sm text-[#212529]">
                    {fmt(total)}
                  </div>
                  <div className="text-[10px] text-[#868E96] mt-0.5">
                    Draft total
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => resume(draft)}
                    className="flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg bg-[#1471D8] hover:bg-[#0F5FB8] text-white text-xs font-semibold transition-colors shadow-sm"
                  >
                    <RotateCcw size={12} />
                    Resume
                    <ChevronRight size={12} />
                  </button>

                  <button
                    onClick={() => discard(draft.id)}
                    title="Discard bill"
                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-[#CED4DA] bg-[#FFFFFF] text-[#868E96] hover:text-[#C92A2A] hover:bg-[#FFF5F5] hover:border-[#FFD6D6] transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Mobile item preview */}
              <div className="md:hidden mt-2 ml-[52px] text-[11px] text-[#868E96] truncate">
                {preview}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}