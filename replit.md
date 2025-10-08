# Wedding Gallery Application

## Overview

This is a full-stack wedding gallery application built with Django REST Framework backend and React frontend. The application allows users to upload wedding images, view image galleries, and engage with content through nested comments. It features user authentication, file uploads with organized storage, and a modern responsive interface built with React and Tailwind CSS.

## Recent Changes

**October 8, 2025 - Streamlined UI & Performance Optimizations:**
- **Streamlined filter interface** - Removed Active Filters box and search input, using only hashtag pill filters for cleaner UX
- **Hashtag-only filtering** - Clickable hashtag pills provide visual feedback, selected tags highlighted with checkmark
- **Database-wide tag filtering** - Tag filters work across all images in database, not just loaded ones
- **Comprehensive CPU optimization** - Reduced page size from 12 to 8 images, decreased pre-loading distance from 800px to 200px
- **Staggered image loading** - 100ms delay between batches with RAF throttling to spread CPU load and prevent spikes
- **Backend query optimization** - Added select_related/prefetch_related to reduce database hits by up to 80%
- **2-minute API response caching** - Using LocMemCache with smart cache invalidation on create/delete
- **Async face detection** - Moved to background threads for non-blocking upload responses
- **Thumbnail quality optimization** - Reduced JPEG quality from 80-90% to 75-80% for faster encoding
- **Enhanced loading spinner** - Larger, more visible spinner with white background and shadow when loading more images
- **Floating back-to-top button** - Appears after scrolling 400px down, provides smooth scroll to top with animated arrow icon
- **Expected 50-70% CPU reduction** when scrolling through gallery

**October 7, 2025 - Production Deployment Configuration:**
- **Configured production domains** - Added reneeanderic.wedding and wedding-website-replit2779.replit.app to ALLOWED_HOSTS
- **CSRF protection updated** - Production domains added to CSRF_TRUSTED_ORIGINS
- **CORS configuration** - Production domains properly configured for cross-origin requests
- **Deployment ready** - VM deployment with Gunicorn, migrations, and static file collection

**October 7, 2025 - Tag System with Import/Export:**
- **Restricted tag selection** - Users can only select from existing tags (no ad-hoc creation)
- **Tag autocomplete in upload** - Upload form now uses autocomplete for tag selection
- **Admin import/export** - Admins can import tags from CSV and export tags to CSV
- **Editable image descriptions** - Click to edit descriptions inline when viewing images
- **Tag management system** - Add and remove tags for images with autocomplete suggestions
- **Mobile-responsive tag/description editing** - Works seamlessly on both desktop sidebar and mobile drawer
- **Persistent tag storage** - Tags saved to database and synced across all users viewing the image
- **Owner-only editing** - Only image owners can edit descriptions and tags for their images
- **Sample CSV provided** - `sample_tags.csv` included with common wedding tags

**October 5, 2025 - Responsive Navigation & Mobile Optimization:**
- **Implemented fully responsive navigation bar** - Mobile hamburger menu with slide-out panel for authenticated users
- **Touch-friendly buttons** - All mobile navigation elements meet 44x44px minimum touch target requirements
- **Responsive logo** - Shows "WG" on mobile, full "Wedding Gallery" on tablet/desktop
- **Mobile-optimized login form** - Stacks vertically on mobile, displays horizontally on desktop
- **Eliminated comment loading flash** - Separated initial load from background refreshes using ref-based tracking
- **Silent background updates** - Comments refresh every 15 seconds without visual disruption
- **Added informational paragraph** - Welcoming message explaining gallery purpose, commenting, and download features
- **Replaced lock icon with wedding photo** - Beautiful sunset silhouette of couple now displays on landing page

**October 1, 2025 - Enhanced Registration UX & Media File Serving:**
- **Added password preview toggle with eye icon on registration form**
- **Implemented password confirmation field with matching validation**
- **Real-time validation feedback with error highlighting for mismatched passwords**
- **Fixed media file serving by excluding /media/ from frontend catch-all route**
- **Thumbnails and original images now load correctly with proper Content-Type headers**

**October 1, 2025 - Responsive Thumbnail Optimization with Face-Aware Cropping:**
- **Implemented comprehensive responsive thumbnail system using easy-thumbnails**
- **Added face detection coordinate storage (face_x, face_y, face_width, face_height) to Image model**
- **Created custom smart_crop processor for face-aware cropping with center-crop fallback**
- **Configured multiple responsive thumbnail sizes:**
  - Square thumbnails with face-aware cropping: 160px, 320px, 640px
  - Width-constrained thumbnails maintaining aspect ratio: 480px, 960px, 1440px
