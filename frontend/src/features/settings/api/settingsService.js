import http, { unwrapResponse } from '../../../services/http'

export const settingsService = {
  async getAll() {
    const response = await http.get('/settings/all/')
    return unwrapResponse(response)
  },
}

export default settingsService
