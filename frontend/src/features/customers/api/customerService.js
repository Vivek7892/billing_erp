import http, { listData, unwrapResponse } from '../../../services/http'

export const customerService = {
  async getCustomers(params = {}) {
    const response = await http.get('/customers/', { params })
    const payload = unwrapResponse(response)
    const items = listData(response)
    items.items = items
    items.count = payload?.count ?? items.length
    items.raw = payload
    return items
  },

  async getCustomer(id) {
    const response = await http.get(`/customers/${id}/`)
    return unwrapResponse(response)
  },

  async createCustomer(payload) {
    const response = await http.post('/customers/', payload)
    return unwrapResponse(response)
  },

  async updateCustomer(id, payload) {
    const response = await http.patch(`/customers/${id}/`, payload)
    return unwrapResponse(response)
  },

  async deleteCustomer(id) {
    const response = await http.delete(`/customers/${id}/`)
    return unwrapResponse(response)
  },

  async getCustomerTransactions(id) {
    const response = await http.get(`/customers/${id}/transactions/`)
    return unwrapResponse(response)
  },

  async getCustomerBills(id) {
    const response = await http.get(`/customers/${id}/bills/`)
    return unwrapResponse(response)
  },

  async sendReminder(id, channel = 'whatsapp') {
    return http.post(`/customers/${id}/send-reminder/`, { channel })
  },

  async sendStatement(id, format = 'whatsapp') {
    return http.post(`/customers/${id}/send-statement/`, { channel: format })
  },

  async recordPayment(id, payload) {
    const response = await http.post(`/customers/${id}/payments/`, payload)
    return unwrapResponse(response)
  },
}

export default customerService
