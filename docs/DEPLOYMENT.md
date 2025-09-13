# Wedding Gallery Deployment Guide

Complete guide for deploying Wedding Gallery to production environments. Choose the deployment method that best fits your needs and technical expertise.

## 🎯 Deployment Overview

Wedding Gallery can be deployed in several ways:

- **🚀 Quick Deploy** - Railway, Heroku (5-10 minutes)
- **☁️ Cloud Platforms** - AWS, GCP, Azure (15-30 minutes)
- **🏠 Self-Hosted** - VPS, dedicated server (30-60 minutes)
- **🐳 Docker** - Containerized deployment (any platform)

## ⚡ Quick Deploy (Recommended)

### Railway Deployment

Railway offers the fastest deployment with automatic HTTPS and database.

1. **Prepare Your Repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/wedding-gallery.git
   cd wedding-gallery
   ```

2. **Create railway.json**
   ```json
   {
     "build": {
       "builder": "NIXPACKS"
     },
     "deploy": {
       "startCommand": "python manage.py migrate && python manage.py runserver 0.0.0.0:$PORT",
       "restartPolicyType": "ON_FAILURE"
     }
   }
   ```

3. **Deploy to Railway**
   ```bash
   npm install -g @railway/cli
   railway login
   railway init
   railway up
   ```

4. **Configure Environment Variables**
   In Railway dashboard, add:
   ```env
   SECRET_KEY=your-secret-key-here
   DEBUG=False
   ALLOWED_HOSTS=*.up.railway.app,your-domain.com
   ```

5. **Add Database (Optional)**
   ```bash
   railway add postgresql
   ```

### Heroku Deployment

1. **Create Heroku App**
   ```bash
   heroku create your-wedding-gallery
   heroku addons:create heroku-postgresql:mini
   ```

2. **Configure Buildpacks**
   ```bash
   heroku buildpacks:clear
   heroku buildpacks:add heroku/python
   heroku buildpacks:add heroku/nodejs
   ```

3. **Set Environment Variables**
   ```bash
   heroku config:set SECRET_KEY=your-secret-key
   heroku config:set DEBUG=False
   heroku config:set ALLOWED_HOSTS=.herokuapp.com
   ```

4. **Deploy**
   ```bash
   git push heroku main
   heroku run python manage.py migrate
   heroku run python manage.py createsuperuser
   ```

## ☁️ Cloud Platform Deployment

### AWS Deployment

#### Using AWS App Runner

1. **Prepare Buildspec**
   ```yaml
   # buildspec.yml
   version: 0.2
   phases:
     pre_build:
       commands:
         - echo Installing dependencies...
         - pip install -r requirements.txt
         - cd frontend && npm install && npm run build
     build:
       commands:
         - echo Build started on `date`
         - python manage.py collectstatic --noinput
         - python manage.py migrate
   artifacts:
     files:
       - '**/*'
   ```

2. **Deploy to App Runner**
   - Create App Runner service
   - Connect to GitHub repository
   - Configure build settings
   - Set environment variables

#### Using AWS Elastic Beanstalk

1. **Install EB CLI**
   ```bash
   pip install awsebcli
   ```

2. **Initialize and Deploy**
   ```bash
   eb init wedding-gallery
   eb create production
   eb deploy
   ```

3. **Configure Environment**
   ```bash
   eb setenv SECRET_KEY=your-key
   eb setenv DEBUG=False
   eb setenv ALLOWED_HOSTS=.elasticbeanstalk.com
   ```

### Google Cloud Platform (GCP)

#### Using Cloud Run

1. **Create Dockerfile**
   ```dockerfile
   FROM python:3.11-slim

   WORKDIR /app
   COPY requirements.txt .
   RUN pip install -r requirements.txt

   COPY . .
   RUN python manage.py collectstatic --noinput

   CMD ["gunicorn", "--bind", "0.0.0.0:8080", "django_project.wsgi:application"]
   ```

2. **Deploy to Cloud Run**
   ```bash
   gcloud run deploy wedding-gallery \
     --source . \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```

## 🏠 Self-Hosted Deployment

### Ubuntu/Debian VPS Setup

1. **Server Preparation**
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install python3 python3-pip python3-venv nginx postgresql
   sudo apt install nodejs npm
   ```

2. **Create Application User**
   ```bash
   sudo adduser wedding
   sudo usermod -aG sudo wedding
   su - wedding
   ```

