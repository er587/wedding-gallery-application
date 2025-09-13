import { useState, useEffect } from 'react'
import { apiService } from '../services/api'
import ImageUpload from './ImageUpload'

export default function UserProfile({ user, onClose, onUserUpdate }) {
  // Guard clause - if no user, don't render
  if (!user) {
    return null
  }

  const [userImages, setUserImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('profile')
  const [editMode, setEditMode] = useState(false)
  const [profileData, setProfileData] = useState({
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    email: user.email || ''
  })
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  })
  const [updateLoading, setUpdateLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (user?.id) {
      fetchUserImages()
    }
  }, [user?.id])

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleEscKey)

    return () => {
      // Re-enable body scroll when modal closes
      document.body.style.overflow = 'unset'
      document.removeEventListener('keydown', handleEscKey)
    }
  }, [onClose])

  const fetchUserImages = async () => {
    try {
      setLoading(true)
      // Fetch liked images instead of uploaded images
      const response = await apiService.getLikedImages()
      setUserImages(response.data.results || response.data || [])
    } catch (error) {
      console.error('Error fetching liked images:', error)
      setUserImages([])
    } finally {
      setLoading(false)
    }
  }

  const handleProfileUpdate = async (e) => {
    e.preventDefault()
    setUpdateLoading(true)
    setMessage('')
    setError('')

    try {
      const response = await apiService.updateProfile(profileData)
      
      if (response.data.user) {
        setMessage('Profile updated successfully!')
        setEditMode(false)
        
        // Update user data in parent component
        if (onUserUpdate) {
          onUserUpdate(response.data.user)
        }
      }
    } catch (error) {
      console.error('Profile update error:', error)
      setError(error.response?.data?.error || 'Failed to update profile')
    } finally {
      setUpdateLoading(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setPasswordLoading(true)
    setMessage('')
    setError('')

    if (passwordData.new_password !== passwordData.confirm_password) {
      setError('New passwords do not match')
      setPasswordLoading(false)
      return
    }

    try {
      const response = await apiService.changePassword({
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      })
      
      setMessage('Password changed successfully!')
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: ''
      })
    } catch (error) {
      console.error('Password change error:', error)
      setError(error.response?.data?.error || 'Failed to change password')
    } finally {
      setPasswordLoading(false)
    }
  }

  const getFullName = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name} ${user.last_name}`
    }
    return user?.first_name || user?.username || 'User'
  }

  const getInitials = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase()
    }
    if (user?.first_name) {
      return user.first_name.charAt(0).toUpperCase()
    }
    if (user?.username) {
      return user.username.charAt(0).toUpperCase()
    }
    return '?'
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        // Close modal when clicking outside the modal content
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div 
        className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white text-xl font-bold">
                {getInitials()}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{getFullName()}</h2>
                <p className="text-gray-600">{user?.email || user?.username}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-colors"
              title="Close profile"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Message/Error Display */}
        {(message || error) && (
          <div className="px-6 pt-4">
            {message && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md mb-4">
                {message}
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === 'profile' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === 'settings' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Settings
          </button>
          <button
            onClick={() => setActiveTab('images')}
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === 'images' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Liked Images ({userImages.length})
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Profile Information</h3>
                <button
                  onClick={() => setEditMode(!editMode)}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  {editMode ? 'Cancel' : 'Edit Profile'}
                </button>
              </div>

              {editMode ? (
                <form onSubmit={handleProfileUpdate} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        First Name
                      </label>
                      <input
                        type="text"
                        value={profileData.first_name}
                        onChange={(e) => setProfileData({...profileData, first_name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter your first name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={profileData.last_name}
                        onChange={(e) => setProfileData({...profileData, last_name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter your last name"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter your email"
                    />
                  </div>
                  <div className="flex space-x-4">
                    <button
                      type="submit"
                      disabled={updateLoading}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {updateLoading ? 'Updating...' : 'Update Profile'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditMode(false)}
                      className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div>
                    <span className="text-sm font-medium text-gray-500">Full Name:</span>
                    <span className="ml-2 text-sm text-gray-900">{getFullName()}</span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">Email:</span>
                    <span className="ml-2 text-sm text-gray-900">{user.email || 'Not provided'}</span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">Username:</span>
                    <span className="ml-2 text-sm text-gray-900">{user?.email || user?.username}</span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">Images Liked:</span>
                    <span className="ml-2 text-sm text-gray-900">{userImages.length}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Change Password</h3>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={passwordData.current_password}
                      onChange={(e) => setPasswordData({...passwordData, current_password: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter your current password"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={passwordData.new_password}
                      onChange={(e) => setPasswordData({...passwordData, new_password: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter your new password"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={passwordData.confirm_password}
                      onChange={(e) => setPasswordData({...passwordData, confirm_password: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Confirm your new password"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
                  >
                    {passwordLoading ? 'Changing...' : 'Change Password'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'images' && (
            <div className="space-y-6">
              {/* Image Upload Section */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Upload New Image</h3>
                <ImageUpload 
                  user={user} 
                  onImageUploaded={() => {
                    setMessage('Image uploaded successfully!')
                    // Refresh the gallery after upload
                    window.location.reload()
                  }}
                  onCancel={() => {}}
                />
              </div>
              
              {/* Liked Images Section */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Your Liked Images</h3>
                {loading ? (
                  <div className="text-center py-8">Loading liked images...</div>
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
                    <div className="text-gray-500">No liked images yet</div>
                    <p className="text-gray-400 text-sm mt-1">Heart some images to see them here!</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}