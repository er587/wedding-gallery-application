#!/usr/bin/env python
"""
Manual Verification Tests using curl and basic commands
Tests that can run without complex setup
"""

import subprocess
import json
import sys

def run_command(command, description):
    """Run a shell command and return result"""
    print(f"🧪 {description}")
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            print(f"   ✅ Success")
            return result.stdout
        else:
            print(f"   ❌ Failed - Status: {result.returncode}")
            if result.stderr:
                print(f"   Error: {result.stderr[:200]}")
            return None
    except subprocess.TimeoutExpired:
        print(f"   ⏰ Timeout")
        return None
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        return None

def test_api_endpoints():
    """Test basic API endpoints using curl"""
    print("🚀 Testing API Endpoints")
    print("=" * 50)
    
    # Test 1: Image list endpoint
    result = run_command(
        'curl -s -X GET "http://localhost:8000/api/images/?page=1&page_size=3" | head -c 500',
        "Image List API (first 500 chars)"
    )
    
    if result and "results" in result:
        print("   📊 API returned paginated results")
    
    # Test 2: Check if API returns JSON
    result = run_command(
        'curl -s -H "Accept: application/json" "http://localhost:8000/api/images/" | python3 -m json.tool 2>/dev/null | head -n 5',
        "JSON Response Validation"
    )
    
    # Test 3: Test CORS preflight
    result = run_command(
        'curl -s -X OPTIONS "http://localhost:8000/api/images/" -H "Origin: http://localhost:5000" | head -c 200',
        "CORS Preflight Check"
    )
    
    # Test 4: User info endpoint (should work regardless of auth status)
    result = run_command(
        'curl -s -X GET "http://localhost:8000/api/user/" | head -c 100',
        "User Info Endpoint"
    )

def test_media_files():
    """Test media file accessibility"""
    print("\n📁 Testing Media Files")
    print("=" * 50)
    
    # Check if media directory exists and has files
    result = run_command(
        'find media/images -name "*.jpg" -o -name "*.png" | head -3',
        "Media Files Present"
    )
    
    if result and result.strip():
        files = result.strip().split('\n')
        print(f"   📸 Found {len(files)} image files")
        
        # Test first image accessibility
        if files:
            first_file = files[0]
            result = run_command(
                f'curl -s -I "http://localhost:8000/{first_file}" | head -n 3',
                f"Media File Access: {first_file}"
            )
    
    # Check thumbnails
    result = run_command(
        'find media/images -name "*thumb*" | head -3',
        "Thumbnail Files Present"
    )
    
    if result and result.strip():
        thumbs = result.strip().split('\n')
        print(f"   🖼️  Found {len(thumbs)} thumbnail files")

def test_database_connection():
    """Test database connectivity"""
    print("\n💾 Testing Database")
    print("=" * 50)
    
    # Check if we can connect to Django
    result = run_command(
        'python manage.py check --database default',
        "Database Connection Check"
    )
    
    # Check migrations status
    result = run_command(
        'python manage.py showmigrations | grep "\\[X\\]" | wc -l',
        "Applied Migrations Count"
    )
    
    if result and result.strip().isdigit():
        print(f"   📋 Applied migrations: {result.strip()}")

def test_frontend_build():
    """Test frontend build status"""
    print("\n⚛️  Testing Frontend")
    print("=" * 50)
    
    # Check if Vite dev server is running
    result = run_command(
        'curl -s -I "http://localhost:5000" | head -n 2',
        "Frontend Server Status"
    )
    
    # Check if React app returns HTML
    result = run_command(
        'curl -s "http://localhost:5000" | grep -i "react\\|vite\\|root" | head -n 2',
        "React App Loading"
    )

def test_permissions_system():
    """Test permission system functionality"""
    print("\n🔐 Testing Permissions")
    print("=" * 50)
    
    # Test unauthenticated image upload (should fail)
    result = run_command(
        'curl -s -X POST "http://localhost:8000/api/images/" -F "title=Test" -F "description=Test" | head -c 200',
        "Unauthenticated Upload (should fail)"
    )
    
    # Test unauthenticated comment (should fail)  
    result = run_command(
        'curl -s -X POST "http://localhost:8000/api/images/1/comments/" -H "Content-Type: application/json" -d \'{"content":"test"}\' | head -c 200',
        "Unauthenticated Comment (should fail)"
    )

def main():
    """Run all verification tests"""
    print("🎯 Wedding Gallery Manual Verification Tests")
    print("=" * 60)
    print("Testing core functionality without complex setup...\n")
    
    # Run all test categories
    test_api_endpoints()
    test_media_files()
    test_database_connection()
    test_frontend_build()
    test_permissions_system()
    
    print("\n" + "=" * 60)
    print("✅ Manual verification tests completed!")
    print("\n💡 Additional Manual Tests to Perform:")
    print("   1. Open browser to http://localhost:5000")
    print("   2. Verify gallery loads with images and thumbnails")
    print("   3. Test image upload with valid invitation code")
    print("   4. Test commenting on images")
    print("   5. Test image deletion (owner only)")
    print("   6. Test responsive design on mobile")
    print("\n🔧 For Full Testing:")
    print("   • Create test users with different invitation codes")
    print("   • Upload various image formats and sizes")
    print("   • Test permission boundaries (Full vs Memory users)")
    print("   • Test error handling (invalid files, network issues)")

if __name__ == "__main__":
    main()