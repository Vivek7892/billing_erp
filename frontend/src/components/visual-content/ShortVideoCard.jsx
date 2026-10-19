import { useState } from 'react'
import { Play } from 'lucide-react'
import VideoPlayerModal from './VideoPlayerModal'
import './VisualContent.css'

export default function ShortVideoCard({
  title = 'How to create your first bill in 30 seconds',
  subtitle = 'POS Billing Tutorial',
  duration = '0:10',
  topic = 'Quick Guide',
  slotKey = 'fast-billing',
  posterUrl,
  videoUrl,
  className = '',
}) {
  const [modalOpen, setModalOpen] = useState(false)

  // Normalize slotKey (strip leading 'video-' if present)
  const cleanKey = String(slotKey || '').replace(/^video-/, '') || 'fast-billing'
  const resolvedPoster = posterUrl || `/assets/dreamwithtech/videos/${cleanKey}.jpg`
  const resolvedVideo = videoUrl || `/assets/dreamwithtech/videos/${cleanKey}.mp4`

  return (
    <>
      <div
        className={`dwt-simple-video-card group ${className}`}
        onClick={() => setModalOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setModalOpen(true)
          }
        }}
        aria-label={`Play tutorial: ${title}`}
      >
        {/* Video Thumbnail */}
        <div className="relative aspect-video w-full bg-slate-900 overflow-hidden">
          <img
            src={resolvedPoster}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
            onError={e => {
              // Hide broken image if any
              e.currentTarget.style.display = 'none'
            }}
          />

          {/* Minimalist circular play button */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-10 h-10 rounded-full bg-slate-950/70 text-white flex items-center justify-center shadow-md backdrop-blur-xs group-hover:bg-[#0057B8] group-hover:scale-110 transition-all duration-200">
              <Play size={16} className="fill-white translate-x-0.5" />
            </div>
          </div>

          {/* Clean duration tag */}
          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 text-[10px] font-mono font-medium rounded bg-black/75 text-white backdrop-blur-xs pointer-events-none">
            {duration}
          </span>
        </div>

        {/* Minimalist text container - no extra color or heavy details */}
        <div className="p-3 flex flex-col gap-0.5">
          <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-1 group-hover:text-[#0057B8] dark:group-hover:text-sky-400 transition-colors">
            {title}
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
            {subtitle || topic}
          </p>
        </div>
      </div>

      <VideoPlayerModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={title}
        duration={duration}
        topic={topic}
        videoUrl={resolvedVideo}
      />
    </>
  )
}
