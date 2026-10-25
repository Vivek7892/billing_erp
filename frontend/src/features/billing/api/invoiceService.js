import http, { listData, unwrapResponse } from '../../../services/http'

export const invoiceService = {
  async getInvoices(params = new URLSearchParams()) {
    const response = await http.get('/invoices/', { params })
    const payload = unwrapResponse(response)
    return {
      items: listData(response),
      count: payload?.count ?? 0,
    }
  },

  async getInvoice(invoiceId) {
    const response = await http.get(`/invoices/${invoiceId}/`)
    return unwrapResponse(response)
  },

  async createInvoice(payload) {
    const response = await http.post('/invoices/', payload)
    return unwrapResponse(response)
  },

  async cancelInvoice(invoiceId, reason = '') {
    const response = await http.post(`/invoices/${invoiceId}/cancel/`, { reason })
    return unwrapResponse(response)
  },

  async refundInvoice(invoiceId, payload = {}) {
    const response = await http.post(`/invoices/${invoiceId}/refund/`, payload)
    return unwrapResponse(response)
  },

  async collectPayment(invoiceId, payload) {
    const response = await http.post(`/invoices/${invoiceId}/collect-payment/`, payload)
    return unwrapResponse(response)
  },

  async getInvoicePayments(invoiceId) {
    const response = await http.get(`/invoices/${invoiceId}/payments/`)
    return unwrapResponse(response)
  },

  async getPdf(invoiceId, params = {}, config = {}) {
    return http.get(`/invoices/${invoiceId}/pdf/`, {
      ...config,
      params,
    })
  },

  async createShortLink(invoiceId) {
    const response = await http.post(`/invoices/${invoiceId}/short-link/`)
    return unwrapResponse(response)
  },

  async sendWhatsApp(invoiceId, phone = '') {
    const response = await http.post(`/invoices/${invoiceId}/send-whatsapp/`, { phone })
    return unwrapResponse(response)
  },

  async sendEmail(invoiceId, email = '') {
    const response = await http.post(`/invoices/${invoiceId}/send-email/`, { email })
    return unwrapResponse(response)
  },

  async createRazorpayOrder(invoiceId) {
    const response = await http.post('/payments/razorpay/create-order/', { invoice_id: invoiceId })
    return unwrapResponse(response)
  },

  async verifyRazorpayPayment(payload) {
    const response = await http.post('/payments/razorpay/verify/', payload)
    return unwrapResponse(response)
  },

  async getReconciliation(params = {}) {
    const response = await http.get('/payments/razorpay/reconciliation/', { params })
    return unwrapResponse(response)
  },
}

export default invoiceService
