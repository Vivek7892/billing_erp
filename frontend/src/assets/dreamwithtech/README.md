# Dreamwithtech Billing ERP — Visual Asset Upload Guide

You can easily drop your custom visual assets into this directory or into `frontend/public/assets/dreamwithtech/`.

The application will **automatically detect and display your uploaded images/GIFs**. If an image is not yet uploaded, it seamlessly falls back to the high-precision vector SVG illustration & CSS animation adhering to the official **Dreamwithtech** brand guidelines.

---

### Official Brand Palette
- **Primary Blue:** `#0057B8`
- **Primary Dark:** `#003F8F`
- **Accent Cyan:** `#16A9D8`
- **Accent Yellow:** `#FFE500`
- **Background:** `#F5F6F8`
- **Surface:** `#FFFFFF`
- **Text Primary:** `#111111`
- **Text Secondary:** `#555555`
- **Text Muted:** `#888888`
- **Success Green:** `#10B981`

---

### Image File Slots & Placements

| Slot Filename | Recommended Format | Ratio / Dimensions | Placement in App |
| :--- | :--- | :--- | :--- |
| `login-illustration.png` | PNG / WebP | Split-screen (portrait/square) | **Login page** (right visual side) |
| `dashboard-hero.png` | PNG / WebP | 16:9 widescreen (~1920×1080) | **Dashboard** top hero section |
| `complete-business-flow.png` | PNG / GIF / WebP | Banner (~1600×500) | **Dashboard** middle section |
| `business-ecosystem.png` | PNG / WebP | 16:9 widescreen (~1920×1080) | **Dashboard** bottom ecosystem section |
| `billing-workflow.png` | PNG / GIF / WebP | Compact card (~800×450) | **New Bill** page / empty cart |
| `payment-completed.png` | PNG / GIF / WebP | Square/card (~600×600) | **New Bill** payment completed modal |
| `credit-collected.png` | PNG / GIF / WebP | Card (~800×450) | **Customers** credit collection section |
| `inventory-workflow.png` | PNG / GIF / WebP | Card (~800×450) | **Stock / Inventory** page |
| `reports-analytics.png` | PNG / GIF / WebP | Card (~800×450) | **Reports / Analytics** page |
| `invoice-empty.png` | PNG / SVG / WebP | Icon/illustration (~400×400) | **Bills** empty state |
| `customer-empty.png` | PNG / SVG / WebP | Icon/illustration (~400×400) | **Customers** empty state |
| `purchase-empty.png` | PNG / SVG / WebP | Icon/illustration (~400×400) | **Purchases** empty state |

> **Tip:** You can upload `.png`, `.webp`, `.jpg`, `.svg`, or `.gif` files into `frontend/public/assets/dreamwithtech/` and the components will immediately render them with zero code modifications needed.

