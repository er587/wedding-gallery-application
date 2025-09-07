import { useState, useEffect } from 'react'
import ImageViewer from './ImageViewer'
import { apiService } from '../services/api'

export default function ImageGallery({ user, refresh }) {
  const [images, setImages] = useState([])
  const [selectedImage, setSelectedImage] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchImages()
  }, [refresh])

  const fetchImages = async () => {
    try {
      setLoading(true)
      const response = await apiService.getImages()
      setImages(response.data)
    } catch (error) {
      console.error('Error fetching images:', error)
      // If API fails, show empty state instead of mock data
      setImages([])
    } finally {
      setLoading(false)
    }
  }

  const handleImageDeleted = (deletedImageId) => {
    // Remove the deleted image from the local state
    setImages(prevImages => prevImages.filter(image => image.id !== deletedImageId))
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading images...</div>
      </div>
    )
  }

  // Show welcome message for logged-out users
  const showWelcomeMessage = !user && images.length > 0

  return (
    <>
      {showWelcomeMessage && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-blue-900 mb-2">Welcome to Memory Gallery</h2>
          <p className="text-blue-700">
            Browse shared memories below. Log in to upload your own images and share your memories!
          </p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {images.map((image) => (
          <div
            key={image.id}
            className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => setSelectedImage(image)}
          >
            <div className="aspect-w-4 aspect-h-3">
              <img
                src={image.image_file}
                alt={image.title}
                className="w-full h-48 object-cover"
              />
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 truncate">{image.title}</h3>
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">{image.description}</p>
              <div className="flex justify-between items-center mt-3 text-sm text-gray-500">
                <span>by {image.uploader.username}</span>
                <span>{image.comment_count} comments</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {images.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500 text-lg">No images yet</div>
          <p className="text-gray-400 mt-2">Be the first to share a memory!</p>
        </div>
      )}

      {selectedImage && (
        <ImageViewer 
          image={selectedImage} 
          user={user}
          onClose={() => setSelectedImage(null)}
          onImageDeleted={handleImageDeleted}
        />
      )}
    </>
  )
}