import { useState } from 'react'
import { apiService } from '../services/api'

export default function ImageUpload({ user, onImageUploaded, onCancel }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image_file: null,
    tags: ''
  })
  const [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  
  // Bulk upload states
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [uploadQueue, setUploadQueue] = useState([])
  const [sharedMetadata, setSharedMetadata] = useState({
    tags: '',
    description: ''
  })

  const handleInputChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files)
    
    if (bulkMode) {
      handleBulkFileSelection(files)
    } else {
      const file = files[0]
      if (file) {
        setFormData(prev => ({ ...prev, image_file: file }))
        
        // Create preview
        const reader = new FileReader()
        reader.onload = (e) => setPreview(e.target.result)
        reader.readAsDataURL(file)
      }
    }
  }

  const handleBulkFileSelection = (files) => {
    const imageFiles = files.filter(file => file.type.startsWith('image/'))
    const newFiles = imageFiles.map(file => ({
      id: Date.now() + Math.random(),
      file,
      title: file.name.split('.')[0],
      preview: null,
      status: 'ready', // ready, uploading, success, error
      progress: 0,
      error: null
    }))
    
    // Create previews for new files
    newFiles.forEach(fileObj => {
      const reader = new FileReader()
      reader.onload = (e) => {
        setSelectedFiles(prev => 
          prev.map(f => f.id === fileObj.id ? { ...f, preview: e.target.result } : f)
        )
      }
      reader.readAsDataURL(fileObj.file)
    })
    
    setSelectedFiles(prev => [...prev, ...newFiles])
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    
    if (bulkMode) {
      handleBulkFileSelection(files)
    } else {
      const file = files[0]
      if (file && file.type.startsWith('image/')) {
        setFormData(prev => ({ ...prev, image_file: file }))
        
        const reader = new FileReader()
        reader.onload = (e) => setPreview(e.target.result)
        reader.readAsDataURL(file)
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (bulkMode) {
      handleBulkUpload()
    } else {
      if (!formData.image_file) return
      await handleSingleUpload()
    }
  }

  const handleSingleUpload = async () => {
    setUploading(true)
    try {
      const formDataToSend = new FormData()
      formDataToSend.append('title', formData.title)
      formDataToSend.append('description', formData.description)
      formDataToSend.append('image_file', formData.image_file)
      
      // Add tags as an array
      if (formData.tags.trim()) {
        const tagArray = formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
        tagArray.forEach(tag => {
          formDataToSend.append('tag_names', tag)
        })
      }
      
      await apiService.createImage(formDataToSend)
      onImageUploaded()
    } catch (error) {
      console.error('Upload error:', error)
      alert('Upload failed. Please make sure you are logged in and try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleBulkUpload = async () => {
    if (selectedFiles.length === 0) return
    
    setUploading(true)
    const filesToUpload = selectedFiles.filter(f => f.status === 'ready')
    
    // Upload files one by one
    for (let i = 0; i < filesToUpload.length; i++) {
      const fileObj = filesToUpload[i]
      
      // Update status to uploading
      setSelectedFiles(prev => 
        prev.map(f => f.id === fileObj.id ? { ...f, status: 'uploading', progress: 0 } : f)
      )
      
      try {
        const formDataToSend = new FormData()
        formDataToSend.append('title', fileObj.title)
        formDataToSend.append('description', sharedMetadata.description)
        formDataToSend.append('image_file', fileObj.file)
        
        // Add shared tags
        if (sharedMetadata.tags.trim()) {
          const tagArray = sharedMetadata.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
          tagArray.forEach(tag => {
            formDataToSend.append('tag_names', tag)
          })
        }
        
        await apiService.createImage(formDataToSend)
        
        // Update status to success
        setSelectedFiles(prev => 
          prev.map(f => f.id === fileObj.id ? { ...f, status: 'success', progress: 100 } : f)
        )
      } catch (error) {
        console.error('Upload error for file:', fileObj.title, error)
        
        // Update status to error
        setSelectedFiles(prev => 
          prev.map(f => f.id === fileObj.id ? { 
            ...f, 
            status: 'error', 
            error: 'Upload failed',
            progress: 0
          } : f)
        )
      }
      
      // Small delay between uploads
      if (i < filesToUpload.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    
    setUploading(false)
    
    // Check if all uploads were successful
    const allSuccess = selectedFiles.every(f => f.status === 'success' || f.status === 'ready')
    if (allSuccess) {
      onImageUploaded()
    }
  }

  const removeFile = (fileId) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== fileId))
  }

  const updateFileTitle = (fileId, title) => {
    setSelectedFiles(prev => 
      prev.map(f => f.id === fileId ? { ...f, title } : f)
    )
  }

  const toggleBulkMode = () => {
    setBulkMode(!bulkMode)
    // Reset states when switching modes
    setSelectedFiles([])
    setFormData({
      title: '',
      description: '',
      image_file: null,
      tags: ''
    })
    setPreview(null)
    setSharedMetadata({ tags: '', description: '' })
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Upload New Image</h2>
        <button 
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Image
          </label>
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {preview ? (
              <div className="space-y-4">
                <img 
                  src={preview} 
                  alt="Preview" 
                  className="max-h-64 mx-auto rounded"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPreview(null)
                    setFormData(prev => ({ ...prev, image_file: null }))
                  }}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              </div>
            ) : (
              <>
                <div className="text-gray-400 mb-2">
                  <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p className="text-gray-600 mb-2">
                  Drag and drop your image here, or
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                >
                  Choose File
                </label>
              </>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Title
          </label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Give your image a title"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description (Memory)
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Share the memory or story behind this image"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tags
          </label>
          <input
            type="text"
            name="tags"
            value={formData.tags}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter tags separated by commas (e.g., family, vacation, birthday)"
          />
          <p className="text-xs text-gray-500 mt-1">
            Tags help others find and filter images by themes or events
          </p>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!formData.image_file || uploading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? 'Uploading...' : 'Upload Image'}
          </button>
        </div>
      </form>
    </div>
  )
}