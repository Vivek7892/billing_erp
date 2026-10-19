import { Users, UserPlus } from 'lucide-react'
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
        <div className="w-11 h-11 rounded-full bg-blue-50 dark:bg-blue-950/50 text-[#0057B8] flex items-center justify-center">
          <Users size={22} strokeWidth={1.8} />
        </div>

        {/* Title */}
        <h3 className="mt-3 text-sm font-semibold text-slate-800 dark:text-white">
          No Customers Yet
        </h3>

        {/* Description */}
        <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500 dark:text-slate-400">
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
              px-3
              py-1.5
              rounded-md
              bg-[#0057B8]
              text-white
              text-xs
              font-medium
              hover:bg-[#003F8F]
              transition-colors
            "
          >
            <UserPlus size={13} />
            Add Customer
          </button>
        )}

      </div>
    </DreamVisualContainer>
  )
}