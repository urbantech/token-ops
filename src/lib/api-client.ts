import axios, { type AxiosError, type AxiosResponse } from 'axios'

const BASE_URL =
  process.env.NEXT_PUBLIC_AINATIVE_API_URL || 'https://api.ainative.studio'

const API_KEY =
  process.env.NEXT_PUBLIC_AINATIVE_API_KEY || process.env.AINATIVE_API_KEY || ''

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// Attach API key on every request
apiClient.interceptors.request.use((config) => {
  if (API_KEY) {
    config.headers['Authorization'] = `Bearer ${API_KEY}`
    config.headers['X-API-Key'] = API_KEY
  }
  return config
})

// Normalise error responses
apiClient.interceptors.response.use(
  (res: AxiosResponse) => res,
  (err: AxiosError<{ detail?: string; message?: string }>) => {
    const message =
      err.response?.data?.detail ||
      err.response?.data?.message ||
      err.message ||
      'An unexpected error occurred'
    return Promise.reject(new Error(message))
  }
)

export default apiClient
