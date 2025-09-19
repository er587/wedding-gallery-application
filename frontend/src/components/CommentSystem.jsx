import { useState } from 'react'
import { apiService } from '../services/api'

export default function CommentSystem({ imageId, comments, user, loading, onCommentAdded }) {
  const [newComment, setNewComment] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmitComment = async (e) => {
    e.preventDefault()
    if (!newComment.trim() || !user) return

    setSubmitting(true)
    try {
      await apiService.createComment(imageId, { content: newComment })
      setNewComment('')
      onCommentAdded()
    } catch (error) {
      console.error('Error posting comment:', error)
      alert('Failed to post comment. Please make sure you are logged in.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitReply = async (e) => {
    e.preventDefault()
    if (!replyText.trim() || !user) return

    setSubmitting(true)
    try {
      await apiService.createReply(replyTo, { content: replyText })
      setReplyText('')
      setReplyTo(null)
      onCommentAdded()
    } catch (error) {
      console.error('Error posting reply:', error)
      alert('Failed to post reply. Please make sure you are logged in.')
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getUserAvatar = (user, role) => {
    let initial = '?'
    if (user?.first_name) {
      initial = user.first_name.charAt(0).toUpperCase()
    } else if (user?.username) {
      initial = user.username.charAt(0).toUpperCase()
    }
    const isFullUser = role === 'full'
    
    return (
      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
        isFullUser 
          ? 'bg-gradient-to-r from-blue-500 to-purple-600' 
          : 'bg-gradient-to-r from-green-500 to-teal-600'
      }`}>
        <span className="text-white font-semibold text-xs">{initial}</span>
      </div>
    )
  }

  const renderComment = (comment, isReply = false) => (
    <div key={comment.id} className={`${isReply ? 'bg-gray-50 rounded-lg p-3' : 'bg-white'}`}>
      <div className="flex items-start space-x-3 mb-2">
        {getUserAvatar(comment.author, comment.author?.role)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <span className="font-semibold text-sm text-gray-900">
              {comment.author?.first_name && comment.author?.last_name 
                ? `${comment.author.first_name} ${comment.author.last_name}`
                : comment.author?.first_name || comment.author?.username || 'Unknown User'
              }
            </span>
            <span className={`text-xs px-2 py-1 rounded ${
              comment.author?.role === 'full' 
                ? 'text-blue-700 bg-blue-100' 
                : 'text-green-700 bg-green-100'
            }`}>
              {comment.author?.role === 'full' ? '📸 Full User' : '💭 Memory User'}
            </span>
            <span className="text-xs text-gray-400">{formatDate(comment.created_at)}</span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{comment.content}</p>
          {user && !isReply && (
            <button
              onClick={() => setReplyTo(comment.id)}
              className="text-xs text-blue-600 hover:text-blue-800 mt-1"
            >
              Reply
            </button>
          )}
          
          {replyTo === comment.id && (
            <form onSubmit={handleSubmitReply} className="mt-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                className="w-full p-2 text-sm border border-gray-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                required
              />
              <div className="flex space-x-2 mt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {submitting ? 'Posting...' : 'Reply'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReplyTo(null)
                    setReplyText('')
                  }}
                  className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
      
      {/* Render replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-8 mt-3 space-y-3 border-l-2 border-blue-100 pl-4">
          {comment.replies.map(reply => renderComment(reply, true))}
        </div>
      )}
    </div>
  )

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        Loading comments...
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Comment Form */}
      {user && (
        <form onSubmit={handleSubmitComment} className="border-b pb-4">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Share your memory of this moment..."
            className="w-full p-3 border border-gray-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            required
          />
          <button
            type="submit"
            disabled={submitting}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {submitting ? 'Posting...' : 'Share Memory'}
          </button>
        </form>
      )}

      {/* Comments List */}
      <div className="space-y-4">
        {comments.length > 0 ? (
          comments.map(comment => renderComment(comment))
        ) : (
          <div className="text-center text-gray-500 py-8">
            <p>No memories shared yet</p>
            {user && <p className="text-sm">Be the first to share your memory!</p>}
          </div>
        )}
      </div>
    </div>
  )
}