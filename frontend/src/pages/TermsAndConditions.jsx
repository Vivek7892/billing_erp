import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  FileText,
  Shield,
  CreditCard,
  Building2,
  Lock,
  RefreshCw,
  Printer,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Scale,
  Receipt,
  Mail,
  MapPin,
  Clock,
  Laptop,
} from 'lucide-react'

export default function TermsAndConditions() {
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState('acceptance')

  const sections = [
    { id: 'acceptance', title: '1. Acceptance of Terms', icon: CheckCircle2 },
    { id: 'license', title: '2. Software License & Permitted Use', icon: Laptop },
    { id: 'accounts', title: '3. User Accounts & Security', icon: Lock },
    { id: 'billing', title: '4. Billing, Invoicing & GST Compliance', icon: Receipt },
    { id: 'payments', title: '5. Payments & Dynamic UPI QR', icon: CreditCard },
    { id: 'data', title: '6. Data Storage & Privacy', icon: Shield },
    { id: 'refunds', title: '7. Subscriptions, Fees & Refunds', icon: RefreshCw },
    { id: 'liability', title: '8. Warranties & Limitation of Liability', icon: Scale },
    { id: 'termination', title: '9. Termination & Account Suspension', icon: FileText },
    { id: 'governing-law', title: '10. Governing Law & Jurisdiction', icon: Building2 },
    { id: 'contact', title: '11. Support & Contact Information', icon: Mail },
  ]

  const scrollTo = (id) => {
    setActiveSection(id)
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--ink)] transition-colors duration-200">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--surface)]/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
              aria-label="Go back"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="ShopEase Logo" className="h-7 w-7 object-contain" />
              <div>
                <span className="text-sm font-bold tracking-tight text-[var(--ink)]">ShopEase POS</span>
                <span className="hidden text-[11px] font-semibold text-[var(--muted)] sm:inline">
                  {' '}· Terms of Service
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] px-3 text-xs font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--line)]/30"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">Print Document</span>
            </button>
            <Link
              to="/login"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1E3A5F] px-3.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#162F4D]"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <section className="border-b border-[var(--line)] bg-[var(--surface)] py-10 sm:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className=" mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)] rounded-full" >
              <Scale size={13} />
              <span>Legal Agreement & Terms of Service</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[var(--ink)] sm:text-4xl">
              Terms &amp; Conditions
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
              Please read these Terms and Conditions carefully before accessing or using ShopEase POS &amp; Billing ERP. These terms govern your use of our point-of-sale software, cloud synchronization, inventory tracking, GST invoice generation, and integrated payment services.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-4 text-xs font-medium text-[var(--muted)]">
              <div className="flex items-center gap-1.5">
                <Clock size={14} className="text-teal-600" />
                <span>Effective Date: <strong>October 11, 2026</strong></span>
              </div>
              <span className="text-[var(--line)]">|</span>
              <div className="flex items-center gap-1.5">
                <span>Version: <strong>1.2 (Production Release)</strong></span>
              </div>
              <span className="text-[var(--line)]">|</span>
              <div className="flex items-center gap-1.5">
                <Building2 size={14} className="text-blue-600" />
                <span>Operator: <strong>Dreamwithtech</strong></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Layout */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          {/* Table of Contents Sticky Sidebar */}
          <aside className="hidden lg:block lg:col-span-1">
            <div className="sticky top-20 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xs">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                Contents
              </h3>
              <nav className="space-y-1">
                {sections.map((sec) => {
                  const Icon = sec.icon
                  const isActive = activeSection === sec.id
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => scrollTo(sec.id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition ${
                        isActive
                          ? 'bg-[#1E3A5F] text-white shadow-xs'
                          : 'text-[var(--muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--ink)]'
                      }`}
                    >
                      <Icon size={14} className={isActive ? 'text-white' : 'text-[var(--muted)]'} />
                      <span className="truncate">{sec.title}</span>
                    </button>
                  )
                })}
              </nav>

              <div className="mt-6 rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-elevated)] p-3 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-[var(--ink)]">
                  <Mail size={13} className="text-[#1E3A5F] dark:text-blue-400" />
                  <span>Questions?</span>
                </div>
                <p className="mt-1 text-[11px] text-[var(--muted)]">
                  Email us at{' '}
                  <a href="mailto:connectwithvvivek@gmail.com" className="font-semibold text-blue-600 hover:underline">
                    connectwithvvivek@gmail.com
                  </a>
                </p>
              </div>
            </div>
          </aside>

          {/* Document Content */}
          <main className="lg:col-span-3 space-y-8">
            {/* 1. Acceptance */}
            <article id="acceptance" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs">
              <div className="flex items-center gap-2.5 border-b border-[var(--line)] pb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg  dark:text-green-300 width-[32px] height-[32px]">
                  <CheckCircle2 size={18} />
                </div>
                <h2 className="text-lg font-bold text-[var(--ink)]">1. Acceptance of Terms</h2>
              </div>
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-[var(--ink)]">
                <p>
                  By accessing, browsing, registering for, downloading, or using the <strong>ShopEase POS &amp; Billing ERP</strong> application (the &ldquo;Service&rdquo; or &ldquo;Software&rdquo;), operated by <strong>ShopEase Retail Technologies</strong> (together with <strong>Sri Balaji Store</strong>, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;), you (&ldquo;User&rdquo;, &ldquo;Merchant&rdquo;, &ldquo;Cashier&rdquo;, or &ldquo;Customer&rdquo;) agree to be legally bound by these Terms and Conditions (&ldquo;Terms&rdquo;).
                </p>
                <p>
                  If you are registering an account or using the Service on behalf of a company, retail establishment, partnership, or other legal entity, you represent and warrant that you have full legal authority to bind that entity to these Terms. If you do not agree to all provisions contained herein, do not use the application or services.
                </p>
              </div>
            </article>

            {/* 2. Software License */}
            <article id="license" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs">
              <div className="flex items-center gap-2.5 border-b border-[var(--line)] pb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg  dark:text-green-300 width-[32px] height-[32px]">
                  <Laptop size={18} />
                </div>
                <h2 className="text-lg font-bold text-[var(--ink)]">2. Software License &amp; Permitted Use</h2>
              </div>
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-[var(--ink)]">
                <p>
                  Subject to your compliance with these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license to access and operate the ShopEase POS software on compatible desktop terminals, tablets, and mobile devices solely for your internal retail and commercial billing management.
                </p>
                <p className="font-semibold text-[var(--ink)]">You agree NOT to:</p>
                <ul className="list-inside list-disc space-y-1.5 pl-2 text-xs sm:text-sm text-[var(--muted)]">
                  <li>Reverse engineer, decompile, disassemble, or attempt to derive source code from any part of the application.</li>
                  <li>Sublicense, lease, resell, distribute, or share login credentials across unauthorized third parties.</li>
                  <li>Use the software to process fraudulent transactions, generate misleading tax invoices, or bypass fiscal obligations.</li>
                  <li>Interfere with the server infrastructure, inject malicious code, or exceed documented API rate limits.</li>
                </ul>
              </div>
            </article>

            {/* 3. User Accounts & Security */}
            <article id="accounts" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs">
              <div className="flex items-center gap-2.5 border-b border-[var(--line)] pb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg  dark:text-green-300 width-[32px] height-[32px]">
                  <Lock size={18} />
                </div>
                <h2 className="text-lg font-bold text-[var(--ink)]">3. User Accounts &amp; Security</h2>
              </div>
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-[var(--ink)]">
                <p>
                  Access to POS terminals is managed via role-based credentials (Admin, Manager, Cashier). You are strictly responsible for maintaining the confidentiality of your username, password, and session tokens.
                </p>
                <p>
                  Any action performed under your credentials will be deemed to have been executed by you or authorized personnel. You agree to notify our support team immediately at <a href="mailto:connectwithvvivek@gmail.com" className="font-semibold text-blue-600 hover:underline">connectwithvvivek@gmail.com</a> upon discovering any unauthorized login or security breach.
                </p>
              </div>
            </article>

            {/* 4. Billing, Invoicing & GST Compliance */}
            <article id="billing" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs">
              <div className="flex items-center gap-2.5 border-b border-[var(--line)] pb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg  dark:text-green-300 width-[32px] height-[32px]">
                  <Receipt size={18} />
                </div>
                <h2 className="text-lg font-bold text-[var(--ink)]">4. Billing, Invoicing &amp; GST Compliance</h2>
              </div>
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-[var(--ink)]">
                <p>
                  ShopEase POS provides automated invoice generation, HSN/SAC code tracking, tax calculation (CGST, SGST, IGST), and thermal and A4 print templates.
                </p>
                <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 ">
                  <strong>Important Notice:</strong> While the system assists in computing statutory taxes based on your entered rates and HSN classifications, the Merchant remains solely liable for ensuring tax compliance, filing accurate GST returns, and maintaining statutory books of accounts under the Goods and Services Tax Act and applicable local regulations.
                </div>
              </div>
            </article>

            {/* 5. Payments & Dynamic UPI QR */}
            <article id="payments" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs">
              <div className="flex items-center gap-2.5 border-b border-[var(--line)] pb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg  dark:text-green-300 width-[32px] height-[32px]">
                  <CreditCard size={18} />
                </div>
                <h2 className="text-lg font-bold text-[var(--ink)]">5. Payments &amp; Dynamic UPI QR Integration</h2>
              </div>
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-[var(--ink)]">
                <p>
                  The platform supports dynamic on-screen UPI QR code generation (NPCI specifications), static tabletop counter standee exports, Cash ledger recording, and optional Razorpay payment gateway integration.
                </p>
                <p>
                  UPI payments scanned by customers transfer funds directly to the merchant&apos;s linked Virtual Payment Address (VPA / UPI ID) through your banking provider. We do not intermediate or hold funds in escrow for direct UPI QR transactions. For gateway transactions (Razorpay), settlement schedules and chargeback terms are governed by Razorpay&apos;s merchant service agreements.
                </p>
              </div>
            </article>

            {/* 6. Data Storage & Privacy */}
            <article id="data" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs">
              <div className="flex items-center gap-2.5 border-b border-[var(--line)] pb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg  dark:text-green-300 width-[32px] height-[32px]">
                  <Shield size={18} />
                </div>
                <h2 className="text-lg font-bold text-[var(--ink)]">6. Data Storage, Backups &amp; Privacy</h2>
              </div>
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-[var(--ink)]">
                <p>
                  Customer records, catalog details, transaction histories, and audit trails are persisted securely in backend databases with local browser caching to support low-latency offline terminal operation.
                </p>
                <p>
                  We treat all merchant sales information, customer phone numbers, and pricing policies as confidential business data. We will never sell or monetize your transaction data to third-party advertisers. Please refer to our Privacy Policy for details regarding our data collection and protection practices.
                </p>
              </div>
            </article>

            {/* 7. Subscriptions & Refunds */}
            <article id="refunds" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs">
              <div className="flex items-center gap-2.5 border-b border-[var(--line)] pb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg  dark:text-green-300 width-[32px] height-[32px]">
                  <RefreshCw size={18} />
                </div>
                <h2 className="text-lg font-bold text-[var(--ink)]">7. Subscriptions, Fees &amp; Refund Policy</h2>
              </div>
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-[var(--ink)]">
                <p>
                  Software licenses and cloud synchronization tiers are billed on a monthly, quarterly, or annual subscription basis. All fees are exclusive of applicable taxes unless explicitly stated otherwise.
                </p>
                <p>
                  Subscription fees paid for cloud ERP hosting, database backups, and software licensing are non-refundable after activation. In case of duplicate charges or platform billing errors, merchants may request a review within 7 business days by submitting proof of payment to our billing desk.
                </p>
              </div>
            </article>

            {/* 8. Warranties & Limitation of Liability */}
            <article id="liability" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs">
              <div className="flex items-center gap-2.5 border-b border-[var(--line)] pb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg  dark:text-green-300 width-[32px] height-[32px]">
                  <Scale size={18} />
                </div>
                <h2 className="text-lg font-bold text-[var(--ink)]">8. Warranties &amp; Limitation of Liability</h2>
              </div>
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-[var(--ink)]">
                <p>
                  The Service is provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis without warranties of any kind, whether express or implied. While we strive for 99.9% uptime, we do not guarantee uninterrupted, error-free, or zero-latency operation during local internet outages or third-party bank server downtimes.
                </p>
                <p>
                  To the maximum extent permitted by applicable law, in no event shall ShopEase Retail Technologies, its founders, or affiliates be liable for any indirect, incidental, punitive, or consequential damages, including loss of business profits, lost revenue, stock discrepancy damages, or data loss arising from the use or inability to use the Software.
                </p>
              </div>
            </article>

            {/* 9. Termination */}
            <article id="termination" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs">
              <div className="flex items-center gap-2.5 border-b border-[var(--line)] pb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg  dark:text-green-300 width-[32px] height-[32px]">
                  <FileText size={18} />
                </div>
                <h2 className="text-lg font-bold text-[var(--ink)]">9. Termination &amp; Account Suspension</h2>
              </div>
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-[var(--ink)]">
                <p>
                  We reserve the right to suspend or terminate access to your account immediately, without prior notice or liability, if you breach any term of this Agreement or engage in unauthorized system misuse.
                </p>
                <p>
                  Upon termination, your right to access the cloud services ceases. Merchants may request a structured CSV or JSON export of their historical sales and product data within 14 days following account termination.
                </p>
              </div>
            </article>

            {/* 10. Governing Law */}
            <article id="governing-law" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs">
              <div className="flex items-center gap-2.5 border-b border-[var(--line)] pb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg  dark:text-green-300 width-[32px] height-[32px]">
                  <Building2 size={18} />
                </div>
                <h2 className="text-lg font-bold text-[var(--ink)]">10. Governing Law &amp; Jurisdiction</h2>
              </div>
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-[var(--ink)]">
                <p>
                  These Terms shall be governed by, interpreted, and construed in accordance with the substantive laws of India, without regard to conflict of law principles.
                </p>
                <p>
                  Any dispute, controversy, or claim arising out of or relating to these Terms or the breach, termination, or invalidity thereof shall be subject to the exclusive jurisdiction of the competent courts situated in <strong>Chennai, Tamil Nadu, India</strong>.
                </p>
              </div>
            </article>

            {/* 11. Support & Contact */}
            <article id="contact" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs">
              <div className="flex items-center gap-2.5 border-b border-[var(--line)] pb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg  dark:text-green-300 width-[32px] height-[32px]">
                  <Mail size={18} />
                </div>
                <h2 className="text-lg font-bold text-[var(--ink)]">11. Support &amp; Contact Information</h2>
              </div>
              <div className="mt-4 space-y-4 text-sm text-[var(--ink)]">
                <p>
                  For questions regarding these Terms, enterprise licensing agreements, technical inquiries, or billing support, please reach out to us:
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
                  <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] p-3.5">
                    <span className="font-bold uppercase tracking-wider text-[var(--muted)]">Operator Name</span>
                    <p className="mt-1 font-semibold text-[var(--ink)]">Dreamwithtech</p>
                  </div>
                  <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] p-3.5">
                    <span className="font-bold uppercase tracking-wider text-[var(--muted)]">Email Support Desk</span>
                    <p className="mt-1 font-semibold text-[var(--ink)]">
                      <a href="mailto:connectwithvvivek@gmail.com" className="text-blue-600 hover:underline">
                        connectwithvvivek@gmail.com
                      </a>
                    </p>
                  </div>
                  
                </div>
              </div>
            </article>

            {/* Footer Bottom Link Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-xs text-[var(--muted)]">
              <div>
                © {new Date().getFullYear()} ShopEase POS &amp; Billing ERP. All rights reserved.
              </div>
              <div className="flex items-center gap-4">
                <Link to="/login" className="font-bold text-[#1E3A5F] dark:text-blue-400 hover:underline">
                  Return to Sign In
                </Link>
                <span>·</span>
                <Link to="/" className="font-bold text-[#1E3A5F] dark:text-blue-400 hover:underline">
                  Open POS Dashboard
                </Link>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}