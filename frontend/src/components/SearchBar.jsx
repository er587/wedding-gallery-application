import { useState, useEffect } from 'react'
import { apiService } from '../services/api'

export default function SearchBar({ onSearch, onTagFilter, currentSearch, currentTags }) {
  const [searchTerm, setSearchTerm] = useState(currentSearch || '')
  const [availableTags, setAvailableTags] = useState([])
  const [selectedTags, setSelectedTags] = useState([])
  const [showTagDropdown, setShowTagDropdown] = useState(false)

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

  // Update search term when it changes externally
  useEffect(() => {
    setSearchTerm(currentSearch || '')
  }, [currentSearch])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    onSearch(searchTerm)
  }

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
    setShowTagDropdown(false)
  }

  const handleClearFilters = () => {
    setSearchTerm('')
    setSelectedTags([])
    onSearch('')
    onTagFilter('')
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 transform transition-all duration-200 ease-in-out">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Search & Filter</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Search by title, description, or user */}
        <form onSubmit={handleSearchSubmit} className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Search Images
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title, description, or username..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Search
            </button>
          </div>
        </form>

        {/* Filter by tags - dropdown with available tags */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Filter by Tags
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowTagDropdown(!showTagDropdown)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 transition-colors text-left flex items-center justify-between"
            >
              <span className="text-gray-700">
                {selectedTags.length > 0 
                  ? `${selectedTags.length} tag${selectedTags.length > 1 ? 's' : ''} selected` 
                  : 'Select tags...'}
              </span>
              <svg 
                className={`w-5 h-5 text-gray-400 transition-transform ${showTagDropdown ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown menu */}
            {showTagDropdown && availableTags.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {availableTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleTagClick(tag.name)}
                    className={`w-full px-4 py-2 text-left hover:bg-blue-50 transition-colors flex items-center justify-between ${
                      selectedTags.includes(tag.name) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <span className="text-gray-700">#{tag.name}</span>
                    {selectedTags.includes(tag.name) && (
                      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clear filters button */}
      {(searchTerm || selectedTags.length > 0) && (
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
