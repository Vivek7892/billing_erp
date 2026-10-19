# Dreamwithtech Billing ERP — Visual-Content & Promotional System

This directory provides a **clean, compact visual-content system** for Dreamwithtech Billing ERP. It offers dedicated, reusable spaces for promotional ads, short videos, product illustrations, and informational banners—keeping them small, simple, and non-intrusive.

---

## 🎨 Brand Design Tokens
- **Primary Blue:** `#0057B8`
- **Primary Dark:** `#003F8F`
- **Accent Cyan:** `#16A9D8`
- **Accent Yellow:** `#FFE500`
- **Background:** `#F5F6F8`
- **Card Surface:** `#FFFFFF` (Dark: `#0F172A`)
- **Corners:** `20px` – `26px` (Default: `22px`)
- **Spacing:** `20px` vertical rhythm
- **Shadows:** Subtle 2px–14px elevation

---

## 📐 Layout & Hierarchy Rules
1. **ERP functionality first** → KPI cards & quick actions.
2. **Important business information** → charts, recent sales, collection.
3. **Small promotional banner / carousel** → placed **between** functional sections (around 16:5 or 3:1 ratio on desktop, compact horizontal cards on mobile). Never placed above main ERP actions.
4. **Short Video cards** → small thumbnail cards with play buttons, not full-screen video players. Clicking opens a compact modal player.
5. **Single visual element per section** → avoid competing banners.

---

## 📁 Custom Media Upload Directories
Drop custom images, GIFs, or videos into the following public directories:

### 1. Promotional Banners (16:5 or 3:1 Ratio)
**Directory:** `frontend/public/assets/dreamwithtech/ads/`
- `ad-whatsapp.(png|webp|jpg|svg)`
- `ad-thermal.(png|webp|jpg|svg)`
- `ad-cloud.(png|webp|jpg|svg)`
- `<slotKey>.(png|webp|jpg|svg)`

### 2. Video Thumbnails & Videos (16:9 Ratio)
**Directory:** `frontend/public/assets/dreamwithtech/videos/`
- `video-fast-billing.(webp|png|jpg)`
- `video-credit-collection.(webp|png|jpg)`
- `<slotKey>.(webp|png|jpg)`

---

## 🧩 Components Overview

### `<CompactPromoBanner />`
Compact horizontal banner with "Ad", "Promo", or "New" badge, title, 1-line description, CTA button, and optional illustration or uploaded asset.

```jsx
import { CompactPromoBanner } from '../components/visual-content'

<CompactPromoBanner
  tag="AD"
  title="Send Instant WhatsApp Invoices & Collect UPI Payments"
  description="Automate payment reminders and allow customers to pay via PhonePe, GPay, and Paytm."
  ctaText="Learn More"
  slotKey="ad-whatsapp"
/>
```

### `<ShortVideoCard />`
Small thumbnail card with play button overlay, duration pill, and compact video player popup.

```jsx
import { ShortVideoCard } from '../components/visual-content'

<ShortVideoCard
  title="How to create your first bill in 30 seconds"
  duration="0:45"
  badge="Watch"
  topic="Quick Guide"
  slotKey="video-fast-billing"
/>
```

### `<VisualContentCarousel />`
Horizontal slide carousel with gentle autoplay, pause-on-hover, touch/swipe navigation, and dot indicators.

```jsx
import { VisualContentCarousel, WhatsAppBillingAd, ThermalPrintingAd } from '../components/visual-content'

<VisualContentCarousel
  items={[<WhatsAppBillingAd key="wa" />, <ThermalPrintingAd key="thermal" />]}
  autoplayInterval={7500}
/>
```

### `<InformationalBanner />`
Compact non-intrusive tip strip with left accent border for shortcuts, GST notices, or pro tips.

```jsx
import { InformationalBanner } from '../components/visual-content'

<InformationalBanner
  tip="Pro Tip: Press F2 anytime on the billing screen to immediately search and add items."
/>
```

