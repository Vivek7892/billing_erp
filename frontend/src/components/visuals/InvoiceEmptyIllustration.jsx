import { FileText, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import DreamVisualContainer from './DreamVisualContainer'

export default function InvoiceEmptyIllustration({
  className = '',
  uploadedSrc,
  title = 'No Invoices Generated Yet',
  description = 'Start billing customers with high-speed barcode scanning, dynamic UPI QR and automated GST calculations.',
  actionLabel = 'Create New Bill',
  onAction,
}) {
  return (
    <DreamVisualContainer
      slotKey="invoice-empty"
      title={title}
      uploadedSrc={uploadedSrc}
      className={`p-6 max-w-md mx-auto text-center bg-transparent border-0 shadow-none ${className}`}
      hideBadge
    >
      <div className="flex flex-col items-center justify-center">
        {/* Vector Invoice Artwork */}
        <div className="relative mb-3 flex items-center justify-center">
          <div className="w-16 h-20 rounded-xl bg-white dark:bg-slate-800 border-2 border-[#0057B8] shadow-md p-2 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-700 pb-1">
              <span className="w-2 h-2 rounded-full bg-[#16A9D8]" />
              <span className="text-[7px] font-mono font-bold text-[#0057B8]">Dreamwithtech PoS</span>
            </div>
            <div className="space-y-1">
              <div className="h-1 bg-gray-200 dark:bg-slate-700 rounded w-full" />
              <div className="h-1 bg-gray-200 dark:bg-slate-700 rounded w-3/4" />
              <div className="h-1 bg-gray-200 dark:bg-slate-700 rounded w-1/2" />
            </div>
            <div className="pt-1 border-t border-dashed border-gray-200 dark:border-slate-700 flex justify-between text-[7px] font-mono font-bold">
              <span>TOTAL</span>
              <span className="text-emerald-600">₹0.00</span>
            </div>
          </div>
          <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#FFE500] text-[#003F8F] flex items-center justify-center shadow font-bold text-xs">
            +
          </span>
        </div>

        <h3 className="text-sm font-bold text-[#111111] dark:text-white">
          {title}
        </h3>
        <p className="text-xs text-[#555555] dark:text-gray-400 mt-1 max-w-xs">
          {description}
        </p>

        {onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0057B8] text-white text-xs font-bold hover:bg-[#003F8F] transition-colors shadow-sm"
          >
            <Plus size={14} />
            <span>{actionLabel}</span>
          </button>
        ) : (
          <Link
            to="/new-bill"
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0057B8] text-white text-xs font-bold hover:bg-[#003F8F] transition-colors shadow-sm"
          >
            <Plus size={14} />
            <span>{actionLabel}</span>
          </Link>
        )}
      </div>
    </DreamVisualContainer>
  )
}
