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
  const [selectedTags, setSelectedTags] = useState('')
  const [mediaType, setMediaType] = useState('') // '', 'video', or 'image' (set by SearchBar filters)
  const [searchText, setSearchText] = useState('')
  const [viewMode, setViewMode] = useState('all') // 'all', 'videos', or 'favorites'
  const [lastVisitTime] = useState(() => localStorage.getItem('lastGalleryVisit'))
  const [selectionMode, setSelectionMode] = useState(false)
  
  const [selectedImages, setSelectedImages] = useState(new Set())
  const [downloading, setDownloading] = useState(false)
  const [showSearchBar, setShowSearchBar] = useState(false)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [totalImageCount, setTotalImageCount] = useState(0)
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 8, // Reduced from 12 to 8 for better CPU performance
    hasMore: true,
    loadingMore: false
  })
  
  // Ref to track current fetch request ID to prevent stale responses
  const currentFetchIdRef = useRef(0)

  const fetchImageCount = async () => {
    try {
      const response = await apiService.getImageCount()
      setTotalImageCount(response.data.count)
    } catch (error) {
      console.error('Error fetching image count:', error)
    }
  }

  const fetchImages = async (isInitialLoad = false) => {
    try {
      // Increment fetch ID to invalidate any pending requests
      const thisFetchId = ++currentFetchIdRef.current
      
      if (isInitialLoad) {
        setLoading(true)
        setImages([])
        setPagination(prev => ({ ...prev, page: 1, hasMore: true, loadingMore: false }))
      } else {
        setPagination(prev => ({ ...prev, loadingMore: true }))
      }
      
      // Build query parameters for tag filtering and media type
      const currentPage = isInitialLoad ? 1 : pagination.page
      
      // When filtering by tags or media type, fetch ALL matching images
      // Otherwise use normal pagination for better performance
      const effectiveMediaType = viewMode === 'videos' ? 'video' : mediaType
      const isFiltering = selectedTags || effectiveMediaType || searchText
      const params = {
        page: currentPage,
        page_size: isFiltering ? 1000 : pagination.pageSize
      }
      if (selectedTags) params.tags = selectedTags
      if (effectiveMediaType) params.media_type = effectiveMediaType
      if (searchText) params.search = searchText

      // Fetch from favorites endpoint or main gallery
      const response = viewMode === 'favorites' && user
        ? await apiService.getLikedImages(currentPage)
        : await apiService.getImages(params)

      // Save last visit time for "NEW" badge (only on first load of all-images mode)
      if (isInitialLoad && viewMode === 'all') {
        localStorage.setItem('lastGalleryVisit', new Date().toISOString())
      }

      // Check if this response is stale (newer request started)
      if (thisFetchId !== currentFetchIdRef.current) {
        return // Discard stale response
      }
      
      // Handle both paginated and non-paginated responses
      const newImages = response.data.results || response.data
      const hasMore = response.data.next ? true : false
      
      if (isInitialLoad) {
        // When filtering, load all results but chunk them progressively to prevent CPU spikes
        if (isFiltering && Array.isArray(newImages) && newImages.length > 8) {
          // Load first batch immediately
          const firstBatch = newImages.slice(0, 8)
          setImages(firstBatch)
          
          // Disable pagination BEFORE starting progressive load
          setPagination(prev => ({ 
            ...prev, 
            page: 2, 
            hasMore: false,
            loadingMore: false
          }))
          
          // Load remaining images in chunks with delays
          const remainingImages = newImages.slice(8)
          const chunkSize = 8
          
          // Use setTimeout to avoid blocking the main thread
          for (let i = 0; i < remainingImages.length; i += chunkSize) {
            // Check if this request is still current
            if (thisFetchId !== currentFetchIdRef.current) {
              break // Abort if newer request started
            }
            
            const chunk = remainingImages.slice(i, i + chunkSize)
            await new Promise(resolve => setTimeout(resolve, 150))
            
            // Check again after delay
            if (thisFetchId !== currentFetchIdRef.current) {
              break // Abort if newer request started
            }
            
            setImages(prev => [...prev, ...chunk])
          }
        } else {
          // Normal initial load (not filtering or small result set)
          setImages(Array.isArray(newImages) ? newImages : [])
          
          const shouldLoadMore = isFiltering ? false : (hasMore && newImages.length === pagination.pageSize)
          
          setPagination(prev => ({ 
            ...prev, 
            page: 2, 
            hasMore: shouldLoadMore
          }))
        }
      } else {
        // Loading more (non-initial load)
        // Add staggered loading delay to prevent CPU spike from decoding all images at once
        if (Array.isArray(newImages) && newImages.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 100))
          
          // Check if this request is still current after delay
          if (thisFetchId !== currentFetchIdRef.current) {
            return // Discard stale load-more response
          }
          
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

    // Optimistic update: toggle immediately before server responds
    setImages(prevImages =>
      prevImages.map(img =>
        img.id === imageId
          ? {
              ...img,
              user_has_liked: !img.user_has_liked,
              like_count: img.user_has_liked ? img.like_count - 1 : img.like_count + 1,
            }
          : img
      )
    )

    try {
      const response = await apiService.toggleLike(imageId)
      // Reconcile with server truth
      setImages(prevImages =>
        prevImages.map(img =>
          img.id === imageId
            ? {
                ...img,
                like_count: response.data.like_count,
                user_has_liked: response.data.liked,
              }
            : img
        )
      )
    } catch (error) {
      // Revert optimistic update on failure
      setImages(prevImages =>
        prevImages.map(img =>
          img.id === imageId
            ? {
                ...img,
                user_has_liked: !img.user_has_liked,
                like_count: img.user_has_liked ? img.like_count - 1 : img.like_count + 1,
              }
            : img
        )
      )
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
        
        // Update the total image count
        fetchImageCount()
        
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
      fetchImageCount() // Fetch total image count
    } else {
      setImages([])
      setLoading(false)
    }
  }, [refresh, user, selectedTags, mediaType, searchText, viewMode])

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

  const handleTagFilter = (tags) => {
    setSelectedTags(tags)
  }

  const handleMediaTypeFilter = (type) => {
    setMediaType(type)
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
      // Download as single ZIP via backend
      const imageIds = Array.from(selectedImages)
      const response = await apiService.bulkDownload(imageIds)

      // Trigger browser download from blob response
      const url = window.URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = 'wedding-photos.zip'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      // Clear selection after download
      setSelectedImages(new Set())
      setSelectionMode(false)
    } catch (error) {
      console.error('Error downloading images:', error)
      toast.error('Failed to download images. Please try again.')
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
      <div id="tour-filters" className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 md:space-x-4 flex-wrap gap-y-2">
            {/* View mode tabs */}
            <div className="flex rounded-lg overflow-hidden border border-gray-200">
              <button
                onClick={() => setViewMode('all')}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'all'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center space-x-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  <span className="hidden md:inline">All</span>
                </span>
              </button>
              <button
                onClick={() => setViewMode('videos')}
                className={`px-3 py-2 text-sm font-medium transition-colors border-l border-gray-200 ${
                  viewMode === 'videos'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center space-x-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                  <span className="hidden md:inline">Videos</span>
                </span>
              </button>
              {user && (
                <button
                  onClick={() => setViewMode('favorites')}
                  className={`px-3 py-2 text-sm font-medium transition-colors border-l border-gray-200 ${
                    viewMode === 'favorites'
                      ? 'bg-red-500 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="flex items-center space-x-1">
                    <svg className="w-4 h-4" fill={viewMode === 'favorites' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    <span className="hidden md:inline">Favorites</span>
                  </span>
                </button>
              )}
            </div>
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <span>{showSearchBar ? 'Hide Filters' : 'Filter by Tags'}</span>
              </span>
            </button>
            
            {images.length > 0 && (
              <div className="flex items-center space-x-2">
                <button
                  id="tour-select-mode"
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
                {totalImageCount > 0 && (
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                    {totalImageCount} {totalImageCount === 1 ? 'image' : 'images'}
                  </span>
                )}
              </div>
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
      
      {/* Tag Filter Bar */}
      {showSearchBar && (
        <div className="mb-6">
          <SearchBar
            onTagFilter={handleTagFilter}
            currentTags={selectedTags}
            onMediaTypeFilter={handleMediaTypeFilter}
            currentMediaType={mediaType}
            onSearchFilter={setSearchText}
            currentSearch={searchText}
          />
        </div>
      )}
      
      {/* Image Grid */}
      {images.length > 0 && (
        <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-6">
          {images.map((image, index) => {
            // Date group header — show when date changes between images (only in unfiltered all-images mode)
            const showDateHeader = viewMode === 'all' && !selectedTags && !mediaType && !searchText && (() => {
              if (index === 0) return true
              const prevDate = new Date(images[index - 1].uploaded_at).toLocaleDateString()
              const thisDate = new Date(image.uploaded_at).toLocaleDateString()
              return prevDate !== thisDate
            })()

            const dateLabel = showDateHeader ? (() => {
              const d = new Date(image.uploaded_at)
              const now = new Date()
              const diff = Math.floor((now - d) / 86400000)
              if (diff === 0) return 'Today'
              if (diff === 1) return 'Yesterday'
              if (diff < 7) return 'This Week'
              return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
            })() : null

            return (<>
            {dateLabel && (
              <h3 key={`date-${image.id}`} className="break-inside-avoid mb-4 text-lg font-semibold text-gray-700 [column-span:_all]">
                {dateLabel}
              </h3>
            )}
            <div
            <div
              key={image.id}
              className={`break-inside-avoid mb-6 bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-all relative ${
                selectionMode && selectedImages.has(image.id) ? 'ring-4 ring-blue-500' : ''
              }`}
            >
              <div
                className="relative overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 cursor-pointer"
                style={{ aspectRatio: image.image_width && image.image_height
                  ? `${image.image_width}/${image.image_height}`
                  : image.is_video ? '16/9' : '1/1' }}
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
                
                {/* Image or Video Thumbnail */}
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
                
                {/* Video Play Icon Overlay */}
                {image.is_video && (
                  <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                    <div className="bg-black/60 rounded-full p-4 backdrop-blur-sm">
                      <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                  </div>
                )}
                
                {/* NEW badge for recently uploaded images */}
                {lastVisitTime && user && !selectionMode && new Date(image.uploaded_at) > new Date(lastVisitTime) && (
                  <div className="absolute top-2 right-2 z-10">
                    <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow">NEW</span>
                  </div>
                )}

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
        </>)})}
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
          {viewMode === 'favorites' ? (
            <>
              <div className="text-6xl mb-4">❤️</div>
              <h2 className="text-2xl font-semibold text-gray-700 mb-2">No favorites yet</h2>
              <p className="text-gray-400 mt-2">Tap the heart on images you love!</p>
            </>
          ) : viewMode === 'videos' ? (
            <>
              <div className="text-6xl mb-4">🎬</div>
              <h2 className="text-2xl font-semibold text-gray-700 mb-2">No videos yet</h2>
              <p className="text-gray-400 mt-2">Videos from your special day will appear here.</p>
            </>
          ) : (
            <>
              <div className="text-6xl mb-4">📸</div>
              <h2 className="text-2xl font-semibold text-gray-700 mb-2">No memories shared yet</h2>
              <p className="text-gray-400 mt-2">Be the first to share a memory!</p>
            </>
          )}
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
