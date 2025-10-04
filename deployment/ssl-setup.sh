#!/bin/bash

# Wedding Gallery - SSL Certificate Setup with Let's Encrypt
# Run this script AFTER your domain is pointing to your server

set -e  # Exit on error

echo "========================================="
echo "Wedding Gallery SSL Setup"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}➜ $1${NC}"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root (use sudo)"
   exit 1
fi

# Get domain from user
echo "Enter your domain name (e.g., example.com):"
read -p "Domain: " DOMAIN

if [ -z "$DOMAIN" ]; then
    print_error "Domain cannot be empty!"
    exit 1
fi

# Get email for Let's Encrypt
echo ""
echo "Enter your email address for Let's Encrypt notifications:"
read -p "Email: " EMAIL

if [ -z "$EMAIL" ]; then
    print_error "Email cannot be empty!"
    exit 1
fi

# Verify domain is pointing to this server
print_info "Checking if domain ${DOMAIN} is pointing to this server..."
SERVER_IP=$(curl -s http://checkip.amazonaws.com/)
DOMAIN_IP=$(dig +short ${DOMAIN} | tail -n1)

if [ "$SERVER_IP" != "$DOMAIN_IP" ]; then
    print_error "Warning: Domain ${DOMAIN} is not pointing to this server!"
    echo "  Server IP: ${SERVER_IP}"
    echo "  Domain IP: ${DOMAIN_IP}"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Install Certbot if not already installed
print_info "Ensuring Certbot is installed..."
apt update
apt install -y certbot python3-certbot-nginx
print_success "Certbot is installed"

# Stop nginx temporarily
print_info "Stopping Nginx temporarily..."
systemctl stop nginx

# Obtain SSL certificate
print_info "Obtaining SSL certificate from Let's Encrypt..."
certbot certonly --standalone \
    --preferred-challenges http \
    --email ${EMAIL} \
    --agree-tos \
    --no-eff-email \
    -d ${DOMAIN} \
    -d www.${DOMAIN}

if [ $? -eq 0 ]; then
    print_success "SSL certificate obtained successfully!"
else
    print_error "Failed to obtain SSL certificate"
    systemctl start nginx
    exit 1
fi

# Update nginx configuration
print_info "Updating Nginx configuration for SSL..."
sed -i "s/your-domain.com/${DOMAIN}/g" /etc/nginx/sites-available/wedding-gallery

# Uncomment SSL lines in nginx config
sed -i 's/# ssl_certificate /ssl_certificate /g' /etc/nginx/sites-available/wedding-gallery
sed -i 's/# ssl_certificate_key /ssl_certificate_key /g' /etc/nginx/sites-available/wedding-gallery
sed -i 's/# include \/etc\/letsencrypt/include \/etc\/letsencrypt/g' /etc/nginx/sites-available/wedding-gallery
sed -i 's/# ssl_dhparam /ssl_dhparam /g' /etc/nginx/sites-available/wedding-gallery

# Uncomment HTTP to HTTPS redirect
sed -i 's/# return 301 https/return 301 https/g' /etc/nginx/sites-available/wedding-gallery

# Test nginx configuration
print_info "Testing Nginx configuration..."
nginx -t

if [ $? -eq 0 ]; then
    print_success "Nginx configuration is valid"
else
    print_error "Nginx configuration test failed!"
    systemctl start nginx
    exit 1
fi

# Start nginx
print_info "Starting Nginx..."
systemctl start nginx
systemctl reload nginx
print_success "Nginx restarted with SSL"

# Update Django .env file
print_info "Updating .env file for HTTPS..."
APP_DIR="/var/www/wedding-gallery"
sed -i "s/CORS_ALLOWED_ORIGINS=.*/CORS_ALLOWED_ORIGINS=https:\/\/${DOMAIN},https:\/\/www.${DOMAIN}/g" ${APP_DIR}/.env
sed -i "s/CSRF_TRUSTED_ORIGINS=.*/CSRF_TRUSTED_ORIGINS=https:\/\/${DOMAIN},https:\/\/www.${DOMAIN}/g" ${APP_DIR}/.env

# Restart Gunicorn
print_info "Restarting Gunicorn service..."
systemctl restart gunicorn-wedding.service
print_success "Gunicorn restarted"

# Set up auto-renewal
print_info "Setting up automatic certificate renewal..."
systemctl enable certbot.timer
systemctl start certbot.timer
print_success "Auto-renewal configured"

# Test renewal
print_info "Testing certificate renewal..."
certbot renew --dry-run

echo ""
echo "========================================="
echo "SSL Setup Complete!"
echo "========================================="
echo ""
print_success "Your site is now secured with HTTPS!"
echo ""
echo "Your website is available at:"
echo "  https://${DOMAIN}"
echo "  https://www.${DOMAIN}"
echo ""
echo "Certificate Details:"
echo "  Certificate: /etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
echo "  Private Key: /etc/letsencrypt/live/${DOMAIN}/privkey.pem"
echo "  Expires: $(certbot certificates | grep 'Expiry Date' | head -n1)"
echo ""
echo "Automatic Renewal:"
echo "  Certificates will auto-renew via systemd timer"
echo "  Check status: systemctl status certbot.timer"
echo ""
print_info "Test your SSL configuration at: https://www.ssllabs.com/ssltest/"
