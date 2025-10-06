# Wedding Gallery - Debian Server Setup Guide

Complete deployment guide for setting up the Wedding Gallery application on your own Debian/Ubuntu server.

## Prerequisites

- A Debian/Ubuntu server with root or sudo access
- A domain name pointing to your server's IP address
- At least 1GB RAM and 10GB storage
- SSH access to your server

## Quick Start

For automated deployment, run the automated script:

```bash
sudo bash deployment/deploy.sh
```

Then configure SSL:

```bash
sudo bash deployment/ssl-setup.sh
```

## Manual Setup Instructions

If you prefer manual setup or need to customize the installation:

### 1. Update System

```bash
sudo apt update
sudo apt upgrade -y
```

### 2. Install Required Packages

```bash
sudo apt install -y \
    python3 python3-pip python3-venv python3-dev \
    postgresql postgresql-contrib \
    nginx \
    git \
    libpq-dev \
    build-essential \
    libopencv-dev \
    ufw \
    certbot python3-certbot-nginx \
    nodejs npm
```

### 3. Configure PostgreSQL Database

```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL shell, run:
CREATE DATABASE wedding_gallery;
CREATE USER wedding_user WITH PASSWORD 'your-secure-password';
ALTER ROLE wedding_user SET client_encoding TO 'utf8';
ALTER ROLE wedding_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE wedding_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE wedding_gallery TO wedding_user;
\q
```

### 4. Clone Application Code

```bash
# Create application directory
sudo mkdir -p /var/www/wedding-gallery
cd /var/www/wedding-gallery

# Clone your repository (replace with your repo URL)
sudo git clone <your-repo-url> .

# Or upload your code via SCP/SFTP to this directory
```

### 5. Set Up Python Virtual Environment

```bash
cd /var/www/wedding-gallery

# Create virtual environment
sudo python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install Python dependencies
pip install -r requirements.txt
```

### 6. Configure Environment Variables

Create `.env` file:

```bash
sudo nano /var/www/wedding-gallery/.env
```

Add the following (customize values):

```env
# Django Settings
SECRET_KEY=your-django-secret-key-here
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com

# Database Configuration
DATABASE_URL=postgresql://wedding_user:your-secure-password@localhost:5432/wedding_gallery

# CORS Settings
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
CSRF_TRUSTED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
CORS_ALLOW_CREDENTIALS=True
CORS_ALLOW_ALL_ORIGINS=False

# File Paths
MEDIA_ROOT=/var/www/wedding-gallery/media
STATIC_ROOT=/var/www/wedding-gallery/static

# Email Configuration (Optional - for password reset)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=your-email@gmail.com
```

Generate a Django secret key:

```bash
python3 -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
```

### 7. Build Frontend

```bash
cd /var/www/wedding-gallery/frontend

# Install Node dependencies
npm install

# Build for production
npm run build

cd /var/www/wedding-gallery
```

### 8. Run Django Setup

```bash
# Activate virtual environment
source venv/bin/activate

# Run migrations
python manage.py migrate

# Collect static files
python manage.py collectstatic --noinput

# Create superuser for admin access
python manage.py createsuperuser
```

### 9. Create Required Directories

```bash
sudo mkdir -p /var/www/wedding-gallery/media
sudo mkdir -p /var/www/wedding-gallery/static
sudo mkdir -p /var/log/wedding-gallery
sudo mkdir -p /backups/wedding-gallery
```

### 10. Set File Permissions

```bash
# Set ownership to www-data (nginx user)
sudo chown -R www-data:www-data /var/www/wedding-gallery
sudo chmod -R 755 /var/www/wedding-gallery
sudo chmod -R 775 /var/www/wedding-gallery/media
sudo chmod -R 775 /var/www/wedding-gallery/static
sudo chown -R www-data:www-data /var/log/wedding-gallery
sudo chown -R www-data:www-data /backups/wedding-gallery
```

### 11. Configure Gunicorn Systemd Service

Create socket file:

```bash
sudo cp /var/www/wedding-gallery/deployment/gunicorn.socket /etc/systemd/system/gunicorn-wedding.socket
```

Create service file:

```bash
sudo cp /var/www/wedding-gallery/deployment/gunicorn.service /etc/systemd/system/gunicorn-wedding.service
```

Start and enable services:

```bash
sudo systemctl daemon-reload
sudo systemctl enable gunicorn-wedding.socket
sudo systemctl start gunicorn-wedding.socket
sudo systemctl enable gunicorn-wedding.service
sudo systemctl restart gunicorn-wedding.service
```

Check status:

```bash
sudo systemctl status gunicorn-wedding.service
```

