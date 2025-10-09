# Wedding Gallery Application

## Overview

This is a full-stack wedding gallery application designed to allow users to upload, view, and interact with wedding images and videos. The application features user authentication, organized file storage, a responsive modern interface, and enables community engagement through nested comments and collaborative tagging. The vision is to provide a central, interactive platform for sharing and reliving wedding memories.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

**October 9, 2025 - Manual Cover Image Upload for Videos:**
- **User control** - Users can now upload custom cover images for videos as a reliable fallback
- **Optional field** - Cover image upload is optional when adding Vimeo videos
- **Smart priority** - Manual cover images take priority over auto-fetched Vimeo thumbnails
- **Responsive sizing** - User-uploaded covers are processed into 320px, 640px, and 1440px versions
- **Visual preview** - Shows preview of selected cover image before upload with remove option
- **Graceful fallback** - If no cover uploaded, system still tries to auto-fetch from Vimeo

**October 9, 2025 - Fixed Vimeo Thumbnails for Domain-Restricted Videos:**
- **Domain-restricted support** - Added Referer header (reneeanderic.wedding) to Vimeo API calls for privacy-restricted videos
- **Responsive thumbnails** - Vimeo thumbnails now processed into 320px, 640px, and 1440px versions like photos
- **Real preview images** - Videos display actual Vimeo thumbnails with proper responsive sizing
- **Auto-fetching** - Thumbnails automatically downloaded from Vimeo oEmbed API when video is uploaded
- **Background processing** - Thumbnail fetch runs async to not block upload response
- **Visual clarity** - Semi-transparent play button overlay shows which items are videos
- **Better gallery** - Videos blend naturally with photos while remaining clearly identifiable

**October 9, 2025 - Vimeo Iframe Embed Code Support:**
- **Easier video uploads** - Users can now paste entire Vimeo iframe embed codes, not just URLs
- **Auto-parsing** - System automatically extracts the player URL from pasted iframe code
- **Flexible input** - Accepts both full iframe embed codes and direct player URLs
- **Clear guidance** - Updated textarea with helpful placeholder and instructions
- **Improved UX** - 3-row textarea with monospace font for better code visibility

**October 9, 2025 - Fixed User Upload Count Feature:**
- **Accurate counting** - Upload count now uses dedicated backend API endpoint instead of client-side filtering
- **Efficient query** - Uses `request.user.uploaded_images.count()` for single database query
- **Works with pagination** - Count is accurate regardless of how many images are loaded
- **Authentication required** - Endpoint is protected and only returns count for authenticated users
- **Multiple displays** - Count appears in profile tab label, profile info section, and images header

**October 9, 2025 - Smart Tag Filtering Loads All Matching Images:**
- **Complete results** - Tag filters now load ALL images with that tag, not just currently loaded ones
- **Progressive loading** - First 8 images appear immediately, remaining load in chunks with delays
- **Performance optimized** - Chunked loading prevents CPU spikes from decoding all images at once
- **Request tracking** - Smart request ID system prevents stale results from overwriting new filters
- **Rapid switching** - Multiple quick filter changes properly abort older requests
- **Better UX** - Users see all matching images without clicking "Load More"

**October 9, 2025 - Upload Button Added to User Profile:**
- **Easy upload access** - Added "Upload New Image" button to the Images tab in user profile
- **Smooth transition** - Clicking the button closes the profile and opens the upload modal seamlessly
- **Clear image count** - Images tab header shows "Your Shared Images (X)" with count
- **Conditional display** - Button only shows for users with upload permissions
- **Better guidance** - Empty state directs users to click the upload button above

## System Architecture

### UI/UX Decisions
The application features a modern, responsive interface built with React and Tailwind CSS. It includes a comprehensive help modal for user guidance, streamlined filter interfaces using clickable hashtag pills, and a floating back-to-top button for improved navigation. Mobile optimization is a key focus, with responsive navigation, touch-friendly buttons, and mobile-optimized forms. The application also provides visual feedback for loading states and user interactions.

### Technical Implementations
- **Backend**: Django 5.0 with Django REST Framework provides API endpoints, user authentication, and data management.
- **Frontend**: React 19.1 with Vite for a fast and reactive user experience.
- **Styling**: Tailwind CSS is used for utility-first styling, ensuring a consistent and responsive design.
- **Database**: SQLite for development, PostgreSQL for production.
- **Image/Video Handling**:
    - Comprehensive responsive thumbnail system using `easy-thumbnails` with face-aware cropping.
    - Multiple responsive sizes (160px, 320px, 640px square; 480px, 960px, 1440px width-constrained).
    - WebP format with JPEG fallback and quality optimization.
    - Vimeo video embed support with media type filtering and responsive display.
    - Asynchronous face detection for non-blocking uploads.
- **Performance Optimizations**:
    - Reduced page size and pre-loading distance.
    - Staggered image loading with RAF throttling.
    - Backend query optimization with `select_related`/`prefetch_related`.
    - 2-minute API response caching with smart invalidation.
    - Long-term caching headers (1 year) and ETag support for media.
- **Authentication & Authorization**:
    - Django's built-in authentication with CSRF protection.
    - Secure invitation-based user registration system with role-based codes (Full User/Memory User).
    - Owner-only editing for image descriptions and tags, with community tagging for all full users.
- **Tagging System**:
    - Restricted tag selection from existing tags with autocomplete in upload forms.
    - Admin import/export functionality for tags.
    - Enhanced tag input with keyboard navigation (arrow keys, Enter, Escape).
    - Database-wide tag filtering.
- **Comment System**: Threaded comments with silent background updates every 15 seconds.

### System Design Choices
- **RESTful API**: Standard CRUD operations with nested resources for comments.
- **Data Models**: Core models include Image, Comment, User, Tag, and Like, supporting a relational structure for content and user interaction.
- **File Storage**: Local file system with organized upload paths by username and timestamp.
- **Deployment**: Production deployment configured for PostgreSQL, WhiteNoise for static files, Gunicorn, and Replit autoscale with a build pipeline.

## External Dependencies

### Backend
- **Django REST Framework**: For building robust APIs.
- **Django CORS Headers**: For managing Cross-Origin Resource Sharing.
- **Pillow**: Python Imaging Library for image processing.
- **psycopg2**: PostgreSQL adapter for Python.
- **WhiteNoise**: For serving static files efficiently in production.
- **Gunicorn**: Production WSGI HTTP server.
- **django-environ**: For managing environment variables.
- **dj-database-url**: For parsing database URLs.
- **django-easy-thumbnails**: For responsive thumbnail generation.

### Frontend
- **React**: JavaScript library for building user interfaces.
- **React-DOM**: Entry point to the DOM for React.
- **Axios**: Promise-based HTTP client for API requests.
- **Tailwind CSS**: Utility-first CSS framework.
- **Vite**: Next-generation frontend tooling.

### Development Tools
- **PostCSS & Autoprefixer**: For processing CSS.

### Production
- **PostgreSQL**: Robust relational database.
- **Neon**: Serverless Postgres.
- **reneeanderic.wedding & wedding-website-replit2779.replit.app**: Production domains.