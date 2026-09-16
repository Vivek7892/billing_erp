# ShopEase POS — Retail Billing & Inventory Management System

A full-stack POS system built with **Django REST Framework** + **React + Vite + Tailwind CSS**.

---

## Quick Start

### 1. Start Backend
```
start_backend.bat
```
Or manually:
```bash
cd backend
python manage.py runserver
```
Backend runs at: http://localhost:8000

### 2. Start Frontend
```
start_frontend.bat
```
Or manually:
```bash
cd frontend
npm run dev
```
Frontend runs at: http://localhost:3000

---

## Default Login Credentials

| Role    | Username | Password    |
|---------|----------|-------------|
| Admin   | admin    | admin123    |
| Cashier | cashier  | cashier123  |

---

## Features

### Dashboard
- Today's sales, bills, profit
- Low stock alerts
- Sales charts (7-day, monthly)
- Top products, payment distribution
- Recent bills

### New Bill / POS
- Fast product search (name, SKU, barcode)
- Keyboard-friendly (Enter to add product)
- Cart with qty, discount, GST per item
- Customer selection / walk-in
- Mixed payment (Cash + UPI + Card + Credit + **PhonePe**)
- Auto invoice numbering
- Save, Print (PDF), New Bill

### Bills
- Full invoice history
- Date filters (Today, Yesterday, Week, Month)
- View, Download PDF, Cancel, Refund
- Stock auto-restored on cancel/refund

### Products
- Full CRUD with category, supplier, GST
- Stock status indicators
- Search and filter

### Inventory
- Current stock view
- Stock adjustment (in/out/damaged/returned)
- Full transaction history

### Purchases
- Purchase orders with multiple items
- Auto stock increase on save
- Supplier management

### Customers
- Customer profiles
- Credit/outstanding tracking
- Purchase history

### Reports (Admin only)
- Sales report with daily chart
- Product sales report
- Profit report (revenue vs cost)
- GST report by rate
- Customer credit report
- Payment method report

### Users (Admin only)
- Admin and Cashier roles
- Role-based access control

### Settings (Admin only)
- Shop info, GSTIN
- Invoice prefix and numbering
- Tax, currency, printer settings

---

## Tech Stack

**Backend:** Django 4.2, Django REST Framework, SimpleJWT, ReportLab (PDF), SQLite

**Frontend:** React 18, Vite, Tailwind CSS v4, Recharts, React Router, Axios, React Hot Toast, Lucide Icons

---

## Database

SQLite (default). For production, switch to PostgreSQL in `backend/core/settings.py`.

---

## Re-seed Demo Data

```bash
cd backend
python manage.py seed_data
```

Adds 33 products, 10 customers, 4 suppliers, 10 categories, 15 sample invoices.

---

## PhonePe Payment Gateway Setup

### 1. Get Credentials
- **Sandbox/UAT**: Use the public test credentials (already in `.env.example`).
- **Production**: Register at [PhonePe Business](https://business.phonepe.com/) and get your `Merchant ID`, `Salt Key`, and `Salt Index`.

### 2. Configure Backend Environment

Copy `backend/.env.example` to `backend/.env` and fill in:

```env
# Sandbox testing
PHONEPE_ENV=UAT
PHONEPE_MERCHANT_ID=PGTESTPAYUAT
PHONEPE_SALT_KEY=099eb0cd-02cf-4dc2-a4c3-df3f7d11b3b4
PHONEPE_SALT_INDEX=1

# IMPORTANT: Set to your deployed frontend URL (Vercel URL in production)
FRONTEND_URL=https://your-app.vercel.app
```

For production:
```env
PHONEPE_ENV=PRODUCTION
PHONEPE_MERCHANT_ID=<your-merchant-id>
PHONEPE_SALT_KEY=<your-salt-key>
PHONEPE_SALT_INDEX=<your-salt-index>
FRONTEND_URL=https://your-app.vercel.app
```

### 3. Run Migration

```bash
cd backend
python manage.py migrate
```

### 4. PhonePe Billing Flow

```
1. Add items to cart
2. Select PhonePe as payment method
3. Click "Save Bill" → bill saved with status=pending
4. PhonePe modal opens automatically
5. Click "Pay with PhonePe" → redirected to PhonePe checkout
6. Customer completes payment on PhonePe
7. PhonePe redirects to /billing/phonepe-callback
8. Backend verifies payment with PhonePe API
9. On success: invoice marked PAID, Payment record created
10. Receipt/invoice available for print/download
```

### 5. New API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payments/phonepe/initiate/` | Create PhonePe payment, returns `payment_url` |
| POST | `/api/payments/phonepe/verify/` | Verify payment status with PhonePe, marks invoice PAID |
| POST | `/api/payments/phonepe/webhook/` | S2S callback from PhonePe (register in merchant dashboard) |

### 6. Security Notes

- PhonePe credentials are **never** exposed to the frontend.
- The bill amount is always taken from the **saved invoice** on the backend — the frontend cannot modify it.
- A bill is only marked `PAID` after the backend calls PhonePe's status API and confirms `COMPLETED`.
- Duplicate payment protection: if an `initiated`/`pending` transaction already exists for an invoice, the same `payment_url` is returned.
- Amount mismatch between PhonePe response and our record causes the transaction to be marked `failed`.
- All PhonePe operations are idempotent — safe to retry.

### 7. Deployment (Vercel Frontend)

Set `FRONTEND_URL` in your backend environment to your Vercel deployment URL:
```
FRONTEND_URL=https://your-app.vercel.app
```

PhonePe will redirect to `{FRONTEND_URL}/billing/phonepe-callback?txn=<id>` after payment.
