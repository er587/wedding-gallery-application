import { useState, useEffect, useRef } from 'react'
import { apiService } from '../services/api'

export default function TagInput({ tags = [], onTagsChange, canEdit = false }) {
  const [allTags, setAllTags] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef(null)
  const suggestionsRef = useRef(null)

  useEffect(() => {
    // Fetch all available tags for autocomplete
    const fetchTags = async () => {
      try {
        const response = await apiService.getTags()
        setAllTags(response.data)
      } catch (error) {
        console.error('Error fetching tags:', error)
      }
    }
    fetchTags()
  }, [])

  useEffect(() => {
    // Close suggestions when clicking outside
    const handleClickOutside = (event) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target) &&
        !inputRef.current.contains(event.target)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (e) => {
    const value = e.target.value
    setInputValue(value)

    if (value.trim()) {
      // Filter tags that match the input and aren't already selected
      const currentTagNames = tags.map(t => t.name.toLowerCase())
      const filtered = allTags.filter(
        tag => 
          tag.name.toLowerCase().includes(value.toLowerCase()) &&
          !currentTagNames.includes(tag.name.toLowerCase())
      )
      setSuggestions(filtered)
      setShowSuggestions(true)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  const addTag = (tagName) => {
    const trimmedTag = tagName.trim().toLowerCase()
    if (trimmedTag && !tags.some(t => t.name.toLowerCase() === trimmedTag)) {
      // Only add if tag exists in database
      const existingTag = allTags.find(t => t.name.toLowerCase() === trimmedTag)
      if (existingTag) {
        onTagsChange([...tags, existingTag])
      }
    }
    setInputValue('')
    setSuggestions([])
    setShowSuggestions(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      // Only add if exact match exists in suggestions
      const exactMatch = allTags.find(t => t.name.toLowerCase() === inputValue.trim().toLowerCase())
      if (exactMatch) {
        addTag(exactMatch.name)
      }
    }
  }

  const removeTag = (tagToRemove) => {
    onTagsChange(tags.filter(tag => tag.name !== tagToRemove.name))
  }

  if (!canEdit && tags.length === 0) {
    return null
  }

  return (
    <div className="mt-3">
      <label className="text-sm font-medium text-gray-700 block mb-1">Tags</label>
      
      {/* Tag chips */}
      <div className="flex flex-wrap gap-1 mb-2">
        {tags.map((tag, index) => (
          <span
            key={index}
            className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
          >
            {tag.name}
            {canEdit && (
              <button
                onClick={() => removeTag(tag)}
                className="ml-1 text-blue-600 hover:text-blue-800 focus:outline-none"
                type="button"
              >
                ×
              </button>
            )}
          </span>
        ))}
      </div>

      {/* Input for selecting existing tags */}
      {canEdit && (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => inputValue.trim() && setShowSuggestions(true)}
            placeholder="Select from existing tags..."
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          {/* Autocomplete suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-40 overflow-y-auto"
            >
              {suggestions.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => addTag(tag.name)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                  type="button"
                >
                  {tag.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
