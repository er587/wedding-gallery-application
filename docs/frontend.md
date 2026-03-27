# Frontend Architecture Documentation

## Overview

The frontend is a React 19.1.1 single-page application built with Vite 7.1.2 and styled with Tailwind CSS 3.4.17. It communicates with the Django backend via Axios, using session-based authentication with CSRF token protection.

**Source**: `frontend/src/`
**Build output**: `frontend/dist/`
**Dev server**: Port 5000 (proxies `/api/*` and `/media/*` to Django on port 8000)

---

## Tech Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Framework | React | 19.1.1 |
| Routing | react-router-dom | 7.9.3 |
| HTTP Client | Axios | 1.11.0 |
| Styling | Tailwind CSS | 3.4.17 |
| Build Tool | Vite | 7.1.2 |
| Lightbox | yet-another-react-lightbox | 3.25.0 |
| File Upload | @uppy/core + @uppy/dashboard + @uppy/aws-s3 | - |
| Tour Guide | driver.js | - |

---

## Application Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/` | App (main layout) | Gallery home page with header, image grid, and all modal overlays |
| `/reset-password/:token` | ResetPassword | Standalone page for password reset form |
| `/verify-email/:token` | EmailVerification | Standalone page for email verification handling |

---

## Component Architecture

### Component Tree

```
App (frontend/src/App.jsx)
├── ToastProvider (context wrapper)
├── Routes
│   ├── /reset-password/:token → ResetPassword
│   ├── /verify-email/:token → EmailVerification
│   └── / → Main Layout
│       ├── Header
│       │   ├── MobileMenu (hamburger menu, visible < md breakpoint)
│       │   │   └── Upload, Profile, Help, Logout buttons
│       │   ├── Desktop Nav (visible >= md breakpoint)
│       │   │   ├── Help button
│       │   │   ├── User avatar + name
│       │   │   ├── Upload Image button (if can_upload_images)
│       │   │   └── Logout button
│       │   └── Auth (login/signup forms, shown when logged out)
│       ├── ImageGallery
│       │   ├── SearchBar (tag filter + media type toggle)
│       │   ├── Image Grid (responsive columns)
│       │   │   └── Image Cards
│       │   │       ├── InlineEditableText (title)
│       │   │       ├── TagInput (display/edit tags)
│       │   │       └── Like/Comment/Delete action buttons
│       │   ├── ImageViewer (lightbox modal, on card click)
│       │   │   ├── Full-size image or Vimeo embed
│       │   │   ├── InlineEditableText (title, description)
│       │   │   ├── TagInput (editable)
│       │   │   └── CommentSystem (threaded)
│       │   ├── Infinite Scroll Sentinel (Intersection Observer)
│       │   └── Back-to-Top Button
│       ├── ImageUpload (modal overlay)
│       │   ├── Single upload mode (file + metadata)
│       │   ├── Bulk upload mode (multiple files)
│       │   ├── Vimeo URL mode
│       │   ├── Drag-and-drop zone
│       │   └── TagInput
│       ├── UserProfile (modal overlay)
│       │   ├── User info display
│       │   ├── Edit profile form
│       │   ├── Change password form
│       │   └── Upload history
│       ├── WelcomeModal (shown on first login)
│       └── HelpModal (help text + tour restart button)
```

---

## Component Details

### App (`frontend/src/App.jsx`)

Root component and primary state hub. Manages:

**State**:
- `user` - Current user object (initialized from localStorage)
- `showUpload` - Upload modal visibility
- `showProfile` - Profile modal visibility
- `showWelcome` - Welcome modal visibility (first login only)
- `showHelp` - Help modal visibility
- `refreshGallery` - Counter to trigger gallery refetch

**Initialization**:
- Fetches CSRF token on mount via `apiService.getCsrfToken()`

**Key Callbacks**:
- `handleLogin(userData)` - Sets user state, persists to localStorage, triggers welcome modal + tour on first login
- `handleLogout()` - Clears all state and localStorage, refreshes gallery
- `handleImageUploaded()` - Closes upload modal, increments refresh counter
- `handleUserUpdate(updatedUser)` - Updates user state and localStorage

---

### ImageGallery (`frontend/src/components/ImageGallery.jsx`)

