import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiService } from '../services/api'
import ImageViewer from './ImageViewer'

/**
 * Standalone page for viewing a single image via shareable URL (/image/:id).
 * Loads the image by ID and renders the full ImageViewer lightbox.
 */
export default function ImagePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [image, setImage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchImage = async () => {
      try {
        const response = await apiService.getImage(id)
        setImage(response.data)
      } catch (err) {
        setError('Image not found')
      } finally {
        setLoading(false)
      }
    }
    fetchImage()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </div>
    )
  }

  if (error || !image) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600 mb-4">{error || 'Image not found'}</p>
          <button onClick={() => navigate('/')} className="text-terracotta hover:underline">
            Back to gallery
          </button>
        </div>
      </div>
    )
  }

  return (
    <ImageViewer
      image={image}
      images={[image]}
      currentIndex={0}
      onClose={() => navigate('/')}
      onNavigate={() => {}}
    />
  )
}
