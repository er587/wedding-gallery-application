# Contributing to Wedding Gallery

Thank you for your interest in contributing to the Wedding Gallery project! This guide will help you get started with contributing to this open-source wedding memory sharing platform.

## 🎯 Ways to Contribute

- **Bug Reports** - Help us identify and fix issues
- **Feature Requests** - Suggest new functionality
- **Code Contributions** - Submit fixes and improvements
- **Documentation** - Improve guides and examples
- **Testing** - Help test new features and report issues

## 🚀 Getting Started

### Prerequisites

Before contributing, make sure you have:
- **Python 3.10+** with pip
- **Node.js 20+** with npm
- **Git** for version control
- **Basic knowledge** of Django and React

### Development Setup

1. **Fork the Repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/wedding-gallery.git
   cd wedding-gallery
   ```

2. **Set Up Backend**
   ```bash
   # Install Python dependencies
   pip install -r requirements.txt
   
   # Run migrations
   python manage.py migrate
   
   # Create superuser (optional)
   python manage.py createsuperuser
   ```

3. **Set Up Frontend**
   ```bash
   cd frontend
   npm install
   cd ..
   ```

4. **Start Development Servers**
   ```bash
   # Terminal 1 - Backend
   python manage.py runserver 0.0.0.0:8000
   
   # Terminal 2 - Frontend
   cd frontend && npm run dev
   ```

5. **Verify Setup**
   - Backend API: http://localhost:8000/api/images/
   - Frontend App: http://localhost:5000

## 📋 Development Workflow

### Making Changes

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

2. **Make Your Changes**
   - Follow existing code style and patterns
   - Add tests for new functionality
   - Update documentation if needed

3. **Test Your Changes**
   ```bash
   # Backend tests
   python manage.py test
   
   # Manual testing
   # Test the application manually by:
   # 1. Creating user accounts with invitation codes
   # 2. Uploading various image formats
   # 3. Testing comment functionality
   # 4. Verifying permission restrictions
   ```

4. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add user profile editing feature"
   # or
   git commit -m "fix: resolve thumbnail generation issue"
   ```

5. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   # Then create Pull Request on GitHub
   ```

## 🎨 Code Style Guidelines

### Python (Backend)
- **PEP 8** compliance for Python code
- **Django conventions** for models, views, serializers
- **Descriptive variable names** and function names
- **Docstrings** for classes and complex functions
- **Type hints** where appropriate

### JavaScript (Frontend)
- **ES6+** modern JavaScript features
- **React functional components** with hooks
- **Descriptive component and variable names**
- **JSDoc comments** for complex functions
- **Consistent indentation** (2 spaces)

### General Guidelines
- **No hardcoded secrets** or API keys in code
- **Environment variables** for configuration
- **Error handling** for all user-facing features
- **Responsive design** for mobile compatibility

## 🧪 Testing Requirements

### Required Tests
- **Unit tests** for new backend functionality
- **Integration tests** for API endpoints
- **Component tests** for React components
- **Manual testing** for UI changes

### Test Commands
```bash
# Backend unit tests
python manage.py test images

# Django system check
python manage.py check

# Manual testing checklist:
# - User registration with invitation codes
# - Photo upload and thumbnail generation
# - Comment system functionality
# - Permission-based access control

# Frontend tests (if Jest configured)
cd frontend && npm test
```

## 📝 Commit Message Format

We use conventional commits for clear history:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (no logic changes)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

**Examples:**
```
feat: add image favorite/like functionality
fix: resolve thumbnail generation for large images
docs: update API documentation with new endpoints
style: format code according to PEP 8 guidelines
```

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Description** - Clear summary of the issue
2. **Steps to Reproduce** - Detailed reproduction steps
3. **Expected Behavior** - What should happen
4. **Actual Behavior** - What actually happens
5. **Environment** - OS, Python version, Node version
6. **Screenshots** - If applicable
7. **Error Messages** - Full stack traces

**Use the Bug Report template when creating issues.**

## 💡 Feature Requests

For new features, please provide:

1. **Problem Statement** - What problem does this solve?
2. **Proposed Solution** - How should it work?
3. **Alternative Solutions** - Other approaches considered
4. **Use Cases** - Real-world usage scenarios
5. **Implementation Ideas** - Technical approach (if any)

## 🔒 Security Issues

If you discover security vulnerabilities:

1. **Do NOT** open a public issue
2. **Email** security concerns privately (see SECURITY.md)
3. **Include** detailed information about the vulnerability
4. **Wait** for acknowledgment before public disclosure

## 🎉 Recognition

Contributors are recognized in several ways:

- **Contributors list** in README.md
- **GitHub contributors page**
- **Release notes** for significant contributions
- **Special thanks** in major releases

## 📚 Resources

### Documentation
- [Django Documentation](https://docs.djangoproject.com/)
- [Django REST Framework](https://www.django-rest-framework.org/)
- [React Documentation](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/docs)

### Project Specific
- [Setup Guide](SETUP.md) - Detailed installation instructions
- [API Documentation](docs/API.md) - Backend API reference
- [Deployment Guide](docs/DEPLOYMENT.md) - Production deployment
- [Architecture Overview](docs/ARCHITECTURE.md) - System design

## ❓ Questions?

- **GitHub Discussions** - For general questions
- **Issues** - For bug reports and feature requests
- **Discord/Slack** - For real-time chat (if available)

Thank you for contributing to Wedding Gallery! 🎊