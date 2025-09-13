# Wedding Gallery 💒📸

A beautiful, secure wedding gallery application built for sharing precious memories with loved ones. Guests can upload photos from the special day and engage through comments while maintaining strict privacy controls.

## ✨ Features

### 🔐 **Invitation-Based Access**
- Secure invitation code system for wedding guests
- Role-based access: Full Users (upload & comment) vs Memory Users (comment only)
- Reusable invitation codes with usage tracking

### 📱 **Smart Photo Management**
- Drag-and-drop image uploads with instant preview
- Intelligent thumbnail generation using OpenCV face detection
- Owner-only deletion permissions - you can only manage your own photos
- High-quality image storage with optimized loading

### 💬 **Interactive Comments**
- Threaded comment system for sharing memories
- Nested replies to keep conversations organized
- Real-time engagement with other wedding guests

### 🎨 **Beautiful Interface**
- Modern, responsive design built with React and Tailwind CSS
- Mobile-friendly gallery perfect for viewing on any device
- Smooth animations and intuitive user experience

## 🛠 Tech Stack

### Backend
- **Django 5.0** with Django REST Framework
- **SQLite** database with Django ORM
- **OpenCV** for intelligent image processing
- **Pillow** for image handling and optimization

### Frontend
- **React 19.1** with modern hooks and components
- **Vite** for lightning-fast development and building
- **Tailwind CSS** for utility-first styling
- **Axios** for seamless API communication

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 20+
- pip and npm

### Backend Setup
```bash
# Install Python dependencies
pip install django djangorestframework django-cors-headers opencv-python pillow

# Run database migrations
python manage.py migrate

# Create admin user (optional)
python manage.py createsuperuser

# Start Django development server
python manage.py runserver 0.0.0.0:8000
```

### Frontend Setup
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### Access the Application
- **Gallery**: http://localhost:5000
- **Admin Panel**: http://localhost:8000/admin

## 📋 Project Structure

```
wedding-gallery/
├── django_project/           # Django settings and configuration
├── images/                   # Core Django app
│   ├── models.py            # Image, Comment, and UserProfile models
│   ├── views.py             # API endpoints and business logic
│   ├── serializers.py       # DRF serializers
│   └── urls.py              # API URL routing
├── frontend/                # React application
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── Auth.jsx           # Authentication system
│   │   │   ├── ImageGallery.jsx   # Main gallery view
│   │   │   ├── ImageUpload.jsx    # Upload interface
│   │   │   ├── ImageViewer.jsx    # Full-size image modal
│   │   │   └── CommentSystem.jsx  # Threaded comments
│   │   └── services/        # API integration
│   └── public/              # Static assets
└── media/                   # Uploaded images and thumbnails
```

## 🔑 Getting Started as a Wedding Guest

1. **Get Your Invitation Code**: Ask the couple for your unique invitation code
2. **Sign Up**: Visit the gallery and create your account using the invitation code
3. **Upload Photos**: Share your favorite moments from the wedding day
4. **Engage**: Comment on photos and reply to other guests' memories
5. **Enjoy**: Browse through all the beautiful memories shared by everyone

## 🛡️ Security & Privacy

- **Owner-Only Permissions**: Users can only delete or edit their own uploaded images
- **Invitation-Based Access**: Only invited guests can join the gallery
- **Secure Authentication**: Session-based authentication with CSRF protection
- **Role-Based Access**: Different permission levels for different types of users

## 🎯 User Roles

### Full User 👤
- Upload unlimited photos
- Comment and reply to all images
- Delete their own uploaded images
- Full gallery access

### Memory User 💭  
- Comment and reply to all images
- View all photos in the gallery
- Cannot upload new images

## 📱 Mobile Experience

The gallery is fully responsive and optimized for mobile devices. Guests can easily:
- Upload photos directly from their phone camera
- Browse the gallery with smooth touch navigation
- Comment and engage on any device
- Save favorite images to their device

## 🤝 Contributing

This is a private wedding gallery project. If you're working on similar wedding tech, feel free to draw inspiration from the architecture and features!

## 📝 License

Private project for wedding use. All photos and content remain the property of the wedding couple and their guests.

---

Made with ❤️ for an unforgettable wedding day