import { FileText, Plus } from 'lucide-react'
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
      className={`w-full py-8 text-center bg-transparent border-0 shadow-none ${className}`}
      hideBadge
    >
      <div className="flex flex-col items-center">
        <FileText
          size={32}
          strokeWidth={1.5}
          className="mb-3 text-[#0057B8]"
        />

        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>

        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {description}
        </p>

        {onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[#0057B8] px-3 py-2 text-xs font-semibold text-white hover:bg-[#003F8F]"
          >
            <Plus size={14} />
            {actionLabel}
          </button>
        ) : (
          <Link
            to="/new-bill"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[#0057B8] px-3 py-2 text-xs font-semibold text-white hover:bg-[#003F8F]"
          >
            <Plus size={14} />
            {actionLabel}
          </Link>
        )}
      </div>
    </DreamVisualContainer>
  )
}
