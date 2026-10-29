import {
  IconFileText,
  IconPlus,
} from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import DreamVisualContainer from './DreamVisualContainer'

export default function InvoiceEmptyIllustration({
  className = '',
  uploadedSrc,
  title = 'No Invoices Yet',
  description = 'Create your first invoice to start billing customers.',
  actionLabel = 'Create New Bill',
  onAction,
}) {
  return (
    <DreamVisualContainer
      slotKey="invoice-empty"
      title={title}
      uploadedSrc={uploadedSrc}
      className={`w-full py-10 text-center bg-transparent border-0 shadow-none ${className}`}
      hideBadge
    >
      <div className="flex flex-col items-center justify-center p-2">
        {/* Modern dark-friendly Icon Container */}
        <div className="mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-[#202125] border border-slate-200 dark:border-[#2E3035] text-[#1E3A5F] dark:text-emerald-400 shadow-xs transition-colors">
          <IconFileText
            size={28}
            strokeWidth={1.75}
          />
        </div>

        <h3 className="text-sm font-bold text-[var(--ink)]">
          {title}
        </h3>

        <p className="mt-1 text-xs text-[var(--muted)] max-w-sm leading-relaxed">
          {description}
        </p>

        {onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[#1E3A5F] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#162F4D] dark:border-slate-200 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white shadow-xs transition-all active:scale-[0.98]"
          >
            <IconPlus size={14} />
            <span>{actionLabel}</span>
          </button>
        ) : (
          <Link
            to="/billing/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[#1E3A5F] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#162F4D] dark:border-slate-200 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white shadow-xs transition-all active:scale-[0.98]"
          >
            <IconPlus size={14} />
            <span>{actionLabel}</span>
          </Link>
        )}
      </div>
    </DreamVisualContainer>
  )
}
