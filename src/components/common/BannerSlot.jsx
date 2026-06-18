import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function BannerSlot({ slot, fallback = null }) {
  const [banner, setBanner] = useState(undefined) // undefined=로딩, null=없음

  useEffect(() => {
    let cancelled = false
    supabase
      .from('banners')
      .select('id, type, title, body, image_url, link_url')
      .eq('slot', slot)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('[BannerSlot] 조회 실패:', error.message)
          setBanner(null)
          return
        }
        setBanner(data)
      })
    return () => { cancelled = true }
  }, [slot])

  // 로딩 중이거나 배너 없음 → fallback
  if (banner === undefined || banner === null) return fallback

  // info 타입: 텍스트 카드
  if (banner.type === 'info') {
    return (
      <div className="mx-4 mb-3 px-4 py-3.5 bg-cream-100 rounded-2xl">
        {banner.title && (
          <p className="text-sm font-semibold text-warm-dark">{banner.title}</p>
        )}
        {banner.body && (
          <p className="text-sm text-warm-light leading-snug mt-0.5">{banner.body}</p>
        )}
      </div>
    )
  }

  // image_link / ad 타입: 이미지 + 클릭 링크
  if (banner.type === 'image_link' || banner.type === 'ad') {
    if (!banner.image_url) return fallback

    const card = (
      <div className="mx-4 mb-3 relative rounded-2xl overflow-hidden bg-cream-100">
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

    if (banner.link_url) {
      return (
        <a href={banner.link_url} target="_blank" rel="noopener noreferrer" className="block">
          {card}
        </a>
      )
    }
    return card
  }

  return fallback
}
