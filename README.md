# Dreamwithtech Billing ERP — Modern Enterprise Billing, Inventory & POS Platform

A production-grade Enterprise Resource Planning (ERP) and Point of Sale (POS) system built with **Django REST Framework** + **React + Vite + Tailwind CSS**.

---

## ⚡ Quick Start

### 1. Start Backend
```bash
start_backend.bat
```
Or manually:
```bash
cd backend
python manage.py runserver
```
Backend runs at: `http://localhost:8000`

### 2. Start Frontend
```bash
start_frontend.bat
```
Or manually:
```bash
cd frontend
npm run dev
```
Frontend runs at: `http://localhost:3000`

---

## 🔑 Default Login Credentials

| Role    | Username | Password    |
|---------|----------|-------------|
| Admin   | admin    | admin123    |
| Cashier | cashier  | cashier123  |
| Manager | manager  | manager123  |

---

## 🧹 Database Reset & Demo Seeding

### Reset All Products, Bills & Reports Data (Keeping Users & Profile Settings)
To cleanly wipe all products, batches, bills, purchases, inventory transactions, ledgers, and reports data **without losing Users, Business Profiles, or App Settings**:
```bash
cd backend
python manage.py reset_data
```
> [!NOTE]
> This command preserves all `User` login accounts, `Business` profile identity, and `Setting` key-value pairs (including thermal printing configurations).

### Seed Full Comprehensive Demo Data
```bash
cd backend
python manage.py seed_data
```
*(Add `--clean` to wipe previous demo records before seeding).*

---

## 🎨 Visual-Content, Promotional Ads & Video System

Dreamwithtech Billing ERP includes a clean, compact visual-content system with dedicated, reusable slots for:
- **Promotional Ads / Feature Banners** (16:5 or 3:1 ratio on desktop, compact cards on mobile)
- **Short Video Guide Cards** (small thumbnail cards with play button, opening a compact modal player)
- **Informational Tips & Shortcuts** (compact banners with keyboard shortcuts like F2/F4)
- **Minimal Vector Illustrations** (lightweight section accents with brand palette)

### Brand Palette & Design Tokens
- **Primary Blue:** `#0057B8`
- **Primary Dark:** `#003F8F`
- **Accent Cyan:** `#16A9D8`
- **Accent Yellow:** `#FFE500`
- **Background:** `#F5F6F8`
- **Surface:** `#FFFFFF` (Dark: `#0F172A`)
- **Card Corners:** `20px` – `26px` (Default: `22px`)
- **Spacing:** `20px` vertical rhythm

---

## 📸 How to Upload Custom Images, Banners & Videos

You can easily replace the built-in SVG vector artwork with your own custom images, GIFs, and videos. Simply drop your files into the corresponding public directories—the application automatically detects them with zero code modifications!

### 1. Promotional Banners
Located in:
📁 **`frontend/public/assets/dreamwithtech/ads/`**

| Filename | Resolution | Where it appears & Content |
|---|---|---|
| `dashboard-banner-hero.png` | `3168 x 1344` (~21:9) | Dashboard top carousel (Flagship Hero: POS setup, thermal receipt, barcode scanner) |
| `ad-billing-speed.png` | `2752 x 1536` (16:9) | Dashboard top carousel & POS ("Create Bills in Seconds. Bill Faster. Serve Better.") |
| `ad-customer-credit.png` | `2752 x 1536` (16:9) | Dashboard top carousel & Customers ("Keep Every Customer Relationship Organized.") |
| `ad-business-erp.png` | `2752 x 1536` (16:9) | Dashboard top carousel & Reports ("Streamline Your Business with Dreamwithtech ERP") |

---

### 2. Video Tutorials & Thumbnail Posters (10s HD MP4s)
Located in:
📁 **`frontend/public/assets/dreamwithtech/videos/`**

| Video File (`.mp4`) | Poster Thumbnail (`.jpg`) | Tutorial Topic & Workflow |
|---|---|---|
| `fast-billing.mp4` | `fast-billing.jpg` | POS fast billing, barcode scanning & continuous receipt |
| `inventory-control.mp4` | `inventory-control.jpg` | Live stock deduction, alerts & adjustments |
| `overview-guide.mp4` | `overview-guide.jpg` | Unified dashboard, module tour & navigation |
| `business-workflow.mp4` | `business-workflow.jpg` | End-to-end sales, inventory & payment lifecycle |
| `reports-analytics.mp4` | `reports-analytics.jpg` | GSTR-1, GSTR-3B tax reports & profit analytics |

---

### 3. General Page Visuals & Illustrations
Located in:
📁 **`frontend/public/assets/dreamwithtech/illustrations/`** & **`frontend/public/assets/dreamwithtech/`**

| Filename | Purpose |
|---|---|
| `login-illustration.png` | Right column artwork for split-screen login page |
| `invoice-empty.(svg\|png)` | Bills page empty state illustration |
| `customer-empty.(svg\|png)` | Customers directory empty state |
| `purchase-empty.(svg\|png)` | Purchases list empty state |

---

## 🖨️ Thermal Printing & Bill Receipt System

The ERP includes native support for high-speed continuous thermal receipts:
- **Paper Widths:** `58mm` and `80mm` continuous paper.
- **Dynamic Content Height:** `@page { size: 58mm auto; margin: 0; }` / `@page { size: 80mm auto; margin: 0; }` with zero cutoffs.
- **Dynamic UPI QR Code:** Generates scannable UPI intent strings (`upi://pay?pa=...&pn=...&am=...&cu=INR`).
- **Configurable Header & Footer:** Business GSTIN, FSSAI, Phone, Address, customizable return terms.

---

## 📱 Content Hierarchy Rules
The interface follows a strict content hierarchy:
$$\text{ERP functionality} \longrightarrow \text{Important business info} \longrightarrow \text{Small promotional banner (16:5 / 3:1)} \longrightarrow \text{Optional video / illustration}$$

- **Dashboard:**
  1. Store Header & Action Controls (New Bill, Reports, Refresh)
  2. Promotional Banner Carousel (Below store name, above Business Insights)
  3. Business Insights Snapshot (Sales, Collections, Profit, Receivables)
  4. Attention Required & Quick Actions
  5. 7-Day Sales Performance & Today's Collection Charts
  6. Recent Transactions Table
  7. Top Products & Low Stock Alerts
  8. Short Video Guide & Billing Pro Tips
