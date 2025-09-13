import { useState, useEffect } from 'react'
import ImageGallery from './components/ImageGallery'
import ImageUpload from './components/ImageUpload'
import Auth from './components/Auth'
import UserProfile from './components/UserProfile'
import WelcomeModal from './components/WelcomeModal'
import { authService } from './services/auth'

function App() {
  const [user, setUser] = useState(null)
  const [showUpload, setShowUpload] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [refreshGallery, setRefreshGallery] = useState(0)

  useEffect(() => {
    // Check if user is already logged in
    const currentUser = authService.getCurrentUser()
    if (currentUser) {
      setUser(currentUser)
    }
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">Wedding Gallery</h1>
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <button
                    onClick={() => setShowWelcome(true)}
                    className="text-gray-600 hover:text-gray-900 transition-colors text-sm"
                  >
                    Help
                  </button>
                  <button
                    onClick={() => setShowProfile(true)}
                    className="flex items-center space-x-3 text-gray-700 hover:text-gray-900 transition-colors p-2 rounded-lg hover:bg-gray-50"
                  >
                    {/* Avatar */}
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
                    {/* User Info */}
                    <div className="flex flex-col items-start">
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
                      onClick={() => setShowUpload(!showUpload)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                    >
                      {showUpload ? 'Cancel' : 'Upload Image'}
                    </button>
                  )}
                  <button
                    onClick={handleLogout}
                    className="text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <Auth onLogin={handleLogin} />
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {showUpload && user && user.can_upload_images && (
          <div className="mb-8">
            <ImageUpload 
              user={user} 
              onImageUploaded={handleImageUploaded}
              onCancel={() => setShowUpload(false)}
            />
          </div>
        )}
        <ImageGallery user={user} refresh={refreshGallery} />
      </main>

      {showProfile && user && (
        <UserProfile 
          user={user}
          onClose={() => setShowProfile(false)}
          onUserUpdate={handleUserUpdate}
        />
      )}

      <WelcomeModal
        isOpen={showWelcome}
        onClose={handleWelcomeClose}
      />
    </div>
  )
}

export default App