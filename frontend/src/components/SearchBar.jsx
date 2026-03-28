import { useState, useEffect, useRef } from 'react'
import { apiService } from '../services/api'

export default function SearchBar({ onTagFilter, currentTags, onMediaTypeFilter, currentMediaType, onSearchFilter, currentSearch }) {
  const [availableTags, setAvailableTags] = useState([])
  const [selectedTags, setSelectedTags] = useState([])
  const [mediaType, setMediaType] = useState('')
  const [searchText, setSearchText] = useState(currentSearch || '')
  const searchTimeoutRef = useRef(null)

  // Fetch available tags from the database
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await apiService.getTags()
        setAvailableTags(response.data)
      } catch (error) {
        console.error('Error fetching tags:', error)
      }
    }
    fetchTags()
  }, [])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [])

  // Parse current tags from parent component
  useEffect(() => {
    if (currentTags) {
      const tagArray = currentTags.split(',').map(t => t.trim()).filter(Boolean)
      setSelectedTags(tagArray)
    } else {
      setSelectedTags([])
    }
  }, [currentTags])

  // Sync media type from parent component
  useEffect(() => {
    setMediaType(currentMediaType || '')
  }, [currentMediaType])

  const handleSearchChange = (value) => {
    setSearchText(value)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => {
      if (onSearchFilter) onSearchFilter(value)
    }, 300)
  }

  const handleTagClick = (tagName) => {
    let newSelectedTags
    if (selectedTags.includes(tagName)) {
      newSelectedTags = selectedTags.filter(t => t !== tagName)
    } else {
      newSelectedTags = [...selectedTags, tagName]
    }
    setSelectedTags(newSelectedTags)
    onTagFilter(newSelectedTags.join(','))
  }

  const handleMediaTypeClick = (type) => {
    const newType = mediaType === type ? '' : type
    setMediaType(newType)
    if (onMediaTypeFilter) {
      onMediaTypeFilter(newType)
    }
  }

  const handleClearFilters = () => {
    setSelectedTags([])
    setMediaType('')
    setSearchText('')
    onTagFilter('')
    if (onMediaTypeFilter) onMediaTypeFilter('')
    if (onSearchFilter) onSearchFilter('')
  }

  const hasActiveFilters = selectedTags.length > 0 || mediaType || searchText

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 transform transition-all duration-200 ease-in-out">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>

      {/* Text Search */}
      <div className="mb-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchText}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by title, description, or uploader..."
            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          {searchText && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Media Type Filter */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Media Type</h4>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleMediaTypeClick('video')}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              mediaType === 'video'
                ? 'bg-purple-600 text-white hover:bg-purple-700 ring-2 ring-purple-600 ring-offset-2'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
            <span>Videos Only</span>
            {mediaType === 'video' && (
              <svg className="w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={() => handleMediaTypeClick('image')}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              mediaType === 'image'
                ? 'bg-purple-600 text-white hover:bg-purple-700 ring-2 ring-purple-600 ring-offset-2'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
            </svg>
            <span>Images Only</span>
            {mediaType === 'image' && (
              <svg className="w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Filter by tags - clickable pills */}
      <div className="mb-2">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Tags</h4>
      </div>
      <div className="flex flex-wrap gap-2">
        {availableTags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            onClick={() => handleTagClick(tag.name)}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              selectedTags.includes(tag.name)
                ? 'bg-purple-600 text-white hover:bg-purple-700 ring-2 ring-purple-600 ring-offset-2'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span>#</span>
            <span>{tag.name}</span>
            {selectedTags.includes(tag.name) && (
              <svg className="w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        ))}
      </div>

      {availableTags.length === 0 && (
        <p className="text-sm text-gray-500">No tags available</p>
      )}

      {/* Clear filters button */}
      {hasActiveFilters && (
        <div className="mt-4 text-center">
          <button
            onClick={handleClearFilters}
            className="text-sm text-gray-600 hover:text-gray-800 underline"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  )
}
