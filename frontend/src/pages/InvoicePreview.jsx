import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Printer, Download, ArrowLeft, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import invoiceService from '../features/billing/api/invoiceService'

export default function InvoicePreview() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [pdfUrl, setPdfUrl] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) { setLoading(false); return }
    let objectUrl = ''
    setLoading(true)
    const token = localStorage.getItem('access_token') || ''
    const params = new URLSearchParams()
    if (token) params.set('token', token)
    invoiceService.getPdf(id, Object.fromEntries(params), { responseType: 'blob' })
      .then(res => {
        const blob = new Blob([res.data], { type: 'application/pdf' })
        objectUrl = URL.createObjectURL(blob)
        setPdfUrl(objectUrl)
      })
      .catch(() => toast.error('Could not load invoice PDF'))
      .finally(() => setLoading(false))
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [id])

  const print = async () => {
    if (!id) return
    const win = window.open('', '_blank', 'width=900,height=900')
    if (!win) { toast.error('Allow pop-ups to print'); return }
    try {
      const token = localStorage.getItem('access_token') || ''
      const params = new URLSearchParams()
      if (token) params.set('token', token)
      const res = await invoiceService.getPdf(id, Object.fromEntries(params), { responseType: 'blob' })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      win.location.href = url
      setTimeout(() => { try { win.focus(); win.print() } catch {} }, 1200)
    } catch { win.close(); toast.error('Could not print invoice') }
  }

  const download = async () => {
    if (!id) return
    try {
      const token = localStorage.getItem('access_token') || ''
      const params = new URLSearchParams()
      if (token) params.set('token', token)
      const res = await invoiceService.getPdf(id, Object.fromEntries(params), { responseType: 'blob' })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `invoice-${id}.pdf`
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { toast.error('Could not download invoice') }
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
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--line)] bg-[var(--surface)] shrink-0">
        <button onClick={() => navigate(-1)} className="icon-btn"><ArrowLeft size={18} /></button>
        <span className="text-sm font-semibold text-[var(--ink)] flex-1">Invoice #{id}</span>
        <button onClick={print} className="btn-secondary text-xs gap-1.5"><Printer size={14} /> Print</button>
        <button onClick={download} className="btn-secondary text-xs gap-1.5"><Download size={14} /> Download</button>
      </div>
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : (
        <iframe
          src={pdfUrl}
          className="flex-1 w-full border-0"
          title={`Invoice ${id}`}
        />
      )}
    </div>
  )
}
