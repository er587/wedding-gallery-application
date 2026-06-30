import { useState, useEffect, useRef } from 'react'
import { apiService } from '../services/api'

// Small removable chip for an active filter.
function ActiveChip({ label, onRemove }) {
  return (
    <button
      onClick={onRemove}
      className="inline-flex items-center gap-1.5 rounded-full bg-terracotta text-white text-[13px] px-3 py-1 hover:opacity-90 transition"
    >
      <span>{label}</span>
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
    </button>
  )
}

export default function SearchBar({ onTagFilter, currentTags, onMediaTypeFilter, currentMediaType, onSearchFilter, currentSearch, onClose }) {
  const [availableTags, setAvailableTags] = useState([])
  const [selectedTags, setSelectedTags] = useState([])
  const [mediaType, setMediaType] = useState('')
  const [searchText, setSearchText] = useState(currentSearch || '')
  const [tagQuery, setTagQuery] = useState('')
  const searchTimeoutRef = useRef(null)

  useEffect(() => {
    apiService.getTags()
      .then((r) => setAvailableTags(r.data))
      .catch((e) => console.error('Error fetching tags:', e))
  }, [])

  useEffect(() => () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current) }, [])

  useEffect(() => {
    setSelectedTags(currentTags ? currentTags.split(',').map((t) => t.trim()).filter(Boolean) : [])
  }, [currentTags])

  useEffect(() => { setMediaType(currentMediaType || '') }, [currentMediaType])

  const handleSearchChange = (value) => {
    setSearchText(value)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => { onSearchFilter && onSearchFilter(value) }, 300)
  }

  const toggleTag = (tagName) => {
    const next = selectedTags.includes(tagName)
      ? selectedTags.filter((t) => t !== tagName)
      : [...selectedTags, tagName]
    setSelectedTags(next)
    onTagFilter(next.join(','))
  }

  const toggleMediaType = (type) => {
    const next = mediaType === type ? '' : type
    setMediaType(next)
    onMediaTypeFilter && onMediaTypeFilter(next)
  }

  const clearAll = () => {
    setSelectedTags([]); setMediaType(''); setSearchText(''); setTagQuery('')
    onTagFilter('')
    onMediaTypeFilter && onMediaTypeFilter('')
    onSearchFilter && onSearchFilter('')
  }

  const hasActiveFilters = selectedTags.length > 0 || mediaType || searchText

  // Tags not already selected, narrowed by the tag-search box.
  const q = tagQuery.trim().toLowerCase()
  const filteredTags = availableTags.filter(
    (t) => !selectedTags.includes(t.name) && (!q || t.name.toLowerCase().includes(q))
  )

  return (
    <div className="bg-white rounded-lg shadow-sm border border-sand-line p-4 md:p-6">
      {/* Header: title + Clear + Close (all at the top) */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-serif text-[18px] text-ink">Filters</h3>
        <div className="flex items-center gap-4">
          {hasActiveFilters && (
            <button onClick={clearAll} className="text-[13px] text-terracotta hover:underline">Clear all</button>
          )}
          {onClose && (
            <button onClick={onClose} aria-label="Close filters" className="text-sand-faint hover:text-ink p-1 -mr-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Active filters — pinned at top so you never scroll to find/remove them */}
      {hasActiveFilters && (
        <div className="mb-4 flex flex-wrap gap-2">
          {searchText && <ActiveChip label={`“${searchText}”`} onRemove={() => handleSearchChange('')} />}
          {mediaType && <ActiveChip label={mediaType === 'video' ? 'Videos' : 'Images'} onRemove={() => toggleMediaType(mediaType)} />}
          {selectedTags.map((t) => <ActiveChip key={t} label={`#${t}`} onRemove={() => toggleTag(t)} />)}
        </div>
      )}

      {/* Text search */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sand-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={searchText}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search title, description, or uploader…"
          className="w-full pl-10 pr-3 py-2 border border-sand-line rounded-lg text-sm text-ink focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta outline-none"
        />
      </div>

      {/* Media type */}
      <div className="mb-4 flex flex-wrap gap-2">
        {[['video', 'Videos'], ['image', 'Photos']].map(([type, label]) => (
          <button
            key={type}
            type="button"
            onClick={() => toggleMediaType(type)}
            className={`px-3 py-1.5 rounded-full text-[13px] transition ${
              mediaType === type ? 'bg-terracotta text-white' : 'bg-sand-line/50 text-sand-soft hover:text-ink'
            }`}
          >
            {label} only
          </button>
        ))}
      </div>

      {/* Tags: searchable + height-capped scroll so a long list doesn't take over */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[13px] font-medium text-sand-soft uppercase tracking-wide">Tags</h4>
          <span className="text-[12px] text-sand-faint">{filteredTags.length}</span>
        </div>
        <input
          type="text"
          value={tagQuery}
          onChange={(e) => setTagQuery(e.target.value)}
          placeholder="Find a tag…"
          className="w-full mb-3 px-3 py-2 border border-sand-line rounded-lg text-sm text-ink focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta outline-none"
        />
        {filteredTags.length > 0 ? (
          <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto pr-1">
            {filteredTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.name)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[13px] bg-sand-line/50 text-sand-soft hover:bg-sand-line hover:text-ink transition"
              >
                <span className="text-sand-faint">#</span>{tag.name}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-sand-faint">
            {availableTags.length === 0 ? 'No tags available.' : q ? 'No tags match.' : 'All tags selected.'}
          </p>
        )}
      </div>
    </div>
  )
}
