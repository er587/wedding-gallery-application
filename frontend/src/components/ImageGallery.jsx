import { useState, useEffect } from 'react'
import ImageViewer from './ImageViewer'

export default function ImageGallery({ user, refresh }) {
  const [images, setImages] = useState([])
  const [selectedImage, setSelectedImage] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchImages()
  }, [refresh])

  const fetchImages = async () => {
    try {
      setLoading(true)
      // Placeholder for actual API call
      // const response = await fetch('/api/images/')
      // const data = await response.json()
      
      // Mock data for demonstration
      const mockImages = [
        {
          id: 1,
          title: "Beautiful Sunset",
          description: "A memorable evening at the beach",
          image_file: "https://picsum.photos/400/300?random=1",
          uploader: { username: "photographer1" },
          uploaded_at: "2025-09-07T10:00:00Z",
          comment_count: 3
        },
        {
          id: 2,
          title: "Mountain Adventure",
          description: "Hiking trip with friends",
          image_file: "https://picsum.photos/400/300?random=2",
          uploader: { username: "adventurer" },
          uploaded_at: "2025-09-06T15:30:00Z",
          comment_count: 1
        },
        {
          id: 3,
          title: "City Lights",
          description: "Downtown at night",
          image_file: "https://picsum.photos/400/300?random=3",
          uploader: { username: "citylover" },
          uploaded_at: "2025-09-05T20:45:00Z",
          comment_count: 5
        }
      ]
      
      setImages(mockImages)
    } catch (error) {
      console.error('Error fetching images:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading images...</div>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {images.map((image) => (
          <div
            key={image.id}
            className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => setSelectedImage(image)}
          >
            <div className="aspect-w-4 aspect-h-3">
              <img
                src={image.image_file}
                alt={image.title}
                className="w-full h-48 object-cover"
              />
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 truncate">{image.title}</h3>
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">{image.description}</p>
              <div className="flex justify-between items-center mt-3 text-sm text-gray-500">
                <span>by {image.uploader.username}</span>
                <span>{image.comment_count} comments</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {images.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500 text-lg">No images yet</div>
          <p className="text-gray-400 mt-2">Be the first to share a memory!</p>
        </div>
      )}

      {selectedImage && (
        <ImageViewer 
          image={selectedImage} 
          user={user}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </>
  )
}