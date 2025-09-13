# Wedding Gallery - Complete Setup Guide

This guide will walk you through setting up your own Wedding Gallery application from scratch. Perfect for couples who want their own private photo-sharing platform for their wedding day!

## 🎯 Quick Overview

Wedding Gallery is a full-stack web application featuring:
- **Secure invitation-based registration** for wedding guests
- **Beautiful photo gallery** with smart thumbnail generation
- **Comment system** for sharing memories and stories
- **Role-based permissions** (Full Users can upload, Memory Users can comment only)
- **Owner-only deletion** - users can only manage their own photos
- **Mobile-responsive design** for all devices

## 📋 Prerequisites

Before you begin, ensure you have:

### System Requirements
- **Operating System**: macOS, Linux, or Windows 10/11
- **Python**: 3.11 or higher
- **Node.js**: 20.x or higher
- **Git**: Latest version
- **Text Editor**: VS Code, PyCharm, or similar

### Technical Knowledge
- Basic familiarity with command line/terminal
- Understanding of web development concepts
- Basic knowledge of Python and JavaScript (helpful but not required)

## 🚀 Step 1: Environment Setup

### Install Python Dependencies

1. **Clone the Repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/wedding-gallery.git
   cd wedding-gallery
   ```

2. **Create Virtual Environment** (Recommended)
   ```bash
   # On macOS/Linux
   python3 -m venv wedding_env
   source wedding_env/bin/activate
   
   # On Windows
   python -m venv wedding_env
   wedding_env\Scripts\activate
   ```

3. **Install Python Packages**
   ```bash
   pip install -r requirements.txt
   ```

### Install Node.js Dependencies

1. **Navigate to Frontend Directory**
   ```bash
   cd frontend
   ```

2. **Install npm Packages**
   ```bash
   npm install
   ```

3. **Return to Project Root**
   ```bash
   cd ..
   ```

## 🗄️ Step 2: Database Setup

### Initialize Django Database

1. **Run Database Migrations**
   ```bash
   python manage.py migrate
   ```
   This creates all necessary database tables.

2. **Create Admin User** (Optional but recommended)
   ```bash
   python manage.py createsuperuser
   ```
   Follow prompts to create your admin account.

3. **Verify Setup**
   ```bash
   python manage.py check
   ```
   This verifies the Django installation is working correctly.

## 🔑 Step 3: Create Invitation Codes

Wedding guests need invitation codes to register. You have two options:

### Option A: Using Django Admin (Recommended)

1. **Start the Server**
   ```bash
   python manage.py runserver 0.0.0.0:8000
   ```

2. **Access Admin Panel**
   - Open browser to http://localhost:8000/admin
   - Login with your superuser account

3. **Create Invitation Codes**
   - Click "Invitation codes"
   - Click "Add invitation code"
   - Fill in details:
     - **Code**: WEDDING2025 (or your choice)
     - **Role**: full_user (can upload) or memory_user (comments only)
     - **Uses**: Number of people who can use this code
     - **Description**: "Bride & Groom Family" or similar

### Option B: Using Command Line

```bash
python manage.py shell
```

```python
from images.models import InvitationCode

# Create code for family members (can upload photos)
InvitationCode.objects.create(
    code="FAMILY2025",
    role="full_user",
    uses=20,
    description="Family members - can upload photos"
)

# Create code for friends (can comment only)
InvitationCode.objects.create(
    code="FRIENDS2025", 
    role="memory_user",
    uses=50,
    description="Friends - can comment on photos"
)

exit()
```

## 🎨 Step 4: Frontend Configuration

### Configure Environment Variables

1. **Create Frontend Environment File**
   ```bash
   cd frontend
   touch .env.local
   ```

2. **Add Configuration**
   ```env
   # .env.local
   VITE_API_BASE_URL=http://localhost:8000
   VITE_WEDDING_TITLE="Sarah & John's Wedding"
   VITE_WEDDING_DATE="June 15, 2025"
   ```

### Customize Wedding Details

Edit `frontend/src/components/App.jsx` to personalize:

```javascript
// Update wedding information
const weddingInfo = {
  coupleName: "Sarah & John",
  weddingDate: "June 15, 2025", 
  venue: "Sunset Garden Venue",
  hashtag: "#SarahAndJohn2025"
}
```

## 🏃 Step 5: Launch the Application

### Start Backend Server

```bash
# In project root directory
python manage.py runserver 0.0.0.0:8000
```

The Django backend will be available at: **http://localhost:8000**

### Start Frontend Development Server

```bash
# In new terminal, navigate to frontend directory
cd frontend
npm run dev
```

The React frontend will be available at: **http://localhost:5000**

### Verify Everything Works

1. **Check Backend API**
   - Visit http://localhost:8000/api/images/
   - Should see JSON response with image data

2. **Check Frontend App**
   - Visit http://localhost:5000
   - Should see wedding gallery interface

3. **Test User Registration**
   - Click "Sign Up" 
   - Use invitation code you created
   - Verify account creation works

## 📸 Step 6: Test Photo Upload

### Upload Your First Photo

1. **Register a Test Account**
   - Use a Full User invitation code
   - Complete registration process

2. **Upload a Photo**
   - Click "Upload Photo" button
   - Select an image file
   - Add title and description
   - Submit upload

3. **Verify Thumbnail Generation**
   - Check that thumbnail appears in gallery
   - Verify full-size image opens in modal
   - Test face detection (if photo has faces)

### Test Comments System

1. **Add a Comment**
   - Click on any photo
   - Add a comment in the text box
   - Submit comment

2. **Test Replies**
   - Reply to existing comment
   - Verify threading works correctly

## ⚙️ Step 7: Production Configuration

### Environment Variables

Create `.env` file in project root:

```env
# Django settings
SECRET_KEY=your-secret-key-here
DEBUG=False
ALLOWED_HOSTS=your-domain.com,localhost

