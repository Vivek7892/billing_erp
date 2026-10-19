import { Truck, Plus } from 'lucide-react'
import DreamVisualContainer from './DreamVisualContainer'

export default function PurchaseEmptyIllustration({ className = '', onNewPurchase, uploadedSrc }) {
  return (
    <DreamVisualContainer
      slotKey="purchase-empty"
      title="No Purchase Orders"
      uploadedSrc={uploadedSrc}
      className={`p-6 max-w-md mx-auto text-center bg-transparent border-0 shadow-none ${className}`}
      hideBadge
    >
      <div className="flex flex-col items-center justify-center">
        {/* Vector Purchase Artwork */}
        <div className="relative mb-3 flex items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border-2 border-amber-500 text-amber-600 flex items-center justify-center shadow-md">
            <Truck size={28} />
          </div>
          <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#FFE500] text-[#003F8F] flex items-center justify-center shadow font-bold text-xs">
            +
          </span>
        </div>

        <h3 className="text-sm font-bold text-[#111111] dark:text-white">
          No Purchase Orders Recorded
        </h3>
        <p className="text-xs text-[#555555] dark:text-gray-400 mt-1 max-w-xs">
          Track supplier purchases, inward shipments, GST input tax credits, and payment liabilities.
        </p>

        {onNewPurchase && (
          <button
            type="button"
            onClick={onNewPurchase}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0057B8] text-white text-xs font-bold hover:bg-[#003F8F] transition-colors shadow-sm"
          >
            <Plus size={14} />
            <span>Create Purchase Order</span>
          </button>
        )}
      </div>
    </DreamVisualContainer>
  )
}

