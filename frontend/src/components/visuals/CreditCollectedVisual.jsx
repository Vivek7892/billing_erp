import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  IndianRupee,
  Receipt,
  CreditCard,
} from 'lucide-react'
import DreamVisualContainer from './DreamVisualContainer'

export default function CreditCollectedVisual({
  className = '',
  customerName = 'Rajesh Kumar',
  uploadedSrc,
}) {
  const [collected, setCollected] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setCollected(true)
    }, 1800)

    return () => clearTimeout(timer)
  }, [])

  const outstanding = 4500
  const collectedAmount = collected ? 4500 : 0
  const remaining = outstanding - collectedAmount

  return (
    <DreamVisualContainer
      slotKey="credit-collected"
      title="Credit Collection"
      uploadedSrc={uploadedSrc}
      className={`p-0 bg-transparent border-0 ${className}`}
      badgeText={collected ? 'Collected' : 'Pending'}
      badgeVariant={collected ? 'success' : 'cyan'}
    >
      <div className="w-full px-1">

        <div
          className={`
            w-full
            rounded-xl
            border
            bg-white
            px-4
            py-3
            dark:bg-slate-800
            ${
              collected
                ? 'border-emerald-200 dark:border-emerald-800'
                : 'border-slate-200 dark:border-slate-700'
            }
          `}
        >

          {/* Customer */}
          <div>
            <div className="text-[9px] uppercase tracking-wide text-slate-400">
              Customer
            </div>

            <div className="mt-0.5 truncate text-xs font-semibold text-slate-800 dark:text-white">
              {customerName}
            </div>
          </div>

          {/* Invoice */}
          <div className="mt-3 flex items-center gap-1.5 text-[9px] text-slate-400">
            <Receipt size={11} />
            <span>INV-2026-089</span>
            <span>•</span>
            <span>20 Oct 2026</span>
          </div>

          {/* Amount */}
          <div className="mt-4 flex items-end justify-between">

            <div>
              <div className="text-[9px] uppercase tracking-wide text-slate-400">
                {collected ? 'Collected Amount' : 'Outstanding'}
              </div>

              <div
                className={`
                  mt-1
                  flex
                  items-center
                  gap-1
                  text-2xl
                  font-bold
                  ${
                    collected
                      ? 'text-emerald-600'
                      : 'text-slate-900 dark:text-white'
                  }
                `}
              >
                <IndianRupee size={18} />

                {(collected
                  ? collectedAmount
                  : outstanding
                ).toLocaleString('en-IN')}

                {collected && (
                  <CheckCircle2
                    size={17}
                    className="ml-1 text-emerald-500"
                    strokeWidth={2.5}
                  />
                )}
              </div>
            </div>

            {/* Remaining */}
            <div className="text-right">
              <div className="text-[9px] text-slate-400">
                Remaining
              </div>

              <div
                className={`
                  mt-1
                  text-sm
                  font-bold
                  ${
                    remaining === 0
                      ? 'text-emerald-600'
                      : 'text-slate-700 dark:text-white'
                  }
                `}
              >
                ₹{remaining.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-700">

            <div className="flex items-center gap-1.5 text-[9px] text-slate-500 dark:text-slate-400">
              <CreditCard size={11} />
              <span>UPI Payment</span>
            </div>

            {collected ? (
              <div className="flex items-center gap-1 text-[9px] font-semibold text-emerald-600">
                <CheckCircle2 size={11} />
                Paid
              </div>
            ) : (
              <span className="text-[9px] text-slate-400">
                Awaiting payment
              </span>
            )}
          </div>

        </div>
      </div>
    </DreamVisualContainer>
  )
} 