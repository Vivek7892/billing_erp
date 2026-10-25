import { useEffect, useState } from 'react'
import {
  IconChevronLeft,
  IconChevronRight,
  IconPackage,
  IconReceipt,
  IconChartBar,
  IconCreditCard,
  IconLayoutDashboard,
} from '@tabler/icons-react'

import currentBanner from '../assets/dashboard-banner-v2.webp'
import inventoryBanner from '../assets/dashboard-banners/inventory.webp'
import billingBanner from '../assets/dashboard-banners/billing.webp'
import reportsBanner from '../assets/dashboard-banners/reports.webp'
import paymentsBanner from '../assets/dashboard-banners/payments.webp'

import './DashboardBanner.css'

const slides = [
  {
    image: currentBanner,
    icon: IconLayoutDashboard,
    eyebrow: 'OVERVIEW',
    title: 'Your business, at a glance',
    description: 'Sales, stock, payments and business activity in one place.',
  },
  {
    image: inventoryBanner,
    icon: IconPackage,
    eyebrow: 'INVENTORY',
    title: 'Stay ahead of stock',
    description: 'Monitor stock levels and act before products run out.',
  },
  {
    image: billingBanner,
    icon: IconReceipt,
    eyebrow: 'BILLING',
    title: 'Bill faster. Serve better.',
    description: 'Create and print GST-ready invoices with fewer steps.',
  },
  {
    image: reportsBanner,
    icon: IconChartBar,
    eyebrow: 'REPORTS',
    title: 'Understand your sales',
    description: 'Track trends, performance and business results clearly.',
  },
  {
    image: paymentsBanner,
    icon: IconCreditCard,
    eyebrow: 'PAYMENTS',
    title: 'Keep collections in view',
    description: 'Monitor received payments and outstanding balances.',
  },
]

export default function DashboardBannerCarousel({ className = '' } = {}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [dragStartX, setDragStartX] = useState(null)

  const slide = slides[activeIndex]
  const Icon = slide.icon

  useEffect(() => {
    if (
      paused ||
      slides.length < 2 ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return undefined
    }

    const timer = window.setInterval(() => {
      setActiveIndex(index => (index + 1) % slides.length)
    }, 8000)

    return () => window.clearInterval(timer)
  }, [paused])

  const showPrevious = () => {
    setActiveIndex(index => (index - 1 + slides.length) % slides.length)
  }

  const showNext = () => {
    setActiveIndex(index => (index + 1) % slides.length)
  }

  const handlePointerDown = event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    setDragStartX(event.clientX)
    setPaused(true)
  }

  const handlePointerUp = event => {
    if (dragStartX === null) return

    const distance = event.clientX - dragStartX
    if (Math.abs(distance) >= 45) {
      if (distance < 0) showNext()
      else showPrevious()
    }

    setDragStartX(null)
    setPaused(false)
  }

  const handlePointerCancel = () => {
    setDragStartX(null)
    setPaused(false)
  }

  return (
    <section
      className={`dashboard-welcome-banner ${className}`.trim()}
      aria-label="ERP dashboard highlights"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setPaused(false)
        }
      }}
    >
      {/* Background image */}
      <div
        className="dashboard-banner-background"
        style={{
          backgroundImage: `url("${slide.image}")`,
        }}
        aria-hidden="true"
      />

      {/* Readability overlay */}
      <div
        className="dashboard-banner-overlay"
        aria-hidden="true"
      />

      {/* Content */}
      <div
        className="dashboard-welcome-copy"
        role="group"
        aria-roledescription="slide"
        aria-label={`${activeIndex + 1} of ${slides.length}`}
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="dashboard-banner-label">
          <span className="dashboard-banner-icon">
            <Icon size={15} aria-hidden="true" />
          </span>

          <span className="dashboard-welcome-eyebrow">
            {slide.eyebrow}
          </span>
        </div>

        <h2>{slide.title}</h2>

        <p>{slide.description}</p>
      </div>

      {/* Navigation */}
      <div className="dashboard-banner-navigation">
        <button
          type="button"
          className="dashboard-banner-arrow dashboard-banner-previous"
          onClick={showPrevious}
          aria-label="Show previous banner"
        >
          <IconChevronLeft size={17} aria-hidden="true" />
        </button>

        <button
          type="button"
          className="dashboard-banner-arrow dashboard-banner-next"
          onClick={showNext}
          aria-label="Show next banner"
        >
          <IconChevronRight size={17} aria-hidden="true" />
        </button>
      </div>

      {/* Pagination */}
      <div
        className="dashboard-banner-pagination"
        aria-label={`Slide ${activeIndex + 1} of ${slides.length}`}
      >
        {slides.map((item, index) => (
          <button
            key={item.eyebrow}
            type="button"
            className={`dashboard-banner-dot${
              index === activeIndex ? ' is-active' : ''
            }`}
            onClick={() => setActiveIndex(index)}
            aria-label={`Show banner ${index + 1}: ${item.title}`}
            aria-current={
              index === activeIndex ? 'true' : undefined
            }
          />
        ))}
      </div>
    </section>
  )
}
