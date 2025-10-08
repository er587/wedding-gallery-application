# Wedding Gallery - Deployment Tools

This folder contains deployment scripts and maintenance tools for the Wedding Gallery application.

## 📁 Files Overview

### Deployment Scripts

| File | Purpose | Usage |
|------|---------|-------|
| `deploy.sh` | Main deployment script | `bash deployment/deploy.sh` |
| `verify-deployment.sh` | Pre-deployment verification | `bash deployment/verify-deployment.sh` |
| `git-verify.sh` | Git repository verification | `bash deployment/git-verify.sh` |

### Server Configuration

| File | Purpose | Description |
|------|---------|-------------|
| `gunicorn.service` | Systemd service file | Gunicorn process manager |
| `gunicorn.socket` | Systemd socket file | Socket activation for Gunicorn |
| `nginx.conf` | Nginx configuration | Reverse proxy configuration |
| `ssl-setup.sh` | SSL certificate setup | Let's Encrypt SSL automation |

### Email & Maintenance Tools

| File | Purpose | Usage |
|------|---------|-------|
| `test_email.py` | Email functionality testing | `python deployment/test_email.py` |
| `setup_email_env.sh` | Email configuration helper | `bash deployment/setup_email_env.sh` |

## 🚀 Quick Start

### 1. Pre-Deployment Verification

```bash
# Verify all files are present
bash deployment/verify-deployment.sh
```

### 2. Email Setup

```bash
# Interactive email configuration
bash deployment/setup_email_env.sh

# Test email functionality
python deployment/test_email.py
```

### 3. Deploy

```bash
# Run full deployment
bash deployment/deploy.sh
```

## 📧 Email Configuration

### Development (Console Output)

Emails will print to the terminal:

```bash
# Set these environment variables
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
FRONTEND_URL=http://localhost:5000
```

### Production (SMTP)

Send real emails via SMTP:

```bash
# Set these environment variables
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=noreply@yourdomain.com
FRONTEND_URL=https://yourdomain.com
```

### Gmail Setup

1. Enable 2-Factor Authentication
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Use app password in `EMAIL_HOST_PASSWORD`

### Test Email System

```bash
# From project root
python deployment/test_email.py

# Or from deployment folder
cd deployment && python test_email.py
```

This tests:
- ✅ Email configuration
- ✅ Verification email sending
- ✅ Password reset email sending
- ✅ Token generation and validation

**Note:** The script automatically handles being run from either the project root or the deployment folder.

## 🔧 Maintenance Tasks

### Regular Checks

**Weekly:**
```bash
# Test email system
python deployment/test_email.py

# Check deployment readiness
bash deployment/verify-deployment.sh
```

**Monthly:**
```bash
# Update dependencies
pip install -r requirements.txt --upgrade

# Run migrations
python manage.py migrate
```

### Troubleshooting

**Email not working:**
```bash
# Check email configuration
python deployment/test_email.py

# Verify environment variables
env | grep EMAIL
```

**Deployment verification fails:**
```bash
# Check what's missing
bash deployment/verify-deployment.sh

# Verify git repository
bash deployment/git-verify.sh
```

## 📚 Documentation

- **Full deployment guide**: See `../DEPLOYMENT.md`
- **Setup guide**: See `../SETUP.md`
- **Debian setup**: See `../SETUP-DEBIAN.md`

## 🆘 Support

If you encounter issues:

1. Run verification: `bash deployment/verify-deployment.sh`
2. Check email config: `python deployment/test_email.py`
3. Review logs on your deployment platform
4. Check environment variables are set correctly

## 🎯 Quick Reference

### Environment Variables Checklist

**Required:**
- [ ] `SECRET_KEY` - Django secret key
- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `ALLOWED_HOSTS` - Your domain
- [ ] `DEBUG` - Set to False for production

**Email (Required for user features):**
- [ ] `EMAIL_BACKEND` - Email backend type
- [ ] `EMAIL_HOST` - SMTP host
- [ ] `EMAIL_PORT` - SMTP port
- [ ] `EMAIL_HOST_USER` - Email address
- [ ] `EMAIL_HOST_PASSWORD` - Email password/app password
- [ ] `DEFAULT_FROM_EMAIL` - From email address
- [ ] `FRONTEND_URL` - Frontend URL for email links

**Optional:**
- [ ] `CORS_ALLOWED_ORIGINS` - Allowed CORS origins
- [ ] `WEDDING_COUPLE_NAME` - Couple names
- [ ] `WEDDING_DATE` - Wedding date
- [ ] `WEDDING_HASHTAG` - Wedding hashtag

### Common Commands

```bash
# Full deployment
bash deployment/deploy.sh

# Verify before deploy
bash deployment/verify-deployment.sh

# Setup email
bash deployment/setup_email_env.sh

# Test email
python deployment/test_email.py

# Check database
python manage.py dbshell

# Collect static files
python manage.py collectstatic --noinput
```
