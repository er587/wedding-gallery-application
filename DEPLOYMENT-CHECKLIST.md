# Wedding Gallery - Deployment Checklist

Quick reference for all critical files that must exist for successful deployment.

## Pre-Deployment Verification

**Run these commands before deploying:**

```bash
# 1. Verify all files are committed
bash deployment/git-verify.sh

# 2. Verify deployment readiness
bash deployment/verify-deployment.sh
```

## Critical Files Checklist

### Core Django Files
- [ ] `manage.py` - Django management script
- [ ] `requirements.txt` - Python dependencies
- [ ] `requirements-debian.txt` - Debian-specific requirements
- [ ] `debian-packages.txt` - System packages list

### Django Project Configuration
- [ ] `django_project/settings.py` - Django settings
- [ ] `django_project/urls.py` - URL routing
- [ ] `django_project/wsgi.py` - WSGI application

### Images App - Core Files
- [ ] `images/__init__.py` - Package init
- [ ] `images/models.py` - Database models
- [ ] `images/views.py` - API views
- [ ] `images/serializers.py` - DRF serializers
- [ ] `images/urls.py` - URL patterns
- [ ] `images/admin.py` - Admin configuration
- [ ] `images/apps.py` - App configuration

### Images App - Custom Modules ⚠️ CRITICAL
These files are often missing and cause deployment failures:

- [ ] `images/storage.py` - Replit storage backend (209 lines)
- [ ] `images/face_recognition_utils.py` - Face detection logic
- [ ] `images/middleware.py` - Media caching middleware
- [ ] `images/face_views.py` - Face tagging API views

### Custom Thumbnail Processors ⚠️ CRITICAL
- [ ] `images/thumbnail_processors/` - Directory
- [ ] `images/thumbnail_processors/__init__.py` - Package init
- [ ] `images/thumbnail_processors/smart_crop.py` - Face-aware cropping

### Database Migrations
- [ ] `images/migrations/` - Directory
- [ ] `images/migrations/__init__.py` - Package init
- [ ] `images/migrations/0001_initial.py` - Initial migration
- [ ] All subsequent migration files

### Frontend Application
- [ ] `frontend/package.json` - Node dependencies
- [ ] `frontend/vite.config.js` - Vite configuration
- [ ] `frontend/index.html` - HTML entry point
- [ ] `frontend/src/App.jsx` - Main App component
- [ ] `frontend/src/index.css` - Global styles
- [ ] `frontend/src/main.jsx` - React entry point

### Frontend Components
- [ ] `frontend/src/components/Auth.jsx` - Authentication
- [ ] `frontend/src/components/ImageGallery.jsx` - Gallery view
- [ ] `frontend/src/components/ImageUpload.jsx` - Upload interface
- [ ] `frontend/src/components/ImageViewer.jsx` - Image viewer modal
- [ ] `frontend/src/components/CommentSystem.jsx` - Comments
- [ ] `frontend/src/components/MobileMenu.jsx` - Mobile navigation

### Deployment Files
- [ ] `deployment/deploy.sh` - Automated deployment script
- [ ] `deployment/verify-deployment.sh` - File verification
- [ ] `deployment/git-verify.sh` - Git status checker
- [ ] `deployment/gunicorn.service` - Systemd service
- [ ] `deployment/gunicorn.socket` - Systemd socket
- [ ] `deployment/nginx.conf` - Nginx configuration
- [ ] `deployment/ssl-setup.sh` - SSL/HTTPS setup

### Documentation
- [ ] `SETUP-DEBIAN.md` - Debian setup guide
- [ ] `DEPLOYMENT-CHECKLIST.md` - This file
- [ ] `replit.md` - Project documentation

### Environment Configuration
- [ ] `.env` file on server (not in git)
- [ ] `.env.example` (optional template)

## Common Missing Files Issues

