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
      console.log('🔍 Login response:', response.data)
      
      const userData = response.data.user || response.data
      console.log('🔍 Extracted user data:', userData)
      console.log('🔍 First name from response:', userData.first_name)
      console.log('🔍 Username from response:', userData.username)
      
      localStorage.setItem('user', JSON.stringify(userData))
      localStorage.setItem('isAuthenticated', 'true')
      console.log('🔍 Stored user data:', localStorage.getItem('user'))
      
      return userData
    } catch (error) {
      // Fallback to hardcoded users for development
      if (username === 'testuser' && password === 'testpass123') {
        const userData = {
          id: 2,
          username: 'testuser',
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User',
          role: 'full',
          can_upload_images: true,
          can_delete_images: true,
          can_comment: true
        }
        
        localStorage.setItem('user', JSON.stringify(userData))
        localStorage.setItem('isAuthenticated', 'true')
        return userData
      } else if (username === 'memoryuser' && password === 'memorypass123') {
        const userData = {
          id: 3,
          username: 'memoryuser',
          email: 'memory@example.com',
          first_name: 'Memory',
          last_name: 'User',
          role: 'memory',
          can_upload_images: false,
          can_delete_images: false,
          can_comment: true
        }
        
        localStorage.setItem('user', JSON.stringify(userData))
        localStorage.setItem('isAuthenticated', 'true')
        return userData
      } else {
        throw new Error('Invalid credentials')
      }
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
    console.log('🔍 getCurrentUser - Raw user from localStorage:', user)
    console.log('🔍 getCurrentUser - isAuthenticated:', isAuthenticated)
    const parsedUser = user && isAuthenticated ? JSON.parse(user) : null
    console.log('🔍 getCurrentUser - Parsed user:', parsedUser)
    return parsedUser
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
  }
}