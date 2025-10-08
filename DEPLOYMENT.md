# Wedding Gallery - Production Deployment Guide

## 🚀 Quick Start

Your Wedding Gallery application is now **production-ready** and configured for deployment with PostgreSQL database.

### Prerequisites
- PostgreSQL database server
- Node.js 18+ and Python 3.10+
- Environment variables configured

### 1. Environment Setup

Create your production `.env` file:

```bash
cp .env.example .env
```

**Required Environment Variables:**

```env
# SECURITY - CRITICAL!
SECRET_KEY=your-super-secret-production-key-here-minimum-50-characters
DEBUG=False

# DATABASE
DATABASE_URL=postgres://username:password@hostname:5432/database_name

# DEPLOYMENT
ALLOWED_HOSTS=your-domain.com,www.your-domain.com
CORS_ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
CORS_ALLOW_ALL_ORIGINS=False  # CRITICAL: Must be False in production!

# WEDDING CUSTOMIZATION
WEDDING_COUPLE_NAME="Your Names Here"
WEDDING_DATE="Your Wedding Date"
WEDDING_HASHTAG="#YourHashtag2025"
```

### 2. Quick Deploy (Automated)

```bash
# Make deployment script executable
chmod +x scripts/deploy.sh

# Run full deployment
./scripts/deploy.sh
```

### 3. Manual Deployment Steps

If you prefer manual deployment:

```bash
# Install dependencies
pip install -r requirements.txt
cd frontend && npm install && cd ..

# Build frontend
cd frontend && npm run build && cd ..

# Set up database
python manage.py migrate
python scripts/init_db.py

# Collect static files
python manage.py collectstatic --noinput

# Start production server
gunicorn --bind 0.0.0.0:8000 --workers 2 django_project.wsgi:application
```

## 🗄️ Database Configuration

### PostgreSQL Setup

The application is configured to use PostgreSQL in production. Your database will be automatically configured if you're using the Replit PostgreSQL integration.

**Manual PostgreSQL Setup:**

1. Create database:
```sql
CREATE DATABASE wedding_gallery;
CREATE USER wedding_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE wedding_gallery TO wedding_user;
```

2. Set DATABASE_URL:
```env
DATABASE_URL=postgres://wedding_user:secure_password@localhost:5432/wedding_gallery
```

### Database Initialization

The `scripts/init_db.py` script will:
- ✅ Test database connection
- ✅ Run all migrations
- ✅ Create superuser (if configured)
- ✅ Create default invitation codes
- ✅ Set up initial data

## 📧 Email Configuration

### Email Setup

Configure email settings for password reset and email verification features:

**For Development (Console):**
```env
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
FRONTEND_URL=http://localhost:5000
```

**For Production (SMTP):**
```env
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=noreply@yourdomain.com
FRONTEND_URL=https://yourdomain.com
TEST_EMAIL=your-email@gmail.com  # Optional: for testing email functionality
```

### Email Testing

**Automated Setup:**
```bash
# Interactive email configuration helper
bash deployment/setup_email_env.sh
```

**Verify Email Functionality:**
```bash
# Test with console output (default)
python deployment/test_email.py

# Test with your real email address
TEST_EMAIL=your-email@gmail.com python deployment/test_email.py
```

The test script will verify:
- ✅ Email configuration is correct
- ✅ Email verification tokens work
- ✅ Password reset tokens work
- ✅ Email delivery functions properly

**Tip:** Add `TEST_EMAIL=your-email@gmail.com` to your `.env` file to always test with your real email address.

**Gmail App Password Setup:**
1. Enable 2-Factor Authentication on your Google account
2. Go to: https://myaccount.google.com/apppasswords
3. Generate an app password for "Mail"
4. Use this password (not your regular password) in `EMAIL_HOST_PASSWORD`

## 🔒 Security Configuration

### Production Security Features

- **HTTPS Enforcement**: Automatic HTTPS redirect in production
- **Security Headers**: XSS protection, content type sniffing protection
- **CSRF Protection**: Cross-site request forgery protection
- **Session Security**: Secure cookies for HTTPS deployments
- **Static File Security**: WhiteNoise with compression and caching

### Required Security Settings

```env
DEBUG=False
SECRET_KEY=your-unique-secret-key-minimum-50-characters-long
SECURE_SSL_REDIRECT=True  # Only if you have HTTPS
```

## 🎯 Deployment Platforms

### Replit Deployment

Your application is configured for **Replit Autoscale Deployment**:

