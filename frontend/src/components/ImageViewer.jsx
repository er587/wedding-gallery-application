import { useState, useEffect, useRef } from 'react'
import CommentSystem from './CommentSystem'
import { apiService } from '../services/api'

export default function ImageViewer({ image, user, onClose, onImageDeleted }) {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
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
  }, [image.id])

  const fetchComments = async () => {
    try {
      setLoading(true)
      const response = await apiService.getComments(image.id)
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
      await apiService.deleteImage(image.id)
      onImageDeleted(image.id)
      onClose()
    } catch (error) {
      console.error('Error deleting image:', error)
      alert('Failed to delete image. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const canDeleteImage = user && image.uploader && user.username === image.uploader.username && user.can_delete_images

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex">
        {/* Image Section */}
        <div className="flex-1 bg-black flex items-center justify-center">
          <img
            src={image.image_file}
            alt={image.title}
            className="max-w-full max-h-full object-contain"
          />
        </div>
        
        {/* Comments Section */}
        <div className="w-80 bg-white flex flex-col">
          {/* Header */}
          <div className="p-4 border-b">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-semibold text-lg">{image.title}</h2>
                <p className="text-sm text-gray-600">by {image.uploader.username}</p>
              </div>
              <div className="flex items-center space-x-2">
                {canDeleteImage && (
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
            {image.description && (
              <p className="text-gray-700 mt-2">{image.description}</p>
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