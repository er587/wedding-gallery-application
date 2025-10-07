import { useState } from 'react'
import { authService } from '../services/auth'
import { useToast } from './Toast'

export default function Auth({ onLogin }) {
  const toast = useToast()
  const [showSignupModal, setShowSignupModal] = useState(false)
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [resetEmail, setResetEmail] = useState('')
  const [isSubmittingReset, setIsSubmittingReset] = useState(false)
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
      toast.error('Login failed. Please check your credentials and try again.', 6000)
    }
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    
    // Validate passwords match
    if (signupData.password !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }
    
    setPasswordError('')
    
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
      setConfirmPassword('')
      setShowPassword(false)
      setShowConfirmPassword(false)
    } catch (error) {
      toast.error(`Registration failed: ${error.message}`)
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

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setIsSubmittingReset(true)
    
    try {
      await authService.requestPasswordReset(resetEmail)
      toast.success('Password reset instructions sent to your email')
      setShowForgotPasswordModal(false)
      setResetEmail('')
    } catch (error) {
      toast.success('If an account exists with this email, password reset instructions will be sent')
      setShowForgotPasswordModal(false)
      setResetEmail('')
    } finally {
      setIsSubmittingReset(false)
    }
  }

  return (
    <>
      {/* Login Form - Responsive */}
      <div className="flex items-center">
        <form onSubmit={handleLogin} className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
          {/* Email and Password Row */}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              name="username"
              placeholder="Email Address"
              value={loginData.username}
              onChange={handleLoginInputChange}
              required
              className="px-3 py-2 md:py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto min-h-[44px] md:min-h-0"
            />
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={loginData.password}
              onChange={handleLoginInputChange}
              required
              className="px-3 py-2 md:py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto min-h-[44px] md:min-h-0"
            />
          </div>
          
          {/* Buttons Row */}
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-3 md:py-2 rounded text-sm hover:bg-blue-700 transition-colors whitespace-nowrap min-h-[44px] md:min-h-0"
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setShowSignupModal(true)}
              className="text-blue-600 text-sm hover:underline px-4 py-3 md:py-2 min-h-[44px] md:min-h-0"
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => setShowForgotPasswordModal(true)}
              className="text-gray-600 text-sm hover:underline px-4 py-3 md:py-2 whitespace-nowrap min-h-[44px] md:min-h-0"
            >
              Forgot Password?
            </button>
          </div>
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
              
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Password"
                  value={signupData.password}
                  onChange={handleSignupInputChange}
                  required
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    if (passwordError) setPasswordError('')
                  }}
                  required
                  className={`w-full px-3 py-2 pr-10 border rounded text-sm focus:outline-none focus:ring-2 ${
                    passwordError 
                      ? 'border-red-300 focus:ring-red-500' 
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              
              {passwordError && (
                <p className="text-red-600 text-sm -mt-2">{passwordError}</p>
              )}
              
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

      {/* Forgot Password Modal */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Reset Password</h2>
              <button
                onClick={() => setShowForgotPasswordModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <p className="text-gray-600 text-sm mb-4">
              Enter your email address and we'll send you instructions to reset your password.
            </p>
            
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <input
                type="email"
                placeholder="Email Address"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowForgotPasswordModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReset}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors disabled:bg-blue-300"
                >
                  {isSubmittingReset ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}