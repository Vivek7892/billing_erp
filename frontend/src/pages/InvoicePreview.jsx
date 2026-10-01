import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import {
  Printer,
  Download,
  ArrowLeft,
  FileText,
  Share2,
  ExternalLink,
  RefreshCw,
  Smartphone,
  Monitor,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Copy,
} from 'lucide-react'
import toast from 'react-hot-toast'
import invoiceService from '../features/billing/api/invoiceService'
import { API_BASE_URL } from '../api'

function getPdfUrl(id, thermal) {
  const token = localStorage.getItem('access_token') || ''
  const printer = thermal ? 'thermal' : 'a4'

  return `${API_BASE_URL}/invoices/${id}/pdf/?token=${encodeURIComponent(
    token
  )}&printer=${printer}`
}

function getDirectPdfUrl(id, thermal, download = false) {
  return `${getPdfUrl(id, thermal)}&download=${download ? '1' : '0'}`
}

function isMobileDevice() {
  if (typeof navigator === 'undefined') return false

  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
}

export default function InvoicePreview() {
  const { id } = useParams()
  const navigate = useNavigate()

  const isMobile = isMobileDevice()

  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [publicToken, setPublicToken] = useState('')
  const [thermal, setThermal] = useState(false)
  const [pdfUrl, setPdfUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [showMore, setShowMore] = useState(false)

  // --------------------------------------------------
  // FETCH INVOICE DETAILS
  // --------------------------------------------------

  useEffect(() => {
    if (!id) return

    let active = true

    invoiceService
      .getInvoice(id)
      .then((invoice) => {
        if (active) {
          setInvoiceNumber(invoice?.invoice_number || `#${id}`)
          setPublicToken(invoice?.public_token || '')
        }
      })
      .catch(() => {
        if (active) setInvoiceNumber(`#${id}`)
      })

    return () => {
      active = false
    }
  }, [id])

  const viewDigitalBill = () => {
    const url = `${window.location.origin}/bill/${publicToken || id}`
    window.open(url, '_blank')
  }

  const copyBillLink = () => {
    const url = `${window.location.origin}/bill/${publicToken || id}`
    navigator.clipboard.writeText(url)
    toast.success('Bill link copied to clipboard!')
  }

  // --------------------------------------------------
  // FETCH PDF
  // --------------------------------------------------

  const loadPdf = useCallback(async () => {
    if (!id) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(false)

    // Mobile browsers have inconsistent support for authenticated blob URLs.
    // They open the server PDF directly from the action buttons instead.
    if (isMobile) {
      setPdfUrl('')
      setLoading(false)
      return
    }

    try {
      const token = localStorage.getItem('access_token') || ''

      const response = await invoiceService.getPdf(
        id,
        {
          token,
          printer: thermal ? 'thermal' : 'a4',
        },
        {
          responseType: 'blob',
        }
      )

      const blob = new Blob([response.data], {
        type: 'application/pdf',
      })

      // Validate response content type where possible
      if (blob.size === 0) {
        throw new Error('Empty PDF response')
      }

      const objectUrl = URL.createObjectURL(blob)

      setPdfUrl((previousUrl) => {
        if (previousUrl) {
          URL.revokeObjectURL(previousUrl)
        }

        return objectUrl
      })
    } catch (err) {
      console.error('Invoice PDF loading error:', err)
      setError(true)
      toast.error('Unable to load invoice PDF')
    } finally {
      setLoading(false)
    }
  }, [id, isMobile, thermal])

  useEffect(() => {
    loadPdf()

    return () => {
      // Cleanup is handled when replacing the Blob URL
    }
  }, [loadPdf])

  // --------------------------------------------------
  // OPEN PDF
  // --------------------------------------------------

  const openPdf = useCallback(async () => {
    if (!id) return

    try {
      if (isMobile) {
        const directUrl = getDirectPdfUrl(id, thermal)
        const newWindow = window.open(directUrl, '_blank', 'noopener,noreferrer')

        if (!newWindow) {
          toast.error('Popup blocked. Opening the invoice here instead.')
          window.location.assign(directUrl)
        }
        return
      }

      // Reuse already loaded PDF when available
      if (pdfUrl) {
        const newWindow = window.open('', '_blank')

        if (newWindow) {
          newWindow.location.href = pdfUrl
          return
        }

        // Popup blocked: navigate directly
        window.location.href = pdfUrl
        return
      }

      // Fallback: fetch PDF directly
      const token = localStorage.getItem('access_token') || ''

      const response = await invoiceService.getPdf(
        id,
        {
          token,
          printer: thermal ? 'thermal' : 'a4',
        },
        {
          responseType: 'blob',
        }
      )

      const blob = new Blob([response.data], {
        type: 'application/pdf',
      })

      const url = URL.createObjectURL(blob)

      window.location.href = url
    } catch (err) {
      console.error(err)
      toast.error('Unable to open invoice')
    }
  }, [id, isMobile, thermal, pdfUrl])

  // --------------------------------------------------
  // DOWNLOAD PDF
  // --------------------------------------------------

  const downloadPdf = async () => {
    if (!id || downloading) return

    setDownloading(true)

    try {
      if (isMobile) {
        const directUrl = getDirectPdfUrl(id, thermal, true)
        const anchor = document.createElement('a')
        anchor.href = directUrl
        anchor.target = '_blank'
        anchor.rel = 'noopener'
        anchor.click()
        toast.success('Invoice download started')
        return
      }

      const token = localStorage.getItem('access_token') || ''

      const response = await invoiceService.getPdf(
        id,
        {
          token,
          printer: thermal ? 'thermal' : 'a4',
        },
        {
          responseType: 'blob',
        }
      )

      const blob = new Blob([response.data], {
        type: 'application/pdf',
      })

      const url = URL.createObjectURL(blob)

      const anchor = document.createElement('a')

      anchor.href = url
      anchor.download = `invoice-${invoiceNumber || id}-${
        thermal ? 'thermal' : 'a4'
      }.pdf`

      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)

      setTimeout(() => URL.revokeObjectURL(url), 1000)

      toast.success('Invoice downloaded successfully')
    } catch (err) {
      console.error(err)
      toast.error('Could not download invoice')
    } finally {
      setDownloading(false)
    }
  }

  // --------------------------------------------------
  // SHARE PDF
  // --------------------------------------------------

  const shareInvoice = async () => {
    if (!id || sharing) return

    setSharing(true)

    try {
      const format = thermal ? 'thermal' : 'a4'

      // Share a server URL on mobile so Android Chrome and iOS Safari can
      // hand the PDF to their native viewer/share sheet without a blob URL.
      if (isMobile && navigator.share) {
        const link = await invoiceService.createShortLink(id)
        const sharedUrl = link?.url
          ? `${link.url}?printer=${format}`
          : getDirectPdfUrl(id, thermal)
        await navigator.share({
          title: `Invoice ${invoiceNumber || id}`,
          text: `Invoice ${invoiceNumber || id}`,
          url: sharedUrl,
        })
        return
      }

      const token = localStorage.getItem('access_token') || ''

      const response = await invoiceService.getPdf(
        id,
        {
          token,
          printer: format,
        },
        {
          responseType: 'blob',
        }
      )

      const blob = new Blob([response.data], {
        type: 'application/pdf',
      })

      const file = new File(
        [blob],
        `invoice-${invoiceNumber || id}-${format}.pdf`,
        {
          type: 'application/pdf',
        }
      )

      // Native mobile file sharing
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `Invoice ${invoiceNumber || id}`,
          text: `Invoice ${invoiceNumber || id}`,
          files: [file],
        })

        return
      }

      // Share using invoice short link
      const link = await invoiceService.createShortLink(id)

      const sharedUrl = link?.url
        ? `${link.url}?printer=${format}`
        : getPdfUrl(id, thermal)

      if (navigator.share) {
        await navigator.share({
          title: `Invoice ${invoiceNumber || id}`,
          text: `Invoice ${invoiceNumber || id}`,
          url: sharedUrl,
        })
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(sharedUrl)
        toast.success('Invoice link copied')
      } else {
        toast.error('Sharing is not supported on this browser')
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.error(err)
        toast.error('Could not share invoice')
      }
    } finally {
      setSharing(false)
    }
  }

  // --------------------------------------------------
  // INVALID INVOICE
  // --------------------------------------------------

  if (!id) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface-elevated)] border border-[var(--line)]">
            <FileText size={30} className="text-[var(--muted)]" />
          </div>

          <h2 className="text-xl font-bold text-[var(--ink)]">
            No Invoice Selected
          </h2>

          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Open an invoice from the Bills list or create a new bill to
            continue.
          </p>

          <button
            onClick={() => navigate('/sales/invoices')}
            className="btn-primary mt-6"
          >
            Go to Bills
          </button>
        </div>
      </div>
    )
  }

  // --------------------------------------------------
  // MAIN UI
  // --------------------------------------------------

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-[var(--surface-elevated)]">
      {/* ==========================================
          HEADER
      ========================================== */}

      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="px-3 sm:px-5 lg:px-6 py-3">
          <div className="flex items-center gap-3">
            {/* Back */}
            <button
              onClick={() => navigate(-1)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] text-[var(--muted)] transition hover:bg-[var(--surface-elevated)] hover:text-[var(--ink)]"
              aria-label="Go back"
            >
              <ArrowLeft size={19} />
            </button>

            {/* Title */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm sm:text-base font-bold text-[var(--ink)]">
                  Invoice {invoiceNumber || `#${id}`}
                </h1>

                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <CheckCircle2 size={11} />
                  Invoice
                </span>
              </div>

              <p className="mt-0.5 text-[11px] sm:text-xs text-[var(--muted)]">
                Preview and manage your bill
              </p>
            </div>

            {/* Desktop actions */}
            <div className="hidden lg:flex items-center gap-2">
              <FormatSelector
                thermal={thermal}
                setThermal={setThermal}
              />

              <ActionButton
                icon={<ExternalLink size={15} />}
                label="View Bill"
                onClick={viewDigitalBill}
              />

              <ActionButton
                icon={<Copy size={15} />}
                label="Copy Link"
                onClick={copyBillLink}
              />

              <ActionButton
                icon={<Printer size={15} />}
                label="Open"
                onClick={openPdf}
              />

              <ActionButton
                icon={<Download size={15} />}
                label="Download"
                onClick={downloadPdf}
                loading={downloading}
              />

              <ActionButton
                icon={<Share2 size={15} />}
                label="Share"
                onClick={shareInvoice}
                loading={sharing}
              />
            </div>

            {/* Mobile menu */}
            <div className="relative lg:hidden">
              <button
                onClick={() => setShowMore((value) => !value)}
                className="flex h-10 items-center gap-1 rounded-xl border border-[var(--line)] px-3 text-[var(--ink)]"
              >
                <span className="text-xs font-semibold">Actions</span>
                <ChevronDown size={15} />
              </button>

              {showMore && (
                <>
                  <button
                    aria-label="Close actions"
                    className="fixed inset-0 z-40 h-full w-full cursor-default"
                    onClick={() => setShowMore(false)}
                  />

                  <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-xl">
                    <div className="mb-2 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                        Invoice Format
                      </p>

                      <FormatSelector
                        thermal={thermal}
                        setThermal={setThermal}
                        fullWidth
                      />
                    </div>

                    <div className="h-px bg-[var(--line)]" />

                    <MenuAction
                      icon={<ExternalLink size={16} />}
                      label="View Digital Bill"
                      onClick={() => {
                        setShowMore(false)
                        viewDigitalBill()
                      }}
                    />

                    <MenuAction
                      icon={<Copy size={16} />}
                      label="Copy Bill Link"
                      onClick={() => {
                        setShowMore(false)
                        copyBillLink()
                      }}
                    />

                    <MenuAction
                      icon={<Printer size={16} />}
                      label="Open Invoice"
                      onClick={() => {
                        setShowMore(false)
                        openPdf()
                      }}
                    />

                    <MenuAction
                      icon={<Download size={16} />}
                      label="Download PDF"
                      onClick={() => {
                        setShowMore(false)
                        downloadPdf()
                      }}
                    />

                    <MenuAction
                      icon={<Share2 size={16} />}
                      label="Share Invoice"
                      onClick={() => {
                        setShowMore(false)
                        shareInvoice()
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Mobile quick action bar */}
        <div className="lg:hidden border-t border-[var(--line)] px-3 py-2">
          <div className="grid grid-cols-3 gap-2">
            <QuickAction
              icon={<Printer size={16} />}
              label="Open"
              onClick={openPdf}
            />

            <QuickAction
              icon={<Download size={16} />}
              label="Download"
              onClick={downloadPdf}
              loading={downloading}
            />

            <QuickAction
              icon={<Share2 size={16} />}
              label="Share"
              onClick={shareInvoice}
              loading={sharing}
            />
          </div>
        </div>
      </header>

      {/* ==========================================
          FORMAT INFO
      ========================================== */}

      <div className="border-b border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 sm:px-6">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {thermal ? (
              <Smartphone
                size={15}
                className="shrink-0 text-[var(--muted)]"
              />
            ) : (
              <Monitor
                size={15}
                className="shrink-0 text-[var(--muted)]"
              />
            )}

            <span className="text-xs text-[var(--muted)]">
              {thermal
                ? 'Thermal receipt · 80mm format'
                : 'A4 document · Standard invoice format'}
            </span>
          </div>

          <span className="hidden sm:inline text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-light)]">
            {isMobile ? 'Mobile Preview' : 'Document Preview'}
          </span>
        </div>
      </div>

      {/* ==========================================
          PDF CONTENT
      ========================================== */}

      <main className="relative flex-1 min-h-0">
        {loading ? (
          <LoadingState thermal={thermal} />
        ) : error ? (
          <ErrorState onRetry={loadPdf} />
        ) : isMobile ? (
          <MobilePdfState
            thermal={thermal}
            onOpen={openPdf}
            onDownload={downloadPdf}
            onShare={shareInvoice}
            downloading={downloading}
            sharing={sharing}
          />
        ) : (
          <div className="h-[calc(100vh-11rem)] min-h-[500px] w-full overflow-hidden bg-[var(--surface-elevated)] p-3 sm:p-5 lg:p-6">
            <div className="mx-auto h-full max-w-[1500px] overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-sm">
              <iframe
                src={pdfUrl}
                className="h-full w-full border-0"
                title={`Invoice ${invoiceNumber || id}`}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// ==================================================
// FORMAT SELECTOR
// ==================================================

function FormatSelector({ thermal, setThermal, fullWidth = false }) {
  return (
    <div
      className={`flex items-center rounded-md border border-[var(--line)] bg-[var(--surface-elevated)] p-1 ${
        fullWidth ? 'w-full mt-2' : ''
      }`}
    >
      <button
        onClick={() => setThermal(false)}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
          !thermal
            ? 'bg-indigo-600 text-white shadow-xs'
            : 'text-[var(--muted)] hover:text-[var(--ink)]'
        }`}
      >
        <FileText size={13} />
        A4
      </button>

      <button
        onClick={() => setThermal(true)}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
          thermal
            ? 'bg-indigo-600 text-white shadow-xs'
            : 'text-[var(--muted)] hover:text-[var(--ink)]'
        }`}
      >
        <Smartphone size={13} />
        Thermal
      </button>
    </div>
  )
}

// ==================================================
// ACTION BUTTON
// ==================================================

function ActionButton({ icon, label, onClick, loading = false }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--ink-secondary)] transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
    >
      {loading ? (
        <RefreshCw size={14} className="animate-spin" />
      ) : (
        icon
      )}
      {label}
    </button>
  )
}

// ==================================================
// QUICK ACTION
// ==================================================

function QuickAction({ icon, label, onClick, loading = false }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] text-xs font-semibold text-[var(--ink-secondary)] transition active:scale-[0.98] hover:bg-[var(--surface-elevated)] disabled:opacity-60"
    >
      {loading ? (
        <RefreshCw size={15} className="animate-spin" />
      ) : (
        icon
      )}

      {label}
    </button>
  )
}

