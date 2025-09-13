import axios from 'axios'

// Use relative URLs - Vite will proxy to Django backend
const API_BASE_URL = ''

// Debug logging to help troubleshoot
console.log('🔗 Frontend API Configuration:')
console.log('  API Base URL: Using Vite proxy (relative URLs)')
console.log('  Current location:', window.location.origin)

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enable cookies for session authentication
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

  // Like functionality
  toggleLike: (imageId) => api.post(`/api/images/${imageId}/like/`),
  getLikedImages: (page = 1) => api.get(`/api/auth/liked-images/?page=${page}`),

  // Authentication
  getCsrfToken: () => api.get('/api/auth/csrf/'),
  login: (credentials) => api.post('/api/auth/login/', credentials),
  register: (userData) => api.post('/api/auth/register/', userData),
  logout: () => api.post('/api/auth/logout/'),
  getCurrentUser: () => api.get('/api/auth/user/'),
}

// Request interceptor for CSRF tokens and auth
api.interceptors.request.use(async (config) => {
  // Get CSRF token from cookie
  const csrfToken = getCookie('csrftoken')
  if (csrfToken) {
    config.headers['X-CSRFToken'] = csrfToken
  }
  
  const token = localStorage.getItem('authToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Helper function to get cookie value
function getCookie(name) {
  let cookieValue = null
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';')
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim()
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1))
        break
      }
    }
  }
  return cookieValue
}

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