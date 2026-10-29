import {
  IconUsers,
  IconUserPlus,
} from '@tabler/icons-react'
import DreamVisualContainer from './DreamVisualContainer'

export default function CustomerEmptyIllustration({
  className = '',
  onAddCustomer,
  uploadedSrc,
}) {
  return (
    <DreamVisualContainer
      slotKey="customer-empty"
      title="No Customers Found"
      uploadedSrc={uploadedSrc}
      className={`p-4 text-center bg-transparent border-0 shadow-none ${className}`}
      hideBadge
    >
      <div className="flex flex-col items-center">

        {/* Simple icon */}
        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-[#202125] border border-slate-200 dark:border-[#2E3035] text-[#1E3A5F] dark:text-emerald-400 flex items-center justify-center shadow-xs">
          <IconUsers size={22} strokeWidth={1.8} />
        </div>

        {/* Title */}
        <h3 className="mt-3 text-sm font-bold text-[var(--ink)]">
          No Customers Yet
        </h3>

        {/* Description */}
        <p className="mt-1 max-w-xs text-xs leading-5 text-[var(--muted)]">
          Add your first customer to manage credit, balances, and purchase history.
        </p>

        {/* CTA */}
        {onAddCustomer && (
          <button
            type="button"
            onClick={onAddCustomer}
            className="
              mt-3
              inline-flex
              items-center
              gap-1.5
              px-3.5
              py-2
              rounded-lg
              border
              border-[var(--line)]
              bg-[#1E3A5F]
              text-white
              text-xs
              font-semibold
              hover:bg-[#162F4D]
              dark:border-slate-200
              dark:bg-slate-100
              dark:text-slate-900
              dark:hover:bg-white
              transition-colors
            "
          >
            <IconUserPlus size={14} />
            <span>Add Customer</span>
          </button>
        )}

      </div>
    </DreamVisualContainer>
  )
}