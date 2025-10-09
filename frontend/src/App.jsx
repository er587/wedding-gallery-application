import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import ImageGallery from './components/ImageGallery'
import ImageUpload from './components/ImageUpload'
import Auth from './components/Auth'
import UserProfile from './components/UserProfile'
import WelcomeModal from './components/WelcomeModal'
import HelpModal from './components/HelpModal'
import ResetPassword from './components/ResetPassword'
import EmailVerification from './components/EmailVerification'
import MobileMenu from './components/MobileMenu'
import { ToastProvider } from './components/Toast'
import { authService } from './services/auth'
import { apiService } from './services/api'

function App() {
  const [user, setUser] = useState(() => authService.getCurrentUser())
  const [showUpload, setShowUpload] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [refreshGallery, setRefreshGallery] = useState(0)

  useEffect(() => {
    // Initialize app: get CSRF token for future requests
    const initializeApp = async () => {
      try {
        // Ensure CSRF cookie is set before making any POST requests
        await apiService.getCsrfToken()
      } catch (error) {
        console.error('Failed to initialize CSRF token:', error)
        // Continue anyway - the user can still try to login/use the app
      }
    }
    
    initializeApp()
  }, [])

  const handleLogin = (userData) => {
    setUser(userData)
    localStorage.setItem('user', JSON.stringify(userData))
    
    // Check if this is the user's first time logging in
    const userKey = userData.id || userData.username || userData.email || 'default'
    const hasSeenWelcome = localStorage.getItem(`hasSeenWelcome_${userKey}`)
    if (!hasSeenWelcome) {
      setShowWelcome(true)
      // Mark as seen when modal opens to prevent repeats on refresh
      localStorage.setItem(`hasSeenWelcome_${userKey}`, 'true')
    }
  }

  const handleUserUpdate = (updatedUser) => {
    setUser(updatedUser)
    localStorage.setItem('user', JSON.stringify(updatedUser))
  }

  const handleLogout = () => {
    authService.logout()
    setUser(null)
    setShowUpload(false)
    setShowProfile(false)
    setShowWelcome(false)
    // Redirect to default page by refreshing the gallery
    setRefreshGallery(prev => prev + 1)
    // Add a brief message to show logout was successful
    setTimeout(() => {
      // You could add a toast notification here if needed
    }, 100)
  }

  const handleWelcomeClose = () => {
    setShowWelcome(false)
  }

  const handleImageUploaded = () => {
    setShowUpload(false)
    setRefreshGallery(prev => prev + 1)
  }

  return (
    <ToastProvider>
      <Routes>
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/verify-email/:token" element={<EmailVerification />} />
        <Route path="/" element={
          <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow-sm border-b">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                  {/* Responsive Logo */}
                  <h1 className="font-bold text-gray-900">
                    <span className="md:hidden text-xl">WG</span>
                    <span className="hidden md:inline text-2xl">Wedding Gallery</span>
                  </h1>
                  
                  <div className="flex items-center space-x-2 md:space-x-4">
                    {user ? (
                      <>
                        {/* Mobile Menu */}
                        <MobileMenu
                          user={user}
                          onUpload={() => setShowUpload(true)}
                          onProfile={() => setShowProfile(true)}
                          onHelp={() => setShowHelp(true)}
                          onLogout={handleLogout}
                        />
                        
                        {/* Desktop Navigation */}
                        <div className="hidden md:flex items-center space-x-4">
                          <button
                            onClick={() => setShowHelp(true)}
                            className="text-gray-600 hover:text-gray-900 transition-colors text-sm"
                          >
                            Help
                          </button>
                          <button
                            onClick={() => setShowProfile(true)}
                            className="flex items-center space-x-2 lg:space-x-3 text-gray-700 hover:text-gray-900 transition-colors p-2 rounded-lg hover:bg-gray-50"
                          >
                            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                              {(() => {
                                if (user?.first_name && user?.last_name) {
                                  return `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase()
                                } else if (user?.first_name) {
                                  return user.first_name.charAt(0).toUpperCase()
                                } else if (user?.username) {
                                  return user.username.charAt(0).toUpperCase()
                                } else {
                                  return '?'
                                }
                              })()}
                            </div>
                            <div className="hidden lg:flex flex-col items-start">
                              <span className="text-sm font-medium">
                                {user?.first_name && user?.last_name 
                                  ? `${user.first_name} ${user.last_name}`
                                  : user?.first_name || user?.username || 'User'
                                }
                              </span>
                            </div>
                          </button>
                          {user.can_upload_images && (
                            <button
                              onClick={() => setShowUpload(true)}
                              className="bg-blue-600 text-white px-3 lg:px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm"
                            >
                              <span className="hidden lg:inline">Upload Image</span>
                              <span className="lg:hidden">Upload</span>
                            </button>
                          )}
                          <button
                            onClick={handleLogout}
                            className="text-gray-600 hover:text-gray-900 transition-colors text-sm"
                          >
                            Logout
                          </button>
                        </div>
                      </>
                    ) : (
                      <Auth onLogin={handleLogin} />
                    )}
                  </div>
                </div>
              </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <ImageGallery user={user} refresh={refreshGallery} />
            </main>

            {showUpload && user && user.can_upload_images && (
              <ImageUpload 
                user={user} 
                onImageUploaded={handleImageUploaded}
                onCancel={() => setShowUpload(false)}
              />
            )}

            {showProfile && user && (
              <UserProfile 
                user={user}
                onClose={() => setShowProfile(false)}
                onUserUpdate={handleUserUpdate}
                onUpload={() => setShowUpload(true)}
              />
            )}

            <WelcomeModal
              isOpen={showWelcome}
              onClose={handleWelcomeClose}
            />

            <HelpModal
              isOpen={showHelp}
              onClose={() => setShowHelp(false)}
            />
          </div>
        } />
      </Routes>
    </ToastProvider>
  )
}

export default App