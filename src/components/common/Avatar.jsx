export default function Avatar({ url, nickname, size = 'md', className = '' }) {
  const sizes = {
    xs: 'w-5 h-5 text-[7px]',
    sm: 'w-7 h-7 text-[9px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-14 h-14 text-lg',
  }
  const sizeClass = sizes[size] ?? sizes.md

  const isKakaoUrl = url?.includes('kakaocdn') || url?.includes('k.kakaocdn')
  const validUrl = url && !isKakaoUrl ? url : null

  if (validUrl) {
    return (
      <img
        src={validUrl}
        alt={nickname || ''}
        className={`${sizeClass} rounded-full object-cover bg-cream-200 ${className}`}
        onError={e => { e.currentTarget.style.display = 'none' }}
      />
    )
  }

  const initial = nickname?.charAt(0) || '?'
  return (
    <div className={`${sizeClass} rounded-full bg-warm-brown/20 flex items-center justify-center font-medium text-warm-brown flex-shrink-0 ${className}`}>
      {initial}
    </div>
  )
}
