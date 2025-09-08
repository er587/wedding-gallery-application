import { useState } from 'react'

export default function SearchBar({ onSearch, onTagFilter }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [tagFilter, setTagFilter] = useState('')

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    onSearch(searchTerm)
  }

  const handleTagSubmit = (e) => {
    e.preventDefault()
    onTagFilter(tagFilter)
  }

  const handleClearFilters = () => {
    setSearchTerm('')
    setTagFilter('')
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

        {/* Filter by tags */}
        <form onSubmit={handleTagSubmit} className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Filter by Tags
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              placeholder="Enter tags separated by commas..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Filter
            </button>
          </div>
        </form>
      </div>

      {/* Clear filters button */}
      <div className="mt-4 text-center">
        <button
          onClick={handleClearFilters}
          className="text-sm text-gray-600 hover:text-gray-800 underline"
        >
          Clear all filters
        </button>
      </div>
    </div>
  )
}