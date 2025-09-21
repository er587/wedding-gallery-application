#!/bin/bash

# Wedding Gallery Production Deployment Script
# This script prepares and deploys the application to production

set -e  # Exit on any error

echo "🚀 Starting Wedding Gallery deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required environment variables are set
check_env_vars() {
    print_status "Checking environment variables..."
    
    required_vars=("DATABASE_URL" "SECRET_KEY")
    missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        print_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        echo ""
        echo "Please set these variables and run the script again."
        exit 1
    fi
    
    print_success "All required environment variables are set"
}

# Install Python dependencies
install_python_deps() {
    print_status "Installing Python dependencies..."
    pip install -r requirements.txt || {
        print_error "Failed to install Python dependencies"
        exit 1
    }
    print_success "Python dependencies installed"
}

# Install Node.js dependencies and build frontend
build_frontend() {
    print_status "Building React frontend..."
    
    if [ -d "frontend" ]; then
        cd frontend
        
        print_status "Installing Node.js dependencies..."
        npm install || {
            print_error "Failed to install Node.js dependencies"
            exit 1
        }
        
        print_status "Building production bundle..."
        npm run build || {
            print_error "Failed to build frontend"
            exit 1
        }
        
        cd ..
        print_success "Frontend built successfully"
    else
        print_warning "Frontend directory not found, skipping frontend build"
    fi
}

# Run database migrations
run_migrations() {
    print_status "Running database migrations..."
    python manage.py migrate || {
        print_error "Database migrations failed"
        exit 1
    }
    print_success "Database migrations completed"
}

# Collect static files
collect_static() {
    print_status "Collecting static files..."
    python manage.py collectstatic --noinput || {
        print_error "Failed to collect static files"
        exit 1
    }
    print_success "Static files collected"
}

# Initialize database with default data
init_database() {
    print_status "Initializing database..."
    python scripts/init_db.py || {
        print_warning "Database initialization had some issues, but deployment continues"
    }
}

# Security check
security_check() {
    print_status "Running security check..."
    python manage.py check --deploy || {
        print_warning "Security check found issues, but deployment continues"
    }
    print_success "Security check completed"
}

# Test database connection
test_db_connection() {
    print_status "Testing database connection..."
    python -c "
import os
import django
from django.conf import settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_project.settings')
django.setup()
from django.db import connection
try:
    with connection.cursor() as cursor:
        cursor.execute('SELECT 1')
    print('Database connection successful')
except Exception as e:
    print(f'Database connection failed: {e}')
    exit(1)
" || {
        print_error "Database connection test failed"
        exit 1
    }
    print_success "Database connection verified"
}

# Main deployment process
main() {
    echo ""
    echo "=================================================="
    echo "  Wedding Gallery Production Deployment"
    echo "=================================================="
    echo ""
    
    check_env_vars
    install_python_deps  # Install dependencies BEFORE any Django code
    test_db_connection   # Move after dependencies are installed
    build_frontend
    run_migrations
    collect_static
    # Note: init_database runs migrations again - only use if you need default data
    # init_database
    security_check
    
    echo ""
    print_success "🎉 Deployment completed successfully!"
    echo ""
    echo "Your Wedding Gallery application is ready for production!"
    echo ""
    echo "Next steps:"
    echo "  1. Start the application server: gunicorn django_project.wsgi:application"
    echo "  2. Access your site and test all functionality"
    echo "  3. Configure your web server (nginx/apache) if needed"
    echo "  4. Set up monitoring and logging"
    echo ""
}

# Run main function
main