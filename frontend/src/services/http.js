export function unwrapResponse(response) {
  const payload = response?.data
  if (payload?.success === true && Object.prototype.hasOwnProperty.call(payload, 'data')) {
    return payload.data
  }
  return payload
}

export function listData(response) {
  const payload = unwrapResponse(response)
  return payload?.results ?? payload ?? []
}

export function errorMessage(error, fallback = 'Something went wrong') {
  const payload = error?.response?.data
  if (typeof payload?.message === 'string' && payload.message) return payload.message
  if (typeof payload?.detail === 'string' && payload.detail) return payload.detail
  if (typeof payload?.error === 'string' && payload.error) return payload.error
  if (Array.isArray(payload?.errors)) return payload.errors[0] || fallback
  if (error?.message) return error.message
  return fallback
}
