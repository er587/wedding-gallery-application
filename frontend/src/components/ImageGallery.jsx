import { useState, useEffect, useCallback, useRef } from 'react'
import ImageViewer from './ImageViewer'
import SearchBar from './SearchBar'
import InlineEditableText from './InlineEditableText'
import { apiService } from '../services/api'
import { useToast } from './Toast'
import weddingHero from '../assets/wedding-hero.webp'

// Format an ISO date (YYYY-MM-DD) as "August 22, 2025" without timezone drift.
function formatWeddingDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return ''
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

// Shared editorial masthead — names, date · venue · location, intro.
// All copy comes from the site configuration (Django admin); nothing is hardcoded.
function Masthead({ config }) {
  const p1 = config?.partner_one_name
  const p2 = config?.partner_two_name
  const lineParts = [
    formatWeddingDate(config?.wedding_date),
    config?.venue_name && (
      config?.venue_url
        ? <a key="venue" href={config.venue_url} target="_blank" rel="noopener noreferrer" className="hover:text-ink transition-colors">{config.venue_name}</a>
        : config.venue_name
    ),
    config?.location,
  ].filter(Boolean)

  return (
    <div className="text-center px-6 md:px-12 pt-[78px] pb-[44px]">
      {lineParts.length > 0 && (
        <div className="text-[12px] font-medium leading-[1.6] uppercase tracking-[0.32em] text-terracotta">
          {lineParts.map((part, i) => (
            <span key={i}>{i > 0 && <span className="text-sand-rule">&nbsp;·&nbsp;</span>}{part}</span>
          ))}
        </div>
      )}
      <h1 className="font-serif font-medium text-[64px] md:text-[96px] leading-none tracking-[0.005em] mt-5 text-ink">
        {p1 && p2 ? (
          <>{p1} <span className="italic text-terracotta">&amp;</span> {p2}</>
        ) : (
          config?.couple_display || 'Our Wedding'
        )}
      </h1>
      <div className="flex items-center justify-center gap-[18px] mt-7">
        <span className="w-24 h-px bg-sand-rule"></span>
        <span className="font-serif text-[15px] text-sand-faint">✦</span>
        <span className="w-24 h-px bg-sand-rule"></span>
      </div>
      {config?.intro_text && (
        <p className="font-serif italic text-[21px] leading-[1.5] text-[#6f675b] mt-[26px] mx-auto max-w-[580px]">
          {config.intro_text}
        </p>
      )}
    </div>
  )
}

