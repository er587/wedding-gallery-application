import { apiService } from './api'

export const authService = {
  // For now, we'll use a simple session-based auth with Django
  // In production, you'd want to use proper JWT or similar
  
  login: async (username, password) => {
    try {
      // For development, we'll simulate login with the test user
      if (username === 'testuser' && password === 'testpass123') {
        const userData = {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User'
        }
        
        localStorage.setItem('user', JSON.stringify(userData))
        localStorage.setItem('isAuthenticated', 'true')
        return userData
      } else {
        throw new Error('Invalid credentials')
      }
    } catch (error) {
      console.error('Login error:', error)
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

  isAuthenticated: () => {
    return localStorage.getItem('isAuthenticated') === 'true'
  }
}