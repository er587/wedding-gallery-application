import { useState, useEffect } from 'react'
import ImageViewer from './ImageViewer'
import SearchBar from './SearchBar'
import { apiService } from '../services/api'

export default function ImageGallery({ user, refresh }) {
  const [images, setImages] = useState([])
  const [selectedImage, setSelectedImage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchParams, setSearchParams] = useState({ search: '', tags: '' })

  useEffect(() => {
    // Only fetch images if user is logged in
    if (user) {
      fetchImages()
    } else {
      setImages([])
      setLoading(false)
    }
  }, [refresh, user, searchParams])

  const fetchImages = async () => {
    try {
      setLoading(true)
      // Build query parameters for search and filtering
      const params = {}
      if (searchParams.search) params.search = searchParams.search
      if (searchParams.tags) params.tags = searchParams.tags
      
      const response = await apiService.getImages(params)
      setImages(response.data)
    } catch (error) {
      console.error('Error fetching images:', error)
      setImages([])
    } finally {
      setLoading(false)
    }
  }

  const handleImageDeleted = (deletedImageId) => {
    // Remove the deleted image from the local state
    setImages(prevImages => prevImages.filter(image => image.id !== deletedImageId))
  }

  const handleSearch = (searchTerm) => {
    setSearchParams(prev => ({ ...prev, search: searchTerm }))
  }

  const handleTagFilter = (tags) => {
    setSearchParams(prev => ({ ...prev, tags: tags }))
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading images...</div>
      </div>
    )
  }

  // Show login prompt for logged-out users
  if (!user) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-6">🔒</div>
        <h2 className="text-3xl font-bold text-gray-800 mb-4">Welcome to Memory Gallery</h2>
        <p className="text-xl text-gray-600 mb-8">
          Please log in to view and share precious memories
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-md mx-auto">
          <p className="text-blue-800 font-medium mb-2">Ready to explore?</p>
          <p className="text-blue-700 text-sm">
            Log in above to discover shared memories and upload your own special moments.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <SearchBar onSearch={handleSearch} onTagFilter={handleTagFilter} />
      
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
              
              {/* Display tags */}
              {image.tags && image.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {image.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full"
                    >
                      #{tag.name}
                    </span>
                  ))}
                </div>
              )}
              
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
          <div className="text-6xl mb-4">📸</div>
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">No memories shared yet</h2>
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