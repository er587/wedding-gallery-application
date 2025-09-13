import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../services/api';

const FaceTagging = ({ image, onFaceTagged, isOpen, onClose }) => {
  const [faces, setFaces] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFace, setSelectedFace] = useState(null);
  const [tagMode, setTagMode] = useState(false);
  const [personName, setPersonName] = useState('');
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const canvasRef = useRef(null);
  const imageRef = useRef(null);

  // Load people list on component mount
  useEffect(() => {
    if (isOpen) {
      loadPeople();
    }
  }, [isOpen]);

  // Draw face detection overlay when faces change
  useEffect(() => {
    if (faces.length > 0 && imageRef.current) {
      drawFaceOverlay();
    }
  }, [faces, image]);

  const loadPeople = async () => {
    try {
      const response = await apiService.getPeople();
      setPeople(response.data);
    } catch (error) {
      console.error('Error loading people:', error);
    }
  };

  const detectFaces = async () => {
    if (!image?.id) return;

    setLoading(true);
    try {
      const response = await apiService.detectFaces(image.id);
      setFaces(response.data.faces || []);
      if (response.data.faces?.length > 0) {
        setTagMode(true);
      }
    } catch (error) {
      console.error('Error detecting faces:', error);
      alert('Failed to detect faces. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const drawFaceOverlay = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    
    // Set canvas size to match image display size
    const rect = img.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate scale factors
    const scaleX = rect.width / img.naturalWidth;
    const scaleY = rect.height / img.naturalHeight;
    
    // Draw face rectangles (face coordinates are relative to image size)
    faces.forEach((face, index) => {
      const x = face.x * rect.width;      // Convert relative to pixel coordinates
      const y = face.y * rect.height;
      const width = face.width * rect.width;
      const height = face.height * rect.height;
      
      // Face rectangle style
      ctx.strokeStyle = selectedFace === index ? '#ef4444' : '#3b82f6';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);
      
      // Face number label
      ctx.fillStyle = selectedFace === index ? '#ef4444' : '#3b82f6';
      ctx.font = '16px Arial';
      ctx.fillText(`Face ${index + 1}`, x + 5, y - 5);
      
      // Tag button area (if face is selected)
      if (selectedFace === index) {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
        ctx.fillRect(x, y, width, height);
      }
    });
  };

  const handleCanvasClick = (event) => {
    if (!tagMode) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    
    // Check if click is within any face rectangle (face coordinates are relative)
    for (let i = 0; i < faces.length; i++) {
      const face = faces[i];
      const x = face.x * rect.width;      // Convert relative to pixel coordinates
      const y = face.y * rect.height;
      const width = face.width * rect.width;
      const height = face.height * rect.height;
      
      if (clickX >= x && clickX <= x + width && 
          clickY >= y && clickY <= y + height) {
        setSelectedFace(i);
        return;
      }
    }
    
    // Click outside any face
    setSelectedFace(null);
  };

  const submitTag = async () => {
    if (selectedFace === null) return;
    
    const face = faces[selectedFace];
    const tagData = {
      face_x: face.x,
      face_y: face.y,
      face_width: face.width,
      face_height: face.height,
      confidence_score: face.confidence || 0.8
    };

    if (selectedPersonId) {
      tagData.person_id = parseInt(selectedPersonId);
    } else if (personName.trim()) {
      tagData.person_name = personName.trim();
    } else {
      alert('Please select a person or enter a name');
      return;
    }

    try {
      await apiService.createFaceTag(image.id, tagData);
      
      // Remove tagged face from faces array
      const newFaces = faces.filter((_, index) => index !== selectedFace);
      setFaces(newFaces);
      setSelectedFace(null);
      setPersonName('');
      setSelectedPersonId('');
      
      // Reload people list in case new person was created
      await loadPeople();
      
      if (onFaceTagged) {
        onFaceTagged();
      }
      
      alert('Face tagged successfully! Tag is pending admin approval.');
    } catch (error) {
      console.error('Error tagging face:', error);
      alert('Failed to tag face. Please try again.');
    }
  };

  const getSuggestedTags = async () => {
    if (!image?.id) return;
    
    try {
      const response = await apiService.getSuggestedTags(image.id);
      const suggestions = response.data.suggestions || [];
      
      if (suggestions.length > 0) {
        alert(`Found ${suggestions.length} auto-tag suggestions! Check the admin panel to review.`);
      } else {
        alert('No auto-tag suggestions found for this image.');
      }
    } catch (error) {
      console.error('Error getting tag suggestions:', error);
      alert('Failed to get tag suggestions.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-auto p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Face Tagging - {image?.title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="relative inline-block">
          <img
            ref={imageRef}
            src={image?.image_file}
            alt={image?.title}
            className="max-w-full max-h-96 object-contain"
            onLoad={drawFaceOverlay}
          />
          
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="absolute top-0 left-0 cursor-crosshair"
            style={{ pointerEvents: tagMode ? 'auto' : 'none' }}
          />
        </div>

        <div className="mt-4 space-y-4">
          {!tagMode ? (
            <div className="flex space-x-4">
              <button
                onClick={detectFaces}
                disabled={loading}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? 'Detecting...' : 'Detect Faces'}
              </button>
              
              <button
                onClick={getSuggestedTags}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
              >
                Get Suggestions
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded">
                <p className="text-sm text-blue-600 mb-2">
                  {faces.length} face(s) detected. Click on a face to tag it.
                  {selectedFace !== null && ` Selected: Face ${selectedFace + 1}`}
                </p>
              </div>

              {selectedFace !== null && (
                <div className="bg-gray-50 p-4 rounded">
                  <h3 className="font-medium mb-3">Tag Face {selectedFace + 1}</h3>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Select existing person:
                      </label>
                      <select
                        value={selectedPersonId}
                        onChange={(e) => {
                          setSelectedPersonId(e.target.value);
                          if (e.target.value) setPersonName('');
                        }}
                        className="w-full border rounded px-3 py-2"
                      >
                        <option value="">Choose a person...</option>
                        {people.map(person => (
                          <option key={person.id} value={person.id}>
                            {person.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="text-center text-sm text-gray-500">- OR -</div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Enter new person name:
                      </label>
                      <input
                        type="text"
                        value={personName}
                        onChange={(e) => {
                          setPersonName(e.target.value);
                          if (e.target.value) setSelectedPersonId('');
                        }}
                        placeholder="Enter person's name"
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>

                    <button
                      onClick={submitTag}
                      className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 w-full"
                    >
                      Tag This Face
                    </button>
                  </div>
                </div>
              )}

              <div className="flex space-x-4">
                <button
                  onClick={() => {
                    setTagMode(false);
                    setFaces([]);
                    setSelectedFace(null);
                  }}
                  className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                >
                  Cancel Tagging
                </button>
                
                <button
                  onClick={getSuggestedTags}
                  className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
                >
                  Auto-Tag Suggestions
                </button>
              </div>
            </div>
          )}

          {image?.face_tags && image.face_tags.length > 0 && (
            <div className="bg-green-50 p-4 rounded">
              <h3 className="font-medium text-green-800 mb-2">Existing Tags:</h3>
              <div className="space-y-1">
                {image.face_tags.map((tag, index) => (
                  <div key={index} className="text-sm text-green-700">
                    • {tag.person.name} (Status: {tag.status})
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FaceTagging;