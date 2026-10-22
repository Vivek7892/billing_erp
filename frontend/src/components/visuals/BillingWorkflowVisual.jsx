import { useState, useEffect } from 'react'
import {
  IconPackage,
  IconShoppingCart,
  IconHash,
  IconCalculator,
  IconFileText,
  IconCreditCard,
  IconCheck,
} from '@tabler/icons-react'
import DreamVisualContainer from './DreamVisualContainer'

const STAGES = [
  { id: 'product', label: 'Product Selection', icon: IconPackage, detail: 'SKU: PROD-102 · Barcode Scanned' },
  { id: 'cart', label: 'Cart', icon: IconShoppingCart, detail: 'Item Added to Active Bill' },
  { id: 'qty', label: 'Quantity', icon: IconHash, detail: 'Qty: 3 Units @ ₹140.00' },
  { id: 'total', label: 'Total', icon: IconCalculator, detail: 'Subtotal ₹420.00 + GST' },
  { id: 'invoice', label: 'Invoice', icon: IconFileText, detail: 'Generated INV-2026-089' },
  { id: 'payment', label: 'Payment', icon: IconCreditCard, detail: 'Paid via Dynamic UPI QR' },
]

export default function BillingWorkflowVisual({ className = '', compact = false, uploadedSrc }) {
  const [activeStage, setActiveStage] = useState(0)

  useEffect(() => {
    // 5-second loop: ~830ms per step across 6 stages
    const timer = setInterval(() => {
      setActiveStage(s => (s + 1) % STAGES.length)
    }, 833)
    return () => clearInterval(timer)
  }, [])

  if (compact) {
    const current = STAGES[activeStage]
    const Icon = current.icon
    return (
      <div className={`flex flex-col items-center justify-center gap-1.5 py-1 ${className}`}>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0057B8]/10 text-[#0057B8] dark:text-sky-300 border border-[#0057B8]/20 text-xs font-semibold">
          <Icon size={13} />
          <span>Stage {activeStage + 1}/6: {current.label}</span>
          <span className="text-slate-400 font-normal">·</span>
          <span className="text-slate-500 dark:text-slate-400 font-normal">{current.detail}</span>
        </div>
      </div>
    )
  }

  return (
    <DreamVisualContainer
      slotKey="billing-workflow"
      title="Billing Workflow Animation (Product → Cart → Quantity → Total → Invoice → Payment)"
      uploadedSrc={uploadedSrc}
      className={`p-4 bg-white dark:bg-slate-900 border border-[#0057B8]/15 ${className}`}
      badgeText="Billing Workflow"
      badgeVariant="cyan"
    >
      <div className="w-full flex flex-col items-center justify-center text-center">
        <div className="text-xs font-bold uppercase tracking-wider text-[#0057B8] mb-3 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#FFE500] animate-ping" />
          Seamless 5-Second Billing Engine
        </div>

        {/* 6 Stage Workflow Indicators */}
        <div className="w-full max-w-xl grid grid-cols-6 gap-1 md:gap-2 mb-4">
          {STAGES.map((stg, index) => {
            const Icon = stg.icon
            const isCurrent = activeStage === index
            const isCompleted = activeStage > index

            return (
              <div
                key={stg.id}
                className={`flex flex-col items-center p-2 rounded-xl transition-all duration-300 ${
                  isCurrent
                    ? 'bg-[#0057B8] text-white shadow-md scale-105'
                    : isCompleted
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-[#F5F6F8] dark:bg-slate-800 text-[#888888]'
                }`}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-1">
                  {isCompleted ? <IconCheck size={16} strokeWidth={2.5} /> : <Icon size={16} />}
                </div>
                <span className="text-[9px] font-bold line-clamp-1">{stg.label}</span>
              </div>
            )
          })}
        </div>

        {/* Live Active Stage Card */}
        <div className="w-full max-w-sm rounded-xl p-3 bg-[#F5F6F8] dark:bg-slate-800/60 border border-gray-200/80 dark:border-slate-700/80 flex items-center justify-between">
          <div className="text-left">
            <span className="text-[10px] font-bold uppercase text-[#888888] block">Current Stage</span>
            <span className="text-xs font-extrabold text-[#003F8F] dark:text-[#16A9D8]">
              {activeStage + 1}. {STAGES[activeStage].label}
            </span>
          </div>
          <span className="text-[11px] font-mono font-semibold text-[#555555] dark:text-gray-300 bg-white dark:bg-slate-700 px-2.5 py-1 rounded-md border border-gray-200 dark:border-slate-600 shadow-2xs">
            {STAGES[activeStage].detail}
          </span>
        </div>
      </div>
    </DreamVisualContainer>
  )
}


