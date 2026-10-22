import {
  IconCircleCheck,
  IconCurrencyRupee,
  IconCreditCard,
  IconQrcode,
} from '@tabler/icons-react'
import DreamVisualContainer from './DreamVisualContainer'

const formatCurrency = value =>
  `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`

export default function CreditCollectedVisual({
  className = '',
  customer,
  amount = 0,
  method = 'cash',
  collected = false,
  uploadedSrc,
}) {
  const outstanding = Number(customer?.outstanding_amount || 0)
  const collectedAmount = Number(amount || 0)
  const remaining = Math.max(outstanding - collectedAmount, 0)

  const paymentMethods = {
    cash: {
      label: 'Cash',
      icon: IconCurrencyRupee,
    },
    upi: {
      label: 'UPI',
      icon: IconQrcode,
    },
    card: {
      label: 'Card',
      icon: IconCreditCard,
    },
  }

  const payment = paymentMethods[method] || {
    label: 'Payment',
    icon: IconCreditCard,
  }

  const PaymentIcon = payment.icon

  return (
    <DreamVisualContainer
      slotKey="credit-collected"
      title="Credit Collection"
      uploadedSrc={uploadedSrc}
      className={`p-0 bg-transparent border-0 shadow-none ${className}`}
      hideBadge
    >
      <div className="w-full px-1 py-1">

        {/* Simple rectangular summary */}
        <div className="w-full border border-slate-200 bg-slate-50/70 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/40">

          {/* Customer + status */}
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[9px] font-medium uppercase tracking-wide text-slate-400">
                Customer
              </p>

              <p className="mt-0.5 truncate text-sm font-semibold text-slate-800 dark:text-white">
                {customer?.name || 'Customer'}
              </p>
            </div>

            <div
              className={`flex items-center gap-1 text-[10px] font-semibold ${
                collected
                  ? 'text-emerald-600'
                  : 'text-amber-600'
              }`}
            >
              {collected && <IconCircleCheck size={12} />}
              {collected ? 'Collected' : 'Pending'}
            </div>
          </div>

          {/* Amounts */}
          <div className="mt-3 grid grid-cols-3 border-t border-slate-200 pt-3 dark:border-slate-700">

            {/* Due */}
            <div className="border-r border-slate-200 pr-3 dark:border-slate-700">
              <p className="text-[9px] font-medium uppercase tracking-wide text-slate-400">
                Due
              </p>

              <p className="mt-1 text-base font-bold text-rose-600 dark:text-rose-400">
                {formatCurrency(outstanding)}
              </p>
            </div>

            {/* To Collect */}
            <div className="border-r border-slate-200 px-3 dark:border-slate-700">
              <p className="text-[9px] font-medium uppercase tracking-wide text-slate-400">
                {collected ? 'Collected' : 'To Collect'}
              </p>

              <p
                className={`mt-1 text-base font-bold ${
                  collected
                    ? 'text-emerald-600'
                    : 'text-[#0057B8]'
                }`}
              >
                {formatCurrency(collectedAmount)}
              </p>
            </div>

            {/* Remaining */}
            <div className="pl-3 text-right">
              <p className="text-[9px] font-medium uppercase tracking-wide text-slate-400">
                Remaining
              </p>

              <p
                className={`mt-1 text-base font-bold ${
                  remaining === 0
                    ? 'text-emerald-600'
                    : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                {formatCurrency(remaining)}
              </p>
            </div>
          </div>

          {/* Payment method */}
          <div className="mt-3 flex items-center gap-1.5 border-t border-slate-200 pt-2.5 text-[9px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
            <PaymentIcon size={11} />
            <span>{payment.label}</span>

            {!collected && (
              <span className="ml-auto text-slate-400">
                Ready to collect
              </span>
            )}

            {collected && (
              <span className="ml-auto font-semibold text-emerald-600">
                Paid
              </span>
            )}
          </div>

        </div>
      </div>
    </DreamVisualContainer>
  )
}