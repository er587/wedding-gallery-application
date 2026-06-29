# Wedding Gallery 💒📸

A beautiful, secure wedding gallery application for sharing precious memories with loved ones. Built with Django REST Framework and React, featuring invitation-based access, intelligent photo management, and seamless social engagement.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://python.org)
[![React](https://img.shields.io/badge/React-19.1+-blue.svg)](https://react.dev)
[![Django](https://img.shields.io/badge/Django-5.0-green.svg)](https://djangoproject.com)

**Perfect for couples who want a private, elegant platform for wedding guests to share photos and memories!**

## ✨ Features

### 🔐 **Secure Access Control**
- **Invitation-based registration** - Only invited guests can join
- **Role-based permissions** - Full Users (upload & comment) vs Memory Users (comment only)
- **Owner-only deletion** - Users can only manage their own uploaded photos
- **Reusable invitation codes** with usage tracking and admin management

### 📸 **Intelligent Photo Management**
- **Smart thumbnail generation** using OpenCV face detection for optimal viewing angles
- **Drag-and-drop upload** with instant preview and validation
- **Automatic image optimization** - 90%+ file size reduction for faster loading
- **Organized storage** by user and timestamp
- **Multiple format support** - JPG, PNG, WebP, and more

### 💬 **Interactive Engagement**
- **Threaded comment system** for sharing memories and stories
- **Nested replies** to keep conversations organized
- **Fresh content updates** when new photos and comments are added
- **Mobile-optimized** for commenting on any device

### 🎨 **Beautiful Interface**
- **Modern, responsive design** built with React and Tailwind CSS
- **Mobile-first approach** - perfect for viewing on phones and tablets
- **Smooth animations** and intuitive user experience
- **Customizable themes** and wedding-specific branding

### 🤖 **AI Photo Labeling** (optional)
- **Auto-captioning** with your choice of **Claude, ChatGPT, or Gemini**
- **People matching** - find already-tagged guests across your untagged photos
- **Near-duplicate tagging** - copy tags to burst/duplicate shots (no API cost)
- **Staff review gate** - every AI suggestion is approved before it goes live
- **Editable prompts** - tune the AI's tone from the dashboard or Django admin

## 🚀 Quick Start

### One-Minute Demo
```bash
# Clone and set up (5 commands)
git clone https://github.com/er587/wedding-gallery-application.git
cd wedding-gallery
pip install -r requirements.txt
python manage.py migrate && cd frontend && npm install && cd ..

# Launch both servers (2 terminals)
python manage.py runserver 0.0.0.0:8000  # Backend
cd frontend && npm run dev                  # Frontend

# Visit http://localhost:5000 - Your gallery is ready!
```

### Complete Setup
For detailed installation instructions, see our **[Complete Setup Guide](SETUP.md)**.

## 🛠 Tech Stack

### Backend (Django REST Framework)
- **Django 5.0** - Robust web framework with built-in admin
- **Django REST Framework** - Powerful API development
- **OpenCV** - Intelligent face detection for thumbnail generation
- **Pillow** - Advanced image processing and optimization
- **SQLite/PostgreSQL** - Flexible database options
- **Vision LLMs** - Optional AI captioning via Anthropic, OpenAI, or Gemini

### Frontend (React + Vite)
- **React 19.1** - Modern component-based UI
- **Vite** - Lightning-fast development and build tool
- **Tailwind CSS** - Utility-first styling for beautiful design
- **Axios** - Seamless API communication

## 📋 Core Functionality

### For Wedding Couples
- **Admin dashboard** for managing invitation codes and user roles
- **Bulk photo management** with owner permissions
- **Guest activity overview** and engagement metrics
- **Customizable wedding information** and branding

### For Wedding Guests
- **Simple registration** with invitation codes
- **One-click photo uploads** from mobile or desktop
- **Social commenting** with reply threads
- **Beautiful gallery browsing** with fast-loading thumbnails
- **Save favorite photos** to device

## 🎯 User Roles

### 👤 Full Users
- Upload unlimited wedding photos
- Comment and reply to all images  
- Delete and edit their own uploads
- Full gallery access and engagement

### 💭 Memory Users
- View all photos in the gallery
- Comment and reply to share memories
- Cannot upload new photos
- Perfect for extended family and friends

## 📱 Screenshots

*Gallery View - Smart thumbnails with face detection*
*Upload Interface - Drag and drop with instant preview*  
*Comment System - Threaded conversations about memories*
*Mobile Experience - Optimized for phones and tablets*

## 🏃 Quick Development Setup

### Prerequisites
- **Python 3.10+** with pip
- **Node.js 20+** with npm
- **Git** for version control

### Backend Setup
```bash
# Install Python dependencies
pip install -r requirements.txt

# Initialize database
python manage.py migrate

# Create admin user
python manage.py createsuperuser

# Start development server
python manage.py runserver 0.0.0.0:8000
```

### Frontend Setup
```bash
# Install Node dependencies
cd frontend && npm install

# Start development server  
npm run dev

# Visit http://localhost:5000
```

### Create Invitation Codes
1. Visit http://localhost:8000/admin
2. Login with your admin account
3. Go to "Invitation codes" → "Add invitation code"
4. Create codes for different guest groups:
   - `FAMILY2025` (Full Users) - Can upload photos
   - `FRIENDS2025` (Memory Users) - Can comment only

## 🎨 Customization

### Wedding Branding
All wedding details (couple names, date, venue, intro/footer copy, featured
photo) are stored in the database — no code edits needed. Set them in the Django
admin under **Site configuration** (`/admin/`), and the site updates instantly.

### Styling
- **Colors**: Update Tailwind config in `tailwind.config.js`
- **Fonts**: Add Google Fonts in `index.html`
- **Layout**: Modify component files in `src/components/`
- **Images**: Replace logo and background images in `public/`

## 🤖 AI Photo Labeling

Generate captions and tags for your gallery with a vision LLM. **Every suggestion
goes through a staff review gate**, so nothing is published without your approval.

Three tools, available from a staff-only dashboard at **`/labeling`** and as
management commands:

- **Generate captions** — a warm, wedding-aware title + description per photo.
- **Match people** — finds people you've already tagged in your *other* untagged
  photos and suggests their names (few-shot visual matching).
- **Propagate to duplicates** — copies tags from a tagged photo to its
  near-identical shots via perceptual hashing (no API cost).

### Choose your AI provider

Captioning works with **Anthropic Claude**, **OpenAI (ChatGPT)**, or **Google
Gemini** — use whichever you have a key for. Configure in `.env`:

| Variable | Purpose |
| --- | --- |
| `LABELING_PROVIDER` | Default provider: `anthropic` (default), `openai`, or `gemini` |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` | API key for the provider(s) you use |
| `ANTHROPIC_LABELING_MODEL` / `OPENAI_LABELING_MODEL` / `GEMINI_LABELING_MODEL` | Optional model override per provider |
| `ANTHROPIC_LABEL_MAX_TAGS` | Optional cap on AI-suggested tags per image (`0` = none) |

The provider SDKs (`anthropic`, `openai`, `google-generativeai`) are in
`requirements.txt` and imported lazily — you only need the one you use.
People-matching currently uses Anthropic only.

### The staff dashboard

Log in as a staff user and open **Labeling** in the top bar:

- **Review** — approve/reject pending suggestions (thumbnail, suggested title,
  description, tags, confidence, rationale).
- **Run tasks** — run captions / match people / propagate with a live progress
  bar; choose the provider and model per run.
- **Prompts** — edit the caption and people-matching prompts right in the browser
  (stored in the DB; leave blank for the built-in default). Also editable in the
  Django admin.

### Labeling context

Set the couple names, venue, and location in the Django admin (**Site
configuration**) so captions are accurate. `fetch_venue_context` can pull your
venue website's text into the labeling context automatically.

### From the command line

The same tools are management commands — all write **pending** suggestions for
review:

```bash
python manage.py autolabel --limit 20 --model claude-sonnet-4-6   # captions
python manage.py match_people --min-confidence 0.7                # match tagged people
python manage.py propagate_labels --dry-run                       # near-duplicate tags
python manage.py fetch_venue_context                              # venue site -> context
```

## 📊 Performance Features

### Smart Optimization
- **Thumbnail Generation**: 300x300px thumbnails with face detection
- **File Size Reduction**: 90%+ smaller files for faster loading  
- **Lazy Loading**: Images load as you scroll
- **Caching**: Efficient browser and server-side caching
- **CDN Ready**: Easy integration with content delivery networks

### Scalability
- **Pagination**: Efficient loading of large photo collections
- **Database Optimization**: Indexed queries for fast retrieval
- **Media Storage**: Configurable local or cloud storage
- **API Rate Limiting**: Protection against abuse

## 🚀 Deployment Options

### Quick Deploy (5 minutes)
- **Railway** - `railway deploy` (recommended)
- **Heroku** - `git push heroku main`
- **DigitalOcean** - App Platform one-click deploy

### Self-Hosted
- **VPS/Dedicated Server** - Full control and customization
- **Docker** - Containerized deployment with docker-compose
- **Cloud Platforms** - AWS, GCP, Azure integration

See our **[Deployment Guide](docs/DEPLOYMENT.md)** for detailed instructions.

## 🧪 Testing

### Automated Tests
```bash
# Backend test suite
python manage.py test
```

### Test Coverage
- ✅ **Authentication** - Invitation codes, login/logout
- ✅ **Photo Management** - Upload, display, deletion permissions
- ✅ **Comments** - Threading, replies, validation
- ✅ **Permissions** - Role-based access control
- ✅ **Media Files** - Thumbnail generation, file access
- ✅ **API Integration** - All endpoints tested

## 🤝 Contributing

We love contributions! Whether you're fixing bugs, adding features, or improving documentation.

- **[Contributing Guide](CONTRIBUTING.md)** - How to contribute
- **[Code of Conduct](CODE_OF_CONDUCT.md)** - Community standards
- **[Security Policy](SECURITY.md)** - Reporting vulnerabilities

### Ways to Contribute
- 🐛 **Bug Reports** - Help us identify and fix issues
- ✨ **Feature Requests** - Suggest new functionality  
- 💻 **Code Contributions** - Submit improvements and fixes
- 📚 **Documentation** - Improve guides and examples
- 🧪 **Testing** - Help test new features

## 🔒 Security

Wedding photos are precious memories. We take security seriously:

- **Invitation-only access** prevents unauthorized users
- **Owner-only permissions** protect user content
- **Input validation** prevents malicious uploads
- **CSRF protection** secures all forms
- **Regular security updates** for all dependencies

Report security issues privately via our **[Security Policy](SECURITY.md)**.

## 📚 Documentation

- **[Complete Setup Guide](SETUP.md)** - Detailed installation instructions
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment
- **[Frontend Components](docs/FRONTEND.md)** - React component guide
- **[Contributing Guide](CONTRIBUTING.md)** - How to contribute
- **[Security Policy](SECURITY.md)** - Reporting vulnerabilities

## 🚀 Roadmap

### Coming Soon
- **Photo Slideshow** - Automated photo presentations
- **Social Media Export** - Easy sharing to platforms
- **Advanced Analytics** - Photo engagement insights
- **Edit-before-approve** - Tweak AI suggestions before applying them

### Long Term
- **Multi-Wedding Support** - Host multiple events
- **Professional Photography Integration** - Vendor photo imports
- **AI Photo Enhancement** - Automatic photo improvements
- **Mobile App** - Native iOS and Android apps

## ❓ FAQ

### **Q: How many photos can be uploaded?**
A: Unlimited! The system is designed to handle thousands of wedding photos efficiently.

### **Q: Can I customize the design?**
A: Yes! Full customization of colors, fonts, layout, and branding is supported.

### **Q: Is it mobile-friendly?**
A: Absolutely! Mobile-first design ensures perfect experience on all devices.

### **Q: How do I backup photos?**
A: Multiple backup options available - local exports, cloud storage, and database dumps.

### **Q: Can I use my own domain?**
A: Yes! Deploy to any domain with full DNS and SSL support.

## 📞 Support

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - Questions and community help
- **GitHub Releases** - New version announcements

## 🙏 Acknowledgments

Built with love for couples everywhere. Special thanks to:

- **Django & React Communities** - Amazing frameworks and support
- **Open Source Contributors** - Features, fixes, and feedback
- **Wedding Couples** - Real-world testing and feature requests
- **Photography Community** - Guidance on image handling best practices

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

You're free to use, modify, and distribute this software for personal and commercial purposes.

---

<div align="center">

**Made with ❤️ for unforgettable wedding memories**

[⭐ Star this repo](https://github.com/er587/wedding-gallery-application) • [🚀 Deploy now](docs/DEPLOYMENT.md) • [💬 Discussions](https://github.com/er587/wedding-gallery-application/discussions)

</div>