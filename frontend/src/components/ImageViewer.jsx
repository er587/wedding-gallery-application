import { useState, useEffect, useRef } from 'react'
import CommentSystem from './CommentSystem'
import { apiService } from '../services/api'

export default function ImageViewer({ image, user, onClose, onImageDeleted }) {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [imageData, setImageData] = useState(image) // Local copy for like updates
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex">
        {/* Image Section */}
        <div className="flex-1 bg-black flex items-center justify-center">
          <img
            src={imageData.image_file}
            alt={imageData.title}
            className="max-w-full max-h-full object-contain"
          />
        </div>
        
        {/* Comments Section */}
        <div className="w-80 bg-white flex flex-col">
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
                  className="text-blue-500 hover:text-blue-700 text-sm px-2 py-1 rounded border border-blue-500 hover:border-blue-700 transition-colors"
                  title="Save image to device"
                >
                  💾 Save
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
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ✕
                </button>
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