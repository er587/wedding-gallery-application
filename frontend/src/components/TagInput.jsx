import { useState, useEffect, useRef } from 'react'
import { apiService } from '../services/api'

export default function TagInput({ tags = [], onTagsChange, canEdit = false, canCreate = false }) {
  const [allTags, setAllTags] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef(null)
  const suggestionsRef = useRef(null)

  useEffect(() => {
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
    const handleClickOutside = (event) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target) &&
        !inputRef.current.contains(event.target)
      ) {
        setShowSuggestions(false)
        setSelectedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setSelectedIndex(-1)
  }, [suggestions])

  const handleInputChange = (e) => {
    const value = e.target.value
    setInputValue(value)

    if (value.trim()) {
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
      const existingTag = allTags.find(t => t.name.toLowerCase() === trimmedTag)
      if (existingTag) {
        onTagsChange([...tags, existingTag])
      } else if (canCreate) {
        // Staff can create a brand-new tag inline; the backend persists it on save.
        onTagsChange([...tags, { name: trimmedTag }])
      }
    }
    setInputValue('')
    setSuggestions([])
    setShowSuggestions(false)
    setSelectedIndex(-1)
  }

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault()
        const exactMatch = allTags.find(t => t.name.toLowerCase() === inputValue.trim().toLowerCase())
        if (exactMatch) {
          addTag(exactMatch.name)
        } else if (canCreate && inputValue.trim()) {
          addTag(inputValue)
        }
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        )
        break
      
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          addTag(suggestions[selectedIndex].name)
        } else {
          const exactMatch = allTags.find(t => t.name.toLowerCase() === inputValue.trim().toLowerCase())
          if (exactMatch) {
            addTag(exactMatch.name)
          } else if (canCreate && inputValue.trim()) {
            addTag(inputValue)
          }
        }
        break
      
      case 'Escape':
        e.preventDefault()
        setShowSuggestions(false)
        setSelectedIndex(-1)
        break
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

      {canEdit && (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => inputValue.trim() && setShowSuggestions(true)}
            placeholder={canCreate ? 'Type to add a new tag, or pick one…' : 'Select from existing tags…'}
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {canCreate && inputValue.trim() &&
            !allTags.some(t => t.name.toLowerCase() === inputValue.trim().toLowerCase()) && (
              <div className="mt-1 text-xs text-gray-500">
                Press Enter to create “{inputValue.trim().toLowerCase()}”
              </div>
            )}

          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-40 overflow-y-auto"
            >
              {suggestions.map((tag, index) => (
                <button
                  key={tag.id}
                  onClick={() => addTag(tag.name)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full px-3 py-2 text-left text-sm focus:outline-none transition-colors ${
                    selectedIndex === index 
                      ? 'bg-blue-100 text-blue-900' 
                      : 'hover:bg-blue-50'
                  }`}
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
