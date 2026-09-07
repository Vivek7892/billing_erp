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
}

export default productService
