import http, { listData, unwrapResponse } from '../../../services/http'

export const productService = {
  async getProducts(params = {}) {
    const response = await http.get('/products/', { params })
    const payload = unwrapResponse(response)
    const items = listData(response)
    items.items = items
    items.count = payload?.count ?? items.length
    items.raw = payload
    return items
  },

  async getProduct(id) {
    const response = await http.get(`/products/${id}/`)
    return unwrapResponse(response)
  },

  async createProduct(data) {
    const response = await http.post('/products/', data)
    return unwrapResponse(response)
  },

  async updateProduct(id, data) {
    const response = await http.patch(`/products/${id}/`, data)
    return unwrapResponse(response)
  },

  async deleteProduct(id) {
    const response = await http.delete(`/products/${id}/`)
    return unwrapResponse(response)
  },

  async getCategories(params = {}) {
    const response = await http.get('/categories/', { params })
    return listData(response)
  },

  async getSuppliers(params = {}) {
    const response = await http.get('/suppliers/', { params })
    return listData(response)
  },

  async adjustStock(payload) {
    const response = await http.post('/inventory/adjust/', payload)
    return unwrapResponse(response)
  },

  async getInventoryTransactions(productId, params = {}) {
    const response = await http.get('/inventory/', {
      params: { product: productId, ...params },
    })
    return listData(response)
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

export default productService
