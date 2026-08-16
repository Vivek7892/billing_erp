import { FileText } from 'lucide-react'

export default function InvoicePreview() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-3">
      <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center">
        <FileText size={28} className="text-slate-400" />
      </div>
      <h2 className="text-lg font-semibold text-slate-700">Invoice Preview</h2>
      <p className="text-sm text-slate-400 max-w-xs">Print-ready A4 GST tax invoice with HSN summary and tax breakup.</p>
    </div>
  )
}
