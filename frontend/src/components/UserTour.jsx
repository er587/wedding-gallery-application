import { driver } from "driver.js"
import "driver.js/dist/driver.css"

const TOUR_COMPLETED_KEY = 'wedding-gallery-tour-completed'

export function hasCompletedTour() {
  return localStorage.getItem(TOUR_COMPLETED_KEY) === 'true'
}

export function markTourCompleted() {
  localStorage.setItem(TOUR_COMPLETED_KEY, 'true')
}

export function resetTour() {
  localStorage.removeItem(TOUR_COMPLETED_KEY)
}

export function startUserTour() {
  const driverObj = driver({
    showProgress: true,
    showButtons: ['next', 'previous', 'close'],
    steps: [
      {
        element: '#tour-welcome',
        popover: {
          title: 'Welcome to Wedding Gallery!',
          description: 'Let me show you the key features to help you explore and share wedding memories. You can skip this tour at any time.',
          side: "bottom",
          align: 'center'
        }
      },
      {
        element: '#tour-upload-button',
        popover: {
          title: 'Upload Your Images',
          description: 'Click here to upload wedding photos and videos. You can upload single images or multiple images at once!',
          side: "bottom",
          align: 'start'
        }
      },
      {
        element: '#tour-filters',
        popover: {
          title: 'Filter the Gallery',
          description: 'Use these controls to find specific photos. You can filter by media type (photos/videos), search by keywords, or click on tag pills to see photos with specific tags.',
          side: "bottom",
          align: 'start'
        }
      },
      {
        element: '#tour-select-mode',
        popover: {
          title: 'Select Images for Download',
          description: 'Click "Select Images" to choose multiple photos at once. After selecting, click "Download Selected" to get them all in a ZIP file.',
          side: "bottom",
          align: 'start'
        }
      },
      {
        popover: {
          title: 'You\'re All Set!',
          description: 'Explore the gallery, add tags to help organize photos, and enjoy reliving these special memories. You can restart this tour anytime from the Help menu.',
          side: "center",
          align: 'center'
        }
      }
    ],
    onDestroyStarted: () => {
      markTourCompleted()
      driverObj.destroy()
    },
    onDestroyed: () => {
      markTourCompleted()
    }
  })

  driverObj.drive()
}
