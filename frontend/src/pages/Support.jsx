import { useMemo, useState } from 'react'
import { PageHeader } from '../components/UI'
import {
  IconPhone,
  IconMail,
  IconMessageCircle,
  IconSearch,
  IconChevronDown,
  IconChevronUp,
  IconKeyboard,
  IconCircleCheck,
  IconServer,
  IconX,
} from '@tabler/icons-react'

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

  const toggleItem = (category, question) => {
    const key = `${category}-${question}`

    setOpenItems(prev => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const filteredFaqs = useMemo(() => {
    const query = search.trim().toLowerCase()

    return FAQ_DATA
      .filter(
        section =>
          activeCategory === 'All' ||
          section.category === activeCategory,
      )
      .map(section => ({
        ...section,
        items: section.items.filter(
          item =>
            !query ||
            item.q.toLowerCase().includes(query) ||
            item.a.toLowerCase().includes(query) ||
            section.category.toLowerCase().includes(query),
        ),
      }))
      .filter(section => section.items.length > 0)
  }, [activeCategory, search])

  const categories = [
    'All',
    'Billing & POS',
    'Inventory & Stock',
    'Reports & Tax',
    'Settings & Printing',
  ]

  return (
    <div className="w-full min-w-0 pb-12 text-[var(--ink)]">
      <PageHeader
        title="Help & Support"
        subtitle="Get assistance, check system status, or find answers to common questions."
      />

      {/* Contact */}
      <section className="mt-6 grid grid-cols-1 divide-y divide-[var(--line)] rounded-lg border border-[var(--line)] bg-[var(--surface)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <a
          href="tel:+917892409872"
          className="flex items-center gap-3 p-4 transition-colors hover:bg-[var(--surface-elevated)]"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--surface-elevated)]">
            <IconPhone size={16} />
          </div>

          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--muted)]">
              Phone Support
            </p>
            <p className="mt-0.5 text-sm font-semibold">
              +91 78924 09872
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--muted-light)]">
              Mon – Sat · 9:00 AM – 8:00 PM
            </p>
          </div>
        </a>

        <a
          href="https://wa.me/917892409872"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 p-4 transition-colors hover:bg-[var(--surface-elevated)]"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--surface-elevated)]">
            <IconMessageCircle size={16} />
          </div>

          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--muted)]">
              WhatsApp
            </p>
            <p className="mt-0.5 text-sm font-semibold">
              Instant Chat Assistance
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--muted-light)]">
              Typical reply in under 15 mins
            </p>
          </div>
        </a>

        <a
          href="mailto:connectwithvvivek@gmail.com"
          className="flex items-center gap-3 p-4 transition-colors hover:bg-[var(--surface-elevated)]"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--surface-elevated)]">
            <IconMail size={16} />
          </div>

          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--muted)]">
              Email Support
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold">
              connectwithvvivek@gmail.com
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--muted-light)]">
              Detailed inquiry & invoice issues
            </p>
          </div>
        </a>
      </section>

     

      {/* Keyboard shortcuts */}
      <section className="mt-6 border-b border-[var(--line)] pb-6">
        <div className="mb-4 flex items-center gap-2">
          <IconKeyboard size={15} />
          <h2 className="text-sm font-semibold">
            Keyboard Shortcuts
          </h2>
        </div>

        <div className="overflow-hidden rounded-lg border border-[var(--line)]">
          <div className="grid grid-cols-1 divide-y divide-[var(--line)] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
            {SHORTCUTS.map((shortcut, index) => (
              <div
                key={shortcut.key}
                className={`
                  flex items-center justify-between gap-3 px-3 py-2.5
                  ${index >= 2 ? 'lg:border-t lg:border-[var(--line)]' : ''}
                `}
              >
                <span className="truncate text-xs text-[var(--muted)]">
                  {shortcut.label}
                </span>

                <kbd className="shrink-0 rounded border border-[var(--line)] bg-[var(--surface-elevated)] px-1.5 py-0.5 font-mono text-[10px] font-semibold">
                  {shortcut.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-6">
        <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-base font-semibold">
              Frequently Asked Questions
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Find quick answers about billing, inventory, GST, reports,
              and settings.
            </p>
          </div>

          <div className="flex h-9 w-full items-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 lg:w-72">
            <IconSearch
              size={14}
              className="shrink-0 text-[var(--muted)]"
            />

            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search questions..."
              className="min-w-0 flex-1 bg-transparent px-2 text-xs outline-none placeholder:text-[var(--placeholder)]"
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-[var(--muted)] hover:text-[var(--ink)]"
                aria-label="Clear search"
              >
                <IconX size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Categories */}
        <div className="mt-4 flex gap-5 overflow-x-auto border-b border-[var(--line)]">
          {categories.map(category => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`
                relative shrink-0 pb-2.5 text-xs font-medium transition-colors
                ${
                  activeCategory === category
                    ? 'text-[#1E3A5F]'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }
              `}
            >
              {category}

              {activeCategory === category && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#1E3A5F]" />
              )}
            </button>
          ))}
        </div>

        {/* Questions */}
        <div className="mt-4">
          {filteredFaqs.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--muted)]">
              No matching help articles found.
            </div>
          ) : (
            filteredFaqs.map(section => (
              <div key={section.category} className="mb-6">
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  {section.category}
                </h3>

                <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
                  {section.items.map(item => {
                    const key = `${section.category}-${item.q}`
                    const isOpen = Boolean(openItems[key])

                    return (
                      <div key={item.q}>
                        <button
                          type="button"
                          onClick={() =>
                            toggleItem(section.category, item.q)
                          }
                          className="flex w-full items-center justify-between gap-4 py-3.5 text-left transition-colors hover:text-[#1E3A5F]"
                        >
                          <span className="text-sm font-medium">
                            {item.q}
                          </span>

                          {isOpen ? (
                            <IconChevronUp
                              size={16}
                              className="shrink-0 text-[var(--muted)]"
                            />
                          ) : (
                            <IconChevronDown
                              size={16}
                              className="shrink-0 text-[var(--muted)]"
                            />
                          )}
                        </button>

                        {isOpen && (
                          <div className="pb-4 pr-8 text-xs leading-6 text-[var(--muted)]">
                            {item.a}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

function StatusItem({ label, value, status = false }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-light)]">
        {label}
      </p>

      <div className="mt-1 flex items-center gap-1.5 text-sm font-medium">
        {status && (
          <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
        )}

        {value}
      </div>
    </div>
  )
}