import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import currentBanner from '../assets/dashboard-banner-v2.png'
import inventoryBanner from '../assets/dashboard-banners/inventory.png'
import billingBanner from '../assets/dashboard-banners/billing.png'
import reportsBanner from '../assets/dashboard-banners/reports.png'
import paymentsBanner from '../assets/dashboard-banners/payments.png'
import './DashboardBanner.css'

const slides = [
  {
    image: currentBanner,
    eyebrow: 'DREAMWITHTECH ERP',
    title: 'Your business, at a glance',
    description: 'Sales, stock, and payments together in one clear view.',
  },
  {
    image: inventoryBanner,
    eyebrow: 'INVENTORY CONTROL',
    title: 'Stay ahead of stock',
    description: 'Track inventory and spot low-stock items sooner.',
  },
  {
    image: billingBanner,
    eyebrow: 'FAST, CLEAR BILLING',
    title: 'Bill faster. Serve better.',
    description: 'Create, print, and share professional GST-ready invoices.',
  },
  {
    image: reportsBanner,
    eyebrow: 'SALES INSIGHTS',
    title: 'Make every sale count',
    description: 'Understand sales trends with clear business reports.',
  },
  {
    image: paymentsBanner,
    eyebrow: 'PAYMENTS OVERVIEW',
    title: 'Keep payments in view',
    description: 'Follow collections and outstanding balances at a glance.',
  },
]

export default function DashboardBannerCarousel() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const slide = slides[activeIndex]

  useEffect(() => {
    if (
      paused ||
      slides.length < 2 ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) return undefined

    const timer = window.setInterval(() => {
      setActiveIndex(index => (index + 1) % slides.length)
    }, 7000)

    return () => window.clearInterval(timer)
  }, [paused])

  const showPrevious = () => {
    setActiveIndex(index => (index - 1 + slides.length) % slides.length)
  }
  const showNext = () => {
    setActiveIndex(index => (index + 1) % slides.length)
  }

  return (
    <section
      className="dashboard-welcome-banner"
      aria-label="Dreamwithtech ERP promotions"
      aria-roledescription="carousel"
      style={{ backgroundImage: `url("${slide.image}")` }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false)
      }}
    >
      <div
        className="dashboard-welcome-copy"
        role="group"
        aria-roledescription="slide"
        aria-label={`${activeIndex + 1} of ${slides.length}`}
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="dashboard-welcome-eyebrow">{slide.eyebrow}</span>
        <h2>{slide.title}</h2>
        <p>{slide.description}</p>
      </div>

      <button
        type="button"
        className="dashboard-banner-arrow dashboard-banner-previous"
        onClick={showPrevious}
        aria-label="Show previous banner"
      >
        <ChevronLeft size={19} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="dashboard-banner-arrow dashboard-banner-next"
        onClick={showNext}
        aria-label="Show next banner"
      >
        <ChevronRight size={19} aria-hidden="true" />
      </button>

      <div className="dashboard-banner-pagination" aria-label={`Slide ${activeIndex + 1} of ${slides.length}`}>
        {slides.map((item, index) => (
          <button
            key={item.eyebrow}
            type="button"
            className={`dashboard-banner-dot${index === activeIndex ? ' is-active' : ''}`}
            onClick={() => setActiveIndex(index)}
            aria-label={`Show banner ${index + 1}: ${item.title}`}
            aria-current={index === activeIndex ? 'true' : undefined}
          />
        ))}
      </div>
    </section>
  )
}
