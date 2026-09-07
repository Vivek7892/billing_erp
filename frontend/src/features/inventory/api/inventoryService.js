import api from '../../../api'
import { listData, unwrapResponse } from '../../../services/http'

export const inventoryService = {
  async getProducts(params = {}) {
    const response = await api.get('/products/', { params })
    return listData(response)
  },

  async getTransactions(params = {}) {
    const response = await api.get('/inventory/', { params })
    return listData(response)
  },

  async adjustStock(payload) {
    const response = await api.post('/inventory/adjust/', payload)
    return unwrapResponse(response)
  },

  async bulkAdjustStock(items) {
    const response = await api.post('/inventory/bulk-adjust/', { items })
    return unwrapResponse(response)
  },

  async importStock(formData) {
    const response = await api.post('/inventory/import/', formData)
    return unwrapResponse(response)
  },
}

export default inventoryService
