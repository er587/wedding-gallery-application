import { useState, useEffect } from 'react'
import { apiService } from '../services/api'

export default function SearchBar({ onTagFilter, currentTags, onMediaTypeFilter, currentMediaType }) {
  const [availableTags, setAvailableTags] = useState([])
  const [selectedTags, setSelectedTags] = useState([])
  const [mediaType, setMediaType] = useState('')

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

  const handleTagClick = (tagName) => {
    let newSelectedTags
    if (selectedTags.includes(tagName)) {
      // Remove tag if already selected
      newSelectedTags = selectedTags.filter(t => t !== tagName)
    } else {
      // Add tag if not selected
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
    onTagFilter('')
    if (onMediaTypeFilter) {
      onMediaTypeFilter('')
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 transform transition-all duration-200 ease-in-out">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>
      
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
      {(selectedTags.length > 0 || mediaType) && (
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