// ==================================================
// MENU ACTION
// ==================================================

function MenuAction({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-[var(--ink-secondary)] transition hover:bg-[var(--surface-elevated)]"
    >
      {icon}
      {label}
    </button>
  )
}

// ==================================================
// LOADING STATE
// ==================================================

function LoadingState({ thermal }) {
  return (
    <div className="flex min-h-[500px] items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg border border-[var(--line)] bg-[var(--surface)] p-8 text-center shadow-none">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
          <RefreshCw size={22} className="animate-spin" />
        </div>

        <h3 className="mt-4 text-base font-bold text-[var(--ink)]">
          Preparing your invoice
        </h3>

        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Generating your {thermal ? 'thermal receipt' : 'A4 invoice'}.
          Please wait a moment.
        </p>

        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-elevated)]">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-indigo-600" />
        </div>
      </div>
    </div>
  )
}

// ==================================================
// ERROR STATE
// ==================================================

function ErrorState({ onRetry }) {
  return (
    <div className="flex min-h-[500px] items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg border border-[var(--line)] bg-[var(--surface)] p-8 text-center shadow-none">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
          <AlertCircle size={24} />
        </div>

        <h3 className="mt-4 text-base font-bold text-[var(--ink)]">
          Unable to load invoice
        </h3>

        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          We couldn't retrieve the PDF. Check your connection and try again.
        </p>

        <button
          onClick={onRetry}
          className="btn-primary mt-6 inline-flex items-center gap-2"
        >
          <RefreshCw size={15} />
          Try Again
        </button>
      </div>
    </div>
  )
}

