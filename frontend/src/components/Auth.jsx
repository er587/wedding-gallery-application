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
        <div className="text-center mb-12 pt-12">
          <div className="flex justify-center mb-8">
            <svg 
              className="w-40 h-40 filter drop-shadow-lg" 
              viewBox="0 0 400 400" 
              fill="none"
              alt="Wedding Couple Silhouette"
            >
              {/* Groom silhouette */}
              <path 
                d="M120 80C130 70 140 70 150 80C160 90 160 110 150 120C140 130 130 130 120 120C110 110 110 90 120 80Z
                   M115 130L160 130L165 150L160 380L145 380L140 240L135 240L130 380L115 380L120 150Z
                   M115 150L125 170L110 190L100 170Z
                   M165 150L175 170L160 190L170 170Z" 
                fill="#1f2937" 
              />
              {/* Bride silhouette - head and hair */}
              <path 
                d="M230 85C240 75 250 75 260 85C270 95 270 115 260 125C250 135 240 135 230 125C220 115 220 95 230 85Z
                   M220 90C215 85 215 95 220 100C225 95 225 85 220 90Z
                   M270 90C275 85 275 95 270 100C265 95 265 85 270 90Z" 
                fill="#1f2937" 
              />
              {/* Bride body and dress */}
              <path 
                d="M225 135L270 135L275 155C285 165 300 175 310 190L305 205C295 195 280 185 270 180L270 250L260 250L255 200L250 200L245 250L235 250L240 180C230 185 215 195 205 205L200 190C210 175 225 165 235 155L240 135Z
                   M235 180L270 180C285 200 305 230 315 280C320 320 325 360 330 380L160 380C170 360 180 320 190 280C200 230 220 200 235 180Z
                   M190 280C185 300 180 340 175 380L345 380C340 340 335 300 330 280C335 290 340 310 345 340L350 380L370 380C365 340 360 290 355 280C360 230 340 200 320 180L275 180C295 200 315 230 330 280Z" 
                fill="#1f2937" 
              />
              {/* Dress details and flow */}
              <path 
                d="M175 350C180 330 190 310 205 295C220 310 240 330 250 350C260 330 280 310 295 295C310 310 320 330 325 350C340 340 350 360 345 380L175 380C170 360 175 340 175 350Z" 
                fill="#1f2937" 
              />
            </svg>
          </div>
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Welcome to Our Wedding Gallery</h2>
          <p className="text-lg text-gray-600 mb-8 max-w-md mx-auto">Share precious memories from our special day</p>
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