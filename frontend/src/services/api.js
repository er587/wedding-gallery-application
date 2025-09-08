import axios from 'axios'

// Get the backend URL from environment or use Replit domain  
const getBackendURL = () => {
  // Check for explicit environment variable first
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL
  }
  
  // For Replit environment
  if (window.location.hostname.includes('.replit.dev')) {
    // In Replit, both frontend (port 5000) and backend (port 8000) use the same domain
    // Just change the port in the current URL
    return window.location.protocol + '//' + window.location.hostname + ':8000'
  }
  
  // Default for local development
  return 'http://localhost:8000'
}

const API_BASE_URL = getBackendURL()

// Debug logging to help troubleshoot
console.log('🔗 Frontend API Configuration:')
console.log('  API Base URL:', API_BASE_URL)
console.log('  Current location:', window.location.origin)

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// API service functions
export const apiService = {
  // Images
  getImages: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    const url = queryString ? `/api/images/?${queryString}` : '/api/images/'
    return api.get(url)
  },
  getImage: (id) => api.get(`/api/images/${id}/`),
  createImage: (formData) => api.post('/api/images/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  updateImage: (id, data) => api.put(`/api/images/${id}/`, data),
  deleteImage: (id) => api.delete(`/api/images/${id}/`),

  // Comments
  getComments: (imageId) => api.get(`/api/images/${imageId}/comments/`),
  createComment: (imageId, data) => api.post(`/api/images/${imageId}/comments/`, data),
  createReply: (commentId, data) => api.post(`/api/comments/${commentId}/reply/`, data),

  // Authentication (placeholder for now)
  login: (credentials) => api.post('/api/auth/login/', credentials),
  register: (userData) => api.post('/api/auth/register/', userData),
  logout: () => api.post('/api/auth/logout/'),
  getCurrentUser: () => api.get('/api/auth/user/'),
}

// Request interceptor for auth tokens
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken')
      localStorage.removeItem('user')
      window.location.href = '/'
    }
    return Promise.reject(error)
  }
)

export default api