import { useState, useEffect } from 'react'
import { Package, Boxes, Receipt, CreditCard, FileCheck, Users, BarChart3, ArrowRight } from 'lucide-react'
import DreamVisualContainer from './DreamVisualContainer'

const FLOW_NODES = [
  { id: 'products', label: 'Products', icon: Package, desc: 'Central Master Catalog' },
  { id: 'inventory', label: 'Inventory', icon: Boxes, desc: 'Real-time Stock Control' },
  { id: 'billing', label: 'Billing', icon: Receipt, desc: 'High-speed POS Counter' },
  { id: 'payment', label: 'Payment', icon: CreditCard, desc: 'Cash & Dynamic UPI QR' },
  { id: 'invoice', label: 'Invoice', icon: FileCheck, desc: '58/80mm & A4 GST Bills' },
  { id: 'customer', label: 'Customer', icon: Users, desc: 'Credit & Loyalty Ledger' },
  { id: 'reports', label: 'Reports', icon: BarChart3, desc: 'Financial Intelligence' },
]

export default function CompleteBusinessFlowVisual({ className = '', uploadedSrc }) {
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    // 5-second loop: ~714ms per step across 7 nodes
    const timer = setInterval(() => {
      setActiveStep(s => (s + 1) % FLOW_NODES.length)
    }, 714)
    return () => clearInterval(timer)
  }, [])

  return (
    <DreamVisualContainer
      slotKey="complete-business-flow"
      title="Complete Business Flow Animation (Products → Inventory → Billing → Payment → Invoice → Customer → Reports)"
      uploadedSrc={uploadedSrc}
      className={`p-6 bg-gradient-to-r from-white via-[#F5F6F8] to-white dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 border border-[#0057B8]/20 ${className}`}
      badgeText="Unified Ecosystem"
      badgeVariant="cyan"
    >
      <div className="w-full flex flex-col items-center justify-center text-center">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-[#16A9D8] animate-ping" />
          <h2 className="text-sm md:text-base font-extrabold text-[#003F8F] dark:text-[#16A9D8] uppercase tracking-wider">
            Connected Business Flow in One ERP Platform
          </h2>
        </div>
        <p className="text-xs text-[#555555] dark:text-gray-300 max-w-xl mb-6">
          Every transaction seamlessly ripples through catalogue, stock deductions, tax calculations, customer ledgers, and executive intelligence.
        </p>

        {/* 7 Connected Step Nodes */}
        <div className="w-full max-w-4xl grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {FLOW_NODES.map((node, i) => {
            const Icon = node.icon
            const isCurrent = activeStep === i
            const isCompleted = activeStep > i

            return (
              <div
                key={node.id}
                className={`relative flex flex-col items-center p-3 rounded-xl border transition-all duration-300 ${
                  isCurrent
                    ? 'bg-[#0057B8] text-white border-[#003F8F] shadow-lg scale-105 z-10'
                    : isCompleted
                      ? 'bg-blue-50/70 dark:bg-blue-950/40 text-[#0057B8] dark:text-[#16A9D8] border-blue-200 dark:border-blue-800'
                      : 'bg-white dark:bg-slate-800 text-[#555555] dark:text-gray-300 border-gray-200/80 dark:border-slate-700/80'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-1.5 ${
                  isCurrent ? 'bg-white/20 text-[#FFE500]' : 'bg-[#F5F6F8] dark:bg-slate-700'
                }`}>
                  <Icon size={18} />
                </div>
                <span className="text-xs font-bold">{node.label}</span>
                <span className={`text-[9px] mt-0.5 line-clamp-1 ${isCurrent ? 'text-white/80' : 'text-[#888888]'}`}>
                  {node.desc}
                </span>

                {/* Arrow connector */}
                {i < FLOW_NODES.length - 1 && (
                  <div className="hidden md:block absolute -right-2 top-1/2 -translate-y-1/2 z-20 text-gray-300">
                    <ArrowRight size={12} className={isCurrent ? 'text-[#0057B8] animate-pulse' : ''} />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Live Active Node Subtitle */}
        <div className="mt-5 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0057B8]/10 dark:bg-blue-950/60 border border-[#0057B8]/20 text-xs font-semibold text-[#003F8F] dark:text-[#16A9D8]">
          <span>Active Step {activeStep + 1} of 7:</span>
          <span className="text-[#111111] dark:text-white font-bold">{FLOW_NODES[activeStep].label} ({FLOW_NODES[activeStep].desc})</span>
        </div>
      </div>
    </DreamVisualContainer>
  )
}

