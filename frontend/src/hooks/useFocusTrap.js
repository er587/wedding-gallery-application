import { useEffect, useRef } from 'react'

/**
 * Traps focus within a container element (for modals/dialogs).
 * Saves the previously focused element and restores it on unmount.
 *
 * Usage:
 *   const trapRef = useFocusTrap()
 *   return <div ref={trapRef}>...modal content...</div>
 */
export default function useFocusTrap() {
  const containerRef = useRef(null)
  const previousFocusRef = useRef(null)

  useEffect(() => {
    // Save the currently focused element to restore later
    previousFocusRef.current = document.activeElement

    const container = containerRef.current
    if (!container) return

    const focusableSelector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

    // Focus the first focusable element inside the container
    const firstFocusable = container.querySelector(focusableSelector)
    if (firstFocusable) {
      firstFocusable.focus()
    }

    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return

      const focusableElements = container.querySelectorAll(focusableSelector)
      if (focusableElements.length === 0) return

      const first = focusableElements[0]
      const last = focusableElements[focusableElements.length - 1]

      if (e.shiftKey) {
        // Shift+Tab: wrap from first to last
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        // Tab: wrap from last to first
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      // Restore focus to the previously focused element
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus()
      }
    }
  }, [])

  return containerRef
}
