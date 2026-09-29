import { useState, useMemo } from 'react'
import { PageHeader } from '../components/UI'
import {
  HelpCircle,
  Phone,
  Mail,
  MessageCircle,
  Search,
  ChevronDown,
  ChevronUp,
  Keyboard,
  CheckCircle2,
  Server,
  Database,
  Smartphone,
  X,
  ExternalLink,
} from 'lucide-react'

const FAQ_DATA = [
  {
    category: 'Billing & POS',
    items: [
      {
        q: 'How do I create and complete a new sale?',
        a: 'Go to New Bill from the sidebar. Scan or search for products by name, SKU, or barcode. Adjust quantities, select a customer or keep Walk-in, choose the payment method (Cash, UPI, Card, or Credit), and click Complete Sale to print the bill.',
      },
      {
        q: 'How does the dynamic UPI QR payment work?',
        a: 'Select UPI as the payment method. The system generates an on-screen QR code containing the exact invoice total. The customer scans it with any UPI app (GPay, PhonePe, Paytm). Once payment arrives, complete the sale.',
      },
      {
        q: 'Can I apply line-item or bill-level discounts?',
        a: 'Yes. In the cart table, each item has an optional discount percentage field. The system automatically recalculates taxable amounts and GST breakdown in real time.',
      },
      {
        q: 'How are credit sales tracked?',
        a: 'When you select Credit as the payment method for a customer with available credit limit, the sale is recorded and added to their outstanding ledger balance.',
      },
    ],
  },
  {
    category: 'Inventory & Stock',
    items: [
      {
        q: 'When does inventory update automatically?',
        a: 'Stock automatically deducts when a sale invoice is confirmed, and increases when supplier purchases or customer returns are processed. No manual calculations needed.',
      },
      {
        q: 'How do I record physical inventory count adjustments?',
        a: 'Go to Stock or Products, find the product, click "Adjust Stock", and choose whether you want to Add (+), Deduct (-), or Set an exact physical count with reason notes.',
      },
      {
        q: 'What triggers Low Stock and Out of Stock alerts?',
        a: 'When stock reaches or falls below the minimum stock threshold configured on the product, it triggers a Low Stock Alert. When balance is zero or below, it alerts as Out of Stock.',
      },
    ],
  },
  {
    category: 'Reports & Tax',
    items: [
      {
        q: 'How do I generate GST and GSTR-1 tax summaries?',
        a: 'Navigate to Reports → GST Tax Summary. Select your target date range (e.g. This Month) to view slab-wise taxable turnover, CGST, SGST, and total liability, and export to PDF or Excel.',
      },
      {
        q: 'Can I export reports for my CA or accountant?',
        a: 'Yes. Every report (Sales, Products, Profit & Loss, GST, Customer Credit, Expenses) has one-click "Export PDF" and "Export Excel (.xlsx)" buttons at the top right.',
      },
      {
        q: 'How is Profit & Loss calculated?',
        a: 'Profit is computed as Total Sales Revenue minus Cost of Goods Sold (purchase basis) minus operational business expenses recorded in the Expenses module.',
      },
    ],
  },
  {
    category: 'Settings & Printing',
    items: [
      {
        q: 'How do I switch between A4 Tax Invoice and 80mm Thermal Receipt?',
        a: 'Go to Settings → Invoicing & Print. Set Default Bill Format to either Standard GST Tax Invoice (A4) or Thermal POS Receipt (80mm). You can also toggle preview in the Live Bill Preview tab.',
      },
      {
        q: 'How do I update store details, GSTIN, and Bank Account?',
        a: 'In Settings, update your Store Details under Business Profile and your Bank Account / UPI VPA under Banking & UPI QR. Changes reflect immediately on all printed bills.',
      },
    ],
  },
]

const SHORTCUTS = [
  { key: 'Ctrl + Enter', label: 'Complete Sale / Save Bill' },
  { key: 'Ctrl + K', label: 'Focus Product Search Bar' },
  { key: 'F2', label: 'Select Cash Payment' },
  { key: 'F3', label: 'Select UPI QR Payment' },
  { key: 'F4', label: 'Select Card Payment' },
  { key: 'Ctrl + P', label: 'Print Current Bill' },
  { key: 'Esc', label: 'Close Active Modal / Dialog' },
  { key: 'Enter', label: 'Add Highlighted Item to Cart' },
]

