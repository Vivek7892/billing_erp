import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import './VisualContent.css'

export default function VisualContentCarousel({
  items = [],
  autoplayInterval = 7000,
  className = '',
  ariaLabel = 'Promotions and Quick Guides',
}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const touchStartX = useRef(null)

  useEffect(() => {
    if (isPaused || items.length <= 1) return

    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % items.length)
    }, autoplayInterval)

    return () => clearInterval(timer)
  }, [isPaused, items.length, autoplayInterval])

  if (!items || items.length === 0) return null

  const handlePrev = () => {
    setCurrentIndex(prev => (prev - 1 + items.length) % items.length)
  }

  const handleNext = () => {
    setCurrentIndex(prev => (prev + 1) % items.length)
  }

  const handleTouchStart = e => {
    touchStartX.current = e.touches[0].clientX
    setIsPaused(true)
  }

  const handleTouchEnd = e => {
    if (touchStartX.current === null) return
    const touchEndX = e.changedTouches[0].clientX
    const diff = touchEndX - touchStartX.current
    if (diff > 45) {
      handlePrev()
    } else if (diff < -45) {
      handleNext()
    }
    touchStartX.current = null
    setIsPaused(false)
  }

  return (
    <section
      className={`dwt-carousel-wrapper ${className}`}
      aria-label={ariaLabel}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={e => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setIsPaused(false)
        }
      }}
    >
      <div className="dwt-carousel-container">
        <div
          className="dwt-carousel-track"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {items.map((item, idx) => (
            <div
              key={idx}
              className="dwt-carousel-slide"
              aria-hidden={idx !== currentIndex}
            >
              {item}
            </div>
          ))}
        </div>

        {/* Previous / Next buttons (only if > 1 item) */}
        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              className="dwt-carousel-nav-btn prev"
              aria-label="Previous slide"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="dwt-carousel-nav-btn next"
              aria-label="Next slide"
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}
      </div>

      {/* Dots Indicator */}
      {items.length > 1 && (
        <div className="dwt-carousel-dots" role="tablist" aria-label="Slide indicators">
          {items.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              className={`dwt-carousel-dot ${idx === currentIndex ? 'active' : ''}`}
              role="tab"
              aria-selected={idx === currentIndex}
              aria-label={`Slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  )
}

