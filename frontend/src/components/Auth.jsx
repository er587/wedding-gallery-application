import { useState } from 'react'
import { authService } from '../services/auth'

export default function Auth({ onLogin }) {
  const [showSignupModal, setShowSignupModal] = useState(false)
  const [loginData, setLoginData] = useState({
    username: '',
    password: ''
  })
  const [signupData, setSignupData] = useState({
    password: '',
    email: '',
    invitation_code: '',
    first_name: '',
    last_name: ''
  })

  const handleLogin = async (e) => {
    e.preventDefault()
    try {
      const userData = await authService.login(loginData.username, loginData.password)
      onLogin(userData)
    } catch (error) {
      alert(`Login failed: ${error.message}`)
    }
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    try {
      const userData = await authService.register(signupData)
      onLogin(userData)
      setShowSignupModal(false)
      // Reset form
      setSignupData({
        password: '',
        email: '',
        invitation_code: '',
        first_name: '',
        last_name: ''
      })
    } catch (error) {
      alert(`Registration failed: ${error.message}`)
    }
  }

  const handleLoginInputChange = (e) => {
    setLoginData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleSignupInputChange = (e) => {
    setSignupData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  return (
    <>
      {/* Welcome Section with Wedding Couple */}
      {!showSignupModal && (
        <div className="text-center mb-8 pt-6">
          <div className="flex justify-center mb-4">
            <svg 
              className="w-24 h-24" 
              viewBox="0 0 100 100" 
              fill="none"
              alt="Wedding Couple"
            >
              {/* Simple wedding couple silhouette */}
              <path 
                d="M30 20C32 18 35 18 37 20C39 22 39 26 37 28C35 30 32 30 30 28C28 26 28 22 30 20Z
                   M28 30L40 30L42 35L40 80L35 80L33 50L32 50L30 80L25 80L27 35Z" 
                fill="#1f2937" 
              />
              <path 
                d="M60 22C62 20 65 20 67 22C69 24 69 28 67 30C65 32 62 32 60 30C58 28 58 24 60 22Z
                   M58 32L70 32L72 37C75 40 78 43 80 47L78 50C76 47 73 44 70 42L70 80L65 80L63 55L62 55L60 80L55 80L57 42C54 44 51 47 49 50L47 47C49 43 52 40 55 37L57 32Z
                   M55 42L70 42C75 50 80 60 82 80L47 80C49 60 54 50 55 42Z" 
                fill="#1f2937" 
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Our Wedding Gallery</h2>
          <p className="text-gray-600 mb-6">Share precious memories from our special day</p>
        </div>
      )}
      
      {/* Login Form */}
      <div className="flex items-center space-x-4 justify-center">
        <form onSubmit={handleLogin} className="flex items-center space-x-2">
          <input
            type="email"
            name="username"
            placeholder="Email Address"
            value={loginData.username}
            onChange={handleLoginInputChange}
            required
            className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={loginData.password}
            onChange={handleLoginInputChange}
            required
            className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setShowSignupModal(true)}
            className="text-blue-600 text-sm hover:underline"
          >
            Sign Up
          </button>
        </form>
      </div>

      {/* Signup Modal */}
      {showSignupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Join Wedding Gallery</h2>
              <button
                onClick={() => setShowSignupModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  name="first_name"
                  placeholder="First Name"
                  value={signupData.first_name}
                  onChange={handleSignupInputChange}
                  className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  name="last_name"
                  placeholder="Last Name"
                  value={signupData.last_name}
                  onChange={handleSignupInputChange}
                  className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <input
                type="email"
                name="email"
                placeholder="Email Address"
                value={signupData.email}
                onChange={handleSignupInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              
              <input
                type="password"
                name="password"
                placeholder="Password"
                value={signupData.password}
                onChange={handleSignupInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                <label className="block text-sm font-medium text-yellow-800 mb-1">
                  Invitation Code
                </label>
                <input
                  type="text"
                  name="invitation_code"
                  placeholder="Enter your invitation code"
                  value={signupData.invitation_code}
                  onChange={handleSignupInputChange}
                  required
                  className="w-full px-3 py-2 border border-yellow-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-white"
                />
                <p className="text-xs text-yellow-700 mt-1">
                  Required code provided by the wedding organizer
                </p>
              </div>
              
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSignupModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                >
                  Sign Up
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}