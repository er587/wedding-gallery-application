import { useState } from 'react'
import { apiService } from '../services/api'
import { useToast } from './Toast'
import TagInput from './TagInput'

export default function ImageUpload({ user, onImageUploaded, onCancel }) {
  const toast = useToast()
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image_file: null,
    vimeo_url: '',
    cover_image: null,
    tags: []
  })
  const [preview, setPreview] = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadType, setUploadType] = useState('image') // 'image' or 'video'
  
  // Bulk upload states
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [uploadQueue, setUploadQueue] = useState([])
  const [sharedMetadata, setSharedMetadata] = useState({
    tags: [],
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
      // Validate based on upload type
      if (uploadType === 'image' && !formData.image_file) return
      if (uploadType === 'video' && !formData.vimeo_url) return
      await handleSingleUpload()
    }
  }

  const handleSingleUpload = async () => {
    setUploading(true)
    try {
      const formDataToSend = new FormData()
      formDataToSend.append('title', formData.title)
      formDataToSend.append('description', formData.description)
      
      // Add either image_file or vimeo_url based on upload type
      if (uploadType === 'image' && formData.image_file) {
        formDataToSend.append('image_file', formData.image_file)
      } else if (uploadType === 'video' && formData.vimeo_url) {
        formDataToSend.append('vimeo_url', formData.vimeo_url)
        // Add cover image if provided
        if (formData.cover_image) {
          formDataToSend.append('cover_image', formData.cover_image)
        }
      }
      
      // Add tags as an array
      if (formData.tags.length > 0) {
        formData.tags.forEach(tag => {
          formDataToSend.append('tag_names', tag.name)
        })
      }
      
      await apiService.createImage(formDataToSend)
      onImageUploaded()
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Upload failed. Please make sure you are logged in and try again.')
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
        if (sharedMetadata.tags.length > 0) {
          sharedMetadata.tags.forEach(tag => {
            formDataToSend.append('tag_names', tag.name)
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
      vimeo_url: '',
      cover_image: null,
      tags: []
    })
    setPreview(null)
    setCoverPreview(null)
    setSharedMetadata({ tags: [], description: '' })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-semibold">
            {bulkMode ? 'Bulk Upload Images' : (uploadType === 'video' ? 'Add Vimeo Video' : 'Upload New Image')}
          </h2>
          {!bulkMode && (
            <button
              type="button"
              onClick={() => {
                setUploadType(uploadType === 'image' ? 'video' : 'image')
                setPreview(null)
                setCoverPreview(null)
                setFormData(prev => ({ ...prev, image_file: null, vimeo_url: '', cover_image: null }))
              }}
              className="px-3 py-1 text-sm rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              {uploadType === 'image' ? '🎬 Add Video' : '🖼️ Upload Image'}
            </button>
          )}
          <button
            type="button"
            onClick={toggleBulkMode}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              bulkMode 
                ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {bulkMode ? '📄 Single Upload' : '📚 Bulk Upload'}
          </button>
        </div>
        <button 
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* File Upload Area or Vimeo URL Input */}
        {uploadType === 'video' && !bulkMode ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vimeo Embed Code or URL
              </label>
              <textarea
                value={formData.vimeo_url}
                onChange={(e) => {
                  const value = e.target.value
                  // Extract URL from iframe embed code if pasted
                  const iframeMatch = value.match(/src=["']([^"']+)["']/)
                  const extractedUrl = iframeMatch ? iframeMatch[1] : value
                  setFormData(prev => ({ ...prev, vimeo_url: extractedUrl.trim() }))
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder='<iframe src="https://player.vimeo.com/video/..." ...></iframe>'
                rows="3"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Paste the entire Vimeo iframe embed code or just the player URL
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cover Image (Optional)
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors">
                {coverPreview ? (
                  <div className="space-y-2">
                    <img 
                      src={coverPreview} 
                      alt="Cover preview" 
                      className="max-h-32 mx-auto rounded"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setCoverPreview(null)
                        setFormData(prev => ({ ...prev, cover_image: null }))
                      }}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Remove Cover
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="text-gray-400 mb-2">
                      <svg className="mx-auto h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files[0]
                        if (file) {
                          setFormData(prev => ({ ...prev, cover_image: file }))
                          const reader = new FileReader()
                          reader.onload = (e) => setCoverPreview(e.target.result)
                          reader.readAsDataURL(file)
                        }
                      }}
                      className="hidden"
                      id="cover-image-upload"
                    />
                    <label
                      htmlFor="cover-image-upload"
                      className="cursor-pointer inline-block bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200 transition-colors text-sm"
                    >
                      Choose Cover Image
                    </label>
                  </>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Upload a custom thumbnail for this video (optional - will auto-fetch from Vimeo if not provided)
              </p>
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {bulkMode ? 'Images' : 'Image'}
            </label>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              {!bulkMode && preview ? (
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
                    {bulkMode ? 'Drag and drop multiple images here, or' : 'Drag and drop your image here, or'}
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    multiple={bulkMode}
                    onChange={handleFileChange}
                    className="hidden"
                    id="image-upload"
                  />
                  <label
                    htmlFor="image-upload"
                    className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                  >
                    {bulkMode ? 'Choose Multiple Files' : 'Choose File'}
                  </label>
                </>
              )}
            </div>
          </div>
        )}

        {/* Bulk Upload: Selected Files Preview */}
        {bulkMode && selectedFiles.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">
              Selected Images ({selectedFiles.length})
            </h3>
            <div className="max-h-96 overflow-y-auto space-y-3">
              {selectedFiles.map((fileObj) => (
                <div key={fileObj.id} className="border rounded-lg p-4 flex items-start space-x-4">
                  {/* Image Preview */}
                  <div className="flex-shrink-0">
                    {fileObj.preview ? (
                      <img 
                        src={fileObj.preview} 
                        alt={fileObj.title}
                        className="w-16 h-16 object-cover rounded"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center">
                        <span className="text-gray-400 text-xs">Loading...</span>
                      </div>
                    )}
                  </div>
                  
                  {/* File Info */}
                  <div className="flex-grow">
                    <div className="flex items-center justify-between mb-2">
                      <input
                        type="text"
                        value={fileObj.title}
                        onChange={(e) => updateFileTitle(fileObj.id, e.target.value)}
                        className="text-sm font-medium text-gray-900 border-0 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent"
                        placeholder="Image title"
                      />
                      <button
                        type="button"
                        onClick={() => removeFile(fileObj.id)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                    
                    {/* Status and Progress */}
                    <div className="flex items-center space-x-2">
                      {fileObj.status === 'ready' && (
                        <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">Ready</span>
                      )}
                      {fileObj.status === 'uploading' && (
                        <>
                          <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">Uploading...</span>
                          <div className="flex-grow h-2 bg-gray-200 rounded">
                            <div className="h-2 bg-blue-600 rounded animate-pulse" style={{ width: '50%' }}></div>
                          </div>
                        </>
                      )}
                      {fileObj.status === 'success' && (
                        <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">✓ Uploaded</span>
                      )}
                      {fileObj.status === 'error' && (
                        <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">✗ Failed</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata Fields */}
        {bulkMode ? (
          /* Bulk Mode: Shared Metadata */
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-medium text-gray-900">Shared Information</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (Memory)
              </label>
              <textarea
                value={sharedMetadata.description}
                onChange={(e) => setSharedMetadata(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Share the memory or story behind these images (applied to all)"
              />
            </div>
            <div>
              <TagInput
                tags={sharedMetadata.tags}
                onTagsChange={(tags) => setSharedMetadata(prev => ({ ...prev, tags }))}
                canEdit={true}
              />
              <p className="text-xs text-gray-500 mt-1">
                These tags will be applied to all uploaded images
              </p>
            </div>
          </div>
        ) : (
          /* Single Mode: Individual Metadata */
          <>
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
              <TagInput
                tags={formData.tags}
                onTagsChange={(tags) => setFormData(prev => ({ ...prev, tags }))}
                canEdit={true}
              />
              <p className="text-xs text-gray-500 mt-1">
                Tags help others find and filter images by themes or events
              </p>
            </div>
          </>
        )}

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
            disabled={
              bulkMode 
                ? selectedFiles.length === 0 || uploading
                : (uploadType === 'image' ? !formData.image_file : !formData.vimeo_url) || uploading
            }
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {uploading 
              ? (bulkMode ? `Uploading... (${selectedFiles.filter(f => f.status === 'success').length}/${selectedFiles.length})` : 'Uploading...')
              : (bulkMode ? `Upload ${selectedFiles.length} Images` : (uploadType === 'video' ? 'Add Video' : 'Upload Image'))
            }
          </button>
        </div>
      </form>
      </div>
    </div>
  )
}