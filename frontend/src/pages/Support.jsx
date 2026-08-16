import { useMemo, useState } from 'react'
import { PageHeader } from '../components/UI'
import {
  ChevronDown,
  ChevronUp,
  HelpCircle,
  MessageCircle,
  Phone,
  Mail,
  BookOpen,
  ShoppingCart,
  Package,
  FileText,
  Settings,
  Search,
  ExternalLink,
  Clock3,
  ShieldCheck,
  X,
} from 'lucide-react'

const faqs = [
  {
    category: 'Billing & POS',
    icon: ShoppingCart,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    items: [
      { q: 'How do I create a new bill?', a: 'Go to New Bill from the sidebar. Search for a product by name, SKU, or barcode. Press Enter or click to add it to the cart. Select a customer or leave it as Walk-in, choose a payment method, enter the amount, and click Save Bill.' },
      { q: 'Can I apply a discount on a product?', a: 'Yes. In the cart table, each item has a discount field. Enter the discount percentage directly in the row. The total recalculates automatically.' },
      { q: 'How do I print or download an invoice?', a: 'After saving a bill, use Print for the A4 invoice or Thermal for the thermal receipt. You can also open Bills, find the invoice, and download or print it from there.' },
      { q: 'What is the UPI QR payment option?', a: 'Select UPI as the payment method and choose Generate QR. The customer can scan the QR code using a UPI app. After payment is confirmed, mark the bill as paid.' },
      { q: 'How do I handle credit sales?', a: 'Select Credit as the payment method. The outstanding amount is recorded against the customer and can be tracked from the Customers page.' },
    ],
  },
  {
    category: 'Products & Inventory',
    icon: Package,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    items: [
      { q: 'How do I add a new product?', a: 'Go to Products → Add Product. Fill in the name, SKU, category, purchase price, selling price, GST%, and opening stock, then click Save.' },
      { q: 'How is stock updated automatically?', a: 'Stock decreases automatically when a bill is saved and is restored when a bill is cancelled or refunded. Stock increases when a purchase is saved.' },
      { q: 'How do I adjust stock manually?', a: 'Go to Inventory → Stock Adjustment. Select the product, enter the quantity, choose the adjustment type, and save the change.' },
      { q: 'What does Low Stock Alert mean?', a: 'When current stock reaches or falls below the product Minimum Stock value, the product appears in the Low Stock section and is flagged in the Products list.' },
    ],
  },
  {
    category: 'Bills & Reports',
    icon: FileText,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    items: [
      { q: 'How do I cancel or refund a bill?', a: 'Go to Bills, find the invoice, and choose Cancel or Refund. Stock is automatically restored for the items included in the bill.' },
      { q: 'How do I filter bills by date?', a: 'Use the quick date filters such as Today, Yesterday, This Week, and This Month, or select a custom date range.' },
      { q: 'How do I view sales and profit reports?', a: 'Go to Reports as an Admin. Select Sales, Products, Profit, GST, Customer Credit, or Payments, set the date range, and apply the filter. Available reports can also be exported.' },
      { q: 'Why can’t I see the Reports menu?', a: 'Reports, Users, and Settings are Admin-only sections. Cashier accounts do not see these menu items.' },
    ],
  },
  {
    category: 'Settings & Configuration',
    icon: Settings,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    items: [
      { q: 'How do I update my shop name and logo?', a: 'Go to Settings → Shop Info. Update the shop name, address, GSTIN, and logo. These details are used throughout the application and printed invoices.' },
      { q: 'How do I change the invoice prefix or number?', a: 'Go to Settings → Invoice and configure the invoice prefix and starting number. New invoices will follow the configured format.' },
      { q: 'How do I add a new user or cashier?', a: 'Go to Users as an Admin and select Add User. Enter the username, password, and role. The new user can then sign in.' },
      { q: 'How do I configure UPI for QR payments?', a: 'Open Settings and enter the shop UPI ID. This ID is used when generating UPI QR payments on the New Bill page.' },
    ],
  },
]

const shortcuts = [
  ['Ctrl + K', 'Search product'],
  ['Enter', 'Add to cart'],
  ['Ctrl + Enter', 'Save bill'],
  ['F2', 'Cash payment'],
  ['F3', 'UPI payment'],
  ['F4', 'Card payment'],
  ['Ctrl + P', 'Print bill'],
  ['Esc', 'Close modal'],
]

