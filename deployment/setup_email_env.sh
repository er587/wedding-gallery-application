#!/bin/bash
# Setup Email Environment Variables Helper Script

echo "========================================"
echo "Email Configuration Setup Helper"
echo "========================================"
echo ""

# Check if .env file exists
if [ -f .env ]; then
    echo "⚠ .env file already exists"
    read -p "Do you want to update email settings in existing .env? (y/n): " update_choice
    if [ "$update_choice" != "y" ]; then
        echo "Exiting without changes."
        exit 0
    fi
fi

echo ""
echo "Choose email configuration mode:"
echo "1) Console (Development) - Emails print to terminal"
echo "2) SMTP (Production) - Send real emails via SMTP"
read -p "Enter choice (1 or 2): " mode

if [ "$mode" == "1" ]; then
    # Console backend
    echo ""
    read -p "Test email address (optional, for testing email delivery): " test_email
    
    cat >> .env << EOF

# Email Configuration - Console Backend (Development)
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
FRONTEND_URL=http://localhost:5000
EOF
    
    if [ ! -z "$test_email" ]; then
        echo "TEST_EMAIL=${test_email}" >> .env
    fi
    
    echo ""
    echo "✓ Console email backend configured!"
    echo "  Emails will print to the terminal for testing."
    
elif [ "$mode" == "2" ]; then
    # SMTP backend
    echo ""
    echo "Enter SMTP configuration:"
    read -p "SMTP Host (e.g., smtp.gmail.com): " smtp_host
    read -p "SMTP Port (e.g., 587): " smtp_port
    read -p "Email address: " email_user
    read -sp "App password: " email_pass
    echo ""
    read -p "From email (e.g., noreply@yourdomain.com): " from_email
    read -p "Frontend URL (e.g., https://yourdomain.com): " frontend_url
    read -p "Test email address (optional, for testing email delivery): " test_email
    
    cat >> .env << EOF

# Email Configuration - SMTP Backend (Production)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=${smtp_host}
EMAIL_PORT=${smtp_port}
EMAIL_USE_TLS=True
EMAIL_HOST_USER=${email_user}
EMAIL_HOST_PASSWORD=${email_pass}
DEFAULT_FROM_EMAIL=${from_email}
FRONTEND_URL=${frontend_url}
EOF
    
    if [ ! -z "$test_email" ]; then
        echo "TEST_EMAIL=${test_email}" >> .env
    fi
    
    echo ""
    echo "✓ SMTP email backend configured!"
    echo "  Emails will be sent via ${smtp_host}"
else
    echo "Invalid choice. Exiting."
    exit 1
fi

echo ""
echo "========================================"
echo "Configuration complete!"
echo "========================================"
echo ""
echo "Test your email configuration with:"
echo "  python deployment/test_email.py"
echo ""
if [ ! -z "$test_email" ]; then
    echo "Test emails will be sent to: ${test_email}"
    echo ""
fi
