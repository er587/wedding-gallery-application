import { useState, useEffect, useCallback } from 'react'
import ImageViewer from './ImageViewer'
import SearchBar from './SearchBar'
import { apiService } from '../services/api'

export default function ImageGallery({ user, refresh }) {
  const [images, setImages] = useState([])
  const [selectedImage, setSelectedImage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchParams, setSearchParams] = useState({ search: '', tags: '' })
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedImages, setSelectedImages] = useState(new Set())
  const [downloading, setDownloading] = useState(false)
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 6,
    hasMore: true,
    loadingMore: false
  })

  const fetchImages = async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) {
        setLoading(true)
        setImages([])
        setPagination(prev => ({ ...prev, page: 1, hasMore: true, loadingMore: false }))
      } else {
        setPagination(prev => ({ ...prev, loadingMore: true }))
      }
      
      // Build query parameters for search and filtering
      const currentPage = isInitialLoad ? 1 : pagination.page
      const params = {
        page: currentPage,
        page_size: isInitialLoad ? pagination.pageSize : 3 // Load 3 more after initial 6
      }
      if (searchParams.search) params.search = searchParams.search
      if (searchParams.tags) params.tags = searchParams.tags
      
      const response = await apiService.getImages(params)
      
      // Handle both paginated and non-paginated responses
      const newImages = response.data.results || response.data
      const hasMore = response.data.next ? true : false
      
      if (isInitialLoad) {
        setImages(Array.isArray(newImages) ? newImages : [])
        setPagination(prev => ({ 
          ...prev, 
          page: 2, 
          hasMore: hasMore && newImages.length === pagination.pageSize
        }))
      } else {
        if (Array.isArray(newImages) && newImages.length > 0) {
          setImages(prev => [...prev, ...newImages])
          setPagination(prev => ({ 
            ...prev, 
            page: prev.page + 1, 
            hasMore: hasMore && newImages.length === 3
          }))
        } else {
          // No more images to load
          setPagination(prev => ({ ...prev, hasMore: false }))
        }
      }
    } catch (error) {
      console.error('Error fetching images:', error)
      if (isInitialLoad) {
        setImages([])
      }
      // Stop trying to load more on error
      setPagination(prev => ({ ...prev, hasMore: false }))
    } finally {
      setLoading(false)
      setPagination(prev => ({ ...prev, loadingMore: false }))
    }
  }

  const loadMoreImages = () => {
    if (!pagination.loadingMore && pagination.hasMore) {
      fetchImages(false)
    }
  }

  useEffect(() => {
    // Only fetch images if user is logged in
    if (user) {
      fetchImages(true) // true means reset/initial load
    } else {
      setImages([])
      setLoading(false)
    }
  }, [refresh, user, searchParams])

  useEffect(() => {
    // Set up scroll listener for infinite scroll
    const handleScroll = () => {
      if (pagination.loadingMore || !pagination.hasMore) return
      
      const scrolledToBottom = window.innerHeight + window.scrollY >= document.documentElement.offsetHeight - 1000
      
      if (scrolledToBottom) {
        loadMoreImages()
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [pagination.loadingMore, pagination.hasMore])

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

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode)
    setSelectedImages(new Set())
  }

  const toggleImageSelection = (imageId) => {
    const newSelected = new Set(selectedImages)
    if (newSelected.has(imageId)) {
      newSelected.delete(imageId)
    } else {
      newSelected.add(imageId)
    }
    setSelectedImages(newSelected)
  }

  const selectAllImages = () => {
    const allImageIds = new Set(images.map(img => img.id))
    setSelectedImages(allImageIds)
  }

  const clearSelection = () => {
    setSelectedImages(new Set())
  }

  const downloadSelectedImages = async () => {
    if (selectedImages.size === 0) return

    setDownloading(true)
    try {
      // For multiple images, we'll download them one by one
      // In a production app, you might want to create a zip file
      const selectedImagesList = images.filter(img => selectedImages.has(img.id))
      
      for (let i = 0; i < selectedImagesList.length; i++) {
        const image = selectedImagesList[i]
        try {
          const response = await fetch(image.image_file)
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          
          const link = document.createElement('a')
          link.href = url
          link.download = `${image.title || `image-${image.id}`}.${blob.type.split('/')[1] || 'jpg'}`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          window.URL.revokeObjectURL(url)
          
          // Small delay between downloads to avoid overwhelming the browser
          if (i < selectedImagesList.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500))
          }
        } catch (error) {
          console.error(`Error downloading image ${image.title}:`, error)
        }
      }
      
      // Clear selection after download
      setSelectedImages(new Set())
      setSelectionMode(false)
      
    } catch (error) {
      console.error('Error downloading images:', error)
      alert('Failed to download some images. Please try again.')
    } finally {
      setDownloading(false)
    }
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
        <h2 className="text-3xl font-bold text-gray-800 mb-4">Welcome to Wedding Gallery</h2>
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
      
      {/* Selection Controls */}
      {images.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={toggleSelectionMode}
                className={`px-4 py-2 rounded-md transition-colors ${
                  selectionMode
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {selectionMode ? 'Cancel Selection' : 'Select Images'}
              </button>
              
              {selectionMode && (
                <>
                  <button
                    onClick={selectAllImages}
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    Select All ({images.length})
                  </button>
                  <button
                    onClick={clearSelection}
                    className="text-sm text-gray-600 hover:text-gray-800 underline"
                  >
                    Clear Selection
                  </button>
                </>
              )}
            </div>
            
            {selectionMode && selectedImages.size > 0 && (
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-600">
                  {selectedImages.size} selected
                </span>
                <button
                  onClick={downloadSelectedImages}
                  disabled={downloading}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                >
                  {downloading ? 'Downloading...' : `💾 Download (${selectedImages.size})`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {images.map((image) => (
          <div
            key={image.id}
            className={`bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-all cursor-pointer relative ${
              selectedImages.has(image.id) ? 'ring-4 ring-blue-500' : ''
            }`}
            onClick={(e) => {
              if (selectionMode) {
                e.stopPropagation()
                toggleImageSelection(image.id)
              } else {
                setSelectedImage(image)
              }
            }}
          >
            <div className="aspect-w-4 aspect-h-3 relative">
              <img
                src={image.image_file}
                alt={image.title}
                className="w-full h-48 object-cover"
              />
              
              {/* Selection checkbox */}
              {selectionMode && (
                <div className="absolute top-2 left-2">
                  <input
                    type="checkbox"
                    checked={selectedImages.has(image.id)}
                    onChange={(e) => {
                      e.stopPropagation()
                      toggleImageSelection(image.id)
                    }}
                    className="w-5 h-5 text-blue-600 bg-white border-2 border-gray-300 rounded focus:ring-blue-500"
                  />
                </div>
              )}
              
              {/* Selection overlay */}
              {selectionMode && selectedImages.has(image.id) && (
                <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
                  <div className="bg-blue-600 text-white rounded-full p-2">
                    ✓
                  </div>
                </div>
              )}
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

      {images.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📸</div>
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">No memories shared yet</h2>
          <p className="text-gray-400 mt-2">Be the first to share a memory!</p>
        </div>
      )}

      {/* Load More Button */}
      {images.length > 0 && pagination.hasMore && !pagination.loadingMore && (
        <div className="text-center mt-8">
          <button
            onClick={loadMoreImages}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Load More Images
          </button>
        </div>
      )}

      {/* Loading More Indicator */}
      {pagination.loadingMore && (
        <div className="text-center mt-8">
          <div className="inline-flex items-center space-x-2 text-gray-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span>Loading more images...</span>
          </div>
        </div>
      )}

      {/* End of Results */}
      {images.length > 0 && !pagination.hasMore && (
        <div className="text-center mt-8 text-gray-500">
          <p>You've reached the end of the gallery</p>
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