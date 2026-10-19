import { useEffect, useState } from 'react'
import {
  Wallet,
  ArrowDown,
  CheckCircle2,
  IndianRupee,
} from 'lucide-react'
import DreamVisualContainer from './DreamVisualContainer'

const PHASES = [
  {
    title: 'Outstanding Credit',
    amount: '₹4,500',
    label: 'Credit Due',
    icon: Wallet,
  },
  {
    title: 'Collecting Payment',
    amount: '₹4,500',
    label: 'Receiving',
    icon: ArrowDown,
  },
  {
    title: 'Payment Received',
    amount: '₹4,500',
    label: 'Allocating',
    icon: IndianRupee,
  },
  {
    title: 'Credit Cleared',
    amount: '₹0',
    label: 'Settled',
    icon: CheckCircle2,
  },
]

export default function CreditCollectedVisual({
  className = '',
  customerName = 'Rajesh Kumar',
  uploadedSrc,
}) {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setPhase((current) => (current + 1) % PHASES.length)
    }, 1800)

    return () => clearInterval(timer)
  }, [])

  const current = PHASES[phase]
  const Icon = current.icon
  const isCleared = phase === 3
  const progress = ((phase + 1) / PHASES.length) * 100

  return (
    <DreamVisualContainer
      slotKey="credit-collected"
      title="Credit Collection"
      uploadedSrc={uploadedSrc}
      className={`p-0 bg-transparent border-0 ${className}`}
      badgeText={isCleared ? 'Credit Cleared' : 'Credit Collection'}
      badgeVariant={isCleared ? 'success' : 'cyan'}
    >
      {/* Animation wrapper */}
      <div className="w-full px-1">

        {/* Single compact card */}
        <div
          className="
            w-full
            h-[170px]
            rounded-xl
            border
            border-slate-200
            dark:border-slate-700
            bg-slate-50
            dark:bg-slate-800
            px-4
            py-3
            overflow-hidden
          "
        >

          {/* Customer */}
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
            {customerName}
          </div>

          {/* Main row */}
          <div className="mt-3 flex items-center justify-between">

            {/* Animated information */}
            <div
              key={`content-${phase}`}
              className="min-w-0 animate-[creditFade_.35s_ease-out]"
            >
              <div className="text-[9px] uppercase tracking-wider text-slate-400">
                {current.title}
              </div>

              <div
                className={`mt-0.5 text-2xl leading-none font-bold font-mono ${
                  isCleared
                    ? 'text-emerald-600'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                {current.amount}
              </div>

              <div className="mt-1 text-[10px] text-slate-400">
                {current.label}
              </div>
            </div>

            {/* Static-position icon */}
            <div
              className={`
                shrink-0
                w-9
                h-9
                rounded-full
                flex
                items-center
                justify-center
                transition-colors
                duration-500
                ${
                  isCleared
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-blue-50 text-[#0057B8]'
                }
              `}
            >
              <Icon size={18} strokeWidth={2} />
            </div>
          </div>

          {/* Progress */}
          <div className="mt-4">

            <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`
                  h-full
                  rounded-full
                  transition-all
                  duration-700
                  ease-out
                  ${isCleared ? 'bg-emerald-500' : 'bg-[#0057B8]'}
                `}
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>

            <div className="mt-1 flex items-center justify-between text-[8px] text-slate-400">
              <span>Outstanding</span>
              <span>{Math.round(progress)}%</span>
              <span>Cleared</span>
            </div>

          </div>
        </div>

        {/* Status outside card */}
        <div
          key={`status-${phase}`}
          className="mt-1.5 flex items-center justify-center gap-1.5 animate-[statusFade_.3s_ease-out]"
        >
          <span
            className={`
              w-1.5
              h-1.5
              rounded-full
              ${isCleared
                ? 'bg-emerald-500'
                : 'bg-[#16A9D8] animate-pulse'
              }
            `}
          />

          <span
            className={`
              text-[10px]
              font-medium
              ${isCleared
                ? 'text-emerald-600'
                : 'text-slate-500 dark:text-slate-400'
              }
            `}
          >
            {current.label}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes creditFade {
          from {
            opacity: 0;
            transform: translateY(3px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes statusFade {
          from {
            opacity: 0;
          }

          to {
            opacity: 1;
          }
        }
      `}</style>
    </DreamVisualContainer>
  )
}