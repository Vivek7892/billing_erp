import api from '../../../api'
import { listData, unwrapResponse } from '../../../services/http'

export const customerService = {
  async getCustomers(params = {}) {
    const response = await api.get('/customers/', { params })
    return listData(response)
  },

  async createCustomer(payload) {
    const response = await api.post('/customers/', payload)
    return unwrapResponse(response)
  },
}

export default customerService
