# Wedding Gallery - Personal Server Deployment Guide

Complete step-by-step guide to deploy your Wedding Gallery application on a personal VPS (Virtual Private Server) like DigitalOcean, Linode, AWS EC2, or any Ubuntu/Debian server.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Deploy (Automated)](#quick-deploy-automated)
- [Manual Deployment](#manual-deployment)
- [Post-Deployment](#post-deployment)
- [Maintenance](#maintenance)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required

- **VPS Server**: Ubuntu 22.04 LTS or Debian 11+ with root/sudo access
- **Minimum Specs**: 1 CPU core, 1GB RAM, 25GB disk space
- **Domain Name**: Registered domain pointed to your server's IP
- **SSH Access**: Ability to SSH into your server

### Optional but Recommended

- **2GB RAM**: For better performance with multiple users
- **Email Service**: Gmail, SendGrid, or SMTP for notifications
- **Backup Storage**: External backup solution (AWS S3, Backblaze B2)

---

## Quick Deploy (Automated)

### Step 1: Prepare Your Server

1. **Create a VPS** (DigitalOcean, Linode, Vultr, AWS EC2, etc.)
   - Choose Ubuntu 22.04 LTS
   - Select a plan (minimum 1GB RAM recommended)
   - Note your server's IP address

2. **Point Your Domain** to your server
   ```bash
   # Add these DNS records at your domain registrar:
   A Record: @ → YOUR_SERVER_IP
   A Record: www → YOUR_SERVER_IP
   ```

3. **SSH into Your Server**
   ```bash
   ssh root@YOUR_SERVER_IP
   ```

### Step 2: Upload Your Code

```bash
# Clone or upload your application code
cd /var/www
git clone YOUR_REPOSITORY_URL wedding-gallery
# OR upload via SCP/SFTP

cd wedding-gallery
```

### Step 3: Configure Deployment

```bash
# Edit the deployment script with your domain
nano deployment/deploy.sh

# Change this line:
DOMAIN="your-domain.com"  # Replace with your actual domain
```

### Step 4: Run Automated Deployment

```bash
# Make scripts executable
chmod +x deployment/*.sh

# Run the deployment script
sudo bash deployment/deploy.sh
```

The script will:
- ✓ Install all dependencies (Python, PostgreSQL, Nginx, Node.js)
- ✓ Set up PostgreSQL database with secure credentials
- ✓ Create Python virtual environment
- ✓ Build frontend application
- ✓ Configure Gunicorn systemd service
- ✓ Set up Nginx reverse proxy
- ✓ Configure firewall
- ✓ Create admin account

### Step 5: Set Up SSL Certificate

```bash
# Wait for DNS propagation (5-30 minutes)
# Then run:
sudo bash deployment/ssl-setup.sh

# Enter your domain and email when prompted
```

### Step 6: Access Your Site

Visit `https://your-domain.com` and start using your wedding gallery!

---

## Manual Deployment

If you prefer manual control, follow these detailed steps:

### 1. Server Setup

#### Update System
```bash
sudo apt update && sudo apt upgrade -y
```

#### Install Dependencies
```bash
sudo apt install -y \
    python3 python3-pip python3-venv python3-dev \
    postgresql postgresql-contrib \
    nginx \
    git \
    libpq-dev \
    build-essential \
    libopencv-dev \
    nodejs npm \
    ufw \
    certbot python3-certbot-nginx
```

### 2. PostgreSQL Setup

```bash
# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE wedding_gallery;
CREATE USER wedding_user WITH PASSWORD 'your_secure_password_here';
ALTER ROLE wedding_user SET client_encoding TO 'utf8';
ALTER ROLE wedding_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE wedding_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE wedding_gallery TO wedding_user;
\q
EOF
```

### 3. Application Setup

```bash
# Create application directory
sudo mkdir -p /var/www/wedding-gallery
cd /var/www/wedding-gallery

# Clone your repository or upload code
git clone YOUR_REPO_URL .

# Create Python virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Frontend Build

```bash
cd /var/www/wedding-gallery/frontend
npm install
npm run build
cd ..
```

### 5. Configure Environment

```bash
# Create .env file
nano .env

# Add the following (update with your values):
```

```env
SECRET_KEY=your-generated-secret-key-here
DEBUG=False
ALLOWED_HOSTS=your-domain.com,www.your-domain.com
DATABASE_URL=postgresql://wedding_user:your_password@localhost:5432/wedding_gallery
CORS_ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
CSRF_TRUSTED_ORIGINS=https://your-domain.com,https://www.your-domain.com
CORS_ALLOW_CREDENTIALS=True
MEDIA_ROOT=/var/www/wedding-gallery/media
STATIC_ROOT=/var/www/wedding-gallery/static
```

### 6. Django Setup

```bash
# Run migrations
source venv/bin/activate
python manage.py migrate

# Collect static files
python manage.py collectstatic --noinput

# Create superuser
python manage.py createsuperuser
```

### 7. Set Permissions

```bash
# Create necessary directories
sudo mkdir -p /var/www/wedding-gallery/{media,static}
sudo mkdir -p /var/log/wedding-gallery
sudo mkdir -p /backups/wedding-gallery

# Set ownership
sudo chown -R www-data:www-data /var/www/wedding-gallery
sudo chown -R www-data:www-data /var/log/wedding-gallery
sudo chown -R www-data:www-data /backups/wedding-gallery

# Set permissions
sudo chmod -R 755 /var/www/wedding-gallery
sudo chmod -R 775 /var/www/wedding-gallery/media
sudo chmod -R 775 /var/www/wedding-gallery/static
```

### 8. Configure Gunicorn

```bash
# Copy systemd files
sudo cp deployment/gunicorn.socket /etc/systemd/system/gunicorn-wedding.socket
sudo cp deployment/gunicorn.service /etc/systemd/system/gunicorn-wedding.service

# Enable and start services
sudo systemctl daemon-reload
sudo systemctl enable gunicorn-wedding.socket
sudo systemctl start gunicorn-wedding.socket
sudo systemctl enable gunicorn-wedding.service
sudo systemctl start gunicorn-wedding.service

# Check status
sudo systemctl status gunicorn-wedding.service
```

### 9. Configure Nginx

```bash
# Update domain in nginx config
sudo sed "s/your-domain.com/YOUR_ACTUAL_DOMAIN/g" \
    deployment/nginx.conf > /etc/nginx/sites-available/wedding-gallery

# Enable site
sudo ln -s /etc/nginx/sites-available/wedding-gallery /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### 10. Configure Firewall

```bash
# Enable firewall
sudo ufw --force enable

# Allow SSH, HTTP, HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'

# Check status
sudo ufw status
```

### 11. SSL Certificate (Let's Encrypt)

```bash
# Obtain certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

---

## Post-Deployment

### Create Invitation Codes

1. Access Django admin: `https://your-domain.com/admin/`
2. Login with your superuser account
3. Navigate to "Invitation Codes"
4. Click "Add Invitation Code"
5. Create codes for your wedding guests

### Test Your Site

```bash
# Check all services are running
sudo systemctl status gunicorn-wedding
sudo systemctl status nginx
sudo systemctl status postgresql

# View logs
sudo journalctl -u gunicorn-wedding -f
sudo tail -f /var/log/nginx/wedding-gallery-error.log
```

### Customize Your Wedding Info

Update your `.env` file with wedding details:

```env
WEDDING_COUPLE_NAME=Your Names
WEDDING_DATE=Your Wedding Date
WEDDING_VENUE=Your Venue Name
WEDDING_HASHTAG=#YourHashtag
WEDDING_TITLE=Our Wedding Gallery
WEDDING_DESCRIPTION=Share your beautiful memories!
```

Then restart Gunicorn:
```bash
sudo systemctl restart gunicorn-wedding
```

---

## Maintenance

### Daily Backups

Create a backup script:

```bash
sudo nano /usr/local/bin/wedding-backup.sh
```

Add:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/wedding-gallery"

# Backup database
pg_dump wedding_gallery > ${BACKUP_DIR}/db_${DATE}.sql

# Backup media files
tar -czf ${BACKUP_DIR}/media_${DATE}.tar.gz /var/www/wedding-gallery/media

# Keep only last 30 days
find ${BACKUP_DIR} -name "*.sql" -mtime +30 -delete
find ${BACKUP_DIR} -name "*.tar.gz" -mtime +30 -delete
```

Make executable and add to cron:

```bash
sudo chmod +x /usr/local/bin/wedding-backup.sh
sudo crontab -e

# Add this line for daily backups at 2 AM:
0 2 * * * /usr/local/bin/wedding-backup.sh
```

### Update Application

```bash
cd /var/www/wedding-gallery
git pull
source venv/bin/activate
pip install -r requirements.txt
cd frontend && npm install && npm run build && cd ..
python manage.py migrate
python manage.py collectstatic --noinput
sudo systemctl restart gunicorn-wedding
```

### Monitor Logs

```bash
# Gunicorn logs
sudo journalctl -u gunicorn-wedding -f

# Nginx access logs
sudo tail -f /var/log/nginx/wedding-gallery-access.log

# Nginx error logs
sudo tail -f /var/log/nginx/wedding-gallery-error.log

# Django logs
sudo tail -f /var/log/wedding-gallery/gunicorn-error.log
```

### Performance Monitoring

```bash
# Check disk space
df -h

# Check memory usage
free -m

# Check running processes
htop

# Check PostgreSQL connections
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"
```

---

## Troubleshooting

### Site Not Loading

```bash
# Check Nginx
sudo systemctl status nginx
sudo nginx -t

# Check Gunicorn
sudo systemctl status gunicorn-wedding
sudo journalctl -u gunicorn-wedding -n 50

# Check socket
ls -la /run/gunicorn-wedding.sock
```

### 502 Bad Gateway

```bash
# Check if Gunicorn is running
sudo systemctl restart gunicorn-wedding

# Check socket permissions
sudo chown www-data:www-data /run/gunicorn-wedding.sock
```

### Database Connection Errors

```bash
# Test database connection
sudo -u postgres psql wedding_gallery

# Check PostgreSQL is running
sudo systemctl status postgresql

# Verify DATABASE_URL in .env
cat /var/www/wedding-gallery/.env | grep DATABASE_URL
```

### Static Files Not Loading

```bash
# Recollect static files
cd /var/www/wedding-gallery
source venv/bin/activate
python manage.py collectstatic --noinput

# Check permissions
sudo chown -R www-data:www-data /var/www/wedding-gallery/static
sudo chmod -R 755 /var/www/wedding-gallery/static
```

### SSL Certificate Issues

```bash
# Renew certificate
sudo certbot renew

# Check certificate status
sudo certbot certificates

# Test SSL configuration
curl -I https://your-domain.com
```

### Permission Denied Errors

```bash
# Fix all permissions
sudo chown -R www-data:www-data /var/www/wedding-gallery
sudo chmod -R 755 /var/www/wedding-gallery
sudo chmod -R 775 /var/www/wedding-gallery/media
```

### Out of Disk Space

```bash
# Check disk usage
df -h

# Find large files
sudo du -sh /var/www/wedding-gallery/* | sort -hr

# Clean old backups
sudo find /backups -type f -mtime +30 -delete

# Clean apt cache
sudo apt clean
```

---

## Security Best Practices

1. **Regular Updates**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Strong Passwords**
   - Use unique, strong passwords for database and admin accounts
   - Consider using a password manager

3. **SSH Key Authentication**
   ```bash
   # Disable password authentication
   sudo nano /etc/ssh/sshd_config
   # Set: PasswordAuthentication no
   sudo systemctl restart sshd
   ```

4. **Fail2Ban** (Optional)
   ```bash
   sudo apt install fail2ban
   sudo systemctl enable fail2ban
   ```

5. **Regular Backups**
   - Automate daily backups
   - Store backups offsite (AWS S3, Backblaze B2)
   - Test restoration procedures

---

## Performance Optimization

### Enable Caching (Redis)

```bash
sudo apt install redis-server
pip install redis django-redis

# Add to .env:
CACHE_BACKEND=django.core.cache.backends.redis.RedisCache
CACHE_LOCATION=redis://127.0.0.1:6379/1
```

### Database Optimization

```bash
# Tune PostgreSQL (for 2GB RAM server)
sudo nano /etc/postgresql/14/main/postgresql.conf

# Update these values:
shared_buffers = 512MB
effective_cache_size = 1536MB
maintenance_work_mem = 128MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 2621kB
min_wal_size = 1GB
max_wal_size = 4GB

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Increase Gunicorn Workers

```bash
# Edit gunicorn service
sudo nano /etc/systemd/system/gunicorn-wedding.service

# Change --workers based on: (2 x CPU cores) + 1
# For 2 CPUs: --workers 5

sudo systemctl daemon-reload
sudo systemctl restart gunicorn-wedding
```

---

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review logs for error messages
3. Verify all environment variables are set correctly
4. Ensure DNS is properly configured
5. Test database connectivity

---

## Success Checklist

- [ ] Server created and accessible via SSH
- [ ] Domain DNS pointing to server IP
- [ ] All dependencies installed
- [ ] PostgreSQL database created and configured
- [ ] Application code deployed
- [ ] Frontend built successfully
- [ ] Environment variables configured
- [ ] Database migrations completed
- [ ] Static files collected
- [ ] Superuser account created
- [ ] Gunicorn service running
- [ ] Nginx configured and running
- [ ] Firewall configured
- [ ] SSL certificate installed
- [ ] Site accessible via HTTPS
- [ ] Admin panel accessible
- [ ] Invitation codes created
- [ ] Automated backups configured
- [ ] Monitoring setup
- [ ] Test upload/download functionality

🎉 **Congratulations!** Your Wedding Gallery is now live!

Share your invitation codes with guests and start collecting beautiful memories! 📸💕