### 12. Configure Nginx

Update the nginx configuration with your domain:

```bash
sudo sed "s/your-domain.com/yourdomain.com/g" \
    /var/www/wedding-gallery/deployment/nginx.conf > \
    /etc/nginx/sites-available/wedding-gallery
```

Enable the site:

```bash
sudo ln -sf /etc/nginx/sites-available/wedding-gallery /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
```

Test nginx configuration:

```bash
sudo nginx -t
```

Restart nginx:

```bash
sudo systemctl restart nginx
```

### 13. Configure Firewall

```bash
# Enable firewall
sudo ufw --force enable

# Allow SSH (important!)
sudo ufw allow OpenSSH

# Allow HTTP and HTTPS
sudo ufw allow 'Nginx Full'

# Check status
sudo ufw status
```

### 14. Set Up SSL/HTTPS with Let's Encrypt

```bash
# Run the automated SSL setup script
sudo bash /var/www/wedding-gallery/deployment/ssl-setup.sh

# Or manually:
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Follow the prompts to complete SSL setup.

### 15. Create Invitation Codes

Access the Django admin panel:

```
https://yourdomain.com/admin/
```

Log in with your superuser credentials and create invitation codes for users to sign up.

## Post-Deployment

### Testing

1. Visit `https://yourdomain.com` to test the application
2. Try logging in with your superuser account
3. Create an invitation code in the admin panel
4. Test user registration with the invitation code
5. Upload a test image
6. Test commenting functionality

### Monitoring

View application logs:

```bash
# Gunicorn logs
sudo journalctl -u gunicorn-wedding.service -f

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Application logs
sudo tail -f /var/log/wedding-gallery/app.log
```

### Maintenance

**Update application code:**

```bash
cd /var/www/wedding-gallery
sudo git pull
source venv/bin/activate
pip install -r requirements.txt
cd frontend && npm install && npm run build && cd ..
python manage.py migrate
python manage.py collectstatic --noinput
sudo systemctl restart gunicorn-wedding.service
```

**Database backup:**

```bash
# Create backup
sudo -u postgres pg_dump wedding_gallery > /backups/wedding-gallery/backup-$(date +%Y%m%d-%H%M%S).sql

# Restore backup
sudo -u postgres psql wedding_gallery < /backups/wedding-gallery/backup-file.sql
```

**Media files backup:**

```bash
sudo tar -czf /backups/wedding-gallery/media-$(date +%Y%m%d-%H%M%S).tar.gz /var/www/wedding-gallery/media
```

## Troubleshooting

### Application won't start

Check service status:
```bash
sudo systemctl status gunicorn-wedding.service
sudo journalctl -u gunicorn-wedding.service -n 50
```

### 502 Bad Gateway

1. Check if Gunicorn is running: `sudo systemctl status gunicorn-wedding.service`
2. Check socket file: `sudo ls -la /run/gunicorn-wedding.sock`
3. Restart services: `sudo systemctl restart gunicorn-wedding.service`

### Static files not loading

```bash
python manage.py collectstatic --noinput
sudo systemctl restart nginx
```

### Database connection errors

1. Check PostgreSQL is running: `sudo systemctl status postgresql`
2. Verify credentials in `.env` file
3. Test database connection: `sudo -u postgres psql -d wedding_gallery`

### Permission errors

```bash
sudo chown -R www-data:www-data /var/www/wedding-gallery
sudo chmod -R 775 /var/www/wedding-gallery/media
```

## Security Checklist

- [ ] Change default database password
- [ ] Set DEBUG=False in production
- [ ] Configure ALLOWED_HOSTS properly
- [ ] Set up SSL/HTTPS with Let's Encrypt
- [ ] Enable firewall (UFW)
- [ ] Keep server and packages updated
- [ ] Set strong passwords for admin accounts
- [ ] Regular database and media backups
- [ ] Monitor server logs for suspicious activity
- [ ] Disable root SSH login (optional but recommended)

## Support

For issues or questions:

1. Check the application logs
2. Review this documentation
3. Check the Django and Nginx error logs
4. Verify all configuration files are correct

## Files Reference

- **Deployment Script**: `/var/www/wedding-gallery/deployment/deploy.sh`
- **SSL Setup Script**: `/var/www/wedding-gallery/deployment/ssl-setup.sh`
- **Gunicorn Service**: `/etc/systemd/system/gunicorn-wedding.service`
- **Nginx Config**: `/etc/nginx/sites-available/wedding-gallery`
- **Environment File**: `/var/www/wedding-gallery/.env`
- **Application Logs**: `/var/log/wedding-gallery/`
- **Backups**: `/backups/wedding-gallery/`
