#!/bin/bash

# Wedding Gallery - Deployment Verification Script
# Checks that all required files exist before deployment
# Usage: bash deployment/verify-deployment.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
MISSING_COUNT=0
TOTAL_CHECKS=0

# Functions
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
    ((MISSING_COUNT++))
}

print_info() {
    echo -e "${YELLOW}➜${NC} $1"
}

check_file() {
    ((TOTAL_CHECKS++))
    if [ -f "$1" ]; then
        print_success "$1"
        return 0
    else
        print_error "MISSING: $1"
        return 1
    fi
}

check_dir() {
    ((TOTAL_CHECKS++))
    if [ -d "$1" ]; then
        print_success "$1/"
        return 0
    else
        print_error "MISSING: $1/"
        return 1
    fi
}

echo "========================================="
echo "Wedding Gallery - Deployment Verification"
echo "========================================="
echo ""

# Check we're in the right directory
if [ ! -f "manage.py" ]; then
    echo -e "${RED}ERROR: Must run from project root directory${NC}"
    echo "Current directory: $(pwd)"
    exit 1
fi

print_info "Checking project structure..."
echo ""

# Core Django files
echo "Core Django Files:"
check_file "manage.py"
check_file "requirements.txt"
check_file "requirements-debian.txt"
check_file "debian-packages.txt"
echo ""

# Django project files
echo "Django Project Configuration:"
check_dir "django_project"
check_file "django_project/settings.py"
check_file "django_project/urls.py"
check_file "django_project/wsgi.py"
echo ""

# Images app - Core files
echo "Images App - Core Files:"
check_dir "images"
check_file "images/__init__.py"
check_file "images/models.py"
check_file "images/views.py"
check_file "images/serializers.py"
check_file "images/urls.py"
check_file "images/admin.py"
check_file "images/apps.py"
echo ""

# Images app - Custom modules (CRITICAL - these are often missing!)
echo "Images App - Custom Modules:"
check_file "images/storage.py"
check_file "images/face_recognition_utils.py"
check_file "images/middleware.py"
check_file "images/face_views.py"
echo ""

# Thumbnail processors (CRITICAL!)
echo "Custom Thumbnail Processors:"
check_dir "images/thumbnail_processors"
check_file "images/thumbnail_processors/__init__.py"
check_file "images/thumbnail_processors/smart_crop.py"
echo ""

# Migrations
echo "Database Migrations:"
check_dir "images/migrations"
check_file "images/migrations/__init__.py"
echo ""

# Frontend
echo "Frontend Application:"
check_dir "frontend"
check_file "frontend/package.json"
check_file "frontend/vite.config.js"
check_file "frontend/index.html"
check_dir "frontend/src"
check_file "frontend/src/App.jsx"
echo ""

# Frontend components
echo "Frontend Components:"
check_dir "frontend/src/components"
check_file "frontend/src/components/Auth.jsx"
check_file "frontend/src/components/ImageGallery.jsx"
check_file "frontend/src/components/ImageUpload.jsx"
check_file "frontend/src/components/ImageViewer.jsx"
check_file "frontend/src/components/CommentSystem.jsx"
check_file "frontend/src/components/MobileMenu.jsx"
echo ""

# Deployment files
echo "Deployment Configuration:"
check_dir "deployment"
check_file "deployment/deploy.sh"
check_file "deployment/gunicorn.service"
check_file "deployment/gunicorn.socket"
check_file "deployment/nginx.conf"
check_file "deployment/ssl-setup.sh"
echo ""

# Documentation
echo "Documentation Files:"
check_file "SETUP-DEBIAN.md"
check_file "replit.md"
echo ""

# Check for .env.example or provide template
echo "Environment Configuration:"
if [ -f ".env.example" ]; then
    check_file ".env.example"
else
    print_info "Note: .env.example not found (optional)"
fi
echo ""

# Python import tests (if venv exists)
if [ -d "venv" ] && [ -f "venv/bin/activate" ]; then
    print_info "Testing Python imports (venv detected)..."
    source venv/bin/activate
    
    # Test critical imports
    python3 -c "from images.storage import ReplitAppStorage" 2>/dev/null && \
        print_success "images.storage imports successfully" || \
        print_error "images.storage import FAILED"
    
    python3 -c "from images.thumbnail_processors.smart_crop import face_aware_crop" 2>/dev/null && \
        print_success "thumbnail_processors imports successfully" || \
        print_error "thumbnail_processors import FAILED"
    
    python3 -c "from images.face_recognition_utils import face_recognition_service" 2>/dev/null && \
        print_success "face_recognition_utils imports successfully" || \
        print_error "face_recognition_utils import FAILED"
    
    python3 -c "from images.middleware import MediaCacheMiddleware" 2>/dev/null && \
        print_success "middleware imports successfully" || \
        print_error "middleware import FAILED"
    
    deactivate
    echo ""
fi

# Summary
echo "========================================="
echo "Verification Summary"
echo "========================================="
echo "Total checks: $TOTAL_CHECKS"
echo "Missing items: $MISSING_COUNT"
echo ""

if [ $MISSING_COUNT -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! Ready for deployment.${NC}"
    exit 0
else
    echo -e "${RED}✗ Deployment verification FAILED!${NC}"
    echo ""
    echo "Missing $MISSING_COUNT critical file(s)/directory(ies)."
    echo ""
    echo "Common fixes:"
    echo "  1. Ensure all files are committed: git status"
    echo "  2. Pull latest changes: git pull"
    echo "  3. Check .gitignore isn't excluding files"
    echo "  4. Run: bash deployment/git-verify.sh"
    echo ""
    exit 1
fi
