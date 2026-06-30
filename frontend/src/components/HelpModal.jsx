import { useEffect } from 'react'
import { startUserTour } from './UserTour'

export default function HelpModal({ isOpen, onClose }) {
  const handleStartTour = () => {
    onClose() // Close the help modal first
    setTimeout(() => {
      startUserTour() // Then start the tour
    }, 300) // Small delay to let modal close animation complete
  }
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.body.style.overflow = 'hidden'
      document.addEventListener('keydown', handleEscKey)
    }

    return () => {
      document.body.style.overflow = 'unset'
      document.removeEventListener('keydown', handleEscKey)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div 
        className="bg-white rounded-lg max-w-3xl w-full mx-auto shadow-xl max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-sand-line sticky top-0 bg-white">
          <div className="flex items-center justify-between">
            <h2 id="help-modal-title" className="text-xl font-semibold text-ink">How to Use the Wedding Gallery</h2>
            <button
              onClick={onClose}
              className="text-sand-faint hover:text-sand-soft transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Interactive Tour Button */}
          <div className="bg-gradient-to-r from-terracotta to-terracotta rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-2">🎯 Interactive Tour</h3>
                <p className="text-terracotta/5 text-sm">
                  Take a guided tour of the key features: filters, image selection, and uploads.
                </p>
              </div>
              <button
                onClick={handleStartTour}
                className="px-6 py-3 bg-white text-terracotta rounded-lg hover:bg-terracotta/5 transition-colors font-semibold whitespace-nowrap ml-4"
              >
                Start Tour
              </button>
            </div>
          </div>

          {/* Loading More Pictures */}
          <div className="bg-terracotta/5 border border-terracotta/20 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-ink mb-2 flex items-center">
              <svg className="w-5 h-5 mr-2 text-terracotta" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Loading More Pictures
            </h3>
            <p className="text-ink leading-relaxed">
              Images load 8 at a time to keep things fast. Scroll down and click the <span className="font-semibold">"Load More"</span> button to see additional pictures. 
              <span className="block mt-2 text-terracotta font-medium">Important: You must load all images to see everything in the gallery and use filters effectively!</span>
            </p>
          </div>

          {/* Opening Images */}
          <div className="bg-terracotta/5 border border-terracotta/20 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-ink mb-2 flex items-center">
              <svg className="w-5 h-5 mr-2 text-terracotta" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Viewing Images
            </h3>
            <p className="text-ink leading-relaxed">
              Click on any photo thumbnail to open the <span className="font-semibold">image viewer</span>. You can navigate between images using the arrow buttons or your keyboard's left/right arrow keys. Press <span className="font-semibold">ESC</span> to close the viewer.
            </p>
          </div>

          {/* Adding Tags */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-ink mb-2 flex items-center">
              <svg className="w-5 h-5 mr-2 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              Adding Tags to Pictures
            </h3>
            <p className="text-ink leading-relaxed">
              All full users can add tags to any picture! Open an image, find the tags section, and start typing. 
              <span className="block mt-2">Use <span className="font-semibold">↑/↓ arrow keys</span> to navigate tag suggestions, then press <span className="font-semibold">Enter</span> to select.</span>
              <span className="block mt-2 text-green-800 font-medium">Help organize photos by adding tags like names, locations, or event moments when they're missing!</span>
            </p>
          </div>

          {/* Downloading Images */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-ink mb-2 flex items-center">
              <svg className="w-5 h-5 mr-2 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Downloading Images
            </h3>
            <div className="text-ink leading-relaxed space-y-2">
              <p>
                <span className="font-semibold">Single Image:</span> Open any image and click the <span className="font-semibold">"Save"</span> button (download icon) to save it to your device.
              </p>
              <p>
                <span className="font-semibold">All Images:</span> Load all pictures first, then click <span className="font-semibold">"Download All"</span> at the top of the gallery to get a ZIP file with all photos.
              </p>
            </div>
          </div>

          {/* Using Filters */}
          <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-ink mb-2 flex items-center">
              <svg className="w-5 h-5 mr-2 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Finding Photos with Filters
            </h3>
            <div className="text-ink leading-relaxed space-y-2">
              <p>
                Click on any <span className="font-semibold">tag pills</span> (like names) to filter the gallery and see only photos with that tag. Click the tag again to remove the filter.
              </p>
              <p className="text-pink-800 font-medium">
                To find pictures with your name: Make sure all images are loaded, then click on your name tag to see all photos you're in!
              </p>
              <p>
                You can also use the <span className="font-semibold">"Videos Only"</span> filter to see just video content.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-sand-line/30 rounded-b-lg border-t border-sand-line">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="bg-terracotta text-white px-6 py-2 rounded-md hover:bg-[#974f30] transition-colors"
            >
              Got It!
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
