import { useState, useEffect, useCallback, useRef } from 'react'
import ImageViewer from './ImageViewer'
import SearchBar from './SearchBar'
import InlineEditableText from './InlineEditableText'
import { apiService } from '../services/api'
import { useToast } from './Toast'

export default function ImageGallery({ user, refresh }) {
  const toast = useToast()
  const [images, setImages] = useState([])
  const [selectedImage, setSelectedImage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchParams, setSearchParams] = useState({ search: '', tags: '' })
  const [selectionMode, setSelectionMode] = useState(false)
  
  const [selectedImages, setSelectedImages] = useState(new Set())
  const [downloading, setDownloading] = useState(false)
  const [showSearchBar, setShowSearchBar] = useState(false)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 8, // Reduced from 12 to 8 for better CPU performance
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
        page_size: pagination.pageSize // Load 12 images per batch
      }
      if (searchParams.search) params.search = searchParams.search
      if (searchParams.tags) params.tags = searchParams.tags
      
      const response = await apiService.getImages(params)
      
      // Handle both paginated and non-paginated responses
      const newImages = response.data.results || response.data
      const hasMore = response.data.next ? true : false
      
      // Add staggered loading delay to prevent CPU spike from decoding all images at once
      if (!isInitialLoad && Array.isArray(newImages) && newImages.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      if (isInitialLoad) {
        setImages(Array.isArray(newImages) ? newImages : [])
        setPagination(prev => ({ 
          ...prev, 
          page: 2, 
          hasMore: hasMore && newImages.length === pagination.pageSize
        }))
      } else {
        if (Array.isArray(newImages) && newImages.length > 0) {
          // Filter out duplicates by checking existing image IDs
          setImages(prev => {
            const existingIds = new Set(prev.map(img => img.id))
            const uniqueNewImages = newImages.filter(img => !existingIds.has(img.id))
            return [...prev, ...uniqueNewImages]
          })
          setPagination(prev => ({ 
            ...prev, 
            page: prev.page + 1, 
            hasMore: hasMore && newImages.length === pagination.pageSize
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

  const handleLike = async (imageId) => {
    if (!user) return

    try {
      const response = await apiService.toggleLike(imageId)
      
      // Update the image in the local state
      setImages(prevImages => 
        prevImages.map(img => 
          img.id === imageId 
            ? {
                ...img, 
                like_count: response.data.like_count,
                user_has_liked: response.data.liked
              }
            : img
        )
      )
    } catch (error) {
      console.error('Error toggling like:', error)
    }
  }

  const handleDeleteImage = async (imageId, imageTitle) => {
    if (!user) {
      toast.warning('Please log in to delete images')
      return
    }

    // Confirm deletion
    if (!confirm(`Are you sure you want to delete "${imageTitle}"? This cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/images/${imageId}/`, {
        method: 'DELETE',
        headers: {
          'X-CSRFToken': document.cookie.split('; ').find(row => row.startsWith('csrftoken='))?.split('=')[1],
        },
        credentials: 'include',
      })

      if (response.ok) {
        // Remove the image from the local state
        setImages(prevImages => prevImages.filter(img => img.id !== imageId))
        toast.success('Image deleted successfully')
        
        // Close image viewer if it's open for this image
        if (selectedImage && selectedImage.id === imageId) {
          setSelectedImage(null)
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        toast.error(errorData.error || 'Failed to delete image')
      }
    } catch (error) {
      console.error('Error deleting image:', error)
      toast.error('Failed to delete image')
    }
  }

  const handleUpdateImageTitle = async (imageId, newTitle) => {
    try {
      await apiService.updateImage(imageId, { title: newTitle })
      
      // Update the image in the local state
      setImages(prevImages => 
        prevImages.map(img => 
          img.id === imageId 
            ? { ...img, title: newTitle }
            : img
        )
      )
      
      // Update selected image if it's currently being viewed
      if (selectedImage && selectedImage.id === imageId) {
        setSelectedImage(prev => ({ ...prev, title: newTitle }))
      }
    } catch (error) {
      console.error('Error updating image title:', error)
      throw error // Re-throw so InlineEditableText can handle the error
    }
  }

  const canDeleteImage = (image) => {
    if (!user) return false
    
    // Only allow image owner to delete their own image
    return (image.uploader.id === user.id)
  }

  const canEditImage = (image) => {
    if (!user) return false
    
    // Only allow image owner to edit their own image
    return (image.uploader.id === user.id)
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

  // Track scroll position for back-to-top button
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Add ref for intersection observer
  const loadingTriggerRef = useRef(null)

  useEffect(() => {
    // Use Intersection Observer for more reliable infinite scroll
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting && !pagination.loadingMore && pagination.hasMore) {
          loadMoreImages()
        }
      },
      {
        root: null, // Use viewport as root
        rootMargin: '200px', // Reduced from 800px to 200px to prevent aggressive pre-loading
        threshold: 0
      }
    )

    if (loadingTriggerRef.current) {
      observer.observe(loadingTriggerRef.current)
    }

    return () => {
      if (loadingTriggerRef.current) {
        observer.unobserve(loadingTriggerRef.current)
      }
    }
  }, [pagination.loadingMore, pagination.hasMore])

  const handleImageDeleted = (deletedImageId) => {
    // Remove the deleted image from the local state
    setImages(prevImages => prevImages.filter(image => image.id !== deletedImageId))
  }

  const handleImageTitleUpdated = (imageId, newTitle) => {
    // Update the image title in the gallery's local state
    setImages(prevImages => 
      prevImages.map(img => 
        img.id === imageId 
          ? { ...img, title: newTitle }
          : img
      )
    )
  }

  const handleNavigateToImage = (direction) => {
    if (!selectedImage) return
    
    const currentIndex = images.findIndex(img => img.id === selectedImage.id)
    if (currentIndex === -1) return
    
    let newIndex
    if (direction === 'next') {
      newIndex = currentIndex + 1
      if (newIndex >= images.length) return // At the end
    } else {
      newIndex = currentIndex - 1
      if (newIndex < 0) return // At the beginning
    }
    
    setSelectedImage(images[newIndex])
  }

  const handleSearch = (searchTerm) => {
    setSearchParams(prev => ({ ...prev, search: searchTerm }))
  }

  const handleTagFilter = (tags) => {
    setSearchParams(prev => ({ ...prev, tags: tags }))
  }

  const removeSearchFilter = () => {
    setSearchParams(prev => ({ ...prev, search: '' }))
  }

  const removeTagFilter = (tagToRemove) => {
    const currentTags = searchParams.tags.split(',').map(t => t.trim()).filter(Boolean)
    const newTags = currentTags.filter(tag => tag !== tagToRemove)
    setSearchParams(prev => ({ ...prev, tags: newTags.join(',') }))
  }

  const clearAllFilters = () => {
    setSearchParams({ search: '', tags: '' })
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
      toast.error('Failed to download some images. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
    // Check if wedding-hero.png exists in root, otherwise use /assets/ (for production)
    const heroImageSrc = import.meta.env.PROD ? '/assets/wedding-hero.png' : '/wedding-hero.png'
    
    return (
      <div className="text-center py-8 md:py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4 px-4">Welcome to Wedding Gallery</h2>
        <div className="mb-6 md:mb-8 flex justify-center px-4">
          <img 
            src={heroImageSrc}
            alt="Wedding couple silhouette at sunset" 
            className="rounded-lg shadow-2xl w-full max-w-xs md:max-w-sm object-cover"
            onError={(e) => {
              // Fallback: if image fails to load, try the alternative path
              if (e.target.src.includes('/assets/')) {
                e.target.src = '/wedding-hero.png'
              } else {
                e.target.src = '/assets/wedding-hero.png'
              }
            }}
          />
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-md mx-auto mx-4">
          <p className="text-blue-800 font-medium mb-2">Ready to explore?</p>
          <p className="text-blue-700 text-sm">
            Use your invitation code to signup, view, download and share pictures.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Wedding Gallery Information */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200 p-6 mb-6">
        <p className="text-gray-700 leading-relaxed text-center">
          Welcome to our wedding gallery! Browse and enjoy photos from our special day. Click any image to view it full-size, leave comments to share your memories, and download images to keep. We'd love for you to upload any photos you took of us to add to this collection of treasured moments.
        </p>
      </div>

      {/* Search & Filter Toggle */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowSearchBar(!showSearchBar)}
              className={`px-4 py-2 rounded-md transition-colors ${
                showSearchBar
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span>{showSearchBar ? 'Hide Search' : 'Search & Filter'}</span>
              </span>
            </button>
            
            {images.length > 0 && (
              <button
                onClick={toggleSelectionMode}
                className={`px-4 py-2 rounded-md transition-colors ${
                  selectionMode
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                  <span>{selectionMode ? 'Cancel Selection' : 'Select Images'}</span>
                </span>
              </button>
            )}
          </div>
          
          {selectionMode && (
            <div className="flex items-center space-x-4">
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
              
              {selectedImages.size > 0 && (
                <div className="flex items-center space-x-3 ml-4">
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
          )}
        </div>
      </div>
      
      {/* Collapsible Search Bar */}
      {showSearchBar && (
        <div className="mb-6">
          <SearchBar 
            onSearch={handleSearch} 
            onTagFilter={handleTagFilter}
            currentSearch={searchParams.search}
            currentTags={searchParams.tags}
          />
        </div>
      )}

      {/* Active Filters Display */}
      {(searchParams.search || searchParams.tags) && (
        <div className="bg-white rounded-lg shadow-md border p-4 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-700">Active Filters:</span>
              
              {/* Search filter badge */}
              {searchParams.search && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Search: "{searchParams.search}"
                  <button
                    onClick={removeSearchFilter}
                    className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                    aria-label="Remove search filter"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              
              {/* Tag filter badges */}
              {searchParams.tags && searchParams.tags.split(',').map(t => t.trim()).filter(Boolean).map((tag, index) => (
                <span 
                  key={index}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-800 rounded-full text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  #{tag}
                  <button
                    onClick={() => removeTagFilter(tag)}
                    className="hover:bg-purple-200 rounded-full p-0.5 transition-colors"
                    aria-label={`Remove ${tag} filter`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>

            {/* Clear all button */}
            <button
              onClick={clearAllFilters}
              className="text-sm text-gray-600 hover:text-gray-800 hover:underline transition-colors"
            >
              Clear All
            </button>
          </div>
        </div>
      )}
      
      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {images.map((image, index) => (
            <div
              key={image.id}
              className={`bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-all relative ${
                selectionMode && selectedImages.has(image.id) ? 'ring-4 ring-blue-500' : ''
              }`}
            >
              <div 
                className="aspect-square relative overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 cursor-pointer"
                onClick={(e) => {
                  if (selectionMode) {
                    e.stopPropagation()
                    toggleImageSelection(image.id)
                  } else {
                    setSelectedImage(image)
                  }
                }}
              >
                {/* Loading placeholder with shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                <img
                  src={image.thumbnail_square_320 || image.thumbnail_medium || image.thumbnail_url || image.image_file}
                  srcSet={`
                    ${image.thumbnail_square_160 || image.thumbnail_small} 160w,
                    ${image.thumbnail_square_320 || image.thumbnail_medium} 320w,
                    ${image.thumbnail_square_640 || image.thumbnail_large} 640w
                  `.trim()}
                  sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  alt={image.title}
                  className="absolute inset-0 w-full h-full object-cover transition-transform hover:scale-105 z-10"
                  style={{ 
                    aspectRatio: '1/1',
                    // Stagger image decode start based on index to spread CPU load
                    animationDelay: `${index * 50}ms`
                  }}
                  loading="lazy"
                  decoding="async"
                  onLoad={(e) => {
                    // Use RAF to prevent layout thrashing
                    requestAnimationFrame(() => {
                      const shimmer = e.target.previousElementSibling
                      if (shimmer) shimmer.style.display = 'none'
                    })
                  }}
                />
                
                {/* Selection checkbox - only show in selection mode */}
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
                
                {/* Selection overlay - only show in selection mode */}
                {selectionMode && selectedImages.has(image.id) && (
                  <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
                    <div className="bg-blue-600 text-white rounded-full p-2">
                      ✓
                    </div>
                  </div>
                )}
              </div>
            <div className="p-4">
              <InlineEditableText
                value={image.title}
                onSave={(newTitle) => handleUpdateImageTitle(image.id, newTitle)}
                className="font-semibold text-gray-900 truncate"
                placeholder="Enter image title..."
                canEdit={canEditImage(image)}
              />
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
                <span>by {image.uploader.first_name && image.uploader.last_name ? `${image.uploader.first_name} ${image.uploader.last_name}` : image.uploader.first_name || image.uploader.username}</span>
                <div className="flex items-center space-x-3">
                  <span>{image.comment_count} comments</span>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleLike(image.id)
                      }}
                      className={`flex items-center space-x-1 px-2 py-1 rounded-md transition-colors ${
                        image.user_has_liked 
                          ? 'text-red-600 hover:text-red-700' 
                          : 'text-gray-500 hover:text-red-500'
                      }`}
                      disabled={!user}
                    >
                      <svg 
                        className={`w-4 h-4 ${image.user_has_liked ? 'fill-current' : ''}`} 
                        fill={image.user_has_liked ? 'currentColor' : 'none'} 
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
                      <span>{image.like_count || 0}</span>
                    </button>

                    {/* Delete button - only show if user can delete */}
                    {canDeleteImage(image) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteImage(image.id, image.title)
                        }}
                        className="flex items-center px-2 py-1 rounded-md transition-colors text-red-500 hover:text-red-600 hover:bg-red-50"
                        title="Delete image"
                      >
                        <svg 
                          className="w-4 h-4" 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
        </div>
      )}

      {/* Invisible trigger for Intersection Observer */}
      {images.length > 0 && pagination.hasMore && (
        <div 
          ref={loadingTriggerRef} 
          className="h-1 w-full"
          style={{ position: 'relative', bottom: '200px' }}
        />
      )}

      {images.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📸</div>
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">No memories shared yet</h2>
          <p className="text-gray-400 mt-2">Be the first to share a memory!</p>
        </div>
      )}

      {/* Loading More Indicator */}
      {pagination.loadingMore && (
        <div className="text-center mt-8 mb-8">
          <div className="inline-flex items-center space-x-3 bg-white px-6 py-4 rounded-lg shadow-md">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-200 border-t-blue-600"></div>
            <span className="text-gray-700 font-medium">Loading more images...</span>
          </div>
        </div>
      )}

      {/* Load More Button */}
      {images.length > 0 && pagination.hasMore && !pagination.loadingMore && (
        <div className="text-center mt-8 mb-8">
          <button
            onClick={loadMoreImages}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-8 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
          >
            Load More Images
          </button>
        </div>
      )}

      {/* End of Results */}
      {images.length > 0 && !pagination.hasMore && (
        <div className="text-center mt-8 mb-8 text-gray-500">
          <div className="text-4xl mb-2">🎉</div>
          <p>You've reached the end of the gallery</p>
          <p className="text-sm">All {images.length} images loaded</p>
        </div>
      )}


      {selectedImage && (
        <ImageViewer 
          image={selectedImage} 
          user={user}
          onClose={() => setSelectedImage(null)}
          onImageDeleted={handleImageDeleted}
          onTitleUpdated={handleImageTitleUpdated}
          images={images}
          currentIndex={images.findIndex(img => img.id === selectedImage.id)}
          onNavigate={handleNavigateToImage}
        />
      )}

      {/* Floating Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 z-50 group"
          aria-label="Back to top"
        >
          <svg 
            className="w-6 h-6 transform group-hover:-translate-y-1 transition-transform" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M5 10l7-7m0 0l7 7m-7-7v18" 
            />
          </svg>
        </button>
      )}
    </>
  )
}
