import { useState, useEffect } from 'react'
import ImageGallery from './components/ImageGallery'
import ImageUpload from './components/ImageUpload'
import Auth from './components/Auth'

function App() {
  const [user, setUser] = useState(null)
  const [showUpload, setShowUpload] = useState(false)
  const [refreshGallery, setRefreshGallery] = useState(0)

  useEffect(() => {
    // Check if user is logged in (placeholder for now)
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }
  }, [])

  const handleLogin = (userData) => {
    setUser(userData)
    localStorage.setItem('user', JSON.stringify(userData))
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('user')
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
            <h1 className="text-2xl font-bold text-gray-900">Memory Gallery</h1>
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <span className="text-gray-700">Welcome, {user.username}</span>
                  <button
                    onClick={() => setShowUpload(!showUpload)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    {showUpload ? 'Cancel' : 'Upload Image'}
                  </button>
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
        {showUpload && user && (
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
    </div>
  )
}

export default App