1. **Automatic Build**: Frontend builds and static files collected automatically
2. **Database Migrations**: Run automatically during deployment  
3. **Production Server**: Gunicorn with 2 workers
4. **Zero Downtime**: Autoscale handles traffic spikes

**To Deploy on Replit:**
1. Ensure all environment variables are set
2. Click "Deploy" in your Replit project
3. Your app will build and deploy automatically

### Other Platforms

**Heroku:**
```bash
# Add buildpacks
heroku buildpacks:add heroku/nodejs
heroku buildpacks:add heroku/python

# Set environment variables
heroku config:set SECRET_KEY=your-secret-key
heroku config:set DEBUG=False

# Deploy
git push heroku main
```

**Railway:**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy
railway login
railway link
railway up
```

**DigitalOcean App Platform:**
- Upload your code to GitHub
- Connect to DigitalOcean App Platform
- Configure environment variables
- Deploy automatically

## 🔧 Advanced Configuration

### Performance Optimization

**Database Connection Pooling:**
```env
DATABASE_URL=postgres://user:pass@host:5432/db?sslmode=require&conn_max_age=600
```

**Static File Caching:**
```python
# Already configured in settings.py
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
```

### Custom Domain Setup

1. **Point your domain** to your deployment
2. **Update environment variables:**
```env
ALLOWED_HOSTS=your-domain.com,www.your-domain.com
CORS_ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

3. **Configure HTTPS:**
```env
SECURE_SSL_REDIRECT=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
```

## 🎨 Customization

### Wedding Information

Update your `.env` file:
```env
WEDDING_COUPLE_NAME="Sarah & John"
WEDDING_DATE="June 15, 2025"
WEDDING_VENUE="Sunset Garden Venue"
WEDDING_HASHTAG="#SarahAndJohn2025"
WEDDING_TITLE="Our Wedding Gallery"
WEDDING_DESCRIPTION="Share your beautiful memories from our special day!"
```

### Invitation Codes

**Create invitation codes** via Django admin:
1. Visit `/admin/` after deployment
2. Login with your superuser account
3. Go to "Invitation codes" section
4. Create codes for your guests

**Default invitation code**: `WEDDING2025` (created automatically)

## 📊 Monitoring & Maintenance

### Health Check

```bash
# Check if app is running
curl https://your-domain.com/api/auth/csrf/

# Check database connection
python manage.py shell -c "from django.db import connection; connection.ensure_connection(); print('DB OK')"

# Test email functionality
python deployment/test_email.py
```

### Log Monitoring

- **Application logs**: Check your deployment platform's logging
- **Database logs**: Monitor PostgreSQL performance
- **Static files**: WhiteNoise serves with proper caching headers
- **Email logs**: Monitor email delivery (check console or SMTP logs)

### Regular Maintenance Tasks

**Weekly:**
- ✅ Verify email functionality: `python deployment/test_email.py`
- ✅ Check database backups are running
- ✅ Review application logs for errors
- ✅ Monitor disk space usage

**Monthly:**
- ✅ Update dependencies: `pip install -r requirements.txt --upgrade`
- ✅ Run database optimizations
- ✅ Review and clean old email verification tokens
- ✅ Test all critical features (upload, download, comments)

**After Major Updates:**
- ✅ Run deployment verification: `bash deployment/verify-deployment.sh`
- ✅ Test email system: `python deployment/test_email.py`
- ✅ Verify image uploads and face detection
- ✅ Check all API endpoints

### Backup Strategy

**Database Backups:**
```bash
# Daily backup (set up as cron job)
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

**Media Files Backup:**
- Back up your `media/` directory regularly
- Consider cloud storage (AWS S3, CloudFront) for production

## 🆘 Troubleshooting

### Common Issues

**Static files not loading:**
```bash
python manage.py collectstatic --noinput --clear
```

**Database connection issues:**
```bash
# Test connection
python manage.py dbshell
```

**CORS errors:**
```env
# Check your CORS settings
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.com
```

**Migration issues:**
```bash
# Reset migrations (CAUTION: Data loss)
python manage.py migrate --fake-initial
```

### Support

If you encounter issues:

1. **Check logs** on your deployment platform
2. **Verify environment variables** are correctly set
3. **Test database connection** manually
4. **Check Django admin** for invitation codes

## 🎉 Success!

Your Wedding Gallery is now running in production! 

**Admin Access**: `https://your-domain.com/admin/`  
**API Endpoint**: `https://your-domain.com/api/`  
**Gallery**: `https://your-domain.com/`

Share your invitation codes with wedding guests and start collecting beautiful memories! 📸💕