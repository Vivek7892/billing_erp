import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronRight, Play, Clock, Sparkles, X, Layers, Workflow, Monitor } from 'lucide-react'
import CompactPromoBanner from './CompactPromoBanner'
import ShortVideoCard from './ShortVideoCard'
import VideoPlayerModal from './VideoPlayerModal'
import SectionIllustration from './SectionIllustration'
import {
  CompleteBusinessFlowVisual,
  BusinessEcosystemVisual,
  DashboardHeroVisual,
} from '../visuals'

/* -------------------------------------------------------------
   CLEAN MINIMALIST VECTOR ACCENTS FOR BANNER
-------------------------------------------------------------- */

function POSBillingVector({ className = '' }) {
  return (
    <svg
      viewBox="0 0 240 140"
      className={`w-full max-w-[200px] h-auto drop-shadow-xs select-none opacity-90 ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="25" y="28" width="140" height="84" rx="8" fill="rgba(15, 23, 42, 0.85)" stroke="#0057B8" strokeWidth="1.5" />
      <rect x="33" y="36" width="124" height="14" rx="3" fill="#0057B8" fillOpacity="0.25" />
      <rect x="40" y="41" width="36" height="4" rx="2" fill="#38BDF8" />
      <circle cx="147" cy="43" r="2.5" fill="#10B981" />
      <rect x="33" y="56" width="60" height="4" rx="2" fill="#16A9D8" />
      <rect x="135" y="56" width="22" height="4" rx="2" fill="#F8FAFC" />
      <rect x="33" y="66" width="76" height="4" rx="2" fill="#64748B" />
      <rect x="135" y="66" width="22" height="4" rx="2" fill="#F8FAFC" />
      <line x1="28" y1="88" x2="162" y2="88" stroke="#16A9D8" strokeWidth="1" strokeDasharray="3 3" />
      <rect x="33" y="96" width="44" height="6" rx="2" fill="#0057B8" />
      <rect x="127" y="96" width="30" height="6" rx="2" fill="#FFE500" />
      <g transform="translate(145, 12)">
        <path d="M0 0 H62 V96 L54 92 L46 96 L38 92 L30 96 L22 92 L14 96 L6 92 L0 96 Z" fill="rgba(15, 23, 42, 0.95)" stroke="#38BDF8" strokeWidth="1.2" />
        <rect x="14" y="10" width="34" height="4" rx="2" fill="#38BDF8" />
        <line x1="8" y1="20" x2="54" y2="20" stroke="#475569" strokeWidth="1" strokeDasharray="2 2" />
        <rect x="8" y="26" width="28" height="3" rx="1.5" fill="#94A3B8" />
        <rect x="42" y="26" width="12" height="3" rx="1.5" fill="#38BDF8" />
        <rect x="8" y="34" width="24" height="3" rx="1.5" fill="#94A3B8" />
        <rect x="42" y="34" width="12" height="3" rx="1.5" fill="#38BDF8" />
        <circle cx="50" cy="78" r="9" fill="#10B981" />
        <path d="M46 78L49 81L54 75" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}

function InventoryVector({ className = '' }) {
  return (
    <svg
      viewBox="0 0 240 140"
      className={`w-full max-w-[200px] h-auto drop-shadow-xs select-none opacity-90 ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="24" y="28" width="180" height="88" rx="8" fill="rgba(15, 23, 42, 0.85)" stroke="#0057B8" strokeWidth="1.5" />
      <rect x="32" y="36" width="164" height="6" rx="2" fill="#0057B8" fillOpacity="0.3" />
      <g transform="translate(36, 48)">
        <rect x="0" y="0" width="46" height="42" rx="5" fill="rgba(0, 87, 184, 0.2)" stroke="#0057B8" strokeWidth="1.2" />
        <rect x="8" y="8" width="22" height="3" rx="1.5" fill="#38BDF8" />
        <line x1="8" y1="22" x2="8" y2="32" stroke="#94A3B8" strokeWidth="1.5" />
        <line x1="14" y1="22" x2="14" y2="32" stroke="#94A3B8" strokeWidth="1" />
        <line x1="20" y1="22" x2="20" y2="32" stroke="#94A3B8" strokeWidth="2" />
      </g>
      <g transform="translate(90, 48)">
        <rect x="0" y="0" width="46" height="42" rx="5" fill="rgba(22, 169, 216, 0.2)" stroke="#16A9D8" strokeWidth="1.2" />
        <rect x="8" y="8" width="26" height="3" rx="1.5" fill="#38BDF8" />
        <rect x="8" y="24" width="30" height="4" rx="2" fill="#334155" />
        <rect x="8" y="24" width="22" height="4" rx="2" fill="#10B981" />
      </g>
      <g transform="translate(144, 48)">
        <rect x="0" y="0" width="46" height="42" rx="5" fill="rgba(255, 229, 0, 0.15)" stroke="#EAB308" strokeWidth="1.2" />
        <rect x="8" y="8" width="20" height="3" rx="1.5" fill="#FDE047" />
        <circle cx="36" cy="10" r="4" fill="#EF4444" />
        <rect x="8" y="24" width="30" height="4" rx="2" fill="#334155" />
        <rect x="8" y="24" width="10" height="4" rx="2" fill="#EF4444" />
      </g>
    </svg>
  )
}

function CustomerLedgerVector({ className = '' }) {
  return (
    <svg
      viewBox="0 0 240 140"
      className={`w-full max-w-[200px] h-auto drop-shadow-xs select-none opacity-90 ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="24" y="26" width="180" height="90" rx="8" fill="rgba(15, 23, 42, 0.85)" stroke="#0057B8" strokeWidth="1.5" />
      <circle cx="50" cy="52" r="14" fill="#0057B8" fillOpacity="0.25" />
      <circle cx="50" cy="48" r="5" fill="#38BDF8" />
      <rect x="72" y="44" width="60" height="5" rx="2.5" fill="#F8FAFC" />
      <rect x="72" y="53" width="40" height="3" rx="1.5" fill="#94A3B8" />
      <rect x="138" y="42" width="56" height="18" rx="4" fill="#78350F" stroke="#B45309" strokeWidth="1" />
      <rect x="144" y="49" width="44" height="4" rx="2" fill="#FDE68A" />
      <line x1="36" y1="74" x2="192" y2="74" stroke="#334155" strokeWidth="1" />
      <rect x="36" y="82" width="48" height="4" rx="2" fill="#94A3B8" />
      <rect x="156" y="82" width="36" height="4" rx="2" fill="#10B981" />
    </svg>
  )
}

/* -------------------------------------------------------------
   ECOSYSTEM & ARCHITECTURE VISUAL MODAL
   Allows users to interactively view CompleteBusinessFlowVisual,
   BusinessEcosystemVisual, and DashboardHeroVisual.
-------------------------------------------------------------- */

export function EcosystemVisualModal({ isOpen, onClose }) {
  const [tab, setTab] = useState('flow') // 'flow' | 'ecosystem' | 'platform'

  useEffect(() => {
    if (!isOpen) return
    const onKey = e => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ecosystem-modal-title"
    >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-[#0057B8]/10 text-[#0057B8] dark:text-sky-400">
              <Workflow size={18} />
            </span>
            <div>
              <h3 id="ecosystem-modal-title" className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Dreamwithtech Unified Architecture &amp; Workflow
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Live interactive visuals of the complete ERP lifecycle
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 px-5 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setTab('flow')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'flow'
                ? 'bg-[#0057B8] text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Workflow size={14} />
            <span>Connected Business Flow</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('ecosystem')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'ecosystem'
                ? 'bg-[#0057B8] text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers size={14} />
            <span>Enterprise Ecosystem</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('platform')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'platform'
                ? 'bg-[#0057B8] text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Monitor size={14} />
            <span>Dashboard Platform Hero</span>
          </button>
        </div>

        {/* Modal Body with Visual Component */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 dark:bg-slate-950">
          {tab === 'flow' && <CompleteBusinessFlowVisual className="w-full rounded-xl shadow-xs" />}
          {tab === 'ecosystem' && <BusinessEcosystemVisual className="w-full rounded-xl shadow-xs" />}
          {tab === 'platform' && <DashboardHeroVisual className="w-full rounded-xl shadow-xs" />}
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------
   COMPACT DASHBOARD PROMOTIONAL / FEATURE BANNER
   Uses high-res images as BACKGROUND with seamless dark gradient,
   ensuring 100% text contrast, compact height, and zero noise.
-------------------------------------------------------------- */

export function DashboardPromoCarousel({ className = '' }) {
  const navigate = useNavigate()
  const [activeSlide, setActiveSlide] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [ecosystemModalOpen, setEcosystemModalOpen] = useState(false)

  const slides = [
    {
      id: 'fast-billing',
      badge: 'FEATURED',
      headline: 'Smarter billing. Better business.',
      description: 'Speed up counter checkout with barcode scanning, auto discounts, and continuous thermal receipts.',
      cta: 'Start New Bill',
      link: '/billing/new',
      bgImage: '/assets/dreamwithtech/ads/dashboard-banner-hero.png',
      vector: <POSBillingVector />,
    },
    {
      id: 'inventory-tracking',
      badge: 'INVENTORY',
      headline: 'Real-time stock control.',
      description: 'Automatic stock deduction on every sale with live low-stock warnings and batch tracking.',
      cta: 'Check Stock',
      link: '/inventory/stock',
      bgImage: '/assets/dreamwithtech/ads/ad-billing-speed.png',
      vector: <InventoryVector />,
    },
    {
      id: 'customer-crm',
      badge: 'CUSTOMER CRM',
      headline: 'Keep customer accounts organized.',
      description: 'Track outstanding credit balances, view complete ledger histories, and collect UPI payments.',
      cta: 'View Customers',
      link: '/parties/customers',
      bgImage: '/assets/dreamwithtech/ads/ad-customer-credit.png',
      vector: <CustomerLedgerVector />,
    },
    {
      id: 'business-ecosystem',
      badge: 'CONNECTED ERP',
      headline: 'One unified retail ecosystem.',
      description: 'Catalogue, POS, customer credit, stock deduction, and tax accounting connected in real-time.',
      cta: 'Explore Ecosystem',
      action: () => setEcosystemModalOpen(true),
      bgImage: '/assets/dreamwithtech/ads/ad-business-erp.png',
      vector: <POSBillingVector />,
    },
  ]

  // Auto-advance every 8 seconds, paused on hover
  useEffect(() => {
    if (isPaused || slides.length <= 1) return
    const timer = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % slides.length)
    }, 8000)
    return () => clearInterval(timer)
  }, [isPaused, slides.length])

  const current = slides[activeSlide]

  const handleCta = () => {
    if (current.action) {
      current.action()
    } else if (current.link) {
      navigate(current.link)
    }
  }

  return (
    <>
      <section
        className={`relative overflow-hidden rounded-xl border border-[var(--line)] p-4 sm:p-5 md:px-6 md:py-4.5 min-h-[175px] md:min-h-[195px] max-h-[220px] shadow-xs transition-all duration-300 ${className}`}
        style={{
          backgroundImage: `linear-gradient(to right, rgba(15, 23, 42, 0.96) 0%, rgba(15, 23, 42, 0.90) 42%, rgba(15, 23, 42, 0.52) 75%, rgba(15, 23, 42, 0.22) 100%), url(${current.bgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'right center',
          backgroundRepeat: 'no-repeat',
        }}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        aria-label="Dashboard Feature Highlights"
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 h-full">
          {/* Left: Content & CTA */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-sky-400 bg-sky-500/15 border border-sky-500/30">
                {current.badge}
              </span>
              <span className="text-[11px] text-slate-300 font-medium hidden sm:inline">
                Dreamwithtech Cloud ERP
              </span>
            </div>

            <h2 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-white leading-snug">
              {current.headline}
            </h2>

            <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl line-clamp-2">
              {current.description}
            </p>

            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={handleCta}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:py-2 text-xs font-semibold rounded-lg bg-[#0057B8] hover:bg-[#003F8F] text-white shadow-md transition-colors"
              >
                <span>{current.cta}</span>
                <ArrowRight size={13} strokeWidth={2.5} />
              </button>

              {/* Subtle Slide Indicators */}
              <div className="flex items-center gap-1.5 ml-2" role="tablist" aria-label="Feature slides">
                {slides.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveSlide(idx)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      idx === activeSlide
                        ? 'w-5 bg-sky-400'
                        : 'w-1.5 bg-slate-500 hover:bg-slate-400'
                    }`}
                    role="tab"
                    aria-selected={idx === activeSlide}
                    aria-label={`Slide ${idx + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right: Clean, Lightweight SVG Vector (Hidden on mobile < md for zero clutter) */}
          <div className="hidden md:flex shrink-0 items-center justify-end pl-2">
            {current.vector}
          </div>
        </div>
      </section>

      {/* Ecosystem & Architecture Modal */}
      <EcosystemVisualModal
        isOpen={ecosystemModalOpen}
        onClose={() => setEcosystemModalOpen(false)}
      />
    </>
  )
}

/* -------------------------------------------------------------
   REDESIGNED "QUICK VIDEO GUIDES" COMPONENT
-------------------------------------------------------------- */

export function DashboardVideoGuides({ className = '' }) {
  const [activeVideo, setActiveVideo] = useState(null)

  const guides = [
    {
      id: 'fast-billing',
      title: 'Create Bills in 10 Seconds',
      description: 'Create bills quickly using product search and barcode scanning.',
      duration: '0:10',
      topic: 'Fast Billing',
      poster: '/assets/dreamwithtech/videos/fast-billing.jpg',
      video: '/assets/dreamwithtech/videos/fast-billing.mp4',
    },
    {
      id: 'inventory-control',
      title: 'Stock & Inventory Tracking',
      description: 'Track stock movements, batch expiry, and low-stock alerts.',
      duration: '0:10',
      topic: 'Inventory Management',
      poster: '/assets/dreamwithtech/videos/inventory-control.jpg',
      video: '/assets/dreamwithtech/videos/inventory-control.mp4',
    },
    {
      id: 'overview-guide',
      title: 'ERP Platform Tour',
      description: 'Understand the main dashboard, analytics, and sales workflows.',
      duration: '0:10',
      topic: 'Platform Overview',
      poster: '/assets/dreamwithtech/videos/overview-guide.jpg',
      video: '/assets/dreamwithtech/videos/overview-guide.mp4',
    },
  ]

  return (
    <>
      <section
        className={`rounded-xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden shadow-xs ${className}`}
        aria-labelledby="video-guides-title"
      >
        <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface-elevated)] px-3.5 py-2.5 sm:px-4">
          <div>
            <h2 id="video-guides-title" className="text-sm font-semibold text-[var(--ink)]">
              Quick Video Guides
            </h2>
            <p className="text-[11px] text-[var(--muted)]">
              Learn the essentials in under a minute.
            </p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-[var(--muted)]">
            <Play size={11} className="text-[#0057B8] dark:text-sky-400" />
            3 short tutorials
          </span>
        </div>

        <div className="divide-y divide-[var(--line-subtle)]">
          {guides.map(item => (
            <div
              key={item.id}
              onClick={() => setActiveVideo(item)}
              role="button"
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setActiveVideo(item)
                }
              }}
              className="flex items-center gap-3 sm:gap-4 p-2.5 sm:p-3 w-full text-left hover:bg-[var(--surface-hover)] active:bg-[var(--surface-elevated)] transition-colors cursor-pointer group select-none"
              aria-label={`Watch tutorial: ${item.title}`}
            >
              {/* Compact Video Thumbnail */}
              <div className="relative w-24 sm:w-36 md:w-40 h-16 sm:h-20 shrink-0 rounded-lg overflow-hidden bg-slate-900 border border-[var(--line)]">
                <img
                  src={item.poster}
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
                  onError={e => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-950/70 text-white flex items-center justify-center shadow-xs backdrop-blur-xs group-hover:bg-[#0057B8] group-hover:scale-110 transition-all">
                    <Play size={12} className="fill-white translate-x-0.5" />
                  </div>
                </div>
              </div>

              {/* Title & Description */}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs sm:text-sm font-semibold text-[var(--ink)] truncate group-hover:text-[#0057B8] dark:group-hover:text-sky-400 transition-colors">
                    {item.title}
                  </h3>
                  <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono font-medium rounded bg-[var(--surface-elevated)] border border-[var(--line)] text-[var(--muted)] shrink-0">
                    <Clock size={10} /> {item.duration}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-[var(--muted)] line-clamp-1">
                  {item.description}
                </p>
                <div className="flex sm:hidden items-center gap-2 mt-1">
                  <span className="text-[10px] font-mono font-semibold text-[#0057B8] dark:text-sky-400">
                    ▶ {item.duration}
                  </span>
                </div>
              </div>

              {/* Right Action Arrow */}
              <div className="shrink-0 text-[var(--muted)] group-hover:text-[#0057B8] dark:group-hover:text-sky-400 group-hover:translate-x-0.5 transition-all p-1">
                <ChevronRight size={16} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Video Modal Player */}
      {activeVideo && (
        <VideoPlayerModal
          isOpen={Boolean(activeVideo)}
          onClose={() => setActiveVideo(null)}
          title={activeVideo.title}
          duration={activeVideo.duration}
          topic={activeVideo.topic}
          videoUrl={activeVideo.video}
        />
      )}
    </>
  )
}

/* -------------------------------------------------------------
   REUSABLE SHORT VIDEO CARDS (FOR OTHER PAGES)
-------------------------------------------------------------- */

export function FastBillingVideoCard({ className = '' }) {
  return (
    <ShortVideoCard
      title="Create Bills in 10 Seconds"
      subtitle="Barcodes, continuous thermal receipts & fast payment"
      duration="0:10"
      topic="Fast Billing"
      slotKey="fast-billing"
      className={className}
    />
  )
}

export function InventoryVideoCard({ className = '' }) {
  return (
    <ShortVideoCard
      title="Stock & Inventory Tracking"
      subtitle="Real-time deduction, low-stock alerts & adjustments"
      duration="0:10"
      topic="Inventory"
      slotKey="inventory-control"
      className={className}
    />
  )
}

export function OverviewVideoCard({ className = '' }) {
  return (
    <ShortVideoCard
      title="ERP Platform Tour"
      subtitle="Unified billing, customers, payments & business analytics"
      duration="0:10"
      topic="Overview"
      slotKey="overview-guide"
      className={className}
    />
  )
}

export function WorkflowVideoCard({ className = '' }) {
  return (
    <ShortVideoCard
      title="Complete Business Workflow"
      subtitle="Products, inventory, invoicing, credit & CA reports"
      duration="0:10"
      topic="Workflow"
      slotKey="business-workflow"
      className={className}
    />
  )
}

export function AnalyticsVideoCard({ className = '' }) {
  return (
    <ShortVideoCard
      title="Sales Reports & Margin Analytics"
      subtitle="GSTR-1, GSTR-3B, daily P&L and tax summaries"
      duration="0:10"
      topic="Analytics"
      slotKey="reports-analytics"
      className={className}
    />
  )
}

export function CreditCollectionVideoCard({ className = '' }) {
  return (
    <ShortVideoCard
      title="Track Customer Credit & WhatsApp Reminders"
      subtitle="Collect outstanding balances and send instant payment links"
      duration="0:10"
      topic="Credit Collection"
      slotKey="overview-guide"
      className={className}
    />
  )
}

/* -------------------------------------------------------------
   PROMO BANNER SLIDE (Backwards compatibility)
-------------------------------------------------------------- */

export function PromoBannerSlide({
  imageSrc,
  alt = 'Dreamwithtech ERP',
  badge = 'FEATURED',
  ctaText = 'Open',
  ctaLink = '/billing/new',
  onCtaClick,
  className = '',
}) {
  const navigate = useNavigate()

  const handleClick = e => {
    if (onCtaClick) {
      onCtaClick(e)
    } else if (ctaLink) {
      if (ctaLink.startsWith('http')) {
        window.open(ctaLink, '_blank', 'noopener,noreferrer')
      } else {
        navigate(ctaLink)
      }
    }
  }

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick(e)
        }
      }}
      className={`relative w-full h-36 sm:h-44 md:h-48 rounded-xl overflow-hidden border border-[var(--line)] bg-[var(--surface)] shadow-xs hover:border-[#0057B8]/40 transition cursor-pointer group ${className}`}
      aria-label={`${badge}: ${alt}`}
    >
      <img
        src={imageSrc}
        alt={alt}
        className="w-full h-full object-cover object-center group-hover:scale-101 transition-transform duration-300"
      />
      {badge && (
        <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/95 dark:bg-slate-900/95 text-[#0057B8] dark:text-sky-400 border border-white/40 dark:border-slate-700/50 shadow-xs pointer-events-none">
          {badge}
        </span>
      )}
      {ctaText && (
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#0057B8] text-white shadow-xs pointer-events-none">
          {ctaText}
          <ArrowRight size={12} strokeWidth={2.5} />
        </span>
      )}
    </div>
  )
}

/* -------------------------------------------------------------
   INDIVIDUAL PROMO BANNERS (Backwards compatibility)
-------------------------------------------------------------- */

export function WhatsAppBillingAd({ onCtaClick, className = '' }) {
  return (
    <CompactPromoBanner
      id="ad-whatsapp-billing"
      slotKey="ad-whatsapp"
      assetSrc="/assets/dreamwithtech/ads/ad-customer-credit.png"
      tag="CRM"
      tagVariant="blue"
      title="Send WhatsApp Invoices & Collect UPI Payments"
      description="Automate payment reminders and allow customers to pay via PhonePe, GPay, and Paytm."
      ctaText="View Customers"
      ctaLink="/customers"
      onCtaClick={onCtaClick}
      className={className}
    />
  )
}

export function ThermalPrintingAd({ onCtaClick, className = '' }) {
  return (
    <CompactPromoBanner
      id="ad-thermal-printing"
      slotKey="ad-thermal"
      assetSrc="/assets/dreamwithtech/ads/ad-billing-speed.png"
      tag="POS"
      tagVariant="yellow"
      title="Continuous Thermal Billing (58mm & 80mm)"
      description="Instant receipt printing with dynamic UPI QR codes and continuous auto paper cutoff."
      ctaText="New Bill"
      ctaLink="/billing/new"
      onCtaClick={onCtaClick}
      className={className}
    />
  )
}

export function CloudSyncAd({ onCtaClick, className = '' }) {
  return (
    <CompactPromoBanner
      id="ad-cloud-sync"
      slotKey="ad-cloud"
      assetSrc="/assets/dreamwithtech/ads/ad-business-erp.png"
      tag="ERP"
      tagVariant="blue"
      title="Enterprise Cloud Sync & CA Report Sharing"
      description="Download GSTR-1, GSTR-3B, and P&L statements directly in one click."
      ctaText="View Reports"
      ctaLink="/reports"
      onCtaClick={onCtaClick}
      className={className}
    />
  )
}
