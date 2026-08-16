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
- Mixed payment (Cash + UPI + Card + Credit)
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
