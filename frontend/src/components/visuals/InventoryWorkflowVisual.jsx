import { useState, useEffect } from 'react'
import { PackagePlus, ShoppingBag, ArrowDown, Activity } from 'lucide-react'
import DreamVisualContainer from './DreamVisualContainer'

const STOCK_STAGES = [
  { stage: 1, label: 'Stock Added', qty: '100 Units', badge: '+50 Inward Purchase', color: 'text-emerald-600', icon: PackagePlus },
  { stage: 2, label: 'Product Sold', qty: '100 Units', badge: 'POS Sale #INV-109', color: 'text-[#0057B8]', icon: ShoppingBag },
  { stage: 3, label: 'Inventory Reduced', qty: '96 Units (-4)', badge: 'Real-time Deduction', color: 'text-[#16A9D8]', icon: ArrowDown },
  { stage: 4, label: 'Stock Indicator Updated', qty: '96 Units (Optimal)', badge: 'Threshold Synced', color: 'text-emerald-600', icon: Activity },
]

export default function InventoryWorkflowVisual({ className = '', productName = 'Basmati Rice Premium 5kg', uploadedSrc }) {
  const [currentStage, setCurrentStage] = useState(0)

  useEffect(() => {
    // 5-second loop: 1.25s per phase across 4 states
    const timer = setInterval(() => {
      setCurrentStage(s => (s + 1) % STOCK_STAGES.length)
    }, 1250)
    return () => clearInterval(timer)
  }, [])

  const cur = STOCK_STAGES[currentStage]

  return (
    <DreamVisualContainer
      slotKey="inventory-workflow"
      title="Inventory Workflow Animation (Stock Added → Sold → Reduced → Updated)"
      uploadedSrc={uploadedSrc}
      className={`p-5 bg-white dark:bg-slate-900 border border-[#0057B8]/20 ${className}`}
      badgeText="Real-time Inventory"
      badgeVariant="cyan"
    >
      <div className="w-full max-w-md flex flex-col items-center justify-center text-center">
        {/* Real-time Inventory Card */}
        <div className="w-full p-4 rounded-xl bg-[#F5F6F8] dark:bg-slate-800/80 border border-gray-200/80 dark:border-slate-700/80 mb-3 text-left">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#111111] dark:text-white truncate">{productName}</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950 text-[#0057B8] dark:text-[#16A9D8] border border-blue-200 dark:border-blue-800">
              {cur.badge}
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-[#888888] block">Current Available Stock</span>
              <span className="font-mono text-xl font-black text-[#003F8F] dark:text-[#16A9D8]">
                {cur.qty}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-700 shadow-2xs border border-gray-100 dark:border-slate-600 flex items-center justify-center text-[#0057B8]">
              <cur.icon size={22} className={currentStage === 2 ? 'animate-bounce text-[#16A9D8]' : ''} />
            </div>
          </div>

          {/* Level Progress Indicator */}
          <div className="mt-3 w-full bg-gray-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-700 rounded-full ${
                currentStage >= 2 ? 'w-[75%] bg-[#0057B8]' : 'w-[85%] bg-emerald-500'
              }`}
            />
          </div>
        </div>

        <p className="text-xs font-bold text-[#111111] dark:text-white">
          {cur.label}
        </p>
        <span className="text-[11px] text-[#555555] dark:text-gray-400 mt-0.5">
          Automated Reorder Trigger &amp; Multi-outlet Stock Level Sync
        </span>
      </div>
    </DreamVisualContainer>
  )
}

