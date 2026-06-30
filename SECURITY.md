# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | ✅ |
| < 1.0   | ❌ |

## Reporting a Vulnerability

The Wedding Gallery team takes security bugs seriously. We appreciate your efforts to responsibly disclose your findings, and will make every effort to acknowledge your contributions.

### How to Report Security Issues

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via one of the following methods:

#### Email
Open a **private GitHub Security Advisory** on the repository (**Security → Report a vulnerability**). Please don't use a public issue.

#### GitHub Security Advisories
1. Go to the repository's Security tab
2. Click "Report a vulnerability"
3. Fill out the security advisory form

### What to Include

When reporting security issues, please include the following information:

1. **Type of issue** (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
2. **Full paths** of source file(s) related to the manifestation of the issue
3. **Location** of the affected source code (tag/branch/commit or direct URL)
4. **Special configuration** required to reproduce the issue
5. **Step-by-step instructions** to reproduce the issue
6. **Proof-of-concept or exploit code** (if possible)
7. **Impact** of the issue, including how an attacker might exploit it

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution Timeline**: Depends on severity
  - Critical: 1-7 days
  - High: 7-30 days
  - Medium: 30-90 days
  - Low: 90+ days

### What to Expect

After submitting a report, you can expect:

1. **Acknowledgment** of your report within 48 hours
2. **Regular updates** on our progress
3. **Credit** in our security advisory (if desired)
4. **Coordination** on disclosure timing

## Security Best Practices

### For Users

When deploying Wedding Gallery:

1. **Use HTTPS** for all production deployments
2. **Keep dependencies updated** regularly
3. **Use strong passwords** for admin accounts
4. **Limit file upload sizes** to prevent DoS
5. **Configure proper CORS** settings
6. **Use environment variables** for secrets
7. **Enable database backups** and encryption
8. **Monitor logs** for suspicious activity

### For Developers

When contributing to Wedding Gallery:

1. **Never commit secrets** or API keys
2. **Validate all user input** on both frontend and backend
3. **Use parameterized queries** to prevent SQL injection
4. **Implement proper authentication** and authorization
5. **Sanitize file uploads** and validate file types
6. **Use CSRF protection** for state-changing operations
7. **Implement rate limiting** for API endpoints
8. **Follow secure coding guidelines**

## Known Security Considerations

### Current Security Features

- **CSRF Protection** - Django CSRF middleware enabled
- **SQL Injection Prevention** - Django ORM used throughout
- **File Upload Validation** - File type and size restrictions
- **Authentication Required** - For uploads and comments
- **Owner-Only Permissions** - Users can only delete their own content
- **Input Sanitization** - User content properly escaped
- **Secure Headers** - CORS and security headers configured

### Areas Requiring Attention

- **Rate Limiting** - Consider implementing for API endpoints
- **Email Verification** - For user registration (if needed)
- **Password Policies** - Enforce strong passwords
- **Session Security** - Configure secure session settings
- **Content Validation** - Additional image content scanning
- **Audit Logging** - Track administrative actions

## Security Dependencies

### Backend Security Packages
- **Django**: Latest stable version for security patches
- **django-cors-headers**: Proper CORS configuration
- **Pillow**: Image processing with security updates

### Frontend Security
- **React**: Latest version for XSS protection
- **Vite**: Secure development and build process
- **Input Validation**: Client-side validation (not security boundary)

## Security Model

The gallery is **invitation-only**. The trust boundaries to be aware of:

### Private gallery
- Viewing requires an authenticated session — image list, image detail, comments,
  tags, and the photo count all require login (`IsAuthenticated`).
- The only public endpoint is `/api/site-config/`, which returns landing-page text
  (couple names, date, venue). It never returns a gallery photo to an anonymous
  caller.

### Protected media
- Image bytes under `/media/` are **not** served directly. They go through an
  auth-gated view that requires a logged-in session (authenticated via the session
  cookie the browser sends with `<img>` requests), confines the path to
  `MEDIA_ROOT` (no traversal), and — in production — hands the file to an internal
  nginx location via `X-Accel-Redirect`. Files belonging to a soft-deleted photo
  are not served.

### AI labeling — agent-key trust model
The labeling pipeline lets an external AI agent (or a staff member) propose
captions/tags, but **nothing it submits reaches the live gallery without a staff
member's approval**.

- **Agent API keys** (`AgentApiKey`) are **issued by an admin** in the Django admin
  and stored **hashed** (the plaintext key is shown once at creation and never
  again). A client presents it in the `X-Agent-Key` request header.
- A valid agent key (or a staff session) may **read** the labeling queue and
  **submit** suggestions — but every suggestion is created with status `pending`.
  It is inert until reviewed.
- **Applying** a suggestion to a real image (`approve`) and rejecting one are
  **staff-only** (`IsAdminUser`). The approval step is the trust gate; an agent can
  never write a title/tag onto a photo directly.
- A suggestion's `source` (shown to reviewers) is attributed **server-side** from
  the authenticated identity (the agent key's name, or `staff:<username>`); it is
  not taken from client input, so an agent cannot label its own suggestion as
  staff-vetted.

### Provider API keys
- AI provider keys (`ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY`) live
  in server-side environment variables only and are never sent to the browser.

## Disclosure Policy

- **Coordination**: We prefer coordinated disclosure
- **Timeline**: 90 days from initial report to public disclosure
- **Exceptions**: Critical vulnerabilities may be disclosed sooner
- **Credit**: Security researchers will be credited unless they prefer anonymity

## Security Hall of Fame

We recognize security researchers who help improve Wedding Gallery:

<!-- This section will be updated as we receive reports -->

*No security issues reported yet. Be the first!*

## Contact

For security-related questions and concerns:

- **GitHub Security Advisory**: the repository's Security tab → "Report a vulnerability"
- **General Contact**: See main README for project contact information

---

Thank you for keeping Wedding Gallery secure! 🔒