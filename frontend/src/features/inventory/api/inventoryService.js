import http, { listData, unwrapResponse } from '../../../services/http'

export const inventoryService = {
  async getProducts(params = {}) {
    const response = await http.get('/products/', { params })
    return listData(response)
  },

  async getTransactions(params = {}) {
    const response = await http.get('/inventory/', { params })
    return listData(response)
  },

  async adjustStock(payload) {
    const response = await http.post('/inventory/adjust/', payload)
    return unwrapResponse(response)
  },

  async bulkAdjustStock(items) {
    const response = await http.post('/inventory/bulk-adjust/', { items })
    return unwrapResponse(response)
  },

  async importStock(formData) {
    const response = await http.post('/inventory/import/', formData)
    return unwrapResponse(response)
  },
}

export default inventoryService
