import { useState, useEffect } from 'react'
import { apiService } from '../services/api'

export default function UserProfile({ user, onClose }) {
  const [userImages, setUserImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('images')

  useEffect(() => {
    fetchUserImages()
  }, [user.id])

  const fetchUserImages = async () => {
    try {
      setLoading(true)
      const response = await apiService.getImages()
      // Filter images by current user (in a real app, this would be done server-side)
      const currentUserImages = response.data.filter(img => img.uploader.username === user.username)
      setUserImages(currentUserImages)
    } catch (error) {
      console.error('Error fetching user images:', error)
      setUserImages([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{user.first_name || user.username}</h2>
                <p className="text-gray-600">@{user.username}</p>
                {user.email && <p className="text-gray-500 text-sm">{user.email}</p>}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('images')}
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === 'images' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Images ({userImages.length})
          </button>
          <button
            onClick={() => setActiveTab('about')}
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === 'about' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            About
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {activeTab === 'images' && (
            <div>
              {loading ? (
                <div className="text-center py-8">Loading images...</div>
              ) : userImages.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {userImages.map((image) => (
                    <div key={image.id} className="bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={image.image_file}
                        alt={image.title}
                        className="w-full h-32 object-cover"
                      />
                      <div className="p-2">
                        <h4 className="text-sm font-medium truncate">{image.title}</h4>
                        <p className="text-xs text-gray-500 mt-1">{image.comment_count} comments</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-gray-500">No images uploaded yet</div>
                  <p className="text-gray-400 text-sm mt-1">Start sharing your memories!</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'about' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">About {user.first_name || user.username}</h3>
                <div className="mt-4 space-y-2">
                  <div>
                    <span className="text-sm font-medium text-gray-500">Username:</span>
                    <span className="ml-2 text-sm text-gray-900">{user.username}</span>
                  </div>
                  {user.email && (
                    <div>
                      <span className="text-sm font-medium text-gray-500">Email:</span>
                      <span className="ml-2 text-sm text-gray-900">{user.email}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-sm font-medium text-gray-500">Images shared:</span>
                    <span className="ml-2 text-sm text-gray-900">{userImages.length}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}