// ==================================================
// MOBILE PDF STATE
// ==================================================

function MobilePdfState({
  thermal,
  onOpen,
  onDownload,
  onShare,
  downloading,
  sharing,
}) {
  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-none">
        {/* Top visual */}
        <div className="flex h-28 items-center justify-center bg-[var(--surface-elevated)] border-b border-[var(--line)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800">
            <FileText size={24} />
          </div>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
              <Smartphone size={12} />
              Mobile PDF Viewer
            </span>

            <h2 className="mt-3 text-lg font-bold text-[var(--ink)]">
              Your invoice is ready
            </h2>

            <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
              Open your {thermal ? 'thermal receipt' : 'A4 invoice'} in
              your phone's PDF viewer to zoom, print, save, or share it.
            </p>
          </div>

          {/* Primary action */}
          <button
            onClick={onOpen}
            className="btn-primary mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-md text-sm font-semibold text-white shadow-none"
          >
            <ExternalLink size={16} />
            Open Invoice
          </button>

          {/* Secondary actions */}
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <button
              onClick={onDownload}
              disabled={downloading}
              className="flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] text-xs font-semibold text-[var(--ink-secondary)] transition hover:bg-[var(--surface-elevated)] disabled:opacity-60"
            >
              {downloading ? (
                <RefreshCw size={15} className="animate-spin" />
              ) : (
                <Download size={15} />
              )}
              Download
            </button>

            <button
              onClick={onShare}
              disabled={sharing}
              className="flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] text-xs font-semibold text-[var(--ink-secondary)] transition hover:bg-[var(--surface-elevated)] disabled:opacity-60"
            >
              {sharing ? (
                <RefreshCw size={15} className="animate-spin" />
              ) : (
                <Share2 size={15} />
              )}
              Share
            </button>
          </div>

          {/* Helpful note */}
          <div className="mt-5 flex gap-2.5 rounded-md bg-[var(--surface-elevated)] p-3 border border-[var(--line-subtle)]">
            <FileText
              size={15}
              className="mt-0.5 shrink-0 text-[var(--muted)]"
            />

            <p className="text-[11px] leading-4 text-[var(--muted)]">
              Your invoice will open in a separate PDF viewer. You can
              use your browser's built-in controls to zoom, save, or
              print the document.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}