import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function BannerSlot({ slot, fallback = null, fixed: isFixed = false, onActive }) {
  const [banner, setBanner] = useState(undefined) // undefined=로딩, null=없음

  useEffect(() => {
    let cancelled = false
    supabase
      .from('banners')
      .select('id, type, title, body, image_url, link_url, disclosure')
      .eq('slot', slot)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('[BannerSlot] 조회 실패:', error.message)
          setBanner(null)
          onActive?.(false)
          return
        }
        setBanner(data)
        onActive?.(!!data)
      })
    return () => { cancelled = true }
  }, [slot])

  if (banner === undefined || banner === null) return fallback

  let content = null

  // info 타입: 텍스트 카드
  if (banner.type === 'info') {
    content = (
      <div className="mx-4 mb-3">
        <div className="px-4 py-3.5 bg-cream-100 rounded-2xl">
          {banner.title && (
            <p className="text-sm font-semibold text-warm-dark">{banner.title}</p>
          )}
          {banner.body && (
            <p className="text-sm text-warm-light leading-snug mt-0.5">{banner.body}</p>
          )}
        </div>
        {banner.disclosure && (
          <p className="text-[10px] text-cream-400 mt-1.5 px-1 leading-snug">{banner.disclosure}</p>
        )}
      </div>
    )
  }

  // image / image_link / ad 타입: 이미지 + 선택적 클릭 링크
  else if (banner.type === 'image' || banner.type === 'image_link' || banner.type === 'ad') {
    if (!banner.image_url) return fallback

    const innerCard = (
      <div className="relative rounded-2xl overflow-hidden bg-cream-100">
        <img
          src={banner.image_url}
          alt={banner.title || '배너'}
          className="w-full object-cover"
          style={{ maxHeight: '120px' }}
          loading="lazy"
        />
        {banner.type === 'ad' && (
          <span className="absolute top-2 right-2 text-[10px] bg-black/40 text-white px-1.5 py-0.5 rounded leading-none">
            광고
          </span>
        )}
      </div>
    )

    const linkedCard = banner.link_url ? (
      <a href={banner.link_url} target="_blank" rel="noopener noreferrer" className="block">
        {innerCard}
      </a>
    ) : innerCard

    content = (
      <div className="mx-4 mb-3">
        {linkedCard}
        {banner.disclosure && (
          <p className="text-[10px] text-cream-400 mt-1.5 px-1 leading-snug">{banner.disclosure}</p>
        )}
      </div>
    )
  }

  if (!content) return fallback

  // fixed 모드: BottomNav 바로 위에 고정 (z-[49] = BottomNav z-50 보다 낮음)
  if (isFixed) {
    return (
      <div
        className="fixed left-0 right-0 max-w-lg mx-auto z-[49]"
        style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
      >
        {content}
      </div>
    )
  }

  return content
}
