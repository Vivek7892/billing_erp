import { useEffect } from 'react'
import { X, Play, Volume2, ShieldCheck, CheckCircle } from 'lucide-react'
import './VisualContent.css'

export default function VideoPlayerModal({
  isOpen,
  onClose,
  title = 'ERP Video Tutorial',
  duration = '1:00',
  videoUrl,
  topic = 'Dreamwithtech Fast Billing Walkthrough',
}) {
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = e => {
      if (e.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="dwt-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="video-modal-title"
    >
      <div
        className="dwt-modal-card"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="dwt-modal-header">
          <div className="flex items-center gap-2">
            <span className="dwt-badge-ad">VIDEO</span>
            <h4 id="video-modal-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {title}
            </h4>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="dwt-modal-close"
            aria-label="Close video player"
          >
            <X size={16} />
          </button>
        </div>

        {/* Video Player Box */}
        <div className="relative aspect-video w-full bg-slate-950 flex flex-col items-center justify-center overflow-hidden">
          {videoUrl ? (
            <video
              src={videoUrl}
              controls
              autoPlay
              className="w-full h-full object-contain"
            />
          ) : (
            /* Interactive Simulation Player if no raw mp4 provided */
            <div className="relative w-full h-full flex flex-col items-center justify-center p-6 text-center select-none bg-gradient-to-br from-[#003F8F] via-[#0057B8] to-[#16A9D8]">
              {/* Animated circles */}
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
              
              <div className="relative z-10 flex flex-col items-center max-w-sm">
                <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white mb-3 shadow-lg border border-white/30 dwt-pulse-glow">
                  <Play size={24} className="fill-white translate-x-0.5" />
                </div>
                <span className="text-xs uppercase tracking-wider font-semibold text-sky-200 mb-1">
                  {topic}
                </span>
                <h5 className="text-base font-bold text-white mb-2 leading-tight">
                  {title}
                </h5>
                <p className="text-xs text-sky-100/90 leading-relaxed">
                  Fast, accurate billing and inventory control for modern retail & wholesale businesses.
                </p>
                <div className="mt-4 flex items-center gap-3 text-[11px] text-white/80 font-mono">
                  <span className="bg-white/10 px-2 py-0.5 rounded">Duration: {duration}</span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck size={12} className="text-emerald-300" /> 1080p HD
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Dreamwithtech Billing ERP Guide Series</span>
          <span className="font-semibold text-[#0057B8] dark:text-sky-400">
            Need help? Contact Support
          </span>
        </div>
      </div>
    </div>
  )
}

