import { useState, useEffect, Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import ImageGallery from './components/ImageGallery'
import Auth from './components/Auth'
import MobileMenu from './components/MobileMenu'
import ErrorBoundary from './components/ErrorBoundary'
import { ToastProvider } from './components/Toast'

// Lazy-loaded components (not needed on initial page load)
const ImageUpload = lazy(() => import('./components/ImageUpload'))
const UserProfile = lazy(() => import('./components/UserProfile'))
const WelcomeModal = lazy(() => import('./components/WelcomeModal'))
const HelpModal = lazy(() => import('./components/HelpModal'))
const ResetPassword = lazy(() => import('./components/ResetPassword'))
const EmailVerification = lazy(() => import('./components/EmailVerification'))
const ImagePage = lazy(() => import('./components/ImagePage'))
const CelebrationOverlay = lazy(() => import('./components/CelebrationOverlay'))
const GuestBook = lazy(() => import('./components/GuestBook'))
import { authService } from './services/auth'
import { apiService } from './services/api'
import { startUserTour, hasCompletedTour } from './components/UserTour'

function App() {
  const [user, setUser] = useState(() => authService.getCurrentUser())
  const [showUpload, setShowUpload] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showGuestBook, setShowGuestBook] = useState(false)
  const [refreshGallery, setRefreshGallery] = useState(0)
  const [siteConfig, setSiteConfig] = useState(null)

  useEffect(() => {
    // Initialize app: get CSRF token for future requests
    const initializeApp = async () => {
      try {
        // Ensure CSRF cookie is set before making any POST requests
        await apiService.getCsrfToken()
      } catch (error) {
        console.error('Failed to initialize CSRF token:', error)
        // Continue anyway - the user can still try to login/use the app
      }
    }

    // Load wedding display content (couple, date, venue, masthead/footer copy)
    const loadSiteConfig = async () => {
      try {
        const { data } = await apiService.getSiteConfig()
        setSiteConfig(data)
      } catch (error) {
        console.error('Failed to load site configuration:', error)
      }
    }

    initializeApp()
    loadSiteConfig()
  }, [])

  // Reflect the couple's names in the browser tab once config loads.
  useEffect(() => {
    if (siteConfig?.couple_display) {
      document.title = siteConfig.couple_display
    }
  }, [siteConfig])

  const handleLogin = (userData) => {
    setUser(userData)
    localStorage.setItem('user', JSON.stringify(userData))
    
    // Check if this is the user's first time logging in
    const userKey = userData.id || userData.username || userData.email || 'default'
    const hasSeenWelcome = localStorage.getItem(`hasSeenWelcome_${userKey}`)
    if (!hasSeenWelcome) {
      setShowWelcome(true)
      // Mark as seen when modal opens to prevent repeats on refresh
      localStorage.setItem(`hasSeenWelcome_${userKey}`, 'true')
    }
    
    // Launch interactive tour on first login (independent of welcome modal)
    if (!hasCompletedTour()) {
      setTimeout(() => {
        startUserTour()
      }, 1500) // Delay to let welcome modal and UI render
    }
  }

  const handleUserUpdate = (updatedUser) => {
    setUser(updatedUser)
    localStorage.setItem('user', JSON.stringify(updatedUser))
  }

  const handleLogout = () => {
    authService.logout()
    setUser(null)
    setShowUpload(false)
    setShowProfile(false)
    setShowWelcome(false)
    // Redirect to default page by refreshing the gallery
    setRefreshGallery(prev => prev + 1)
    // Add a brief message to show logout was successful
    setTimeout(() => {
      // You could add a toast notification here if needed
    }, 100)
  }

  const handleWelcomeClose = () => {
    setShowWelcome(false)
  }

  const [celebration, setCelebration] = useState(null)

  const MILESTONES = {
    1: { emoji: '🦄', message: 'Your First Memory!' },
    10: { emoji: '🎉', message: '10 Memories!' },
    25: { emoji: '💐', message: '25 Memories!' },
    50: { emoji: '✨', message: '50 Memories!' },
    100: { emoji: '🥂', message: '100 Memories!' },
  }

  const handleImageUploaded = async () => {
    setShowUpload(false)
    setRefreshGallery(prev => prev + 1)

    // Check for upload milestones
    try {
      const response = await apiService.getUserUploadCount()
      const count = response.data.count
      if (MILESTONES[count]) {
        setCelebration(MILESTONES[count])
      }
    } catch (e) {
      // Silently skip milestone check on error
    }
  }

  return (
    <ErrorBoundary>
    <ToastProvider>
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-gray-400">Loading...</div></div>}>
      <Routes>
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/image/:id" element={<ImagePage />} />
        <Route path="/verify-email/:token" element={<EmailVerification />} />
        <Route path="/" element={
          <div className="min-h-screen bg-cream text-ink font-sans flex flex-col">
            {/* Utility bar */}
            <header className="sticky top-0 z-20 bg-cream/[.92] supports-[backdrop-filter]:backdrop-blur-md supports-[backdrop-filter]:backdrop-saturate-150 border-b border-sand-line">
              <div className="max-w-shell mx-auto flex items-center justify-between px-6 md:px-12 py-[18px]">
                {/* Monogram */}
                <div id="tour-welcome" className="text-[12px] font-medium leading-none uppercase tracking-[0.26em] text-sand-soft">
                  {siteConfig?.couple_display || 'Our Wedding'}
                </div>

                {user ? (
                  <>
                    {/* Mobile Menu */}
                    <div className="md:hidden">
                      <MobileMenu
                        user={user}
                        onUpload={() => setShowUpload(true)}
                        onProfile={() => setShowProfile(true)}
                        onHelp={() => setShowHelp(true)}
                        onLogout={handleLogout}
                      />
                    </div>

                    {/* Desktop utility nav */}
                    <div className="hidden md:flex items-center gap-[30px] text-[13px] text-sand-soft">
                      <button
                        onClick={() => setShowGuestBook(true)}
                        className="hover:text-ink transition-colors"
                      >
                        Guest Book
                      </button>
                      <button
                        onClick={() => setShowHelp(true)}
                        className="hover:text-ink transition-colors"
                      >
                        Help
                      </button>
                      <button
                        onClick={() => setShowProfile(true)}
                        className="flex items-center gap-[9px] hover:text-ink transition-colors"
                      >
                        <span className="w-7 h-7 rounded-full bg-terracotta text-white flex items-center justify-center text-[11px] tracking-[0.04em]">
                          {(() => {
                            if (user?.first_name && user?.last_name) {
                              return `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase()
                            } else if (user?.first_name) {
                              return user.first_name.charAt(0).toUpperCase()
                            } else if (user?.username) {
                              return user.username.charAt(0).toUpperCase()
                            } else {
                              return '?'
                            }
                          })()}
                        </span>
                        <span>
                          {user?.first_name || user?.username || 'User'}
                        </span>
                      </button>
                      <button
                        onClick={handleLogout}
                        className="text-sand-faint hover:text-ink transition-colors"
                      >
                        Log out
                      </button>
                    </div>
                  </>
                ) : (
                  <Auth onLogin={handleLogin} />
                )}
              </div>
            </header>

            <main className="flex-1">
              <ImageGallery
                user={user}
                refresh={refreshGallery}
                onUpload={() => setShowUpload(true)}
                config={siteConfig}
              />
            </main>

            {/* Footer */}
            <footer className="border-t border-sand-line px-12 py-[46px] text-center">
              {siteConfig?.site_domain && (
                <div className="text-[12px] font-medium leading-none uppercase tracking-[0.3em] text-sand-faint">
                  {siteConfig.site_domain}
                </div>
              )}
              {siteConfig?.footer_message && (
                <div className="font-serif italic text-[16px] text-sand-mute mt-3">
                  {siteConfig.footer_message}
                </div>
              )}
            </footer>

            {showUpload && user && user.can_upload_images && (
              <ImageUpload 
                user={user} 
                onImageUploaded={handleImageUploaded}
                onCancel={() => setShowUpload(false)}
              />
            )}

            {showProfile && user && (
              <UserProfile 
                user={user}
                onClose={() => setShowProfile(false)}
                onUserUpdate={handleUserUpdate}
                onUpload={() => setShowUpload(true)}
              />
            )}

            <WelcomeModal
              isOpen={showWelcome}
              onClose={handleWelcomeClose}
            />

            <HelpModal
              isOpen={showHelp}
              onClose={() => setShowHelp(false)}
            />

            {showGuestBook && user && (
              <GuestBook
                user={user}
                onClose={() => setShowGuestBook(false)}
              />
            )}

            {celebration && (
              <CelebrationOverlay
                emoji={celebration.emoji}
                message={celebration.message}
                onClose={() => setCelebration(null)}
              />
            )}
          </div>
        } />
      </Routes>
    </Suspense>
    </ToastProvider>
    </ErrorBoundary>
  )
}

export default App