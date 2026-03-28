import { useEffect, useState } from 'react'

const WEDDING_COLORS = [
  '#FFD700', // gold
  '#FF69B4', // pink
  '#FFFFFF', // white
  '#87CEEB', // light blue
  '#FFB6C1', // light pink
  '#DDA0DD', // plum
  '#F0E68C', // khaki
  '#E6E6FA', // lavender
]

function ConfettiPiece({ index }) {
  const color = WEDDING_COLORS[index % WEDDING_COLORS.length]
  const left = Math.random() * 100
  const delay = Math.random() * 2
  const duration = 2 + Math.random() * 2
  const size = 6 + Math.random() * 8
  const rotation = Math.random() * 360
  const isCircle = index % 3 === 0

  return (
    <div
      className="absolute top-0 animate-confetti-fall"
      style={{
        left: `${left}%`,
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
      }}
    >
      <div
        style={{
          width: `${size}px`,
          height: isCircle ? `${size}px` : `${size * 0.6}px`,
          backgroundColor: color,
          borderRadius: isCircle ? '50%' : '2px',
          transform: `rotate(${rotation}deg)`,
        }}
      />
    </div>
  )
}

export default function CelebrationOverlay({ emoji, message, onClose }) {
  const [fadeOut, setFadeOut] = useState(false)
  const pieces = Array.from({ length: 60 }, (_, i) => i)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadeOut(true), 2500)
    const closeTimer = setTimeout(() => onClose(), 3200)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(closeTimer)
    }
  }, [onClose])

  return (
    <div
      className={`fixed inset-0 z-[100] pointer-events-auto transition-opacity duration-700 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
      onClick={onClose}
    >
      {/* Confetti layer */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {pieces.map(i => <ConfettiPiece key={i} index={i} />)}
      </div>

      {/* Center message */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center animate-bounce-in">
          <div className="text-7xl md:text-8xl mb-4">{emoji}</div>
          <h2 className="text-2xl md:text-4xl font-bold text-white drop-shadow-lg">
            {message}
          </h2>
        </div>
      </div>

      {/* Dark backdrop */}
      <div className="absolute inset-0 bg-black/40 -z-10" />

      {/* CSS animations */}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .animate-confetti-fall {
          animation: confetti-fall linear forwards;
        }
        @keyframes bounce-in {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.1); }
          70% { transform: scale(0.95); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-bounce-in {
          animation: bounce-in 0.6s ease-out;
        }
      `}</style>
    </div>
  )
}
