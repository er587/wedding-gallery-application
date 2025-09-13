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
  
  // Profile management
  getUserProfile: () => api.get('/api/auth/profile/'),
  updateProfile: (profileData) => api.put('/api/auth/profile/update/', profileData),
  changePassword: (passwordData) => api.post('/api/auth/change-password/', passwordData),
  
  // Face Tagging
  detectFaces: (imageId) => api.post(`/api/images/${imageId}/detect-faces/`),
  getFaceTags: (imageId) => api.get(`/api/images/${imageId}/face-tags/`),
  createFaceTag: (imageId, tagData) => api.post(`/api/images/${imageId}/face-tags/`, tagData),
  updateFaceTag: (tagId, tagData) => api.put(`/api/face-tags/${tagId}/`, tagData),
  deleteFaceTag: (tagId) => api.delete(`/api/face-tags/${tagId}/`),
  getSuggestedTags: (imageId) => api.post(`/api/images/${imageId}/suggest-tags/`),
  applyAutoTag: (tagData) => api.post('/api/apply-auto-tag/', tagData),
  
  // People Management
  getPeople: () => api.get('/api/people/'),
  createPerson: (personData) => api.post('/api/people/', personData),
  updatePerson: (personId, personData) => api.put(`/api/people/${personId}/`, personData),
  deletePerson: (personId) => api.delete(`/api/people/${personId}/`),
  
  // Admin Face Tag Management
  getPendingTags: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    const url = queryString ? `/api/admin/pending-tags/?${queryString}` : '/api/admin/pending-tags/'
    return api.get(url)
  },
  approveFaceTag: (tagId) => api.post(`/api/admin/face-tags/${tagId}/approve/`),
  rejectFaceTag: (tagId) => api.post(`/api/admin/face-tags/${tagId}/reject/`),
  bulkApproveTags: (tagIds) => api.post('/api/admin/bulk-approve-tags/', { tag_ids: tagIds }),
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