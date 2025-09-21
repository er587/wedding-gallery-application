/**
 * Enhanced file uploader component that integrates with Replit App Storage
 * Features authentication, access controls, and secure cloud storage
 */

import React, { useState } from 'react';
import axios from 'axios';

const CloudUploader = ({ onUploadComplete, acceptedFileTypes = 'image/*', maxFileSize = 10485760 }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');

  const handleFileUpload = async (file) => {
    if (!file) return;

    // Validate file size
    if (file.size > maxFileSize) {
      setError(`File size must be less than ${Math.round(maxFileSize / 1024 / 1024)}MB`);
      return;
    }

    setIsUploading(true);
    setError('');
    setUploadProgress(0);

    try {
      // Step 1: Get upload URL from Django backend
      const uploadUrlResponse = await axios.post('/api/cloud/upload-url/', {
        filename: file.name,
        content_type: file.type
      });

      const { upload_url, object_path } = uploadUrlResponse.data;

      // Step 2: Upload file directly to cloud storage
      const uploadResponse = await axios.put(upload_url, file, {
        headers: {
          'Content-Type': file.type,
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        }
      });

      if (uploadResponse.status === 200) {
        // Step 3: Set ACL policy for the uploaded file
        const aclResponse = await axios.post('/api/cloud/set-acl/', {
          upload_url: upload_url,
          is_public: false // Wedding gallery files are private by default
        });

        if (aclResponse.data.success) {
          // Notify parent component of successful upload
          onUploadComplete?.({
            object_path: aclResponse.data.object_path,
            access_url: aclResponse.data.access_url,
            filename: file.name,
            size: file.size,
            type: file.type
          });

          setUploadProgress(100);
        } else {
          throw new Error('Failed to set file permissions');
        }
      } else {
        throw new Error('Upload failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.error || 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      // Reset progress after a delay
      setTimeout(() => setUploadProgress(0), 2000);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  return (
    <div className="cloud-uploader">
      <div
        className={`upload-zone ${isUploading ? 'uploading' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        style={{
          border: '2px dashed #e2e8f0',
          borderRadius: '12px',
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: isUploading ? '#f8fafc' : '#ffffff',
          cursor: isUploading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease'
        }}
      >
        {isUploading ? (
          <div className="upload-progress">
            <div style={{ marginBottom: '1rem' }}>
              <svg 
                className="animate-spin h-8 w-8 mx-auto mb-4" 
                fill="none" 
                viewBox="0 0 24 24"
                style={{ color: '#6366f1' }}
              >
                <circle 
                  cx="12" 
                  cy="12" 
                  r="10" 
                  stroke="currentColor" 
                  strokeWidth="4"
                  style={{ opacity: 0.25 }}
                />
                <path 
                  fill="currentColor" 
                  d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <p style={{ color: '#6366f1', fontWeight: '500' }}>
                Uploading to secure cloud storage...
              </p>
            </div>
            <div 
              style={{
                width: '100%',
                height: '8px',
                backgroundColor: '#e2e8f0',
                borderRadius: '4px',
                overflow: 'hidden'
              }}
            >
              <div 
                style={{
                  width: `${uploadProgress}%`,
                  height: '100%',
                  backgroundColor: '#6366f1',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
            <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#64748b' }}>
              {uploadProgress}% complete
            </p>
          </div>
        ) : (
          <div>
            <svg 
              className="mx-auto h-12 w-12 mb-4" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
              style={{ color: '#94a3b8' }}
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1.5} 
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
              />
            </svg>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem', color: '#1e293b' }}>
              Upload Wedding Photo
            </h3>
            <p style={{ color: '#64748b', marginBottom: '1rem' }}>
              Drag and drop your photo here, or click to select
            </p>
            <input
              type="file"
              accept={acceptedFileTypes}
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="file-upload"
              disabled={isUploading}
            />
            <label
              htmlFor="file-upload"
              style={{
                display: 'inline-block',
                backgroundColor: '#6366f1',
                color: 'white',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '500',
                border: 'none'
              }}
            >
              Choose File
            </label>
          </div>
        )}
      </div>

      {error && (
        <div 
          style={{
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#dc2626'
          }}
        >
          <p style={{ margin: 0, fontSize: '0.875rem' }}>
            ⚠️ {error}
          </p>
        </div>
      )}

      <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#64748b' }}>
        <p>✅ Secure cloud storage with authentication</p>
        <p>🔒 Access controls for wedding privacy</p>
        <p>📱 Optimized for mobile and desktop</p>
      </div>
    </div>
  );
};

export default CloudUploader;