Main gallery view with infinite scroll, filtering, and image interaction.

**Features**:
- Responsive grid layout (1-4 columns based on viewport)
- Infinite scroll via Intersection Observer
- Staggered image decode to prevent CPU spikes
- Tag filtering and media type filtering (images/videos/all)
- Search by title, description, uploader
- Like toggle and comment count display
- Image deletion (owner only)
- Lazy loading with `loading="lazy"` and `decoding="async"`
- Responsive thumbnails with `srcSet` (320px, 640px, 1440px)

**Props**: `user`, `refresh` (counter)

---

### ImageViewer (`frontend/src/components/ImageViewer.jsx`)

Full-screen lightbox modal for viewing images/videos with all metadata.

**Features**:
- Full-resolution image display
- Vimeo video embed (iframe)
- Inline editing of title and description (owner only)
- Tag management (any full user)
- Like toggle
- Comment system (threaded)
- Keyboard navigation: Left/Right arrows (prev/next), Escape (close)
- Swipe support for mobile

**Props**: `image`, `images` (for navigation), `user`, `onClose`, `onUpdate`, `onDelete`

---

### Auth (`frontend/src/components/Auth.jsx`)

Authentication modal with three modes: login, signup, and forgot password.

**Login Mode**:
- Email + password fields
- Calls `authService.login()`
- Error display via toast

**Signup Mode**:
- First name, last name, email, password, confirm password, invitation code
- Client-side validation: email format, password length >= 8, password match
- Calls `authService.register()`

**Forgot Password Mode**:
- Email field
- Calls `authService.requestPasswordReset()`
- Success message display

---

### ImageUpload (`frontend/src/components/ImageUpload.jsx`)

Modal overlay for uploading images and videos.

**Modes**:
- **Single upload**: One image with title, description, tags
- **Bulk upload**: Multiple images with shared tags, auto-generated titles
- **Vimeo**: URL input with optional cover image

**Features**:
- Drag-and-drop file zone
- Image preview before upload
- Tag autocomplete from existing tags
- File type validation (frontend only)
- Upload progress indication
- Form data sent as `multipart/form-data`

**Props**: `user`, `onImageUploaded`, `onCancel`

---

### CommentSystem (`frontend/src/components/CommentSystem.jsx`)

Threaded comment display and input for images.

**Features**:
- Top-level comments with one level of replies
- Author name display with initials avatar
- Relative date formatting
- Reply button triggers nested form
- Login required indicator for unauthenticated users

**Props**: `imageId`, `user`, `comments`

---

### TagInput (`frontend/src/components/TagInput.jsx`)

Autocomplete tag input with keyboard support.

**Features**:
- Typeahead suggestions from existing tags
- Add/remove tags as pills
- Keyboard navigation: Arrow keys, Enter (select), Escape (close), Backspace (remove last)
- Click-outside detection to close dropdown

**Props**: `selectedTags`, `onTagsChange`, `availableTags`, `disabled`

---

### InlineEditableText (`frontend/src/components/InlineEditableText.jsx`)

Click-to-edit text field with save/cancel.

**Features**:
- Display mode → edit mode on click
- Enter to save, Escape to cancel
- Validation callback support
- Loading state during save

**Props**: `value`, `onSave`, `editable`, `multiline`, `placeholder`

---

### SearchBar (`frontend/src/components/SearchBar.jsx`)

Gallery filter controls.

**Features**:
- Tag-based filtering with multi-select
- Media type toggle (All / Images / Videos)
- Active filter count badge

**Props**: `tags`, `selectedTags`, `onTagsChange`, `mediaType`, `onMediaTypeChange`

---

### Toast (`frontend/src/components/Toast.jsx`)

Notification system using React Context API.

**Architecture**:
- `ToastProvider` wraps the app, provides `addToast()` via context
- `ToastContainer` renders active toasts
- Auto-dismiss after configurable timeout
- Types: success, error, info, warning

**Usage**: `const { addToast } = useToast(); addToast('Message', 'success')`

---

### UserTour (`frontend/src/components/UserTour.jsx`)

Interactive guided tour using driver.js.

**Steps**:
1. Welcome/gallery title
2. Gallery grid explanation
3. Upload button (if visible)
4. Search/filter bar
5. Help menu

