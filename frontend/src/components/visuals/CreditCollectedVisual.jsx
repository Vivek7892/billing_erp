import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  Sparkles,
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
  const progress = (collectedAmount / outstanding) * 100

  return (
    <DreamVisualContainer
      slotKey="credit-collected"
      title="Credit Collection"
      uploadedSrc={uploadedSrc}
      className={`p-0 bg-transparent border-0 ${className}`}
      badgeText={collected ? 'Collected' : 'Collecting'}
      badgeVariant={collected ? 'success' : 'cyan'}
    >
      <div className="w-full px-1">

        {/* Main Card */}
        <div
          className="
            relative
            w-full
            rounded-xl
            border
            border-slate-200
            dark:border-slate-700
            bg-white
            dark:bg-slate-800
            px-4
            py-3.5
            overflow-hidden
          "
        >

          {/* Subtle success glow */}
          {collected && (
            <div
              className="
                pointer-events-none
                absolute
                -right-10
                -top-10
                h-24
                w-24
                rounded-full
                bg-emerald-400/10
                blur-2xl
              "
            />
          )}

          {/* Header */}
          <div className="flex items-center justify-between">

            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                Customer
              </div>

              <div className="mt-0.5 truncate text-xs font-semibold text-slate-800 dark:text-white">
                {customerName}
              </div>
            </div>

            {/* Collected Mark */}
            <div
              className={`
                shrink-0
                inline-flex
                items-center
                gap-1
                rounded-full
                px-2
                py-1
                text-[9px]
                font-bold
                transition-all
                duration-500
                ${
                  collected
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-blue-50 text-[#0057B8] dark:bg-blue-900/30'
                }
              `}
            >
              <CheckCircle2 size={11} strokeWidth={2.5} />
              {collected ? 'COLLECTED' : 'PROCESSING'}
            </div>
          </div>

          {/* Invoice */}
          <div className="mt-3 flex items-center gap-2 text-[9px] text-slate-400">
            <Receipt size={12} />
            <span>INV-2026-089</span>
            <span>•</span>
            <span>20 Oct 2026</span>
          </div>

          {/* Amount Summary */}
          <div className="mt-4 grid grid-cols-3 gap-2">

            {/* Outstanding */}
            <div className="rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-slate-700/50">
              <div className="text-[8px] uppercase tracking-wide text-slate-400">
                Outstanding
              </div>

              <div className="mt-1 flex items-center gap-0.5 text-sm font-bold text-slate-800 dark:text-white">
                <IndianRupee size={12} />
                4,500
              </div>
            </div>

            {/* Collected */}
            <div
              className={`
                rounded-lg
                px-2.5
                py-2
                transition-colors
                duration-500
                ${
                  collected
                    ? 'bg-emerald-50 dark:bg-emerald-900/20'
                    : 'bg-slate-50 dark:bg-slate-700/50'
                }
              `}
            >
              <div className="text-[8px] uppercase tracking-wide text-slate-400">
                Collected
              </div>

              <div
                className={`
                  mt-1
                  flex
                  items-center
                  gap-0.5
                  text-sm
                  font-bold
                  ${
                    collected
                      ? 'text-emerald-600'
                      : 'text-slate-800 dark:text-white'
                  }
                `}
              >
                <IndianRupee size={12} />
                {collectedAmount.toLocaleString('en-IN')}
              </div>
            </div>

            {/* Remaining */}
            <div className="rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-slate-700/50">
              <div className="text-[8px] uppercase tracking-wide text-slate-400">
                Remaining
              </div>

              <div
                className={`
                  mt-1
                  flex
                  items-center
                  gap-0.5
                  text-sm
                  font-bold
                  ${
                    remaining === 0
                      ? 'text-emerald-600'
                      : 'text-slate-800 dark:text-white'
                  }
                `}
              >
                <IndianRupee size={12} />
                {remaining.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Progress */}
          <div className="mt-4">

            <div className="flex items-center justify-between text-[9px]">
              <span className="font-medium text-slate-500">
                Payment progress
              </span>

              <span
                className={
                  collected
                    ? 'font-bold text-emerald-600'
                    : 'font-semibold text-[#0057B8]'
                }
              >
                {Math.round(progress)}%
              </span>
            </div>

            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
              <div
                className={`
                  h-full
                  rounded-full
                  transition-all
                  duration-1000
                  ease-out
                  ${
                    collected
                      ? 'bg-emerald-500'
                      : 'bg-[#0057B8]'
                  }
                `}
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>
          </div>

          {/* Payment Details */}
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-700">

            <div className="flex items-center gap-1.5 text-[9px] text-slate-500 dark:text-slate-400">
              <CreditCard size={12} />
              <span>UPI</span>
            </div>

            <span className="text-[9px] text-slate-400">
              Ref: UPI-784521
            </span>
          </div>
        </div>

        {/* Success Status */}
        <div
          className={`
            relative
            mt-2
            flex
            items-center
            justify-center
            gap-1.5
            transition-all
            duration-500
            ${
              collected
                ? 'opacity-100'
                : 'opacity-70'
            }
          `}
        >
          {collected && (
            <>
              <Sparkles
                size={12}
                className="text-amber-400"
              />

              <CheckCircle2
                size={14}
                className="text-emerald-500"
                strokeWidth={2.5}
              />

              <span className="text-[10px] font-semibold text-emerald-600">
                Credit fully collected
              </span>

              <Sparkles
                size={12}
                className="text-amber-400"
              />
            </>
          )}

          {!collected && (
            <span className="text-[10px] font-medium text-slate-400">
              Recording payment...
            </span>
          )}
        </div>
      </div>
    </DreamVisualContainer>
  )
}