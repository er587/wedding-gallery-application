#!/usr/bin/env python
"""
Test script for email functionality in the Wedding Gallery application.

This script tests:
1. Email verification functionality
2. Password reset functionality

Configuration:
    Email settings are read from environment variables or .env file.
    
    To use .env file, create a .env file in the project root with:
    
    # For console output (development/testing)
    EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
    FRONTEND_URL=http://localhost:5000
    
    # For SMTP (production)
    # EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
    # EMAIL_HOST=smtp.gmail.com
    # EMAIL_PORT=587
    # EMAIL_USE_TLS=True
    # EMAIL_HOST_USER=your-email@gmail.com
    # EMAIL_HOST_PASSWORD=your-app-password
    # DEFAULT_FROM_EMAIL=noreply@yourdomain.com
    # FRONTEND_URL=https://yourdomain.com

Usage:
    # From project root
    python deployment/test_email.py
    
    # Or from deployment folder
    cd deployment && python test_email.py
"""

import os
import sys
import django

# Add project root to Python path if running from deployment folder
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir) if 'deployment' in script_dir else script_dir

if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Change to project root directory for Django setup
original_dir = os.getcwd()
os.chdir(project_root)

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_project.settings')
django.setup()

from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.conf import settings
from images.models import EmailVerificationToken, PasswordResetToken


def test_email_configuration():
    """Test email configuration settings"""
    print("=" * 60)
    print("Testing Email Configuration")
    print("=" * 60)
    
    print(f"Email Backend: {settings.EMAIL_BACKEND}")
    print(f"Email Host: {settings.EMAIL_HOST}")
    print(f"Email Port: {settings.EMAIL_PORT}")
    print(f"Email Use TLS: {settings.EMAIL_USE_TLS}")
    print(f"Email From: {settings.DEFAULT_FROM_EMAIL or 'Not set'}")
    print(f"Frontend URL: {settings.FRONTEND_URL}")
    print()
    
    if settings.EMAIL_BACKEND == 'django.core.mail.backends.console.EmailBackend':
        print("✓ Email backend is set to CONSOLE - emails will print to console")
        print()
        print("📝 To send real emails via SMTP, set these environment variables:")
        print("   EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend")
        print("   EMAIL_HOST=smtp.gmail.com")
        print("   EMAIL_PORT=587")
        print("   EMAIL_USE_TLS=True")
        print("   EMAIL_HOST_USER=your-email@gmail.com")
        print("   EMAIL_HOST_PASSWORD=your-app-password")
        print("   DEFAULT_FROM_EMAIL=noreply@yourdomain.com")
    else:
        print("✓ Email backend is configured for SMTP delivery")
        if not settings.DEFAULT_FROM_EMAIL:
            print("⚠ WARNING: DEFAULT_FROM_EMAIL is not set!")
        if settings.EMAIL_HOST_USER and settings.EMAIL_HOST_PASSWORD:
            print("✓ SMTP credentials are configured")
        else:
            print("⚠ WARNING: EMAIL_HOST_USER or EMAIL_HOST_PASSWORD may not be set")
    print()


def test_verification_email():
    """Test email verification functionality"""
    print("=" * 60)
    print("Testing Email Verification")
    print("=" * 60)
    
    # Get or create a test user
    user, created = User.objects.get_or_create(
        username='test_email_user@example.com',
        email='test_email_user@example.com',
        defaults={
            'first_name': 'Test',
            'last_name': 'User'
        }
    )
    
    if created:
        user.set_password('testpassword123')
        user.save()
        print(f"✓ Created test user: {user.email}")
    else:
        print(f"✓ Using existing test user: {user.email}")
    
    print()
    
    # Generate verification token
    print("Generating verification token...")
    token_obj = EmailVerificationToken.generate_token(user)
    raw_token = token_obj.raw_token
    
    print(f"✓ Token generated successfully")
    print(f"  Token: {raw_token[:20]}...")
    print(f"  Expires: {token_obj.expires_at}")
    print()
    
    # Construct verification URL
    verification_url = f"{settings.FRONTEND_URL}/verify-email/{raw_token}"
    
    # Prepare email content
    subject = 'Verify Your Email Address'
    message = f'''
Hi {user.first_name or user.username},

Please verify your email address by clicking the link below:

{verification_url}

This link will expire in 24 hours.

If you didn't request this verification, please ignore this email.

Best regards,
Wedding Gallery Team
    '''
    
    # Send verification email
    print("Sending verification email...")
    try:
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=False,
        )
        print("✓ Verification email sent successfully!")
        print()
        
        # Verify the token works
        print("Testing token verification...")
        verified_token = EmailVerificationToken.verify_token(raw_token)
        if verified_token:
            print(f"✓ Token verification successful!")
            print(f"  User: {verified_token.user.email}")
            print(f"  Is valid: {verified_token.is_valid()}")
        else:
            print("✗ Token verification failed!")
            
    except Exception as e:
        print(f"✗ Failed to send verification email: {e}")
    
    print()


