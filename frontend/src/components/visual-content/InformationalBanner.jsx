import { useState } from 'react'
import {
  IconInfoCircle,
  IconSparkles,
  IconX,
  IconArrowRight,
} from '@tabler/icons-react'
import './VisualContent.css'

export default function InformationalBanner({
  icon = IconSparkles,
  tip = 'Pro Tip: Press F2 anytime on the billing screen to immediately search and add items.',
  actionText = '',
  onActionClick,
  dismissable = true,
  className = '',
}) {
  const [dismissed, setDismissed] = useState(false)
  const IconComponent = icon

  if (dismissed) return null

  return (
    <aside
      className={`dwt-info-banner ${className}`}
      role="status"
      aria-label="Information banner"
    >
      <div className="dwt-info-banner-content">
        <span className="dwt-info-icon-badge" aria-hidden="true">
          <IconComponent size={14} />
        </span>
        <p className="m-0 leading-normal">{tip}</p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {actionText && (
          <button
            type="button"
            onClick={onActionClick}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#0057B8] dark:text-sky-400 hover:underline"
          >
            <span>{actionText}</span>
            <IconArrowRight size={12} />
          </button>
        )}

        {dismissable && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1"
            aria-label="Dismiss banner"
          >
            <IconX size={14} />
          </button>
        )}
      </div>
    </aside>
  )
}

