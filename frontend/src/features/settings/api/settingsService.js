import api from '../../../api'
import { unwrapResponse } from '../../../services/http'

export const settingsService = {
  async getAll() {
    const response = await api.get('/settings/all/')
    return unwrapResponse(response)
  },
}

export default settingsService