**Persistence**: Tour completion stored in `localStorage` key `wedding-gallery-tour-completed`

**Exports**: `startUserTour()`, `hasCompletedTour()`

---

### Supporting Components

| Component | File | Purpose |
|-----------|------|---------|
| MobileMenu | `MobileMenu.jsx` | Hamburger menu for mobile viewports |
| WelcomeModal | `WelcomeModal.jsx` | First-login welcome message |
| HelpModal | `HelpModal.jsx` | Help text and tour restart button |
| ResetPassword | `ResetPassword.jsx` | Standalone password reset form (route: `/reset-password/:token`) |
| EmailVerification | `EmailVerification.jsx` | Email verification handler (route: `/verify-email/:token`) |

---

## Services

### API Service (`frontend/src/services/api.js`)

Axios instance configured for Django backend communication.

**Configuration**:
- Base URL: empty (relies on Vite proxy in dev, same-origin in prod)
- `withCredentials: true` for session cookie handling
- Default `Content-Type: application/json`

**Request Interceptor**:
- Reads `csrftoken` cookie and sets `X-CSRFToken` header
- Reads `authToken` from localStorage and sets `Authorization: Bearer` header (unused in current session-based setup)

**Response Interceptor**:
- 401 responses trigger automatic logout: clears localStorage, redirects to `/`

**Methods**:
All API methods are exported as named functions on `apiService` object (see `api.js` for complete list).

---

### Auth Service (`frontend/src/services/auth.js`)

Wrapper around `apiService` for authentication flows.

**Methods**:
- `login(username, password)` - Gets CSRF token, authenticates, stores user in localStorage
- `logout()` - Clears localStorage (`user`, `isAuthenticated`, `authToken`)
- `getCurrentUser()` - Returns parsed user from localStorage (or null)
- `register(userData)` - Gets CSRF token, registers, stores user
- `isAuthenticated()` - Checks `isAuthenticated` localStorage flag
- `requestPasswordReset(email)` - Gets CSRF, sends reset request
- `resetPassword(token, password)` - Gets CSRF, resets password
- `sendVerificationEmail()` - Gets CSRF, triggers verification email
- `verifyEmail(token)` - Gets CSRF, verifies email token

**Pattern**: Every mutation method fetches a fresh CSRF token before the actual API call.

---

## State Management

The application uses **no centralized state management library** (no Redux, Zustand, etc.).

**Approach**:
1. **Component state** (`useState`) - All UI and data state lives in `App.jsx` and is passed down as props
2. **Context API** - Only used for toast notifications (`ToastContext`)
3. **localStorage** - Persists authentication state across page reloads:
   - `user` - Serialized user object
   - `isAuthenticated` - Boolean flag
   - `hasSeenWelcome_{userId}` - Per-user welcome modal tracking
   - `wedding-gallery-tour-completed` - Tour completion flag

**Data Flow**: Unidirectional. App fetches data → passes to children via props → children call callbacks to trigger state updates in App → re-render.

---

## Styling

**Framework**: Tailwind CSS 3.4.17 (utility-first)

**Configuration**:
- `tailwind.config.js` - Content scanning for `./src/**/*.{js,jsx}`
- `postcss.config.js` - PostCSS with Tailwind and Autoprefixer plugins
- `frontend/src/index.css` - Only contains `@tailwind` directives

**Responsive Breakpoints** (Tailwind defaults):
- `sm:` 640px
- `md:` 768px (mobile menu threshold)
- `lg:` 1024px
- `xl:` 1280px

**No component-specific CSS files** except `App.css` for minimal global styles.

---

## Build Configuration

**Vite** (`frontend/vite.config.js`):

```
Dev Server: 0.0.0.0:5000
Proxy:
  /api/* → http://localhost:8000
  /media/* → http://localhost:8000
HMR: clientPort 443, port 24678 (for Replit)
```

**Scripts** (`package.json`):
- `npm run dev` - Start Vite dev server
- `npm run build` - Production build to `frontend/dist/`
- `npm run lint` - ESLint
- `npm run preview` - Preview production build

**Production**: Django serves `frontend/dist/index.html` via the catch-all route. Static assets are hashed for cache busting.