# Database (for production)
DATABASE_URL=postgres://user:password@localhost:5432/wedding_db

# Media settings
MEDIA_ROOT=/path/to/media/storage
STATIC_ROOT=/path/to/static/files

# Security
SECURE_SSL_REDIRECT=True
SECURE_BROWSER_XSS_FILTER=True
SECURE_CONTENT_TYPE_NOSNIFF=True
```

### Security Checklist

- [ ] Change default SECRET_KEY
- [ ] Set DEBUG=False for production
- [ ] Configure ALLOWED_HOSTS
- [ ] Enable HTTPS
- [ ] Set up proper media storage
- [ ] Configure database backups
- [ ] Set up monitoring and logging

## 🚀 Step 8: Deployment Options

### Option A: Simple VPS Deployment

1. **Prepare Server**
   ```bash
   sudo apt update
   sudo apt install python3 python3-pip nginx postgresql
   ```

2. **Deploy Code**
   ```bash
   git clone https://github.com/YOUR_USERNAME/wedding-gallery.git
   cd wedding-gallery
   pip install -r requirements.txt
   ```

3. **Configure Nginx**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location /static/ {
           alias /path/to/wedding-gallery/static/;
       }
       
       location /media/ {
           alias /path/to/wedding-gallery/media/;
       }
       
       location / {
           proxy_pass http://127.0.0.1:8000;
       }
   }
   ```

### Option B: Docker Deployment

1. **Build Images**
   ```bash
   docker-compose build
   ```

2. **Start Services**
   ```bash
   docker-compose up -d
   ```

### Option C: Cloud Platforms

- **Heroku**: Simple deployment with built-in database
- **DigitalOcean**: App Platform or Droplets
- **Railway**: Modern deployment platform
- **Vercel**: For frontend-only deployment
- **PythonAnywhere**: Django-friendly hosting

## 🔧 Troubleshooting

### Common Issues

#### Backend Issues

**Issue**: `ModuleNotFoundError: No module named 'images'`
```bash
# Solution: Install requirements and check Python path
pip install -r requirements.txt
export PYTHONPATH="${PYTHONPATH}:/path/to/wedding-gallery"
```

**Issue**: Database migration errors
```bash
# Solution: Reset migrations
python manage.py migrate --fake-initial
python manage.py migrate
```

**Issue**: Thumbnail generation fails
```bash
# Solution: Install OpenCV properly
pip uninstall opencv-python
pip install opencv-python-headless
```

#### Frontend Issues

**Issue**: `npm run dev` fails
```bash
# Solution: Clear cache and reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

**Issue**: API requests fail (CORS errors)
```bash
# Solution: Check Django CORS settings
# Ensure 'corsheaders' in INSTALLED_APPS
# Verify CORS_ALLOWED_ORIGINS includes frontend URL
```

### Getting Help

1. **Check Logs**
   ```bash
   # Django logs
   python manage.py runserver --verbosity=2
   
   # Frontend logs
   npm run dev
   ```

2. **Run Tests**
   ```bash
   # Backend tests
   python manage.py test
   
   # Integration tests
   python images/integration_tests.py
   ```

3. **Community Support**
   - GitHub Issues: Report bugs and get help
   - Discussions: Ask questions and share tips
   - Documentation: Check docs/ folder for more details

## 📚 Next Steps

After basic setup:

1. **Customize Styling**
   - Edit Tailwind CSS classes
   - Add your wedding colors and fonts
   - Customize component layouts

2. **Add Features**
   - Photo galleries by event (ceremony, reception, etc.)
   - Guest book functionality
   - Photo slideshow/carousel
   - Email notifications for new photos

3. **Performance Optimization**
   - Configure CDN for media files
   - Enable caching for static assets
   - Optimize database queries
   - Add image compression

4. **Backup Strategy**
   - Database backups
   - Media file backups
   - Configuration backups

## 🎉 Congratulations!

Your Wedding Gallery is now ready for your special day! Guests can share photos, leave comments, and create lasting memories together.

### Pre-Wedding Checklist

- [ ] Test all functionality thoroughly
- [ ] Create invitation codes for all guest groups
- [ ] Share registration instructions with wedding party
- [ ] Test with sample photos and comments
- [ ] Verify mobile responsiveness
- [ ] Set up monitoring and backups
- [ ] Prepare troubleshooting guide for wedding day

Enjoy your wedding and the beautiful memories your guests will share! 💕

---

## 📞 Support

Need help? Check our resources:
- [Contributing Guide](CONTRIBUTING.md)
- [API Documentation](docs/API.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [GitHub Issues](https://github.com/YOUR_USERNAME/wedding-gallery/issues)