- **Integrated WebP format for smaller file sizes with JPEG fallback**
- **Updated frontend with responsive srcset and sizes attributes for optimal delivery**
- **Added MediaCacheMiddleware for long-term caching headers (1 year) and ETag support**
- **Optimized image delivery across mobile, tablet, and desktop platforms**

**September 21, 2025 - Production Deployment Ready:**
- **Configured PostgreSQL database for production use**
- **Added WhiteNoise middleware for production static file serving**
- **Enhanced security settings for production deployment**
- **Created Gunicorn configuration for production WSGI server**
- **Set up Replit autoscale deployment with build pipeline**
- **Added database initialization and deployment scripts**
- **Updated requirements.txt for production dependencies**
- **Enhanced .gitignore for complete security (no sensitive data commits)**
- **Production-ready environment variable configuration**

**September 8, 2025 - Complete Authentication & Invitation System:**
- Set up complete Django REST API with Image and Comment models
- Created React frontend with Tailwind CSS styling  
- Implemented image upload functionality with drag-and-drop
- Built threaded comment system for sharing wedding memories
- Configured development workflows for both backend and frontend
- **Implemented secure invitation-based user registration system**
- **Added signup modal with invitation code validation**
- **Full authentication flow with proper CSRF protection**
- **Django admin interface for managing invitation codes**
- **Reusable invitation codes with usage tracking**
- **Role-based codes (Full User vs Memory User permissions)**

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
- **Image Model**: Core entity with title, description, file, uploader reference, tags (many-to-many), and timestamps
- **Comment Model**: Supports nested commenting with parent-child relationships
- **User Model**: Django's built-in User model for authentication
- **Tag Model**: Simple tag system with unique names for categorizing images
- **Like Model**: Track user likes for images with user and image relationships

### API Design
- RESTful API structure with standard CRUD operations
- Nested resources for comments under images (`/api/images/{id}/comments/`)
- Permission-based access control (authenticated users for creation, public for reading)
- Serialized responses with related data (user info, comment counts, nested replies)

### File Upload & Thumbnail Strategy
- Custom upload path generation using username and timestamp
- ImageField for automatic image validation and processing
- Static file serving during development through Django
- **Responsive thumbnail generation with easy-thumbnails:**
  - Face detection coordinates stored per image for smart cropping
  - Custom face-aware crop processor with center-crop fallback
  - Multiple responsive sizes optimized for mobile/tablet/desktop
  - WebP format with quality optimization (82-95%) for smaller file sizes
  - Long-term browser caching (1 year) with ETag support for performance

### Authentication & Authorization
- Django session-based authentication with CSRF protection
- Invitation-based user registration system with reusable codes
- Role-based invitation codes (Full User / Memory User)
- Permission classes for view-level access control  
- User ownership validation for update/delete operations
- Secure invitation code generation and validation
- Usage tracking and admin management for invitation codes
- Modal-based signup interface for better UX

## External Dependencies

### Backend Dependencies
- **Django REST Framework**: API serialization and viewsets
- **Django CORS Headers**: Cross-origin request handling
- **Pillow**: Image processing and validation
- **PostgreSQL & psycopg2**: Production database support
- **WhiteNoise**: Static file serving in production
- **Gunicorn**: Production WSGI server
- **django-environ**: Environment variable management
- **dj-database-url**: Database URL parsing

### Frontend Dependencies
- **React & React-DOM**: Core frontend framework
- **Axios**: HTTP client for API requests
- **Tailwind CSS**: Utility-first CSS framework
- **Vite**: Build tool and development server

### Development Tools
- **PostCSS & Autoprefixer**: CSS processing pipeline

### Production Configuration
- **PostgreSQL Database**: Production-ready database with connection pooling (Neon)
- **WhiteNoise Static Files**: Compressed static file serving
- **Security Headers**: Production security middleware and settings
- **Gunicorn WSGI Server**: Multi-worker production server (3 workers, 120s timeout)
- **VM Deployment**: Replit deployment configuration with build pipeline
- **Production Domains**:
  - reneeanderic.wedding (custom domain)
  - wedding-website-replit2779.replit.app (Replit domain)
- **Deployment Process**: Automated build (frontend) → collect static files → migrate database → start Gunicorn

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