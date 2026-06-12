import { useState, useRef } from 'react'
import LazyImage from './LazyImage'
import FullscreenViewer from './FullscreenViewer'

export default function PhotoGallery({ photos, fullscreenPhotos, maxHeight = 240, className = '', onDownload }) {
  const [idx, setIdx] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const touchStartX = useRef(null)

  if (!photos?.length) return null

  const count = photos.length
  const fsPhotos = fullscreenPhotos || photos

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
    <>
      <div
        className={`relative overflow-hidden select-none cursor-pointer ${className}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={e => { e.stopPropagation(); setIsFullscreen(true) }}
      >
        <LazyImage
          src={photos[idx]}
          alt={`사진 ${idx + 1}`}
          style={{ height: maxHeight }}
          className="w-full"
        />
        {onDownload && (
          <button
            onClick={e => { e.stopPropagation(); onDownload(photos[idx]) }}
            className="absolute bottom-2 right-2 bg-black/45 text-white rounded-full p-2 hover:bg-black/65 active:scale-90 transition-all"
            title="사진 저장"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        )}
        {count > 1 && (
          <>
            <div className="absolute top-2 right-2 bg-black/40 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium pointer-events-none">
              {idx + 1}/{count}
            </div>
            <div
              className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5"
              onClick={e => e.stopPropagation()}
            >
              {photos.map((_, i) => (
                <button
                  key={i}
                  onClick={e => { e.stopPropagation(); setIdx(i) }}
                  className={`h-1.5 rounded-full transition-all ${
                    i === idx ? 'bg-white w-4' : 'bg-white/55 w-1.5'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {isFullscreen && (
        <FullscreenViewer
          photos={fsPhotos}
          initialIndex={idx}
          onClose={() => setIsFullscreen(false)}
        />
      )}
    </>
  )
}
