import { useState, useEffect, useRef } from 'react'
import CommentSystem from './CommentSystem'
import { apiService } from '../services/api'

export default function ImageViewer({ image, user, onClose, onImageDeleted }) {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [imageData, setImageData] = useState(image) // Local copy for like updates
  const [showMobileComments, setShowMobileComments] = useState(false)
  const intervalRef = useRef(null)

  useEffect(() => {
    fetchComments()
    
    // Set up real-time comment updates (every 10 seconds)
    intervalRef.current = setInterval(() => {
      fetchComments()
    }, 10000)
    
    // Cleanup interval on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [imageData.id])

  const fetchComments = async () => {
    try {
      setLoading(true)
      const response = await apiService.getComments(imageData.id)
      setComments(response.data)
    } catch (error) {
      console.error('Error fetching comments:', error)
      setComments([])
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteImage = async () => {
    if (!window.confirm('Are you sure you want to delete this image? This action cannot be undone.')) {
      return
    }

    setDeleting(true)
    try {
      await apiService.deleteImage(imageData.id)
      onImageDeleted(imageData.id)
      onClose()
    } catch (error) {
      console.error('Error deleting image:', error)
      alert('Failed to delete image. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const canDeleteImage = () => {
    if (!user) return false
    
    // Only allow image owner to delete their own image
    return (imageData.uploader && user.id === imageData.uploader.id)
  }

  const handleSaveImage = async () => {
    try {
      const response = await fetch(imageData.image_file)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = `${imageData.title || 'image'}.${blob.type.split('/')[1] || 'jpg'}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error saving image:', error)
      alert('Failed to save image. Please try again.')
    }
  }

  const handleLike = async () => {
    if (!user) return

    try {
      const response = await apiService.toggleLike(imageData.id)
      
      setImageData(prev => ({
        ...prev,
        like_count: response.data.like_count,
        user_has_liked: response.data.liked
      }))
    } catch (error) {
      console.error('Error toggling like:', error)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
      {/* Mobile-first responsive modal */}
      <div className="bg-white w-full h-full md:rounded-lg md:max-w-7xl md:w-full md:max-h-[95vh] md:m-4 overflow-hidden flex flex-col md:flex-row relative">
        {/* Dismiss button in top left */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 z-20 p-2 rounded-full bg-black bg-opacity-50 hover:bg-opacity-70 text-white transition-all shadow-md md:bg-white md:bg-opacity-80 md:hover:bg-opacity-100 md:text-gray-600 md:hover:text-gray-800"
          title="Close"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        
        {/* Image Section - Full height on mobile, flexible on desktop */}
        <div className="flex-1 bg-black flex items-center justify-center min-h-0 order-1 md:order-1">
          <img
            src={imageData.image_file}
            srcSet={`
              ${imageData.thumbnail_large} 600w,
              ${imageData.image_file} 1200w
            `.trim()}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 100vw"
            alt={imageData.title}
            className="max-w-full max-h-full object-contain w-full"
            style={{ maxHeight: 'calc(100vh - 200px)' }} // Reserve space for mobile social bar
          />
        </div>
        
        {/* Mobile Social Bar - Bottom overlay */}
        <div className="md:hidden absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent p-4 text-white order-2">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="font-semibold text-lg">{imageData.title}</h2>
              <p className="text-sm text-gray-200">by {imageData.uploader.first_name && imageData.uploader.last_name ? `${imageData.uploader.first_name} ${imageData.uploader.last_name}` : imageData.uploader.first_name || imageData.uploader.username}</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleLike}
                className={`flex items-center space-x-1 px-2 py-1 rounded-md transition-colors ${
                  imageData.user_has_liked 
                    ? 'text-red-400 hover:text-red-300' 
                    : 'text-white hover:text-red-400'
                }`}
                disabled={!user}
                title={imageData.user_has_liked ? 'Unlike' : 'Like'}
              >
                <svg 
                  className={`w-5 h-5 ${imageData.user_has_liked ? 'fill-current' : ''}`} 
                  fill={imageData.user_has_liked ? 'currentColor' : 'none'} 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" 
                  />
                </svg>
                <span className="text-sm">{imageData.like_count || 0}</span>
              </button>
              <button
                onClick={handleSaveImage}
                className="text-white hover:text-blue-400 text-sm px-2 py-1 rounded transition-colors flex items-center gap-1"
                title="Save image to device"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
              {canDeleteImage() && (
                <button
                  onClick={handleDeleteImage}
                  disabled={deleting}
                  className="text-white hover:text-red-400 text-sm px-2 py-1 rounded transition-colors disabled:opacity-50"
                  title="Delete image"
                >
                  {deleting ? '...' : '🗑️'}
                </button>
              )}
              <button
                onClick={() => setShowMobileComments(true)}
                className="text-white hover:text-blue-400 text-sm px-2 py-1 rounded transition-colors flex items-center gap-1"
                title="View comments"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
                </svg>
                <span className="text-xs">{comments.length}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Comments Drawer */}
        {showMobileComments && (
          <div className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-30" onClick={() => setShowMobileComments(false)}>
            <div 
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-lg max-h-[70vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drawer Header */}
              <div className="p-4 border-b flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-lg">{imageData.title}</h3>
                  <p className="text-sm text-gray-600">Comments & Memories</p>
                </div>
                <button
                  onClick={() => setShowMobileComments(false)}
                  className="p-2 text-gray-500 hover:text-gray-700"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              {/* Comments Content */}
              <div className="flex-1 overflow-y-auto">
                <CommentSystem
                  imageId={image.id}
                  comments={comments}
                  user={user}
                  loading={loading}
                  onCommentAdded={fetchComments}
                />
              </div>
            </div>
          </div>
        )}
        
        {/* Comments Section - Hidden on mobile, sidebar on desktop */}
        <div className="hidden md:flex md:w-80 bg-white flex-col order-3 md:order-2">
          {/* Header */}
          <div className="p-4 border-b">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-semibold text-lg">{imageData.title}</h2>
                <p className="text-sm text-gray-600">by {imageData.uploader.first_name && imageData.uploader.last_name ? `${imageData.uploader.first_name} ${imageData.uploader.last_name}` : imageData.uploader.first_name || imageData.uploader.username}</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleLike}
                  className={`flex items-center space-x-1 px-2 py-1 rounded-md transition-colors ${
                    imageData.user_has_liked 
                      ? 'text-red-600 hover:text-red-700' 
                      : 'text-gray-500 hover:text-red-500'
                  }`}
                  disabled={!user}
                  title={imageData.user_has_liked ? 'Unlike' : 'Like'}
                >
                  <svg 
                    className={`w-5 h-5 ${imageData.user_has_liked ? 'fill-current' : ''}`} 
                    fill={imageData.user_has_liked ? 'currentColor' : 'none'} 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" 
                    />
                  </svg>
                  <span>{imageData.like_count || 0}</span>
                </button>
                <button
                  onClick={handleSaveImage}
                  className="text-blue-500 hover:text-blue-700 text-sm px-3 py-1 rounded border border-blue-500 hover:border-blue-700 transition-colors flex items-center gap-1"
                  title="Save image to device"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Save
                </button>
                {canDeleteImage() && (
                  <button
                    onClick={handleDeleteImage}
                    disabled={deleting}
                    className="text-red-500 hover:text-red-700 text-sm px-2 py-1 rounded border border-red-500 hover:border-red-700 transition-colors disabled:opacity-50"
                    title="Delete image"
                  >
                    {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                )}
              </div>
            </div>
            {imageData.description && (
              <p className="text-gray-700 mt-2">{imageData.description}</p>
            )}
          </div>

          {/* Comments */}
          <div className="flex-1 overflow-y-auto">
            <CommentSystem
              imageId={image.id}
              comments={comments}
              user={user}
              loading={loading}
              onCommentAdded={fetchComments}
            />
          </div>
        </div>
      </div>
    </div>
  )
}