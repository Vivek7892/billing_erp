import api from '../../../api'
import { listData, unwrapResponse } from '../../../services/http'

export const invoiceService = {
  async getInvoices(params = {}) {
    const response = await api.get('/invoices/', { params })
    const payload = unwrapResponse(response)
    return {
      items: listData(response),
      count: payload?.count ?? 0,
    }
  },

  async createInvoice(payload) {
    const response = await api.post('/invoices/', payload)
    return unwrapResponse(response)
  },

  async cancelInvoice(invoiceId) {
    const response = await api.post(`/invoices/${invoiceId}/cancel/`)
    return unwrapResponse(response)
  },

  async refundInvoice(invoiceId) {
    const response = await api.post(`/invoices/${invoiceId}/refund/`)
    return unwrapResponse(response)
  },

  async getInvoice(invoiceId) {
    const response = await api.get(`/invoices/${invoiceId}/`)
    return unwrapResponse(response)
  },

  async getPdf(invoiceId, params = {}, config = {}) {
    return api.get(`/invoices/${invoiceId}/pdf/`, {
      ...config,
      params,
    })
  },

  async createShortLink(invoiceId) {
    const response = await api.post(`/invoices/${invoiceId}/short-link/`)
    return unwrapResponse(response)
  },
}

export default invoiceService
