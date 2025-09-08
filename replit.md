# Wedding Gallery Application

## Overview

This is a full-stack wedding gallery application built with Django REST Framework backend and React frontend. The application allows users to upload wedding images, view image galleries, and engage with content through nested comments. It features user authentication, file uploads with organized storage, and a modern responsive interface built with React and Tailwind CSS.

## Recent Changes

**September 7, 2025 - Phase 1 Implementation Complete:**
- Set up complete Django REST API with Image and Comment models
- Created React frontend with Tailwind CSS styling  
- Implemented image upload functionality with drag-and-drop
- Built threaded comment system for sharing wedding memories
- Configured development workflows for both backend and frontend
- Added basic authentication system (placeholder implementation)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Backend Architecture
- **Framework**: Django 5.0 with Django REST Framework for API endpoints
- **Database**: SQLite (default Django configuration) with Django ORM
- **Authentication**: Django's built-in user authentication system
- **File Storage**: Local file system with organized upload paths by username and timestamp
- **CORS Handling**: Configured for cross-origin requests from frontend

### Frontend Architecture  
- **Framework**: React 19.1 with Vite as the build tool
- **Styling**: Tailwind CSS for utility-first styling
- **HTTP Client**: Axios for API communication (installed but not yet integrated)
- **Development Server**: Vite dev server configured for hot module replacement on port 5000

### Data Models
- **Image Model**: Core entity with title, description, file, uploader reference, and timestamps
- **Comment Model**: Supports nested commenting with parent-child relationships
- **User Model**: Django's built-in User model for authentication

### API Design
- RESTful API structure with standard CRUD operations
- Nested resources for comments under images (`/api/images/{id}/comments/`)
- Permission-based access control (authenticated users for creation, public for reading)
- Serialized responses with related data (user info, comment counts, nested replies)

### File Upload Strategy
- Custom upload path generation using username and timestamp
- ImageField for automatic image validation and processing
- Static file serving during development through Django

### Authentication & Authorization
- Django session-based authentication
- Permission classes for view-level access control
- User ownership validation for update/delete operations

## External Dependencies

### Backend Dependencies
- **Django REST Framework**: API serialization and viewsets
- **Django CORS Headers**: Cross-origin request handling
- **Pillow**: Image processing and validation

### Frontend Dependencies
- **React & React-DOM**: Core frontend framework
- **Axios**: HTTP client for API requests
- **Tailwind CSS**: Utility-first CSS framework
- **Vite**: Build tool and development server

### Development Tools
- **PostCSS & Autoprefixer**: CSS processing pipeline

### Deployment Configuration
- **Replit Integration**: Configured for Replit hosting environment with domain handling
- **CSRF Protection**: Configured for trusted origins based on Replit domains
- **Static File Serving**: Development-mode static file handling for uploaded images

## Project Structure

```
├── django_project/          # Django settings and configuration
├── images/                  # Django app for image and comment models
│   ├── models.py           # Image and Comment models
│   ├── views.py            # API viewsets and endpoints
│   ├── serializers.py      # DRF serializers
│   └── urls.py             # API URL patterns
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── Auth.jsx           # Authentication component
│   │   │   ├── ImageGallery.jsx   # Main gallery view
│   │   │   ├── ImageUpload.jsx    # Upload interface
│   │   │   ├── ImageViewer.jsx    # Image detail modal
│   │   │   └── CommentSystem.jsx  # Threading comments
│   │   ├── App.jsx         # Main application component
│   │   └── index.css       # Tailwind CSS imports
│   ├── vite.config.js      # Vite configuration
│   └── tailwind.config.js  # Tailwind configuration
└── replit.md              # This documentation file
```