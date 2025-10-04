import { apiService } from './api'

export const authService = {
  // For now, we'll use a simple session-based auth with Django
  // In production, you'd want to use proper JWT or similar
  
  login: async (username, password) => {
    try {
      // First get CSRF token
      await apiService.getCsrfToken()
      
      // Then authenticate with Django backend
      const response = await apiService.login({ username, password })
      const userData = response.data.user || response.data
      
      localStorage.setItem('user', JSON.stringify(userData))
      localStorage.setItem('isAuthenticated', 'true')
      
      // Authentication successful
      return userData
    } catch (error) {
      console.error('Django authentication failed:', error.response?.data || error.message)
      throw error
    }
  },

  logout: () => {
    localStorage.removeItem('user')
    localStorage.removeItem('isAuthenticated')
    localStorage.removeItem('authToken')
  },

  getCurrentUser: () => {
    const user = localStorage.getItem('user')
    const isAuthenticated = localStorage.getItem('isAuthenticated')
    return user && isAuthenticated ? JSON.parse(user) : null
  },

  register: async (userData) => {
    try {
      // First get CSRF token
      await apiService.getCsrfToken()
      
      // Then register with Django backend
      const response = await apiService.register(userData)
      const newUserData = response.data.user || response.data
      
      localStorage.setItem('user', JSON.stringify(newUserData))
      localStorage.setItem('isAuthenticated', 'true')
      return newUserData
    } catch (error) {
      console.error('Registration error:', error)
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error)
      }
      throw new Error('Registration failed. Please try again.')
    }
  },

  isAuthenticated: () => {
    return localStorage.getItem('isAuthenticated') === 'true'
  },

  requestPasswordReset: async (email) => {
    try {
      await apiService.getCsrfToken()
      const response = await apiService.requestPasswordReset(email)
      return response.data
    } catch (error) {
      console.error('Password reset request error:', error)
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error)
      }
      throw new Error('Failed to request password reset. Please try again.')
    }
  },

  resetPassword: async (token, password) => {
    try {
      await apiService.getCsrfToken()
      const response = await apiService.resetPassword(token, password)
      return response.data
    } catch (error) {
      console.error('Password reset error:', error)
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error)
      }
      throw new Error('Password reset failed. Please try again.')
    }
  },

  sendVerificationEmail: async () => {
    try {
      await apiService.getCsrfToken()
      const response = await apiService.sendVerificationEmail()
      return response.data
    } catch (error) {
      console.error('Send verification email error:', error)
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error)
      }
      throw new Error('Failed to send verification email. Please try again.')
    }
  },

  verifyEmail: async (token) => {
    try {
      await apiService.getCsrfToken()
      const response = await apiService.verifyEmail(token)
      return response.data
    } catch (error) {
      console.error('Email verification error:', error)
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error)
      }
      throw new Error('Email verification failed. Please try again.')
    }
  }
}