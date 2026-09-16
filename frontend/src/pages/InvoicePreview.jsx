import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Printer, Download, ArrowLeft, FileText, Share2 } from 'lucide-react'
import toast from 'react-hot-toast'
import invoiceService from '../features/billing/api/invoiceService'
import { API_BASE_URL } from '../api'

function getPdfUrl(id, thermal) {
  const token = localStorage.getItem('access_token') || ''
  const printer = thermal ? 'thermal' : 'a4'
  return `${API_BASE_URL}/invoices/${id}/pdf/?token=${token}&printer=${printer}`
}

export default function InvoicePreview() {
  const { id } = useParams()
  const navigate = useNavigate()
  // Mobile browsers, especially iOS Safari, do not reliably render an
  // authenticated blob URL inside an iframe. Let their native PDF viewer do
  // the job instead.
  const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [thermal, setThermal] = useState(false)
  const [pdfUrl, setPdfUrl] = useState('')
  const [loading, setLoading] = useState(true)

  // Fetch invoice number
  useEffect(() => {
    if (!id) return
    invoiceService.getInvoice(id)
      .then(inv => setInvoiceNumber(inv?.invoice_number || `#${id}`))
      .catch(() => setInvoiceNumber(`#${id}`))
  }, [id])

  // Reload PDF blob whenever id or thermal mode changes
  useEffect(() => {
    if (!id) { setLoading(false); return }
    if (isMobile) {
      setPdfUrl('')
      setLoading(false)
      return undefined
    }
    let objectUrl = ''
    setLoading(true)
    const token = localStorage.getItem('access_token') || ''
    const params = { token, printer: thermal ? 'thermal' : 'a4' }
    invoiceService.getPdf(id, params, { responseType: 'blob' })
      .then(res => {
        const blob = new Blob([res.data], { type: 'application/pdf' })
        objectUrl = URL.createObjectURL(blob)
        setPdfUrl(objectUrl)
      })
      .catch(() => toast.error('Could not load invoice PDF'))
      .finally(() => setLoading(false))
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [id, thermal, isMobile])

  const openInNew = () => {
    const url = getPdfUrl(id, thermal)
    if (isMobile) {
      // A same-tab navigation is not popup-blocked and opens in the phone's
      // native PDF viewer, where zoom, save and share work as expected.
      window.location.assign(url)
      return
    }
    const w = window.open('', '_blank')
    if (!w) { toast.error('Allow pop-ups to open'); return }
    w.location.href = url
  }

  const download = async () => {
    if (!id) return
    try {
      const token = localStorage.getItem('access_token') || ''
      const params = { token, printer: thermal ? 'thermal' : 'a4' }
      const res = await invoiceService.getPdf(id, params, { responseType: 'blob' })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const suffix = thermal ? 'thermal' : 'a4'
      a.href = url; a.download = `invoice-${invoiceNumber || id}-${suffix}.pdf`
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { toast.error('Could not download invoice') }
  }

  const share = async () => {
    if (!id) return
    try {
      const format = thermal ? 'thermal' : 'a4'
      const [pdfResponse, link] = await Promise.all([
        invoiceService.getPdf(id, { token: localStorage.getItem('access_token') || '', printer: format }, { responseType: 'blob' }),
        invoiceService.createShortLink(id),
      ])
      const file = new File(
        [new Blob([pdfResponse.data], { type: 'application/pdf' })],
        `invoice-${invoiceNumber || id}-${format}.pdf`,
        { type: 'application/pdf' },
      )
      const title = `Invoice ${invoiceNumber || id}`
      const sharedPdfUrl = link?.url ? `${link.url}?printer=${format}` : getPdfUrl(id, thermal)
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title, files: [file] })
      } else if (navigator.share) {
        await navigator.share({ title, url: sharedPdfUrl })
      } else {
        await navigator.clipboard.writeText(sharedPdfUrl)
        toast.success('Invoice link copied')
      }
    } catch (error) {
      if (error?.name !== 'AbortError') toast.error('Could not share invoice')
    }
  }

  if (!id) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-3">
      <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center">
        <FileText size={28} className="text-[var(--muted-light)]" />
      </div>
      <h2 className="text-lg font-semibold text-[var(--ink-secondary)]">No Invoice Selected</h2>
      <p className="text-sm text-[var(--muted-light)] max-w-xs">Open an invoice from the Bills list or save a new bill.</p>
      <button onClick={() => navigate('/sales/invoices')} className="btn-secondary mt-2">Go to Bills</button>
    </div>
  )

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--line)] bg-[var(--surface)] shrink-0 flex-wrap">
        <button onClick={() => navigate(-1)} className="icon-btn"><ArrowLeft size={18} /></button>

        <span className="text-sm font-semibold text-[var(--ink)] flex-1 min-w-0 truncate">
          {invoiceNumber ? `Invoice ${invoiceNumber}` : `Invoice #${id}`}
        </span>

        {/* Thermal / PDF toggle */}
        <div className="flex items-center rounded-xl border border-[var(--line)] overflow-hidden shrink-0 text-xs font-semibold">
          <button
            onClick={() => setThermal(false)}
            className={`px-3 py-1.5 transition ${!thermal ? 'bg-blue-600 text-white' : 'text-[var(--muted)] hover:bg-[var(--surface-elevated)]'}`}
          >
            PDF
          </button>
          <button
            onClick={() => setThermal(true)}
            className={`px-3 py-1.5 transition ${thermal ? 'bg-blue-600 text-white' : 'text-[var(--muted)] hover:bg-[var(--surface-elevated)]'}`}
          >
            Thermal
          </button>
        </div>

        <button onClick={openInNew} className="btn-secondary text-xs gap-1.5 shrink-0"><Printer size={14} /> {isMobile ? 'Open bill' : 'Open'}</button>
        <button onClick={download} className="btn-secondary text-xs gap-1.5 shrink-0"><Download size={14} /> Download</button>
        <button onClick={share} className="btn-secondary text-xs gap-1.5 shrink-0"><Share2 size={14} /> Share</button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : isMobile ? (
        <div className="flex-1 flex items-center justify-center bg-[var(--surface-elevated)] p-5">
          <section className="w-full max-w-sm rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 text-center shadow-[var(--shadow-card)]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <FileText size={22} />
            </div>
            <h2 className="mt-4 text-base font-bold text-[var(--ink)]">View your invoice</h2>
            <p className="mt-1.5 text-sm leading-6 text-[var(--muted)]">
              Open this bill in your phone's PDF viewer to view, zoom, print, or share it.
            </p>
            <button onClick={openInNew} className="btn-primary btn-lg mt-5 w-full">
              <FileText size={16} /> Open bill
            </button>
            <button onClick={download} className="btn-secondary btn-lg mt-2.5 w-full">
              <Download size={16} /> Download PDF
            </button>
          </section>
        </div>
      ) : (
        <iframe
          src={pdfUrl}
          className="flex-1 w-full border-0"
          title={`Invoice ${invoiceNumber || id}`}
        />
      )}
    </div>
  )
}
