import { Link } from 'react-router-dom'
import {
  IconPlus,
  IconChartBar,
  IconShieldCheck,
  IconArrowUpRight,
} from '@tabler/icons-react'
import DreamVisualContainer from './DreamVisualContainer'
import dashboardHero from '../../assets/dreamwithtech/dashboard-hero.webp'

export default function DashboardHeroVisual({ className = '', uploadedSrc }) {
  return (
    <DreamVisualContainer
      slotKey="dashboard-hero"
      title="Dreamwithtech Billing ERP Dashboard Hero"
      uploadedSrc={uploadedSrc || dashboardHero}
      aspectRatio="16/9"
      className={`w-full overflow-hidden border border-[#0057B8]/20 bg-gradient-to-br from-[#003F8F] via-[#0057B8] to-[#0A2540] text-white shadow-xl ${className}`}
      badgeText="Dreamwithtech Billing ERP"
      badgeVariant="cyan"
    >
      <div className="relative w-full h-full p-6 md:p-8 flex flex-col justify-between">
        {/* Subtle grid background */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.4) 1px, transparent 0)',
          backgroundSize: '24px 24px'
        }} />

        {/* Top Hero Headline & Action row */}
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 max-w-4xl">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#FFE500]">
                All-in-One Enterprise Platform
              </span>
              <span className="text-white/40">·</span>
              <span className="text-[11px] font-medium text-white/80 flex items-center gap-1">
                <IconShieldCheck size={13} className="text-[#16A9D8]" /> GST Compliant &amp; Cloud Synced
              </span>
            </div>
            <h1 className="text-xl md:text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
              Complete Control Over Billing, Stock &amp; Cash Flow
            </h1>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              to="/new-bill"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#FFE500] text-[#003F8F] text-xs font-bold hover:bg-yellow-300 transition-colors shadow-sm"
            >
              <IconPlus size={15} />
              <span>New Bill (Ctrl+N)</span>
            </Link>
            <Link
              to="/reports"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold backdrop-blur-sm border border-white/20 transition-colors"
            >
              <IconChartBar size={14} />
              <span>Analytics</span>
              <IconArrowUpRight size={13} className="text-[#16A9D8]" />
            </Link>
          </div>
        </div>

        {/* Center / Bottom: Mockup Browser Window displaying Dreamwithtech ERP */}
        <div className="relative z-10 mt-4 rounded-xl bg-white text-[#111111] p-3 shadow-2xl border border-white/30 overflow-hidden">
          {/* Browser header */}
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-gray-100 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="ml-2 font-mono text-[11px] font-bold text-[#0057B8]">
                https://app.dreamwithtech.com/billing-erp
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-[#555555]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold">POS Online</span>
              <span className="text-gray-300">|</span>
              <span>Fast Settlement Mode</span>
            </div>
          </div>

          {/* Mini ERP Dashboard Content inside Browser */}
          <div className="grid grid-cols-12 gap-2 text-xs">
            {/* Left 4 cols: Key Metrics */}
            <div className="col-span-4 space-y-2">
              <div className="p-2.5 rounded-lg bg-[#F5F6F8] border border-gray-100">
                <span className="text-[9px] font-bold uppercase text-[#888888] block">Today's Revenue</span>
                <span className="text-sm font-black font-mono text-[#0057B8]">₹48,920.00</span>
                <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">↑ 18.2% vs yesterday</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#F5F6F8] border border-gray-100 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-bold uppercase text-[#888888] block">Invoices Generated</span>
                  <span className="text-xs font-bold font-mono text-[#111111]">142 Bills</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-bold uppercase text-[#888888] block">Credit Collected</span>
                  <span className="text-xs font-bold font-mono text-emerald-600">₹14,500</span>
                </div>
              </div>
            </div>

            {/* Middle 5 cols: Live Sales Curve */}
            <div className="col-span-5 p-2.5 rounded-lg bg-[#F5F6F8] border border-gray-100 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] font-bold text-[#555555]">
                <span>Hourly Sales &amp; Counter Throughput</span>
                <span className="text-[#0057B8] font-mono">Avg ₹345/bill</span>
              </div>
              <svg viewBox="0 0 200 45" className="w-full h-10 mt-1">
                <defs>
                  <linearGradient id="heroCurveGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16A9D8" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#0057B8" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path d="M 0,35 Q 25,10 50,25 T 100,15 T 150,8 T 200,4" fill="none" stroke="#0057B8" strokeWidth="2" />
                <path d="M 0,35 Q 25,10 50,25 T 100,15 T 150,8 T 200,4 L 200,45 L 0,45 Z" fill="url(#heroCurveGrad)" />
                <circle cx="150" cy="8" r="3" fill="#FFE500" stroke="#003F8F" strokeWidth="1.5" />
                <circle cx="200" cy="4" r="3" fill="#0057B8" stroke="#FFFFFF" strokeWidth="1.5" />
              </svg>
            </div>

            {/* Right 3 cols: Quick Operations */}
            <div className="col-span-3 p-2.5 rounded-lg bg-[#F5F6F8] border border-gray-100 flex flex-col justify-between">
              <span className="text-[9px] font-bold uppercase text-[#888888] block">System Status</span>
              <div className="space-y-1 my-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[#555555]">Thermal Printer</span>
                  <span className="font-bold text-emerald-600">58/80 Ready</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[#555555]">Dynamic UPI</span>
                  <span className="font-bold text-emerald-600">Active</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[#555555]">GST Invoices</span>
                  <span className="font-bold text-[#0057B8]">Auto B2B/B2C</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DreamVisualContainer>
  )
}

