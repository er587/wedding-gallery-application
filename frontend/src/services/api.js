import axios from 'axios'

// Get the backend URL from environment or use Replit domain
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (window.location.hostname.includes('.replit.dev') 
    ? window.location.origin.replace(':5000', ':8000') 
    : 'http://localhost:8000')

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
  getImages: () => api.get('/api/images/'),
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