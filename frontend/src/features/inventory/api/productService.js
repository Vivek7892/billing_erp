import api from '../../../api'
import { listData } from '../../../services/http'

export const productService = {
  async getProducts(params = {}) {
    const response = await api.get('/products/', { params })
    return listData(response)
  },

  async getCategories(params = {}) {
    const response = await api.get('/categories/', { params })
    return listData(response)
  },

  async getSuppliers(params = {}) {
    const response = await api.get('/suppliers/', { params })
    return listData(response)
  },

  async getProduct(id) {
    const response = await api.get(`/products/${id}/`)
    return response.data
  },

  async createProduct(data) {
    const response = await api.post('/products/', data)
    return response.data
  },

  async updateProduct(id, data) {
    const response = await api.patch(`/products/${id}/`, data)
    return response.data
  },

  async deleteProduct(id) {
    const response = await api.delete(`/products/${id}/`)
    return response.data
  },

  async adjustStock(payload) {
    const response = await api.post('/inventory/adjust/', payload)
    return response.data
  },

  async getInventoryTransactions(productId, params = {}) {
    const response = await api.get('/inventory/', {
      params: { product: productId, ...params },
    })
    return listData(response)
  },
}

export default productService
