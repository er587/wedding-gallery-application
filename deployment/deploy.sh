#!/bin/bash

# Wedding Gallery - Automated Deployment Script for Ubuntu/Debian VPS
# Run this script as root or with sudo privileges

set -e  # Exit on error

echo "========================================="
echo "Wedding Gallery Deployment Script"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/var/www/wedding-gallery"
APP_USER="www-data"
DOMAIN="your-domain.com"  # CHANGE THIS!
DB_NAME="wedding_gallery"
DB_USER="wedding_user"
DB_PASSWORD="$(openssl rand -base64 32)"  # Random password

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

# Step 1: Update system
print_info "Updating system packages..."
apt update && apt upgrade -y
print_success "System updated"

# Step 2: Install dependencies
print_info "Installing dependencies..."
apt install -y python3 python3-pip python3-venv python3-dev \
    postgresql postgresql-contrib \
    nginx \
    git \
    libpq-dev \
    build-essential \
    libopencv-dev \
    ufw \
    certbot python3-certbot-nginx
print_success "Dependencies installed"

# Step 3: Configure PostgreSQL
print_info "Setting up PostgreSQL database..."
sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME};" || true
sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';" || true
sudo -u postgres psql -c "ALTER ROLE ${DB_USER} SET client_encoding TO 'utf8';"
sudo -u postgres psql -c "ALTER ROLE ${DB_USER} SET default_transaction_isolation TO 'read committed';"
sudo -u postgres psql -c "ALTER ROLE ${DB_USER} SET timezone TO 'UTC';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
print_success "PostgreSQL configured"

# Step 4: Create application directory
print_info "Creating application directory..."
mkdir -p ${APP_DIR}
mkdir -p ${APP_DIR}/media
mkdir -p ${APP_DIR}/static
mkdir -p /var/log/wedding-gallery
mkdir -p /backups/wedding-gallery

# Step 5: Clone or copy application code
print_info "Setting up application code..."
if [ -d "${APP_DIR}/wedding-gallery" ]; then
    print_info "Application directory already exists, pulling latest changes..."
    cd ${APP_DIR}
    git pull
else
    print_info "Please copy your application code to ${APP_DIR}"
    print_info "Or clone from git: git clone <your-repo-url> ${APP_DIR}"
    read -p "Press enter when code is in place..."
fi

cd ${APP_DIR}

# Step 5.5: Verify deployment files
print_info "Verifying all required files are present..."
if [ -f "deployment/verify-deployment.sh" ]; then
    bash deployment/verify-deployment.sh
    if [ $? -ne 0 ]; then
        print_error "Deployment verification failed!"
        print_info "Missing critical files. Please ensure all files are present before deploying."
        print_info "Run 'bash deployment/git-verify.sh' locally to check git status"
        exit 1
    fi
    print_success "All required files verified"
else
    print_error "Verification script not found: deployment/verify-deployment.sh"
    print_info "This may indicate incomplete code deployment"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Step 6: Create Python virtual environment
print_info "Creating Python virtual environment..."
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
print_success "Virtual environment created and dependencies installed"

# Step 7: Create .env file
print_info "Creating .env file..."
SECRET_KEY=$(python3 -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())')
cat > ${APP_DIR}/.env << EOF
SECRET_KEY=${SECRET_KEY}
DEBUG=False
ALLOWED_HOSTS=${DOMAIN},www.${DOMAIN}
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}
CORS_ALLOWED_ORIGINS=https://${DOMAIN},https://www.${DOMAIN}
CSRF_TRUSTED_ORIGINS=https://${DOMAIN},https://www.${DOMAIN}
CORS_ALLOW_CREDENTIALS=True
CORS_ALLOW_ALL_ORIGINS=False
MEDIA_ROOT=${APP_DIR}/media
STATIC_ROOT=${APP_DIR}/static
EOF
print_success ".env file created"

# Step 8: Build frontend
print_info "Building frontend..."
cd ${APP_DIR}/frontend
npm install
npm run build
cd ${APP_DIR}
print_success "Frontend built"

# Step 9: Django setup
print_info "Running Django migrations and collecting static files..."
source venv/bin/activate
python manage.py migrate
python manage.py collectstatic --noinput
print_success "Django setup complete"

# Step 10: Create superuser
print_info "Creating Django superuser..."
echo "Please create an admin account:"
python manage.py createsuperuser
print_success "Superuser created"

# Step 11: Set permissions
print_info "Setting file permissions..."
chown -R ${APP_USER}:${APP_USER} ${APP_DIR}
chmod -R 755 ${APP_DIR}
chmod -R 775 ${APP_DIR}/media
chmod -R 775 ${APP_DIR}/static
chown -R ${APP_USER}:${APP_USER} /var/log/wedding-gallery
chown -R ${APP_USER}:${APP_USER} /backups/wedding-gallery
print_success "Permissions set"

# Step 12: Configure systemd services
print_info "Configuring Gunicorn systemd service..."
cp ${APP_DIR}/deployment/gunicorn.socket /etc/systemd/system/gunicorn-wedding.socket
cp ${APP_DIR}/deployment/gunicorn.service /etc/systemd/system/gunicorn-wedding.service
systemctl daemon-reload
systemctl enable gunicorn-wedding.socket
systemctl start gunicorn-wedding.socket
systemctl enable gunicorn-wedding.service
systemctl restart gunicorn-wedding.service
print_success "Gunicorn service configured and started"

# Step 13: Configure Nginx
print_info "Configuring Nginx..."
sed "s/your-domain.com/${DOMAIN}/g" ${APP_DIR}/deployment/nginx.conf > /etc/nginx/sites-available/wedding-gallery
ln -sf /etc/nginx/sites-available/wedding-gallery /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default  # Remove default site
nginx -t
systemctl restart nginx
print_success "Nginx configured"

# Step 14: Configure firewall
print_info "Configuring firewall..."
ufw --force enable
ufw allow 'Nginx Full'
ufw allow OpenSSH
ufw status
print_success "Firewall configured"

# Step 15: Summary
echo ""
echo "========================================="
echo "Deployment Complete!"
echo "========================================="
echo ""
print_success "Your Wedding Gallery is now deployed!"
echo ""
echo "Important Information:"
echo "  Domain: http://${DOMAIN}"
echo "  Admin Panel: http://${DOMAIN}/admin/"
echo "  Database: ${DB_NAME}"
echo "  Database User: ${DB_USER}"
echo "  Database Password: ${DB_PASSWORD}"
echo ""
echo "Next Steps:"
echo "  1. Point your domain DNS to this server's IP address"
echo "  2. Run the SSL setup script: sudo bash deployment/ssl-setup.sh"
echo "  3. Visit http://${DOMAIN} to test your site"
echo "  4. Login to admin panel and create invitation codes"
echo ""
echo "Important: Save your database credentials in a secure location!"
echo "  Database Password: ${DB_PASSWORD}"
echo ""
print_info "For SSL/HTTPS setup, run: sudo bash deployment/ssl-setup.sh"
