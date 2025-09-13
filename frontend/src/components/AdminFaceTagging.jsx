import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

const AdminFaceTagging = ({ user, onClose }) => {
  const [pendingTags, setPendingTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTags, setSelectedTags] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(10);

  // Check if user is admin
  if (!user?.is_staff) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold mb-4 text-red-600">Access Denied</h2>
          <p className="mb-4">You need admin privileges to access face tag management.</p>
          <button
            onClick={onClose}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  useEffect(() => {
    loadPendingTags();
  }, [currentPage]);

  const loadPendingTags = async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        page_size: pageSize
      };
      const response = await apiService.getPendingTags(params);
      
      setPendingTags(response.data.results || []);
      setTotalPages(Math.ceil(response.data.count / pageSize));
      setSelectedTags(new Set()); // Clear selections when loading new page
    } catch (error) {
      console.error('Error loading pending tags:', error);
      alert('Failed to load pending tags. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTagSelection = (tagId) => {
    const newSelected = new Set(selectedTags);
    if (newSelected.has(tagId)) {
      newSelected.delete(tagId);
    } else {
      newSelected.add(tagId);
    }
    setSelectedTags(newSelected);
  };

  const selectAllOnPage = () => {
    const allTagIds = pendingTags.map(tag => tag.id);
    setSelectedTags(new Set(allTagIds));
  };

  const clearSelection = () => {
    setSelectedTags(new Set());
  };

  const approveTag = async (tagId) => {
    try {
      await apiService.approveFaceTag(tagId);
      await loadPendingTags(); // Refresh the list
      alert('Face tag approved successfully!');
    } catch (error) {
      console.error('Error approving tag:', error);
      alert('Failed to approve tag. Please try again.');
    }
  };

  const rejectTag = async (tagId) => {
    if (!window.confirm('Are you sure you want to reject this face tag? This action cannot be undone.')) {
      return;
    }

    try {
      await apiService.rejectFaceTag(tagId);
      await loadPendingTags(); // Refresh the list
      alert('Face tag rejected successfully.');
    } catch (error) {
      console.error('Error rejecting tag:', error);
      alert('Failed to reject tag. Please try again.');
    }
  };

  const bulkApprove = async () => {
    if (selectedTags.size === 0) {
      alert('Please select at least one tag to approve.');
      return;
    }

    if (!window.confirm(`Are you sure you want to approve ${selectedTags.size} selected tag(s)?`)) {
      return;
    }

    try {
      await apiService.bulkApproveTags(Array.from(selectedTags));
      await loadPendingTags(); // Refresh the list
      alert(`Successfully approved ${selectedTags.size} tag(s)!`);
    } catch (error) {
      console.error('Error bulk approving tags:', error);
      alert('Failed to bulk approve tags. Please try again.');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b bg-blue-50">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-blue-800">Face Tag Management</h2>
              <p className="text-sm text-blue-600 mt-1">Review and approve user-submitted face tags</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl"
            >
              ✕
            </button>
          </div>
          
          {/* Bulk Actions */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {pendingTags.length} pending tag(s) on this page
              </span>
              {selectedTags.size > 0 && (
                <span className="text-sm text-blue-600 font-medium">
                  {selectedTags.size} selected
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={selectAllOnPage}
                className="text-sm text-blue-600 hover:text-blue-800"
                disabled={pendingTags.length === 0}
              >
                Select All
              </button>
              <button
                onClick={clearSelection}
                className="text-sm text-gray-600 hover:text-gray-800"
                disabled={selectedTags.size === 0}
              >
                Clear
              </button>
              <button
                onClick={bulkApprove}
                disabled={selectedTags.size === 0 || loading}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50 text-sm"
              >
                Bulk Approve ({selectedTags.size})
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="text-gray-500">Loading pending tags...</div>
            </div>
          ) : pendingTags.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500 text-lg">🎉 All caught up!</div>
              <div className="text-gray-400 mt-2">No pending face tags to review.</div>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingTags.map((tag) => (
                <div
                  key={tag.id}
                  className={`border rounded-lg p-4 ${
                    selectedTags.has(tag.id) ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedTags.has(tag.id)}
                      onChange={() => handleTagSelection(tag.id)}
                      className="mt-2"
                    />
                    
                    {/* Image Preview */}
                    <div className="relative flex-shrink-0">
                      <img
                        src={tag.image.image_file}
                        alt={tag.image.title}
                        className="w-32 h-24 object-cover rounded"
                      />
                      
                      {/* Face highlight overlay */}
                      <div
                        className="absolute border-2 border-red-400"
                        style={{
                          left: `${tag.face_x * 100}%`,
                          top: `${tag.face_y * 100}%`,
                          width: `${tag.face_width * 100}%`,
                          height: `${tag.face_height * 100}%`
                        }}
                      />
                    </div>
                    
                    {/* Tag Details */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-lg">{tag.person?.name}</h3>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            tag.is_auto_generated 
                              ? 'bg-purple-100 text-purple-700' 
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {tag.is_auto_generated ? 'Auto-generated' : 'User-submitted'}
                          </span>
                          <span className="text-xs text-gray-500">
                            Confidence: {Math.round((tag.confidence_score || 0) * 100)}%
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-600 space-y-1">
                        <div><strong>Image:</strong> {tag.image_title}</div>
                        <div><strong>Tagged by:</strong> {tag.tagged_by?.username}</div>
                        <div><strong>Date:</strong> {formatDate(tag.created_at)}</div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center space-x-2 mt-3">
                        <button
                          onClick={() => approveTag(tag.id)}
                          className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => rejectTag(tag.id)}
                          className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
                        >
                          ✗ Reject
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1 || loading}
                  className="px-3 py-1 rounded border border-gray-300 text-sm hover:bg-gray-100 disabled:opacity-50"
                >
                  Previous
                </button>
                
                <span className="px-3 py-1 bg-blue-500 text-white rounded text-sm">
                  {currentPage}
                </span>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages || loading}
                  className="px-3 py-1 rounded border border-gray-300 text-sm hover:bg-gray-100 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminFaceTagging;