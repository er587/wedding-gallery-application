import { useState, useEffect } from 'react'
import { apiService } from '../services/api'
import { useToast } from './Toast'

export default function GuestBook({ user, onClose }) {
  const toast = useToast()
  const [entries, setEntries] = useState([])
  const [meta, setMeta] = useState({ count: 0, next: null })
  const [loading, setLoading] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchEntries()
    // Prevent body scroll while modal is open
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const fetchEntries = async (page = 1) => {
    try {
      setLoading(true)
      const response = await apiService.getGuestBook(page)
      const data = response.data
      if (data.results) {
        setEntries(page === 1 ? data.results : prev => [...prev, ...data.results])
        setMeta({ count: data.count, next: data.next })
      }
    } catch (error) {
      console.error('Error fetching guest book:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    setSubmitting(true)
    try {
      await apiService.createGuestBookEntry({ message: newMessage.trim() })
      setNewMessage('')
      fetchEntries() // Refresh from page 1
      toast.success('Message added to the guest book!')
    } catch (error) {
      toast.error('Failed to post message. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this message?')) return
    try {
      await apiService.deleteGuestBookEntry(id)
      setEntries(prev => prev.filter(e => e.id !== id))
      toast.success('Message deleted')
    } catch (error) {
      toast.error('Failed to delete message')
    }
  }

  const loadMore = async () => {
    if (!meta.next) return
    const url = new URL(meta.next, window.location.origin)
    const page = url.searchParams.get('page') || 2
    fetchEntries(parseInt(page))
  }

  const formatDate = (dateString) => {
    const d = new Date(dateString)
    return d.toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  const getInitial = (author) => {
    if (author?.first_name) return author.first_name.charAt(0).toUpperCase()
    if (author?.username) return author.username.charAt(0).toUpperCase()
    return '?'
  }

  const getDisplayName = (author) => {
    if (author?.first_name && author?.last_name) return `${author.first_name} ${author.last_name}`
    return author?.first_name || author?.username || 'Guest'
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="font-serif font-medium text-[26px] text-ink">Guest Book</h2>
            <p className="text-sm text-sand-mute mt-1">{meta.count} message{meta.count !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={onClose}
            className="text-sand-faint hover:text-sand-soft p-2"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* New message form */}
        <form onSubmit={handleSubmit} className="p-6 border-b bg-sand-line/30">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Leave a message for the happy couple..."
            className="w-full p-3 border border-sand-line rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-terracotta text-sm"
            rows={3}
            maxLength={2000}
            required
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-sand-faint">{newMessage.length}/2000</span>
            <button
              type="submit"
              disabled={submitting || !newMessage.trim()}
              className="px-4 py-2 bg-terracotta text-white rounded-lg hover:bg-[#974f30] disabled:bg-sand-mute transition-colors text-sm font-medium"
            >
              {submitting ? 'Posting...' : 'Sign Guest Book'}
            </button>
          </div>
        </form>

        {/* Messages feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {entries.length === 0 && !loading ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">📖</div>
              <h3 className="font-serif text-[18px] text-ink">No messages yet</h3>
              <p className="text-sand-faint text-sm mt-1">Be the first to sign the guest book!</p>
            </div>
          ) : (
            entries.map(entry => (
              <div key={entry.id} className="flex space-x-3">
                <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-gradient-to-r from-terracotta to-terracotta">
                  <span className="text-white font-semibold text-sm">{getInitial(entry.author)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-sm text-ink">{getDisplayName(entry.author)}</span>
                      <span className="text-xs text-sand-faint ml-2">{formatDate(entry.created_at)}</span>
                    </div>
                    {entry.author?.id === user?.id && (
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="text-xs text-sand-faint hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-ink mt-1 leading-relaxed whitespace-pre-wrap">{entry.message}</p>
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="text-center py-4 text-sand-faint">Loading...</div>
          )}

          {meta.next && !loading && (
            <div className="text-center pt-2">
              <button
                onClick={loadMore}
                className="text-sm text-terracotta hover:text-terracotta transition-colors"
              >
                Load more ({entries.length} of {meta.count})
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
