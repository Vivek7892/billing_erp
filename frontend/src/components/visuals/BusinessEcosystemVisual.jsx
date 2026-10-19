import {
  Package, Boxes, ShoppingCart, FileText, Users,
  Truck, CreditCard, Wallet, BarChart3, TrendingUp, Layers
} from 'lucide-react'
import DreamVisualContainer from './DreamVisualContainer'

const MODULES = [
  { id: 'products', name: 'Products', icon: Package, color: 'text-[#0057B8]', bg: 'bg-blue-50 dark:bg-blue-950/60' },
  { id: 'inventory', name: 'Inventory', icon: Boxes, color: 'text-[#16A9D8]', bg: 'bg-cyan-50 dark:bg-cyan-950/60' },
  { id: 'billing', name: 'Billing / POS', icon: ShoppingCart, color: 'text-[#003F8F]', bg: 'bg-indigo-50 dark:bg-indigo-950/60' },
  { id: 'invoices', name: 'Invoices', icon: FileText, color: 'text-[#0057B8]', bg: 'bg-blue-50 dark:bg-blue-950/60' },
  { id: 'customers', name: 'Customers', icon: Users, color: 'text-[#16A9D8]', bg: 'bg-cyan-50 dark:bg-cyan-950/60' },
  { id: 'purchases', name: 'Purchases', icon: Truck, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/60' },
  { id: 'payments', name: 'Payments', icon: CreditCard, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/60' },
  { id: 'credit', name: 'Credit Collection', icon: Wallet, color: 'text-[#003F8F]', bg: 'bg-blue-50 dark:bg-blue-950/60' },
  { id: 'reports', name: 'Reports', icon: BarChart3, color: 'text-[#16A9D8]', bg: 'bg-cyan-50 dark:bg-cyan-950/60' },
  { id: 'analytics', name: 'Analytics', icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/60' },
]

export default function BusinessEcosystemVisual({ className = '', uploadedSrc }) {
  return (
    <DreamVisualContainer
      slotKey="business-ecosystem"
      title="Dreamwithtech Billing ERP Unified Business Ecosystem"
      uploadedSrc={uploadedSrc}
      aspectRatio="16/9"
      className={`p-6 md:p-8 bg-gradient-to-br from-[#F5F6F8] via-white to-[#F5F6F8] dark:from-slate-900 dark:via-slate-850 dark:to-slate-900 border border-[#0057B8]/20 ${className}`}
      badgeText="Enterprise Ecosystem"
      badgeVariant="cyan"
    >
      <div className="w-full h-full flex flex-col justify-between">
        {/* Header */}
        <div className="text-center max-w-xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Layers size={18} className="text-[#0057B8]" />
            <h3 className="text-base md:text-lg font-black text-[#111111] dark:text-white uppercase tracking-wider">
              Dreamwithtech Unified Enterprise Ecosystem
            </h3>
          </div>
          <p className="text-xs text-[#555555] dark:text-gray-300">
            Real-time synchronization across retail POS, inventory control, GST tax reporting, supplier procurement, and customer ledger accounting.
          </p>
        </div>

        {/* Central Core & Radial Connected Modules Grid */}
        <div className="relative my-auto py-4">
          {/* Central ERP Brain / Hub */}
          <div className="mx-auto max-w-xs p-4 rounded-2xl bg-gradient-to-br from-[#003F8F] to-[#0057B8] text-white shadow-xl text-center border-2 border-[#16A9D8] z-20 relative">
            <span className="text-[10px] font-black tracking-widest uppercase text-[#FFE500] block mb-0.5">
              CENTRAL WORKSPACE
            </span>
            <span className="text-sm font-black tracking-tight block">
              Dreamwithtech Billing ERP
            </span>
            <span className="text-[10px] text-white/80 block mt-0.5">
              Unified Data, Multi-User RBAC &amp; Automated Ledger
            </span>
          </div>

          {/* 10 Surrounding Modules Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-5 max-w-4xl mx-auto">
            {MODULES.map(mod => {
              const Icon = mod.icon
              return (
                <div
                  key={mod.id}
                  className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-gray-200/80 dark:border-slate-700/80 shadow-2xs hover:shadow-md transition-shadow flex items-center gap-2 text-left"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${mod.bg} ${mod.color}`}>
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-[#111111] dark:text-white truncate block">
                      {mod.name}
                    </span>
                    <span className="text-[9px] text-[#888888] font-medium block">
                      Automated
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer Guarantee */}
        <div className="flex flex-wrap items-center justify-between border-t border-gray-200/60 dark:border-slate-800 pt-3 text-[11px] text-[#888888]">
          <span>Integration · Automation · Full Visibility · Business Control</span>
          <span className="font-semibold text-[#0057B8] dark:text-[#16A9D8]">Dreamwithtech Enterprise Suite</span>
        </div>
      </div>
    </DreamVisualContainer>
  )
}