export default function ImageGallery({ user, refresh, onUpload, config }) {
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


  // Show login prompt for logged-out users
  if (!user) {
    return (
      <div className="pb-24">
        <Masthead config={config} />
        <div className="mb-10 mt-2 flex justify-center px-4">
          <img
            src={weddingHero}
            alt="Wedding couple silhouette at sunset"
            className="w-full max-w-xs md:max-w-sm object-cover shadow-2xl"
          />
        </div>
        <div className="border border-sand-edge bg-white/40 p-6 max-w-md mx-auto text-center">
          <p className="font-serif italic text-[20px] text-ink mb-1">Ready to explore?</p>
          <p className="text-[13px] text-sand-soft">
            Use your invitation code to sign up, view, download and share pictures.
          </p>
        </div>
      </div>
    )
  }

  // Featured frame: the most-loved photo in the unfiltered "All" view.
  const isUnfiltered = viewMode === 'all' && !selectedTags && !mediaType && !searchText
  // Featured hero: the admin-chosen photo if set, otherwise the most-loved one.
  const configuredFeatured = config?.featured_image || null
  let featured = null
  if (isUnfiltered && images.length > 0) {
    if (configuredFeatured) {
      featured = images.find((img) => img.id === configuredFeatured.id) || configuredFeatured
    } else {
      featured = images.reduce((best, img) => ((img.like_count || 0) > (best.like_count || 0) ? img : best), images[0])
    }
  }
  const gridImages = featured ? images.filter((img) => img.id !== featured.id) : images

  // The featured photo may be a thin payload (a random or admin-chosen photo not
  // in the current page lacks uploader/tags/comments the viewer needs), so fetch
  // the full image before opening it.
  const openFeatured = async () => {
    if (!featured) return
    try {
      const { data } = await apiService.getImage(featured.id)
      setSelectedImage(data)
    } catch (err) {
      console.error('Failed to open featured image:', err)
      toast?.error?.('Could not open this photo. Please try again.')
    }
  }

  const tabs = [
    { key: 'all', label: 'All', onClick: () => { setViewMode('all'); setShowSearchBar(false) }, active: viewMode === 'all' && !showSearchBar },
    { key: 'videos', label: 'Films', onClick: () => { setViewMode('videos'); setShowSearchBar(false) }, active: viewMode === 'videos' },
    { key: 'favorites', label: 'Favorites', onClick: () => { setViewMode('favorites'); setShowSearchBar(false) }, active: viewMode === 'favorites' },
    { key: 'tags', label: 'Tags', onClick: () => setShowSearchBar((s) => !s), active: showSearchBar },
  ]

  const uploaderName = (img) =>
    img.uploader.first_name && img.uploader.last_name
      ? `${img.uploader.first_name} ${img.uploader.last_name}`
      : img.uploader.first_name || img.uploader.username

  return (
    <>
      {/* Masthead */}
      <Masthead config={config} />

      {/* Toolbar */}
      <div
        id="tour-filters"
        className="max-w-shell mx-auto flex flex-wrap items-center justify-between gap-y-4 px-6 md:px-12 pb-[26px] border-b border-sand-line"
      >
        <div className="flex items-center gap-[26px] text-[13px] tracking-[0.04em]">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={tab.onClick}
              className={`pb-[6px] transition-colors ${
                tab.active
                  ? 'text-ink border-b-[1.5px] border-terracotta'
                  : 'text-sand-dim hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-6">
          {totalImageCount > 0 && (
            <span className="text-[12px] uppercase tracking-[0.16em] text-sand-mute">
              {totalImageCount} {totalImageCount === 1 ? 'photograph' : 'photographs'}
            </span>
          )}
          {images.length > 0 && (
            <button
              id="tour-select-mode"
              onClick={toggleSelectionMode}
              className={`text-[12px] tracking-[0.06em] uppercase transition-colors ${
                selectionMode ? 'text-ink' : 'text-sand-dim hover:text-ink'
              }`}
            >
              {selectionMode ? 'Cancel' : 'Select'}
            </button>
          )}
          {user.can_upload_images && (
            <button
              id="tour-upload-button"
              onClick={onUpload}
              className="text-[12px] tracking-[0.06em] text-terracotta border border-sand-edge px-[22px] py-[11px] transition-colors hover:bg-terracotta hover:text-white hover:border-terracotta"
            >
              Upload a memory
            </button>
          )}
        </div>
      </div>

      {/* Selection controls */}
      {selectionMode && (
        <div className="max-w-shell mx-auto flex flex-wrap items-center gap-x-6 gap-y-2 px-6 md:px-12 pt-5 text-[13px]">
          <button onClick={selectAllImages} className="text-terracotta hover:text-ink underline underline-offset-2">
            Select all ({images.length})
          </button>
          <button onClick={clearSelection} className="text-sand-soft hover:text-ink underline underline-offset-2">
            Clear selection
          </button>
          {selectedImages.size > 0 && (
            <div className="flex items-center gap-4 ml-auto">
              <span className="text-sand-soft">{selectedImages.size} selected</span>
              <button
                onClick={downloadSelectedImages}
                disabled={downloading}
                className="bg-terracotta text-white px-5 py-2 text-[12px] tracking-[0.06em] uppercase transition-colors hover:bg-[#974f30] disabled:opacity-50"
              >
                {downloading ? 'Downloading…' : `Download (${selectedImages.size})`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tag Filter Bar */}
      {showSearchBar && (
        <div className="max-w-shell mx-auto px-6 md:px-12 pt-6">
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

      {/* Gallery */}
      {(images.length > 0 || loading) && (
        <div className="max-w-shell mx-auto px-6 md:px-12 pt-[46px] pb-16">
          {images.length === 0 && loading ? (
            <div className="flex justify-center items-center py-24 font-serif italic text-[20px] text-sand-mute">
              Gathering the moments…
            </div>
          ) : (
            <>
              {/* Featured frame */}
              {featured && (
                <>
                  <div
                    className="relative aspect-[16/7] overflow-hidden mb-[14px] cursor-pointer group bg-[#ece5d8]"
                    onClick={openFeatured}
                  >
                    <img
                      src={featured.thumbnail_width_1440 || featured.thumbnail_square_640 || featured.image_file}
                      alt={featured.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      loading="lazy"
                      decoding="async"
                    />
                    {(config?.featured_title || config?.featured_subtitle) && (
                      <div className="absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-[rgba(30,22,15,.5)] to-transparent pointer-events-none" />
                    )}
                    {featured.is_video && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-[62px] h-[62px] rounded-full border border-white/90 bg-[rgba(40,30,22,.32)] flex items-center justify-center">
                          <span className="ml-1 border-y-[9px] border-y-transparent border-l-[13px] border-l-white" />
                        </div>
                      </div>
                    )}
                    {(config?.featured_title || config?.featured_subtitle) && (
                      <div className="absolute left-[34px] bottom-[30px] text-white pointer-events-none">
                        {config.featured_title && (
                          <div className="font-serif font-medium text-[34px] leading-none">{config.featured_title}</div>
                        )}
                        {config.featured_subtitle && (
                          <div className="text-[11px] tracking-[0.2em] uppercase opacity-85 mt-2">
                            {config.featured_subtitle}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end font-serif italic text-[14px] text-sand-mute mb-[42px]">
                    — opening frame
                  </div>
                </>
              )}

              {/* Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-[30px] gap-y-[34px]">
                {gridImages.map((image, index) => (
                  <figure key={image.id} className="m-0">
                    <div
                      className={`relative aspect-[4/5] overflow-hidden bg-[#ece5d8] cursor-pointer group ${
                        selectionMode && selectedImages.has(image.id) ? 'ring-2 ring-terracotta ring-offset-2 ring-offset-cream' : ''
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
                      {/* Shimmer placeholder */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>

                      <img
                        src={image.thumbnail_square_640 || image.thumbnail_square_320 || image.image_file}
                        srcSet={[
                          image.thumbnail_square_320 && `${image.thumbnail_square_320} 320w`,
                          image.thumbnail_square_640 && `${image.thumbnail_square_640} 640w`,
                          image.thumbnail_width_1440 && `${image.thumbnail_width_1440} 1440w`,
                        ].filter(Boolean).join(', ')}
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        alt={image.title}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 z-10"
                        style={{ animationDelay: `${index * 50}ms` }}
                        loading="lazy"
                        decoding="async"
                        onLoad={(e) => {
                          requestAnimationFrame(() => {
                            const shimmer = e.target.previousElementSibling
                            if (shimmer) shimmer.style.display = 'none'
                          })
                        }}
                      />

                      {/* Video play overlay */}
                      {image.is_video && (
                        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                          <div className="w-[62px] h-[62px] rounded-full border border-white/90 bg-[rgba(40,30,22,.32)] flex items-center justify-center">
                            <span className="ml-1 border-y-[9px] border-y-transparent border-l-[13px] border-l-white" />
                          </div>
                        </div>
                      )}

                      {/* NEW badge */}
                      {lastVisitTime && user && !selectionMode && new Date(image.uploaded_at) > new Date(lastVisitTime) && (
                        <div className="absolute top-3 right-3 z-20">
                          <span className="bg-terracotta text-white text-[10px] tracking-[0.12em] uppercase px-2 py-[3px]">New</span>
                        </div>
                      )}

                      {/* Selection checkbox */}
                      {selectionMode && (
                        <div className="absolute top-3 left-3 z-20">
                          <input
                            type="checkbox"
                            checked={selectedImages.has(image.id)}
                            onChange={(e) => {
                              e.stopPropagation()
                              toggleImageSelection(image.id)
                            }}
                            className="w-5 h-5 accent-terracotta bg-white border border-sand-edge"
                          />
                        </div>
                      )}

                      {/* Selection overlay */}
                      {selectionMode && selectedImages.has(image.id) && (
                        <div className="absolute inset-0 z-10 bg-terracotta/20 flex items-center justify-center">
                          <span className="bg-terracotta text-white rounded-full w-8 h-8 flex items-center justify-center">✓</span>
                        </div>
                      )}
                    </div>

                    <figcaption className="pt-[15px]">
                      <InlineEditableText
                        value={image.title}
                        onSave={(newTitle) => handleUpdateImageTitle(image.id, newTitle)}
                        className="font-serif font-medium text-[22px] leading-[1.1] text-ink truncate"
                        placeholder="Untitled frame"
                        canEdit={canEditImage(image)}
                      />
                      {image.description && (
                        <p className="font-serif italic text-[15px] text-sand-soft mt-1 line-clamp-2">{image.description}</p>
                      )}

                      {image.tags && image.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] tracking-[0.08em] uppercase text-sand-dim">
                          {image.tags.map((tag) => (
                            <span key={tag.id}>#{tag.name}</span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-[14px] text-[11px] tracking-[0.14em] uppercase text-sand-mute mt-[9px]">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleLike(image.id)
                          }}
                          disabled={!user}
                          className={`flex items-center gap-[5px] transition-colors ${
                            image.user_has_liked ? 'text-terracotta' : 'text-sand-mute hover:text-terracotta'
                          }`}
                          aria-label={image.user_has_liked ? 'Unlike' : 'Like'}
                        >
                          <span className="text-[13px] leading-none">{image.user_has_liked ? '♥' : '♡'}</span>
                          <span>{image.like_count || 0}</span>
                        </button>
                        <span>{image.comment_count} {image.comment_count === 1 ? 'note' : 'notes'}</span>
                        <span className="text-sand-dim normal-case tracking-normal">by {uploaderName(image)}</span>
                        {canDeleteImage(image) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteImage(image.id, image.title)
                            }}
                            className="ml-auto text-sand-dim hover:text-terracotta transition-colors normal-case tracking-normal"
                            title="Delete image"
                          >
                            <svg className="w-[14px] h-[14px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </>
          )}
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
        <div className="text-center px-6 md:px-12 py-24">
          <div className="font-serif text-[28px] text-sand-faint mb-3">✦</div>
          {viewMode === 'favorites' ? (
            <>
              <h2 className="font-serif text-[30px] text-ink mb-2">No favorites yet</h2>
              <p className="font-serif italic text-[17px] text-sand-mute">Tap the heart on the frames you love.</p>
            </>
          ) : viewMode === 'videos' ? (
            <>
              <h2 className="font-serif text-[30px] text-ink mb-2">No films yet</h2>
              <p className="font-serif italic text-[17px] text-sand-mute">Films from our day will appear here.</p>
            </>
          ) : (
            <>
              <h2 className="font-serif text-[30px] text-ink mb-2">No memories shared yet</h2>
              <p className="font-serif italic text-[17px] text-sand-mute">Be the first to add a frame from our day.</p>
            </>
          )}
        </div>
      )}

      {/* Loading More Indicator */}
      {pagination.loadingMore && (
        <div className="text-center py-10">
          <span className="font-serif italic text-[17px] text-sand-mute">Gathering more moments…</span>
        </div>
      )}

      {/* Load More Button */}
      {images.length > 0 && pagination.hasMore && !pagination.loadingMore && (
        <div className="text-center pb-16">
          <button
            onClick={loadMoreImages}
            className="text-[12px] tracking-[0.18em] uppercase text-terracotta border border-sand-edge px-8 py-3 transition-colors hover:bg-terracotta hover:text-white hover:border-terracotta"
          >
            Show more
          </button>
        </div>
      )}

      {/* End of Results */}
      {images.length > 0 && !pagination.hasMore && (
        <div className="text-center pb-16">
          <div className="flex items-center justify-center gap-[18px] mb-4">
            <span className="w-16 h-px bg-sand-rule"></span>
            <span className="font-serif text-[15px] text-sand-faint">✦</span>
            <span className="w-16 h-px bg-sand-rule"></span>
          </div>
          <p className="font-serif italic text-[16px] text-sand-mute">That's every moment — all {images.length} of them.</p>
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
          className="fixed bottom-8 right-8 bg-terracotta hover:bg-[#974f30] text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 z-50 group"
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
