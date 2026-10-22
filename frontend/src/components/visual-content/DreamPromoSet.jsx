import { useState, useEffect } from 'react'
import {
  IconChevronRight,
  IconPlayerPlay,
  IconClock,
  IconX,
  IconLayersLinked,
  IconRoute,
  IconDeviceDesktop,
} from '@tabler/icons-react'
import VideoPlayerModal from './VideoPlayerModal'
import {
  CompleteBusinessFlowVisual,
  BusinessEcosystemVisual,
  DashboardHeroVisual,
} from '../visuals'

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
              <IconRoute size={18} />
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
            <IconX size={18} />
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
            <IconRoute size={14} />
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
            <IconLayersLinked size={14} />
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
            <IconDeviceDesktop size={14} />
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
            <IconPlayerPlay size={11} className="text-[#0057B8] dark:text-sky-400" />
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
                    <IconPlayerPlay size={12} className="fill-white translate-x-0.5" />
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
                    <IconClock size={10} /> {item.duration}
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
                <IconChevronRight size={16} />
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