def test_password_reset_email():
    """Test password reset functionality"""
    print("=" * 60)
    print("Testing Password Reset")
    print("=" * 60)
    
    # Get or create a test user
    user, created = User.objects.get_or_create(
        username='test_reset_user@example.com',
        email='test_reset_user@example.com',
        defaults={
            'first_name': 'Reset',
            'last_name': 'Tester'
        }
    )
    
    if created:
        user.set_password('oldpassword123')
        user.save()
        print(f"✓ Created test user: {user.email}")
    else:
        print(f"✓ Using existing test user: {user.email}")
    
    print()
    
    # Generate password reset token
    print("Generating password reset token...")
    token_obj = PasswordResetToken.generate_token(user)
    raw_token = token_obj.raw_token
    
    print(f"✓ Token generated successfully")
    print(f"  Token: {raw_token[:20]}...")
    print(f"  Expires: {token_obj.expires_at}")
    print()
    
    # Construct reset URL
    reset_url = f"{settings.FRONTEND_URL}/reset-password/{raw_token}"
    
    # Prepare email content
    subject = 'Reset Your Password'
    message = f'''
Hi {user.first_name or user.username},

You requested to reset your password. Click the link below to set a new password:

{reset_url}

This link will expire in 1 hour.

If you didn't request this password reset, please ignore this email or contact support if you're concerned.

Best regards,
Wedding Gallery Team
    '''
    
    # Send password reset email
    print("Sending password reset email...")
    try:
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=False,
        )
        print("✓ Password reset email sent successfully!")
        print()
        
        # Verify the token works
        print("Testing token verification...")
        verified_token = PasswordResetToken.verify_token(raw_token)
        if verified_token:
            print(f"✓ Token verification successful!")
            print(f"  User: {verified_token.user.email}")
            print(f"  Is valid: {verified_token.is_valid()}")
        else:
            print("✗ Token verification failed!")
            
    except Exception as e:
        print(f"✗ Failed to send password reset email: {e}")
    
    print()


def test_basic_email():
    """Test basic email sending without tokens"""
    print("=" * 60)
    print("Testing Basic Email Sending")
    print("=" * 60)
    
    print("Sending test email...")
    try:
        send_mail(
            'Test Email from Wedding Gallery',
            'This is a test email to verify email configuration is working correctly.',
            settings.DEFAULT_FROM_EMAIL,
            ['test@example.com'],
            fail_silently=False,
        )
        print("✓ Basic email sent successfully!")
    except Exception as e:
        print(f"✗ Failed to send basic email: {e}")
    
    print()


def cleanup_test_data():
    """Clean up test data created during testing"""
    print("=" * 60)
    print("Cleanup")
    print("=" * 60)
    
    # Delete test users
    deleted_count = User.objects.filter(
        email__in=['test_email_user@example.com', 'test_reset_user@example.com']
    ).delete()[0]
    
    if deleted_count > 0:
        print(f"✓ Cleaned up {deleted_count} test user(s)")
    else:
        print("✓ No test users to clean up")
    
    print()


def main():
    """Run all email tests"""
    print("\n" + "=" * 60)
    print("Wedding Gallery - Email Functionality Test Suite")
    print("=" * 60)
    print()
    
    try:
        # Test email configuration
        test_email_configuration()
        
        # Test basic email
        test_basic_email()
        
        # Test verification email
        test_verification_email()
        
        # Test password reset email
        test_password_reset_email()
        
        # Summary
        print("=" * 60)
        print("Test Summary")
        print("=" * 60)
        print("✓ All email tests completed!")
        print()
        print("Note: If EMAIL_BACKEND is set to console, check the terminal")
        print("      output above to see the email contents.")
        print()
        
        # Cleanup
        response = input("Do you want to clean up test users? (y/n): ")
        if response.lower() == 'y':
            cleanup_test_data()
        
        print("=" * 60)
        print("Testing Complete!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n✗ Test suite failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
