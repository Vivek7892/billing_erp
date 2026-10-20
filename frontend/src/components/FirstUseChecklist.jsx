import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Circle, ArrowRight, X, Sparkles, Package, ShoppingCart, Printer, BarChart2 } from 'lucide-react'
import http from '../api'

export default function FirstUseChecklist({ className = '' }) {
  const [status, setStatus] = useState(null)
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    http.get('/auth/onboarding-status/')
      .then(({ data }) => {
        if (!active) return
        setStatus(data)
        if (data.checklist?.checklist_dismissed) {
          setDismissed(true)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const handleDismiss = async () => {
    setDismissed(true)
    try {
      await http.post('/auth/onboarding/dismiss-checklist/')
    } catch {
      // silent
    }
  }

  if (loading || dismissed || !status) return null

  const items = [
    {
      id: 'profile',
      label: 'Business profile completed',
      done: Boolean(status.checklist?.profile_completed),
      link: '/onboarding',
      icon: CheckCircle2,
    },
    {
      id: 'product',
      label: 'Add your first product',
      done: Boolean(status.checklist?.product_added),
      link: '/inventory/products',
      icon: Package,
    },
    {
      id: 'invoice',
      label: 'Create your first invoice',
      done: Boolean(status.checklist?.invoice_created),
      link: '/billing/new',
      icon: ShoppingCart,
    },
    {
      id: 'receipt',
      label: 'Configure receipt or printer',
      done: Boolean(status.checklist?.receipt_configured),
      link: '/settings',
      icon: Printer,
    },
    {
      id: 'reports',
      label: 'Explore reports & analytics',
      done: Boolean(status.checklist?.reports_viewed),
      link: '/reports',
      icon: BarChart2,
    },
  ]

  const completedCount = items.filter(i => i.done).length

  // If all 5 items are finished, hide automatically
  if (completedCount === items.length) return null

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5 shadow-xs transition-all ${className}`}
      role="region"
      aria-label="Getting Started Checklist"
    >
      <div className="flex items-center justify-between pb-3 border-b border-[var(--line-subtle)]">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-[#0057B8]/10 text-[#0057B8] dark:text-sky-400">
            <Sparkles size={16} />
          </span>
          <div>
            <h2 className="text-sm font-bold text-[var(--ink)]">
              Getting Started Checklist
            </h2>
            <p className="text-[11px] text-[var(--muted)]">
              {completedCount} of {items.length} completed
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 rounded-md text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)] transition-colors"
          title="Dismiss checklist"
          aria-label="Dismiss checklist"
        >
          <X size={16} />
        </button>
      </div>

      {/* Progress Track */}
      <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden my-3">
        <div
          className="bg-[#0057B8] h-full transition-all duration-500 rounded-full"
          style={{ width: `${(completedCount / items.length) * 100}%` }}
        />
      </div>

      {/* Checklist items */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 pt-1">
        {items.map(item => {
          return (
            <div
              key={item.id}
              onClick={() => {
                if (!item.done && item.link) navigate(item.link)
              }}
              className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs transition-all ${
                item.done
                  ? 'border-emerald-200 bg-emerald-50/60 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-400'
                  : 'border-[var(--line)] bg-[var(--surface-elevated)] text-[var(--ink)] hover:border-[#0057B8] cursor-pointer group'
              }`}
            >
              {item.done ? (
                <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <Circle size={16} className="text-slate-400 group-hover:text-[#0057B8] shrink-0" />
              )}
              <span className={`font-medium truncate ${item.done ? 'line-through opacity-80' : ''}`}>
                {item.label}
              </span>
              {!item.done && (
                <ArrowRight size={12} className="ml-auto opacity-0 group-hover:opacity-100 text-[#0057B8] transition-opacity shrink-0" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

