import { useState, useEffect } from 'react'
import { apiService } from '../services/api'

export default function SearchBar({ onTagFilter, currentTags }) {
  const [availableTags, setAvailableTags] = useState([])
  const [selectedTags, setSelectedTags] = useState([])

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

  const handleClearFilters = () => {
    setSelectedTags([])
    onTagFilter('')
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 transform transition-all duration-200 ease-in-out">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Filter by Tags</h3>
      
      {/* Filter by tags - clickable pills */}
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
      {selectedTags.length > 0 && (
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
