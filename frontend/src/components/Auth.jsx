import { useState } from 'react'
import { authService } from '../services/auth'

export default function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true)
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    invitation_code: '',
    first_name: '',
    last_name: ''
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (isLogin) {
        const userData = await authService.login(formData.username, formData.password)
        onLogin(userData)
      } else {
        // Registration with invitation code
        const userData = await authService.register(formData)
        onLogin(userData)
      }
    } catch (error) {
      const action = isLogin ? 'Login' : 'Registration'
      const message = isLogin ? 
        `Login failed: ${error.message}\n\nExisting users:\n• testuser / testpass123 (Full User)\n• memoryuser / memorypass123 (Memory User)` :
        `Registration failed: ${error.message}\n\nPlease check your invitation code and try again.`
      alert(message)
    }
  }

  const handleInputChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  return (
    <div className="flex items-center space-x-4">
      <form onSubmit={handleSubmit} className="flex items-center space-x-2">
        <input
          type="text"
          name="username"
          placeholder="Username"
          value={formData.username}
          onChange={handleInputChange}
          required
          className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={formData.password}
          onChange={handleInputChange}
          required
          className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {!isLogin && (
          <>
            <input
              type="text"
              name="first_name"
              placeholder="First Name"
              value={formData.first_name}
              onChange={handleInputChange}
              className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              name="last_name"
              placeholder="Last Name"
              value={formData.last_name}
              onChange={handleInputChange}
              className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleInputChange}
              required
              className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              name="invitation_code"
              placeholder="Invitation Code"
              value={formData.invitation_code}
              onChange={handleInputChange}
              required
              className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-yellow-50"
            />
          </>
        )}
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
        >
          {isLogin ? 'Login' : 'Sign Up'}
        </button>
        <button
          type="button"
          onClick={() => setIsLogin(!isLogin)}
          className="text-blue-600 text-sm hover:underline"
        >
          {isLogin ? 'Sign Up' : 'Login'}
        </button>
      </form>
    </div>
  )
}