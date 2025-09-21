import React, { useState, useRef, useEffect } from 'react';
import { useToast } from './Toast';

const InlineEditableText = ({ 
  value, 
  onSave, 
  className = '',
  placeholder = 'Enter text...',
  maxLength = 200,
  disabled = false,
  multiline = false,
  canEdit = true
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);
  const { addToast } = useToast();

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(value || '');
  }, [value]);

  const startEdit = () => {
    if (disabled || !canEdit) return;
    setIsEditing(true);
    setEditValue(value || '');
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditValue(value || '');
  };

  const saveEdit = async () => {
    if (editValue.trim() === (value || '').trim()) {
      cancelEdit();
      return;
    }

    if (!editValue.trim()) {
      addToast('Please enter a valid title', 'error');
      return;
    }

    setIsLoading(true);
    try {
      await onSave(editValue.trim());
      setIsEditing(false);
      addToast('Title updated successfully', 'success');
    } catch (error) {
      addToast('Failed to update title', 'error');
      console.error('Save failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    if (newValue.length <= maxLength) {
      setEditValue(newValue);
    }
  };

  if (!isEditing) {
    return (
      <div
        className={`${className} ${canEdit ? 'cursor-pointer group' : ''}`}
        onClick={startEdit}
        role={canEdit ? "button" : "text"}
        tabIndex={canEdit ? 0 : -1}
        onKeyPress={(e) => canEdit && e.key === 'Enter' && startEdit()}
      >
        <span className={canEdit ? 'group-hover:bg-gray-100 group-hover:rounded px-1 py-0.5 transition-colors duration-150' : ''}>
          {value || placeholder}
        </span>
        {canEdit && (
          <span className="ml-2 opacity-0 group-hover:opacity-50 transition-opacity duration-150 text-xs text-gray-500">
            Click to edit
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        {multiline ? (
          <textarea
            ref={inputRef}
            value={editValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            placeholder={placeholder}
            disabled={isLoading}
            rows={3}
          />
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={placeholder}
            disabled={isLoading}
          />
        )}
        <div className="absolute -bottom-5 right-0 text-xs text-gray-500">
          {editValue.length}/{maxLength}
        </div>
      </div>
      
      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={cancelEdit}
          disabled={isLoading}
          className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={saveEdit}
          disabled={isLoading || !editValue.trim()}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
        >
          {isLoading && (
            <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
              <circle 
                className="opacity-25" 
                cx="12" 
                cy="12" 
                r="10" 
                stroke="currentColor" 
                strokeWidth="4"
              />
              <path 
                className="opacity-75" 
                fill="currentColor" 
                d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          )}
          Save
        </button>
      </div>
      
      <div className="text-xs text-gray-500">
        Press Enter to save, Escape to cancel
      </div>
    </div>
  );
};

export default InlineEditableText;