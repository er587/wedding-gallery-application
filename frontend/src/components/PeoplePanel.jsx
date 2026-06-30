import { useState, useEffect } from 'react'
import { apiService } from '../services/api'

// Browse people: lists `person`-kind tags so guests can pull up everyone by name.
export default function PeoplePanel({ onSelect, onClose, currentTags }) {
  const [people, setPeople] = useState([])
  const [q, setQ] = useState('')
  const selected = currentTags ? currentTags.split(',').map((t) => t.trim()).filter(Boolean) : []

  useEffect(() => {
    apiService.getTags()
      .then((r) => setPeople(
        (r.data || [])
          .filter((t) => t.kind === 'person')
          .sort((a, b) => a.name.localeCompare(b.name))
      ))
      .catch((e) => console.error('Error fetching people:', e))
  }, [])

  const filtered = people.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="bg-white rounded-lg shadow-sm border border-sand-line p-4 md:p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-serif text-[18px] text-ink">People</h3>
        {onClose && (
          <button onClick={onClose} aria-label="Close people" className="text-sand-faint hover:text-ink p-1 -mr-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {people.length === 0 ? (
        <p className="text-sm text-sand-faint">
          No people tagged yet. Tag photos with names and mark those tags as “Person” in the admin.
        </p>
      ) : (
        <>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find someone…"
            className="w-full mb-3 px-3 py-2 border border-sand-line rounded-lg text-sm text-ink focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta outline-none"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelect(p.name)}
                className={`text-left px-3 py-2 rounded-lg text-sm truncate transition ${
                  selected.includes(p.name)
                    ? 'bg-terracotta text-white'
                    : 'bg-sand-line/40 text-ink hover:bg-sand-line'
                }`}
                title={p.name}
              >
                {p.name}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-full text-sm text-sand-faint">No one matches “{q}”.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
