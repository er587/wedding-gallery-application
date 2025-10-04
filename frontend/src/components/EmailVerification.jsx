import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { authService } from '../services/auth'
import { useToast } from './Toast'

export default function EmailVerification() {
  const { token } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  
  const [isVerifying, setIsVerifying] = useState(true)
  const [verificationSuccess, setVerificationSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        await authService.verifyEmail(token)
        setVerificationSuccess(true)
        toast.success('Email verified successfully!')
        setTimeout(() => navigate('/'), 3000)
      } catch (error) {
        setErrorMessage(error.message || 'Email verification failed')
        toast.error(error.message || 'Email verification failed')
      } finally {
        setIsVerifying(false)
      }
    }
    
    if (token) {
      verifyEmail()
    }
  }, [token, navigate, toast])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-md text-center">
        {isVerifying && (
          <>
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Verifying Your Email</h1>
            <p className="text-gray-600">Please wait...</p>
          </>
        )}
        
        {!isVerifying && verificationSuccess && (
          <>
            <div className="text-green-600 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Verified!</h1>
            <p className="text-gray-600 mb-4">Your email has been successfully verified.</p>
            <p className="text-sm text-gray-500">You will be redirected to the home page shortly...</p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              Go to Home
            </button>
          </>
        )}
        
        {!isVerifying && !verificationSuccess && (
          <>
            <div className="text-red-600 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h1>
            <p className="text-gray-600 mb-4">{errorMessage}</p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              Go to Home
            </button>
          </>
        )}
      </div>
    </div>
  )
}