function FAQItem({ q, a, searchTerm }) {
  const [open, setOpen] = useState(false)

  const highlight = (value) => {
    if (!searchTerm.trim()) return value

    const parts = value.split(new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
    return parts.map((part, index) =>
      part.toLowerCase() === searchTerm.toLowerCase()
        ? <mark key={index} className="rounded bg-yellow-100 px-0.5 text-yellow-900">{part}</mark>
        : part
    )
  }

  return (
    <div className={`overflow-hidden rounded-xl border transition-all ${open ? 'border-blue-200 shadow-sm' : 'border-gray-200'}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
        className="flex w-full items-center justify-between gap-4 bg-white px-4 py-3.5 text-left transition hover:bg-gray-50"
      >
        <span className="text-sm font-medium leading-5 text-gray-800">{highlight(q)}</span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-50">
          {open
            ? <ChevronUp size={16} className="text-blue-600" />
            : <ChevronDown size={16} className="text-gray-400" />}
        </span>
      </button>

      {open && (
        <div className="border-t border-gray-100 bg-gray-50/80 px-4 py-3.5 text-sm leading-6 text-gray-600">
          {highlight(a)}
        </div>
      )}
    </div>
  )
}

export default function Support() {
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  const visibleFaqs = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()

    return faqs
      .filter(section => activeCategory === 'all' || section.category === activeCategory)
      .map(section => ({
        ...section,
        items: section.items.filter(item =>
          !query ||
          section.category.toLowerCase().includes(query) ||
          item.q.toLowerCase().includes(query) ||
          item.a.toLowerCase().includes(query)
        ),
      }))
      .filter(section => section.items.length > 0)
  }, [activeCategory, searchTerm])

  const totalQuestions = faqs.reduce((total, section) => total + section.items.length, 0)

  return (
    <div className="min-h-full space-y-5 pb-8">
      <PageHeader
        title="Help & Support"
        subtitle="Find quick answers, billing guidance, and support contact details."
      />

      {/* Hero / Search */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 p-5 text-white shadow-sm sm:p-7">
        <div className="max-w-3xl">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
            <ShieldCheck size={14} />
            {totalQuestions}+ helpful answers
          </div>
          <h2 className="text-xl font-bold sm:text-2xl">How can we help?</h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-blue-100">
            Search billing, inventory, invoices, reports, payments, and settings.
          </p>

          <div className="relative mt-5 max-w-2xl">
            <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Search your question..."
              aria-label="Search help articles"
              className="w-full rounded-xl border border-white/20 bg-white py-3 pl-11 pr-11 text-sm text-gray-800 outline-none ring-0 placeholder:text-gray-400 focus:border-white focus:ring-2 focus:ring-white/30"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X size={17} />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Contact cards */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <a
          href="mailto:dreamwithtech.dev@gmail.com"
          className="group rounded-xl border border-gray-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-sm"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Mail size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-gray-800">Email Support</div>
                <ExternalLink size={13} className="text-gray-300 group-hover:text-blue-500" />
              </div>
              <div className="mt-1 break-all text-xs text-gray-500">dreamwithtech.dev@gmail.com</div>
              <div className="mt-2 flex items-center gap-1 text-[11px] text-gray-400">
                <Clock3 size={12} /> Response within 24 hours
              </div>
            </div>
          </div>
        </a>

        <a
          href="https://wa.me/917892409872"
          target="_blank"
          rel="noreferrer"
          className="group rounded-xl border border-gray-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-sm"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <MessageCircle size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-gray-800">WhatsApp Support</div>
                <ExternalLink size={13} className="text-gray-300 group-hover:text-emerald-500" />
              </div>
              <div className="mt-1 text-xs text-gray-500">+91 7892409872</div>
              <div className="mt-2 text-[11px] text-gray-400">Mon–Sat · 9 AM – 6 PM</div>
            </div>
          </div>
        </a>

        <a
          href="tel:+917892409872"
          className="group rounded-xl border border-gray-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-sm"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
              <Phone size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-gray-800">Call Support</div>
                <ExternalLink size={13} className="text-gray-300 group-hover:text-orange-500" />
              </div>
              <div className="mt-1 text-xs text-gray-500">+91 7892409872</div>
              <div className="mt-2 text-[11px] text-gray-400">Direct phone assistance</div>
            </div>
          </div>
        </a>
      </section>

      {/* FAQ */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <HelpCircle size={18} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Frequently Asked Questions</h2>
              <p className="mt-0.5 text-xs text-gray-500">
                {searchTerm ? `${visibleFaqs.reduce((n, section) => n + section.items.length, 0)} matching questions` : 'Select a category or search for an answer.'}
              </p>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition ${
                activeCategory === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All
            </button>

            {faqs.map(section => (
              <button
                key={section.category}
                type="button"
                onClick={() => setActiveCategory(section.category)}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition ${
                  activeCategory === section.category
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {section.category}
              </button>
            ))}
          </div>

          {visibleFaqs.length > 0 ? (
            <div className="space-y-5">
              {visibleFaqs.map(section => (
                <div key={section.category}>
                  <div className={`mb-3 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 ${section.bg}`}>
                    <section.icon size={14} className={section.color} />
                    <span className={`text-xs font-semibold ${section.color}`}>{section.category}</span>
                  </div>

                  <div className="space-y-2">
                    {section.items.map((item, index) => (
                      <FAQItem
                        key={`${section.category}-${index}`}
                        q={item.q}
                        a={item.a}
                        searchTerm={searchTerm}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-5 py-10 text-center">
              <Search size={24} className="mx-auto text-gray-300" />
              <h3 className="mt-3 text-sm font-semibold text-gray-800">No results found</h3>
              <p className="mt-1 text-xs text-gray-500">Try a different keyword or clear the search.</p>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('')
                  setActiveCategory('all')
                }}
                className="mt-4 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Keyboard shortcuts */}
      <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
            <BookOpen size={17} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-blue-900">Keyboard Shortcuts</h3>
            <p className="mt-0.5 text-xs text-blue-700/70">Speed up common billing actions.</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {shortcuts.map(([key, description]) => (
            <div key={key} className="rounded-xl border border-blue-100 bg-white p-2.5">
              <kbd className="block truncate rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-center text-[11px] font-mono font-semibold text-gray-700">
                {key}
              </kbd>
              <span className="mt-1.5 block truncate text-center text-[11px] text-gray-500">{description}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Developer footer */}
      <div className="flex flex-col items-center justify-between gap-2 border-t border-gray-200 pt-4 text-xs text-gray-400 sm:flex-row">
        <span>Need more help? Contact the support team.</span>
        <a
          href="https://vivekv.me/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-indigo-500 hover:text-indigo-600 hover:underline"
        >
          Developed by Vivek V <ExternalLink size={12} />
        </a>
      </div>
    </div>
  )
}