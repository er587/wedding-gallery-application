import { useState, useEffect, useRef } from 'react'
import CommentSystem from './CommentSystem'
import FaceTagging from './FaceTagging'
import AdminFaceTagging from './AdminFaceTagging'
import { apiService } from '../services/api'

export default function ImageViewer({ image, user, onClose, onImageDeleted }) {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [imageData, setImageData] = useState(image) // Local copy for like updates
  const [showFaceTagging, setShowFaceTagging] = useState(false)
  const [showFaceOverlay, setShowFaceOverlay] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const intervalRef = useRef(null)
  const imageCanvasRef = useRef(null)
  const imageDisplayRef = useRef(null)

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

  const handleFaceTagged = async () => {
    // Refresh image data to get updated face tags
    try {
      const response = await apiService.getImage(imageData.id)
      setImageData(response.data)
    } catch (error) {
      console.error('Error refreshing image data:', error)
    }
  }

  const drawFaceOverlay = () => {
    const canvas = imageCanvasRef.current
    const img = imageDisplayRef.current
    
    if (!canvas || !img || !imageData.face_tags || imageData.face_tags.length === 0) return

    const ctx = canvas.getContext('2d')
    
    // Set canvas size to match image display size
    const rect = img.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    if (!showFaceOverlay) return // Don't draw if overlay is hidden
    
    // Calculate scale factors
    const scaleX = rect.width / img.naturalWidth
    const scaleY = rect.height / img.naturalHeight
    
    // Draw face tags
    imageData.face_tags.forEach((faceTag, index) => {
      // Convert relative coordinates to pixel coordinates
      const x = faceTag.face_x * rect.width
      const y = faceTag.face_y * rect.height
      const width = faceTag.face_width * rect.width
      const height = faceTag.face_height * rect.height
      
      // Face rectangle
      ctx.strokeStyle = '#10b981' // Green for approved tags
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, width, height)
      
      // Person name label background
      const labelText = faceTag.person.name
      ctx.font = '14px Arial'
      const textWidth = ctx.measureText(labelText).width
      
      ctx.fillStyle = 'rgba(16, 185, 129, 0.9)' // Semi-transparent green
      ctx.fillRect(x, y - 25, textWidth + 10, 20)
      
      // Person name text
      ctx.fillStyle = 'white'
      ctx.fillText(labelText, x + 5, y - 10)
    })
  }

  // Draw face overlay when image data or overlay state changes
  useEffect(() => {
    if (imageDisplayRef.current) {
      // Add a small delay to ensure image is fully loaded
      setTimeout(drawFaceOverlay, 100)
    }
  }, [imageData.face_tags, showFaceOverlay])

  const toggleFaceOverlay = () => {
    setShowFaceOverlay(!showFaceOverlay)
    // Redraw will happen via useEffect
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex">
        {/* Image Section */}
        <div className="flex-1 bg-black flex items-center justify-center relative">
          <img
            ref={imageDisplayRef}
            src={imageData.image_file}
            alt={imageData.title}
            className="max-w-full max-h-full object-contain"
            onLoad={drawFaceOverlay}
          />
          
          {/* Face Overlay Canvas */}
          <canvas
            ref={imageCanvasRef}
            className="absolute top-0 left-0 pointer-events-none"
            style={{ 
              width: '100%', 
              height: '100%',
              objectFit: 'contain'
            }}
          />
        </div>
        
        {/* Comments Section */}
        <div className="w-80 bg-white flex flex-col">
          {/* Header */}
          <div className="p-4 border-b">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-semibold text-lg">{imageData.title}</h2>
                <p className="text-sm text-gray-600">by {imageData.uploader.username}</p>
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
                  onClick={() => setShowFaceTagging(true)}
                  className="text-purple-500 hover:text-purple-700 text-sm px-2 py-1 rounded border border-purple-500 hover:border-purple-700 transition-colors"
                  title="Tag faces in this image"
                  disabled={!user}
                >
                  👤 Tag Faces
                </button>
                {imageData.face_tags && imageData.face_tags.length > 0 && (
                  <button
                    onClick={toggleFaceOverlay}
                    className={`text-sm px-2 py-1 rounded border transition-colors ${
                      showFaceOverlay 
                        ? 'text-green-700 border-green-700 bg-green-50' 
                        : 'text-green-500 border-green-500 hover:text-green-700 hover:border-green-700'
                    }`}
                    title={showFaceOverlay ? 'Hide face tags' : 'Show face tags'}
                  >
                    {showFaceOverlay ? '👁️ Hide Tags' : '👁️ Show Tags'} ({imageData.face_count || 0})
                  </button>
                )}
                {user?.is_staff && (
                  <button
                    onClick={() => setShowAdminPanel(true)}
                    className="text-orange-500 hover:text-orange-700 text-sm px-2 py-1 rounded border border-orange-500 hover:border-orange-700 transition-colors"
                    title="Admin face tag management"
                  >
                    ⚙️ Admin Panel
                  </button>
                )}
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
      
      {/* Face Tagging Modal */}
      <FaceTagging
        image={imageData}
        isOpen={showFaceTagging}
        onClose={() => setShowFaceTagging(false)}
        onFaceTagged={handleFaceTagged}
      />
      
      {/* Admin Panel Modal */}
      {showAdminPanel && (
        <AdminFaceTagging
          user={user}
          onClose={() => setShowAdminPanel(false)}
        />
      )}
    </div>
  )
}