### Problem: ModuleNotFoundError for 'images.storage'
**Solution:**
```bash
# Check if file exists
ls -la images/storage.py

# If missing, copy from source or git pull
git pull
# or
scp images/storage.py user@server:/var/www/wedding-gallery/images/
```

### Problem: ModuleNotFoundError for 'images.thumbnail_processors'
**Solution:**
```bash
# Check if directory exists
ls -la images/thumbnail_processors/

# If missing
git pull
# or
scp -r images/thumbnail_processors/ user@server:/var/www/wedding-gallery/images/
```

### Problem: Import errors for custom modules
**Solution:**
```bash
# Verify all custom modules
python3 -c "from images.storage import ReplitAppStorage"
python3 -c "from images.face_recognition_utils import face_recognition_service"
python3 -c "from images.thumbnail_processors.smart_crop import face_aware_crop"
```

## Deployment Workflow

### 1. Before Deploying (Local/Replit)
```bash
# Verify all files committed
bash deployment/git-verify.sh

# Commit any missing files
git add images/storage.py images/thumbnail_processors/
git commit -m "Add missing custom modules"
git push
```

### 2. On Debian Server
```bash
# Pull latest code
cd /var/www/wedding-gallery
git pull

# Verify deployment
bash deployment/verify-deployment.sh

# If verification passes, proceed with deployment
sudo bash deployment/deploy.sh
```

### 3. Post-Deployment
```bash
# Test application
curl -I https://yourdomain.com

# Check logs
sudo journalctl -u gunicorn-wedding.service -n 50
```

## Quick Fix Commands

**If files are missing on server:**

```bash
# Option 1: Git pull (preferred)
cd /var/www/wedding-gallery
git pull

# Option 2: Copy specific file
scp images/storage.py user@server:/var/www/wedding-gallery/images/

# Option 3: Copy entire images directory
scp -r images/ user@server:/var/www/wedding-gallery/

# Fix permissions after copying
sudo chown -R www-data:www-data /var/www/wedding-gallery/images
sudo systemctl restart gunicorn-wedding.service
```

## Verification Script Usage

**Local verification (before git push):**
```bash
bash deployment/git-verify.sh
```

**Server verification (before deployment):**
```bash
bash deployment/verify-deployment.sh
```

**Combined workflow:**
```bash
# On local/Replit
bash deployment/git-verify.sh && git push

# On server
cd /var/www/wedding-gallery && \
git pull && \
bash deployment/verify-deployment.sh && \
sudo bash deployment/deploy.sh
```

## Troubleshooting

### All verification scripts pass but deployment still fails?

1. **Check Python path:**
   ```bash
   source venv/bin/activate
   python -c "import sys; print('\n'.join(sys.path))"
   ```

2. **Check file permissions:**
   ```bash
   ls -la images/*.py
   ls -la images/thumbnail_processors/*.py
   ```

3. **Check virtual environment:**
   ```bash
   which python
   pip list | grep -i django
   ```

4. **Review deployment logs:**
   ```bash
   sudo journalctl -u gunicorn-wedding.service -n 100
   ```

## Success Indicators

✅ All checkboxes above are checked
✅ `bash deployment/git-verify.sh` exits with code 0
✅ `bash deployment/verify-deployment.sh` exits with code 0
✅ No ModuleNotFoundError in deployment logs
✅ Application accessible at domain
✅ Can login and upload images
✅ Thumbnails generate correctly

## Emergency Recovery

If deployment is completely broken:

```bash
# 1. Stop services
sudo systemctl stop gunicorn-wedding.service

# 2. Backup current state
sudo tar -czf /backups/broken-deployment-$(date +%Y%m%d).tar.gz /var/www/wedding-gallery

# 3. Fresh clone
sudo rm -rf /var/www/wedding-gallery
sudo git clone <your-repo-url> /var/www/wedding-gallery
cd /var/www/wedding-gallery

# 4. Verify before proceeding
bash deployment/verify-deployment.sh

# 5. If verification passes, redeploy
sudo bash deployment/deploy.sh
```