export default function Support() {
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [openItems, setOpenItems] = useState({})

  const toggleItem = (catIdx, itemIdx) => {
    const key = `${catIdx}-${itemIdx}`
    setOpenItems(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const filteredFaqs = useMemo(() => {
    const q = search.trim().toLowerCase()
    return FAQ_DATA.filter(
      cat => activeCategory === 'All' || cat.category === activeCategory,
    )
      .map(cat => ({
        ...cat,
        items: cat.items.filter(
          it =>
            !q ||
            it.q.toLowerCase().includes(q) ||
            it.a.toLowerCase().includes(q) ||
            cat.category.toLowerCase().includes(q),
        ),
      }))
      .filter(cat => cat.items.length > 0)
  }, [activeCategory, search])

  return (
    <div className="support-page w-full min-w-0 space-y-6 pb-16 text-[var(--ink)]">
      {/* =====================================================
          PAGE HEADER
      ====================================================== */}
      <PageHeader
        title="Help & Support Desk"
        subtitle="Need help? Contact our technical team, check system status, or browse guides."
      />

      {/* =====================================================
          1. DIRECT CONTACT CARDS (Simple, Formal, Clean)
      ====================================================== */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Phone Support */}
        <a
          href="tel:+919876543210"
          className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm hover:border-indigo-400 hover:shadow-md transition-all group block"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
              <Phone size={18} />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                Phone Support
              </span>
              <p className="mt-1 text-sm font-bold text-[var(--ink)] group-hover:text-indigo-600 transition-colors">
                +91 98765 43210
              </p>
              <span className="text-[11px] text-[var(--muted-light)] mt-0.5 block">
                Mon – Sat • 9:00 AM – 8:00 PM
              </span>
            </div>
          </div>
        </a>

        {/* WhatsApp Desk */}
        <a
          href="https://wa.me/919876543210"
          target="_blank"
          rel="noreferrer"
          className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm hover:border-teal-400 hover:shadow-md transition-all group block"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400">
              <MessageCircle size={18} />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                WhatsApp Desk
              </span>
              <p className="mt-1 text-sm font-bold text-[var(--ink)] group-hover:text-teal-600 transition-colors">
                Instant Chat Assistance
              </p>
              <span className="text-[11px] text-[var(--muted-light)] mt-0.5 block">
                Typical reply in under 15 mins
              </span>
            </div>
          </div>
        </a>

        {/* Email Support */}
        <a
          href="mailto:support@balajistore.com"
          className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm hover:border-blue-400 hover:shadow-md transition-all group block"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <Mail size={18} />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                Email Support
              </span>
              <p className="mt-1 text-sm font-bold text-[var(--ink)] group-hover:text-blue-600 transition-colors truncate">
                support@balajistore.com
              </p>
              <span className="text-[11px] text-[var(--muted-light)] mt-0.5 block">
                Detailed inquiry &amp; invoice issues
              </span>
            </div>
          </div>
        </a>
      </section>

      {/* =====================================================
          2. SYSTEM ENVIRONMENT & DIAGNOSTIC STATUS
      ====================================================== */}
      <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-3 flex items-center gap-2">
          <Server size={14} className="text-indigo-600" />
          System &amp; POS Health Status
        </h3>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
          <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-elevated)] p-3">
            <span className="text-[10px] uppercase font-bold text-[var(--muted-light)]">
              Backend API
            </span>
            <div className="mt-1 flex items-center gap-1.5 font-semibold text-teal-600 dark:text-teal-400">
              <span className="h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
              Connected &amp; Online
            </div>
          </div>

          <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-elevated)] p-3">
            <span className="text-[10px] uppercase font-bold text-[var(--muted-light)]">
              Database Service
            </span>
            <div className="mt-1 flex items-center gap-1.5 font-semibold text-teal-600 dark:text-teal-400">
              <span className="h-2 w-2 rounded-full bg-teal-500" />
              Operational
            </div>
          </div>

          <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-elevated)] p-3">
            <span className="text-[10px] uppercase font-bold text-[var(--muted-light)]">
              Local POS Offline Cache
            </span>
            <div className="mt-1 flex items-center gap-1.5 font-semibold text-[var(--ink)]">
              <CheckCircle2 size={13} className="text-indigo-600" />
              Synchronized
            </div>
          </div>

          <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-elevated)] p-3">
            <span className="text-[10px] uppercase font-bold text-[var(--muted-light)]">
              Billing ERP Build
            </span>
            <p className="mt-1 font-mono font-bold text-[var(--ink)]">
              v2.4 (Enterprise Edition)
            </p>
          </div>
        </div>
      </section>

      {/* =====================================================
          3. POS KEYBOARD SHORTCUTS REFERENCE
      ====================================================== */}
      <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Keyboard size={16} className="text-indigo-600" />
          <h3 className="text-sm font-bold text-[var(--ink)]">
            Billing Workstation Keyboard Shortcuts
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
          {SHORTCUTS.map(sc => (
            <div
              key={sc.key}
              className="flex items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5"
            >
              <span className="text-[11px] text-[var(--muted)] truncate">
                {sc.label}
              </span>
              <kbd className="font-mono text-[10px] font-bold bg-[var(--surface-elevated)] border border-[var(--line)] rounded px-1.5 py-0.5 text-[var(--ink)] shrink-0">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>
      </section>

      {/* =====================================================
          4. FREQUENTLY ASKED QUESTIONS (Simple Accordion)
      ====================================================== */}
      <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--line)] pb-3">
          <div>
            <h3 className="text-sm font-bold text-[var(--ink)]">
              Frequently Asked Questions
            </h3>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Instant guidance on billing, inventory, GST calculations, and settings.
            </p>
          </div>

          {/* Search box */}
          <div className="relative min-w-0 sm:w-72">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search help articles..."
              className="input h-9 w-full pl-9 pr-8 text-xs font-medium"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)]"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1">
          {['All', 'Billing & POS', 'Inventory & Stock', 'Reports & Tax', 'Settings & Printing'].map(
            cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`rounded-lg px-3 py-1.5 font-semibold whitespace-nowrap transition-colors ${
                  activeCategory === cat
                    ? 'bg-indigo-600 text-white'
                    : 'bg-[var(--surface-elevated)] text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                {cat}
              </button>
            ),
          )}
        </div>

        {/* Accordion Questions List */}
        <div className="space-y-2.5 pt-1">
          {filteredFaqs.length === 0 ? (
            <div className="text-center py-8 text-xs text-[var(--muted)]">
              No matching help articles found. Please try a different query or contact support.
            </div>
          ) : (
            filteredFaqs.map((section, catIdx) => (
              <div key={section.category} className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block pt-1">
                  {section.category}
                </span>

                {section.items.map((item, itemIdx) => {
                  const isOpen = Boolean(openItems[`${catIdx}-${itemIdx}`])
                  return (
                    <div
                      key={itemIdx}
                      className="rounded-xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => toggleItem(catIdx, itemIdx)}
                        className="w-full text-left p-3.5 flex items-center justify-between gap-3 hover:bg-[var(--surface-elevated)] transition-colors"
                      >
                        <span className="text-xs sm:text-sm font-semibold text-[var(--ink)]">
                          {item.q}
                        </span>
                        {isOpen ? (
                          <ChevronUp
                            size={16}
                            className="text-indigo-600 shrink-0"
                          />
                        ) : (
                          <ChevronDown
                            size={16}
                            className="text-[var(--muted)] shrink-0"
                          />
                        )}
                      </button>

                      {isOpen && (
                        <div className="px-3.5 pb-3.5 pt-1 text-xs leading-relaxed text-[var(--muted)] border-t border-[var(--line-subtle)] bg-[var(--surface-elevated)]/40">
                          {item.a}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}