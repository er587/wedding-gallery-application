#!/usr/bin/env python
"""
Database initialization script for Wedding Gallery
This script sets up the PostgreSQL database with initial data and configurations
"""

import os
import sys
import django

# Add the project directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configure Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_project.settings')
django.setup()

from django.core.management import call_command
from django.contrib.auth import get_user_model
from django.db import connection
from images.models import InvitationCode

User = get_user_model()

def check_database_connection():
    """Check if database connection is working"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        print("✅ Database connection successful")
        return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False

def run_migrations():
    """Run Django migrations"""
    try:
        print("🔧 Running database migrations...")
        call_command('migrate', verbosity=1)
        print("✅ Migrations completed successfully")
        return True
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return False

def create_superuser():
    """Create superuser if it doesn't exist"""
    try:
        admin_username = os.getenv('DJANGO_SUPERUSER_USERNAME', 'admin')
        admin_email = os.getenv('DJANGO_SUPERUSER_EMAIL', 'admin@example.com')
        admin_password = os.getenv('DJANGO_SUPERUSER_PASSWORD')
        
        if not admin_password:
            print("⚠️  DJANGO_SUPERUSER_PASSWORD not set, skipping superuser creation")
            return True
            
        if User.objects.filter(username=admin_username).exists():
            print(f"✅ Superuser '{admin_username}' already exists")
            return True
            
        User.objects.create_superuser(
            username=admin_username,
            email=admin_email,
            password=admin_password
        )
        print(f"✅ Superuser '{admin_username}' created successfully")
        return True
    except Exception as e:
        print(f"❌ Failed to create superuser: {e}")
        return False

def create_invitation_codes():
    """Create default invitation codes"""
    try:
        # Create a general invitation code if none exist
        if not InvitationCode.objects.exists():
            InvitationCode.objects.create(
                code='WEDDING2025',
                code_type='full_user',
                uses_remaining=100,
                description='Default wedding invitation code'
            )
            print("✅ Default invitation code 'WEDDING2025' created")
        else:
            print("✅ Invitation codes already exist")
        return True
    except Exception as e:
        print(f"❌ Failed to create invitation codes: {e}")
        return False

def collect_static_files():
    """Collect static files for production"""
    try:
        print("📁 Collecting static files...")
        call_command('collectstatic', verbosity=1, interactive=False)
        print("✅ Static files collected successfully")
        return True
    except Exception as e:
        print(f"❌ Failed to collect static files: {e}")
        return False

def main():
    """Main initialization function"""
    print("🚀 Starting Wedding Gallery database initialization...\n")
    
    success = True
    
    # Check database connection
    if not check_database_connection():
        success = False
    
    # Run migrations
    if success and not run_migrations():
        success = False
    
    # Create superuser
    if success and not create_superuser():
        success = False
    
    # Create invitation codes
    if success and not create_invitation_codes():
        success = False
    
    # Collect static files
    if success and not collect_static_files():
        success = False
    
    if success:
        print("\n🎉 Database initialization completed successfully!")
        print("\nNext steps:")
        print("1. Set up your environment variables")
        print("2. Start the application server")
        print("3. Access the admin interface to manage invitation codes")
    else:
        print("\n❌ Database initialization failed. Please check the errors above.")
        sys.exit(1)

if __name__ == '__main__':
    main()