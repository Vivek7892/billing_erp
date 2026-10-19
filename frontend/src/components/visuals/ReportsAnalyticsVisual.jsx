import { useState, useEffect } from 'react'
import { TrendingUp, BarChart3, PieChart, ArrowUpRight } from 'lucide-react'
import DreamVisualContainer from './DreamVisualContainer'

const REPORT_STAGES = [
  { stage: 1, title: 'Initializing Workspace', revenue: '₹0.00', bills: '0', growth: '0%', fillHeight: 'h-2' },
  { stage: 2, title: 'Sales Data Syncing', revenue: '₹34,200', bills: '48', growth: '+12.4%', fillHeight: 'h-6' },
  { stage: 3, title: 'Charts Growing & Trends', revenue: '₹78,900', bills: '112', growth: '+19.8%', fillHeight: 'h-12' },
  { stage: 4, title: 'Revenue Engine Updated', revenue: '₹1,24,650', bills: '184', growth: '+24.5%', fillHeight: 'h-16' },
  { stage: 5, title: 'Completed Analytics Dashboard', revenue: '₹1,42,850', bills: '215', growth: '+28.2%', fillHeight: 'h-20' },
]

export default function ReportsAnalyticsVisual({ className = '', uploadedSrc }) {
  const [stageIndex, setStageIndex] = useState(0)

  useEffect(() => {
    // 5-second loop: 1000ms per stage across 5 states
    const timer = setInterval(() => {
      setStageIndex(i => (i + 1) % REPORT_STAGES.length)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const cur = REPORT_STAGES[stageIndex]

  return (
    <DreamVisualContainer
      slotKey="reports-analytics"
      title="Reports & Analytics Animation (Empty → Data Appears → Charts Grow → Revenue Updates → Completed Dashboard)"
      uploadedSrc={uploadedSrc}
      className={`p-5 bg-white dark:bg-slate-900 border border-[#0057B8]/20 ${className}`}
      badgeText="Business Analytics"
      badgeVariant="cyan"
    >
      <div className="w-full max-w-lg flex flex-col items-center justify-center text-center">
        {/* Dynamic Analytics Visual Display */}
        <div className="w-full p-4 rounded-xl bg-[#F5F6F8] dark:bg-slate-800/80 border border-gray-200/80 dark:border-slate-700/80 mb-3 text-left">
          <div className="flex items-center justify-between text-xs mb-3">
            <span className="font-bold text-[#111111] dark:text-white flex items-center gap-1.5">
              <BarChart3 size={15} className="text-[#0057B8]" />
              Executive Sales &amp; Margin Velocity
            </span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
              <TrendingUp size={13} /> {cur.growth}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-700/60 border border-gray-100 dark:border-slate-600">
              <span className="text-[9px] font-bold uppercase text-[#888888] block">Gross Revenue</span>
              <span className="font-mono text-lg font-black text-[#0057B8] dark:text-[#16A9D8]">
                {cur.revenue}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-700/60 border border-gray-100 dark:border-slate-600">
              <span className="text-[9px] font-bold uppercase text-[#888888] block">Billed Transactions</span>
              <span className="font-mono text-lg font-black text-[#111111] dark:text-white">
                {cur.bills} Invoices
              </span>
            </div>
          </div>

          {/* Dynamic 7-Bar Chart Animation */}
          <div className="flex items-end justify-between gap-1.5 h-20 pt-2 border-b border-gray-200 dark:border-slate-700">
            {[35, 50, 42, 68, 75, 90, 100].map((scale, i) => {
              const activeRatio = (stageIndex + 1) / 5
              const currentHeightPct = Math.max(12, Math.round(scale * activeRatio))
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <div
                    className="w-full rounded-t-sm transition-all duration-500"
                    style={{
                      height: `${currentHeightPct}%`,
                      backgroundColor: i === 6 ? '#FFE500' : i >= 4 ? '#0057B8' : '#16A9D8',
                    }}
                  />
                  <span className="text-[8px] font-mono text-[#888888]">D{i + 1}</span>
                </div>
              )
            })}
          </div>
        </div>

        <p className="text-xs font-bold text-[#111111] dark:text-white">
          {cur.title}
        </p>
        <span className="text-[11px] text-[#555555] dark:text-gray-400 mt-0.5">
          Real-time Gross Profit, Tax Summary &amp; Category Contribution
        </span>
      </div>
    </DreamVisualContainer>
  )
}

