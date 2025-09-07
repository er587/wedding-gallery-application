import { useState, useEffect } from 'react'
import CommentSystem from './CommentSystem'

export default function ImageViewer({ image, user, onClose }) {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchComments()
  }, [image.id])

  const fetchComments = async () => {
    try {
      setLoading(true)
      // Placeholder for actual API call
      // const response = await fetch(`/api/images/${image.id}/comments/`)
      // const data = await response.json()
      
      // Mock comments for demonstration
      const mockComments = [
        {
          id: 1,
          content: "What a beautiful sunset! I remember being there with you that evening. The colors were absolutely breathtaking.",
          author: { username: "friend1" },
          created_at: "2025-09-07T11:00:00Z",
          replies: [
            {
              id: 4,
              content: "Yes! It was such a perfect moment. I'm so glad we captured it.",
              author: { username: "photographer1" },
              created_at: "2025-09-07T11:30:00Z",
              replies: []
            }
          ]
        },
        {
          id: 2,
          content: "This brings back so many memories of our beach trips together.",
          author: { username: "beachlover" },
          created_at: "2025-09-07T12:00:00Z",
          replies: []
        },
        {
          id: 3,
          content: "I can almost hear the waves crashing. Thanks for sharing this memory!",
          author: { username: "nostalgic" },
          created_at: "2025-09-07T13:00:00Z",
          replies: []
        }
      ]
      
      setComments(mockComments)
    } catch (error) {
      console.error('Error fetching comments:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex">
        {/* Image Section */}
        <div className="flex-1 bg-black flex items-center justify-center">
          <img
            src={image.image_file}
            alt={image.title}
            className="max-w-full max-h-full object-contain"
          />
        </div>
        
        {/* Comments Section */}
        <div className="w-80 bg-white flex flex-col">
          {/* Header */}
          <div className="p-4 border-b">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-semibold text-lg">{image.title}</h2>
                <p className="text-sm text-gray-600">by {image.uploader.username}</p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            </div>
            {image.description && (
              <p className="text-gray-700 mt-2">{image.description}</p>
            )}
          </div>

          {/* Comments */}
          <div className="flex-1 overflow-y-auto">
            <CommentSystem
              imageId={image.id}
              comments={comments}
              user={user}
              loading={loading}
              onCommentAdded={fetchComments}
            />
          </div>
        </div>
      </div>
    </div>
  )
}