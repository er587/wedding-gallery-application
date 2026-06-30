import { useState } from 'react'
import { apiService } from '../services/api'
import { useToast } from './Toast'

export default function CommentSystem({ imageId, comments, commentsMeta, user, loading, onCommentAdded, onLoadMore }) {
  const toast = useToast()
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
      toast.error('Failed to post comment. Please make sure you are logged in.')
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
      toast.error('Failed to post reply. Please make sure you are logged in.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReport = async (commentId) => {
    if (!confirm('Are you sure you want to report this comment?')) return
    try {
      const response = await apiService.reportComment(commentId)
      toast.success(response.data.message || 'Comment reported')
      if (response.data.hidden) {
        onCommentAdded() // Refresh to show hidden state
      }
    } catch (error) {
      const msg = error.response?.data?.error || 'Failed to report comment'
      toast.error(msg)
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

  const getUserAvatar = (user) => {
    let initial = '?'
    if (user?.first_name) {
      initial = user.first_name.charAt(0).toUpperCase()
    } else if (user?.username) {
      initial = user.username.charAt(0).toUpperCase()
    }
    
    return (
      <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-gradient-to-r from-terracotta to-terracotta">
        <span className="text-white font-semibold text-xs">{initial}</span>
      </div>
    )
  }

  const renderComment = (comment, isReply = false) => (
    <div key={comment.id} className={`${isReply ? 'bg-sand-line/30 rounded-lg p-3' : 'bg-white'}`}>
      <div className="flex items-start space-x-3 mb-2">
        {getUserAvatar(comment.author)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <span className="font-semibold text-sm text-ink">
              {comment.author?.first_name && comment.author?.last_name 
                ? `${comment.author.first_name} ${comment.author.last_name}`
                : comment.author?.first_name || comment.author?.username || 'Unknown User'
              }
            </span>
            <span className="text-xs text-sand-faint">{formatDate(comment.created_at)}</span>
          </div>
          <p className="text-sm text-ink leading-relaxed">{comment.content}</p>
          {user && !comment.is_hidden && (
            <div className="flex items-center space-x-3 mt-1">
              {!isReply && (
                <button
                  onClick={() => setReplyTo(comment.id)}
                  className="text-xs text-terracotta hover:text-terracotta"
                >
                  Reply
                </button>
              )}
              {comment.author?.id !== user.id && (
                <button
                  onClick={() => handleReport(comment.id)}
                  className="text-xs text-sand-faint hover:text-red-500 transition-colors"
                  title="Report this comment"
                >
                  Flag
                </button>
              )}
            </div>
          )}
          
          {replyTo === comment.id && (
            <form onSubmit={handleSubmitReply} className="mt-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                className="w-full p-2 text-sm border border-sand-line rounded resize-none focus:outline-none focus:ring-2 focus:ring-terracotta"
                rows={2}
                required
              />
              <div className="flex space-x-2 mt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1 bg-terracotta text-white text-xs rounded hover:bg-[#974f30] disabled:bg-sand-mute"
                >
                  {submitting ? 'Posting...' : 'Reply'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReplyTo(null)
                    setReplyText('')
                  }}
                  className="px-3 py-1 bg-sand-line/50 text-ink text-xs rounded hover:bg-sand-line"
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
        <div className="ml-8 mt-3 space-y-3 border-l-2 border-terracotta/10 pl-4">
          {comment.replies.map(reply => renderComment(reply, true))}
        </div>
      )}
    </div>
  )

  if (loading) {
    return (
      <div className="p-4 text-center text-sand-mute">
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
            className="w-full p-3 border border-sand-line rounded resize-none focus:outline-none focus:ring-2 focus:ring-terracotta"
            rows={3}
            required
          />
          <button
            type="submit"
            disabled={submitting}
            className="mt-2 px-4 py-2 bg-terracotta text-white rounded hover:bg-[#974f30] disabled:bg-sand-mute transition-colors"
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
          <div className="text-center text-sand-mute py-8">
            <p>No memories shared yet</p>
            {user && <p className="text-sm">Be the first to share your memory!</p>}
          </div>
        )}
      </div>

      {/* Load More */}
      {commentsMeta?.next && (
        <div className="text-center pt-2">
          <button
            onClick={onLoadMore}
            className="text-sm text-terracotta hover:text-terracotta transition-colors"
          >
            Load more comments ({comments.length} of {commentsMeta.count})
          </button>
        </div>
      )}
    </div>
  )
}