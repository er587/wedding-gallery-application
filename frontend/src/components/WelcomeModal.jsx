import { useEffect } from 'react'

export default function WelcomeModal({ isOpen, onClose }) {
  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
      document.addEventListener('keydown', handleEscKey)
    }

    return () => {
      // Re-enable body scroll when modal closes
      document.body.style.overflow = 'unset'
      document.removeEventListener('keydown', handleEscKey)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full mx-auto shadow-xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Welcome to Our Wedding Gallery! 🎉</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <div className="text-gray-700 leading-relaxed space-y-4">
            <p>
              This is a custom web app I built just for our wedding! 🎉 It's a space where family and friends can share memories, and thoughts about the special moments we all experienced together.
            </p>
            <p>
              Whether it's a hilarious story from the reception, a touching moment from the ceremony, or a snapshot of something unforgettable — this is the place to keep those memories alive and shared.
            </p>
            <p className="text-pink-600 font-medium">
              Thank you for being part of our day. We can't wait to see what you'll share! ❤️
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-lg">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Let's Share Memories!
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}