import { useState, useRef } from 'react'

export default function PhotoGallery({ photos, maxHeight = 240, className = '' }) {
  const [idx, setIdx] = useState(0)
  const touchStartX = useRef(null)

  if (!photos?.length) return null

  const count = photos.length

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) < 40) return
    if (dx < 0 && idx < count - 1) setIdx(idx + 1)
    else if (dx > 0 && idx > 0) setIdx(idx - 1)
    touchStartX.current = null
  }

  return (
    <div
      className={`relative overflow-hidden select-none ${className}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <img
        src={photos[idx]}
        alt={`사진 ${idx + 1}`}
        className="w-full object-cover"
        style={{ maxHeight }}
        draggable={false}
      />
      {count > 1 && (
        <>
          <div className="absolute top-2 right-2 bg-black/40 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">
            {idx + 1}/{count}
          </div>
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === idx ? 'bg-white w-4' : 'bg-white/55 w-1.5'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