3. **Deploy Application**
   ```bash
   git clone https://github.com/YOUR_USERNAME/wedding-gallery.git
   cd wedding-gallery
   
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

4. **Database Setup**
   ```bash
   sudo -u postgres createuser wedding
   sudo -u postgres createdb wedding_gallery
   sudo -u postgres psql -c "ALTER USER wedding PASSWORD 'secure_password';"
   ```

5. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

6. **Frontend Build**
   ```bash
   cd frontend
   npm install
   npm run build
   cd ..
   ```

7. **Django Setup**
   ```bash
   python manage.py migrate
   python manage.py collectstatic --noinput
   python manage.py createsuperuser
   ```

### Nginx Configuration

1. **Create Nginx Config**
   ```nginx
   # /etc/nginx/sites-available/wedding-gallery
   server {
       listen 80;
       server_name your-domain.com www.your-domain.com;
       
       location /static/ {
           alias /home/wedding/wedding-gallery/static/;
           expires 30d;
           add_header Cache-Control "public, no-transform";
       }
       
       location /media/ {
           alias /home/wedding/wedding-gallery/media/;
           expires 7d;
           add_header Cache-Control "public, no-transform";
       }
       
       location / {
           proxy_pass http://127.0.0.1:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

2. **Enable Site**
   ```bash
   sudo ln -s /etc/nginx/sites-available/wedding-gallery /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

### SSL Certificate (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

### Process Management (Systemd)

1. **Create Service File**
   ```ini
   # /etc/systemd/system/wedding-gallery.service
   [Unit]
   Description=Wedding Gallery Django App
   After=network.target
   
   [Service]
   Type=simple
   User=wedding
   WorkingDirectory=/home/wedding/wedding-gallery
   Environment=PATH=/home/wedding/wedding-gallery/venv/bin
   ExecStart=/home/wedding/wedding-gallery/venv/bin/gunicorn --workers 3 --bind 127.0.0.1:8000 django_project.wsgi:application
   Restart=always
   
   [Install]
   WantedBy=multi-user.target
   ```

2. **Enable and Start Service**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable wedding-gallery
   sudo systemctl start wedding-gallery
   ```

## 🐳 Docker Deployment

### Docker Compose Setup

1. **Create docker-compose.yml**
   ```yaml
   version: '3.8'
   
   services:
     web:
       build: .
       ports:
         - "8000:8000"
       environment:
         - DEBUG=False
         - DATABASE_URL=postgres://wedding:password@db:5432/wedding_gallery
       depends_on:
         - db
       volumes:
         - ./media:/app/media
   
     db:
       image: postgres:15
       environment:
         POSTGRES_DB: wedding_gallery
         POSTGRES_USER: wedding
         POSTGRES_PASSWORD: password
       volumes:
         - postgres_data:/var/lib/postgresql/data
   
     nginx:
       image: nginx:alpine
       ports:
         - "80:80"
         - "443:443"
       volumes:
         - ./nginx.conf:/etc/nginx/nginx.conf
         - ./media:/app/media
       depends_on:
         - web
   
   volumes:
     postgres_data:
   ```

2. **Create Dockerfile**
   ```dockerfile
   FROM python:3.11-slim
   
   WORKDIR /app
   
   # Install system dependencies
   RUN apt-get update && apt-get install -y \
       libpq-dev gcc \
       && rm -rf /var/lib/apt/lists/*
   
   # Install Python dependencies
   COPY requirements.txt .
   RUN pip install --no-cache-dir -r requirements.txt
   
   # Install Node.js and build frontend
   RUN apt-get update && apt-get install -y curl \
       && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
       && apt-get install -y nodejs
   
   COPY frontend/package*.json frontend/
   RUN cd frontend && npm install
   
   # Copy application code
   COPY . .
   
   # Build frontend
   RUN cd frontend && npm run build
   
   # Collect static files
   RUN python manage.py collectstatic --noinput
   
   EXPOSE 8000
   
   CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "3", "django_project.wsgi:application"]
   ```

3. **Deploy with Docker**
   ```bash
   docker-compose up -d
   docker-compose exec web python manage.py migrate
   docker-compose exec web python manage.py createsuperuser
   ```

## 🔧 Production Configuration

### Environment Variables

Create `.env` file with production settings:

```env
# Django Core Settings
SECRET_KEY=your-very-secure-secret-key-here
DEBUG=False
ALLOWED_HOSTS=your-domain.com,www.your-domain.com

# Database
DATABASE_URL=postgres://user:password@localhost:5432/wedding_gallery

# Media and Static Files
MEDIA_ROOT=/var/www/wedding-gallery/media
STATIC_ROOT=/var/www/wedding-gallery/static

# Email (for notifications)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.your-provider.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@domain.com
EMAIL_HOST_PASSWORD=your-email-password

# Security
SECURE_SSL_REDIRECT=True
SECURE_BROWSER_XSS_FILTER=True
SECURE_CONTENT_TYPE_NOSNIFF=True
SECURE_HSTS_SECONDS=31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS=True
SECURE_HSTS_PRELOAD=True

# CORS (adjust for your domain)
CORS_ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com

# File Upload Limits
FILE_UPLOAD_MAX_MEMORY_SIZE=10485760  # 10MB
DATA_UPLOAD_MAX_MEMORY_SIZE=10485760  # 10MB
```

### Performance Optimization

1. **Enable Gzip Compression**
   ```nginx
   gzip on;
   gzip_vary on;
   gzip_min_length 1024;
   gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
   ```

2. **Configure Caching**
   ```python
   # settings.py
   CACHES = {
       'default': {
           'BACKEND': 'django.core.cache.backends.redis.RedisCache',
           'LOCATION': 'redis://127.0.0.1:6379/1',
       }
   }
   ```

3. **Database Optimization**
   ```python
   DATABASES = {
       'default': {
           'ENGINE': 'django.db.backends.postgresql',
           'OPTIONS': {
               'MAX_CONNS': 20,
               'OPTIONS': {
                   'MAX_CONNS': 20,
               }
           }
       }
   }
   ```

## 🔒 Security Checklist

### Pre-Deployment Security

- [ ] **Secret Key**: Generate new SECRET_KEY for production
- [ ] **Debug Mode**: Set DEBUG=False
- [ ] **Allowed Hosts**: Configure ALLOWED_HOSTS properly
- [ ] **HTTPS**: Enable SSL/TLS certificates
- [ ] **Database**: Use strong database passwords
- [ ] **CORS**: Configure CORS_ALLOWED_ORIGINS
- [ ] **File Uploads**: Set reasonable file size limits

### Post-Deployment Security

- [ ] **Firewall**: Configure server firewall rules
- [ ] **Updates**: Keep all dependencies updated
- [ ] **Backups**: Set up regular database and file backups
- [ ] **Monitoring**: Set up error monitoring and alerts
- [ ] **Logs**: Configure log rotation and monitoring
- [ ] **Access**: Limit server access to necessary personnel

## 📊 Monitoring & Maintenance

### Health Monitoring

1. **Basic Health Check**
   ```python
   # Add to urls.py
   from django.http import JsonResponse
   
   def health_check(request):
       return JsonResponse({'status': 'healthy'})
   ```

2. **Database Monitoring**
   ```bash
   # Check database connections
   python manage.py shell -c "from django.db import connection; print(connection.ensure_connection())"
   ```

### Backup Strategy

1. **Database Backup**
   ```bash
   # Daily backup script
   #!/bin/bash
   DATE=$(date +%Y%m%d_%H%M%S)
   pg_dump wedding_gallery > /backups/wedding_gallery_$DATE.sql
   find /backups -name "*.sql" -mtime +7 -delete
   ```

2. **Media Files Backup**
   ```bash
   # Sync media files to cloud storage
   rsync -av /path/to/media/ s3://your-bucket/media/
   ```

### Log Management

1. **Configure Django Logging**
   ```python
   LOGGING = {
       'version': 1,
       'disable_existing_loggers': False,
       'handlers': {
           'file': {
               'level': 'INFO',
               'class': 'logging.FileHandler',
               'filename': '/var/log/wedding-gallery/django.log',
           },
       },
       'root': {
           'handlers': ['file'],
       },
   }
   ```

2. **Log Rotation**
   ```bash
   # /etc/logrotate.d/wedding-gallery
   /var/log/wedding-gallery/*.log {
       daily
       missingok
       rotate 52
       compress
       delaycompress
       notifempty
       create 644 wedding wedding
   }
   ```

## 🚀 Scaling Considerations

### High Traffic Optimization

1. **Load Balancing**
   - Use multiple app server instances
   - Configure Nginx upstream
   - Implement session affinity if needed

2. **Database Scaling**
   - Read replicas for query optimization
   - Connection pooling
   - Database indexing optimization

3. **Media Storage**
   - CDN for static assets
   - Cloud storage for user uploads
   - Image optimization pipeline

### Cost Optimization

1. **Resource Monitoring**
   - Track CPU and memory usage
   - Monitor database query performance
   - Analyze bandwidth usage

2. **Efficiency Improvements**
   - Enable database query optimization
   - Implement proper caching strategy
   - Optimize image sizes and formats

## ❓ Troubleshooting

### Common Issues

**Issue**: Static files not loading
```bash
# Solution
python manage.py collectstatic --noinput
# Check STATIC_ROOT and STATIC_URL settings
```

**Issue**: Database connection errors
```bash
# Check database service
systemctl status postgresql
# Verify connection settings
python manage.py dbshell
```

**Issue**: Permission denied on media uploads
```bash
# Fix media directory permissions
sudo chown -R wedding:wedding /path/to/media/
sudo chmod -R 755 /path/to/media/
```

### Support Resources

- **GitHub Issues**: Report deployment problems
- **Community Chat**: Get help from other users
- **Professional Support**: Available for complex deployments

---

## 🎉 Deployment Complete!

Your Wedding Gallery is now live and ready for your special day!

### Final Steps

1. **Test All Features**
   - User registration with invitation codes
   - Photo upload and thumbnail generation
   - Comment system functionality
   - Mobile responsiveness

2. **Create Content**
   - Set up invitation codes for different guest groups
   - Customize wedding information and branding
   - Upload initial photos if desired

3. **Share with Guests**
   - Provide registration instructions
   - Share invitation codes
   - Test the flow with a few early users

Congratulations on successfully deploying your Wedding Gallery! 🎊