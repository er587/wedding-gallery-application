import { useState } from 'react'

export default function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true)
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: ''
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    // Placeholder for actual authentication
    // For now, just simulate a successful login
    onLogin({ 
      id: 1, 
      username: formData.username,
      email: formData.email 
    })
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
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleInputChange}
            required
            className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
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