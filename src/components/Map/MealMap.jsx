import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'
import { getThumbUrl, uploadPhotoToStorage } from '../../lib/uploadPhoto'
import Modal from '../common/Modal'
import MealForm from '../MealRecord/MealForm'
import { linkify } from '../../lib/linkify'

// ── 상수 ──────────────────────────────────────────────────────
const TAG_COLORS = { 집밥: '#86efac', 외식: '#fcd34d', 카페: '#f9a8d4', 배달: '#93c5fd' }
const MAP_FILTERS = ['전체', '외식', '카페']
const ROUND = 1e4
const INPUT_CLS = 'w-full px-4 py-3 rounded-2xl bg-cream-100 border border-cream-200 text-sm text-warm-dark placeholder-cream-400 focus:outline-none focus:border-warm-light transition-colors'
const WISH_CATEGORY_COLORS = { 한식: '#fca5a5', 일식: '#93c5fd', 양식: '#86efac', 중식: '#fcd34d', 카페: '#f9a8d4', 기타: '#d1b89a' }
const MOOD_TAGS = ['🔥 핫플', '💕 로맨틱', '🌿 힐링', '📸 인생샷', '✨ 특별한 날', '🍽️ 맛집 예감']
const EMPTY_WISH_FORM = { name: '', location: '', memo: '', moodTags: [] }
const SEOUL = { lat: 37.5665, lng: 126.9780 }

// ── Kakao 지오코딩 ─────────────────────────────────────────────
async function geocodeKakao(query) {
  if (!window.kakao?.maps || !query.trim()) return null
  return new Promise(resolve => {
    window.kakao.maps.load(() => {
      const geocoder = new window.kakao.maps.services.Geocoder()
      geocoder.addressSearch(query, (result, status) => {
        if (status === window.kakao.maps.services.Status.OK && result[0]) {
          resolve([parseFloat(result[0].y), parseFloat(result[0].x)])
        } else {
          new window.kakao.maps.services.Places().keywordSearch(query, (res2, st2) => {
            if (st2 === window.kakao.maps.services.Status.OK && res2[0]) {
              resolve([parseFloat(res2[0].y), parseFloat(res2[0].x)])
            } else {
              resolve(null)
            }
          }, { size: 1 })
        }
      })
    })
  })
}

// ── 유틸 ──────────────────────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const sec = Math.floor(diff / 1000)
  const min = Math.floor(sec / 60)
  const hour = Math.floor(min / 60)
  const day = Math.floor(hour / 24)
  if (sec < 60) return '방금'
  if (min < 60) return `${min}분 전`
  if (hour < 24) return `${hour}시간 전`
  if (day < 7) return `${day}일 전`
  return `${Math.floor(day / 30) > 0 ? Math.floor(day / 30) + '달 전' : day + '일 전'}`
}

function makePinHTML(color, count, selected) {
  const sz = selected ? (count > 1 ? 30 : 24) : (count > 1 ? 22 : 16)
  const shadow = selected ? '0 3px 14px rgba(0,0,0,.4)' : '0 2px 6px rgba(0,0,0,.25)'
  const border = selected ? '3px solid white' : '2.5px solid white'
  const badge = count > 1
    ? `<div style="position:absolute;top:-6px;right:-6px;background:#6b4f3a;color:#fff;border-radius:50%;width:14px;height:14px;font-size:8px;display:flex;align-items:center;justify-content:center;font-weight:700;border:1.5px solid #fff">${count}</div>`
    : ''
  return `<div style="position:relative;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:4px">
    <div style="width:${sz}px;height:${sz}px;background:${color || '#a07850'};border:${border};border-radius:50%;box-shadow:${shadow}"></div>
    ${badge}
  </div>`
}

function makeWishPinHTML(selected) {
  const sz = selected ? 22 : 16
  const shadow = selected ? '0 3px 14px rgba(0,0,0,.4)' : '0 2px 6px rgba(0,0,0,.25)'
  const border = selected ? '3px solid white' : '2.5px solid white'
  const bg = selected ? '#e11d48' : '#fb7185'
  return `<div style="position:relative;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:4px">
    <div style="width:${sz}px;height:${sz}px;background:${bg};border:${border};border-radius:50%;box-shadow:${shadow}"></div>
  </div>`
}

// ── CommentItem ────────────────────────────────────────────────
function CommentItem({ comment, currentUserId, onDelete }) {
  const isOwn = !!currentUserId && comment.user_id === currentUserId
  const initial = (comment.nickname || '?').charAt(0)
  return (
    <div className="flex gap-2.5">
      {comment.avatar_url ? (
        <img src={comment.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5" />
      ) : (
        <div className="w-7 h-7 rounded-full bg-cream-200 shrink-0 mt-0.5 flex items-center justify-center">
          <span className="text-[9px] text-warm-light font-bold leading-none">{initial}</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs font-semibold text-warm-dark">{comment.nickname || '익명'}</span>
          <span className="text-[10px] text-cream-400 shrink-0">{formatTimeAgo(comment.created_at)}</span>
          {isOwn && (
            <button onClick={() => onDelete(comment.id)}
              className="ml-auto text-[10px] text-cream-400 hover:text-red-400 transition-colors shrink-0">
              삭제
            </button>
          )}
        </div>
        <p className="text-sm text-warm-dark leading-relaxed mt-0.5 break-words">{linkify(comment.content)}</p>
      </div>
    </div>
  )
}

// ── MealPinCard ────────────────────────────────────────────────
function MealPinCard({ meal, liveMeal, onClick }) {
  const { ratingsMap } = useApp()
  const display = liveMeal || meal
  const thumb = getThumbUrl(display.photos?.[0] || display.photo || '')
  const mealRatings = ratingsMap?.[display.id] || []
  const avgRating = mealRatings.length > 0
    ? Math.floor(mealRatings.reduce((s, r) => s + r.rating, 0) / mealRatings.length)
    : display.rating || 0
  const ratingCount = mealRatings.length
  return (
    <button
      type="button"
      className="shrink-0 w-52 rounded-2xl border border-cream-200 bg-white overflow-hidden active:scale-[0.98] transition-transform text-left"
      style={{ scrollSnapAlign: 'start' }}
      onClick={onClick}
    >
      {thumb && <img src={thumb} alt="" className="w-full h-28 object-cover" />}
      <div className="p-3">
        <p className="text-sm font-semibold text-warm-dark leading-snug truncate">
          {display.title || display.restaurantName || '식사 기록'}
        </p>
        {display.restaurantName && display.title && (
          <p className="text-xs text-warm-light truncate mt-0.5">{display.restaurantName}</p>
        )}
        {avgRating > 0 && (
          <div className="flex items-center gap-1 mt-1">
            <div className="flex gap-0.5">
              {[1,2,3,4,5].map(i => (
                <span key={i} style={{ color: i <= avgRating ? '#c4a882' : '#e5ddd5', fontSize: '13px' }}>★</span>
              ))}
            </div>
            {ratingCount >= 2 && (
              <span style={{ fontSize: '10px', color: '#c4a882' }}>{ratingCount}명</span>
            )}
          </div>
        )}
        {display.review && (
          <p className="text-xs text-warm-light mt-1 leading-relaxed line-clamp-2">{display.review}</p>
        )}
        <p className="text-[10px] text-cream-400 mt-1.5">{display.date}</p>
      </div>
    </button>
  )
}

// ── WishDetailModal ────────────────────────────────────────────
function WishDetailModal({ item, onClose, onEdit, onDelete, onVisit, onViewOnMap }) {
  const { user } = useApp()
  const [comments, setComments] = useState([])
  const [commentsLoaded, setCommentsLoaded] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState('')
  const commentsEndRef = useRef(null)

  useEffect(() => {
    if (!item?.id) return
    let destroyed = false

    supabase.from('comments').select('id, wishlist_id, user_id, nickname, avatar_url, content, created_at').eq('wishlist_id', item.id).order('created_at').then(({ data, error }) => {
      if (error) console.error('[위시리스트 댓글 로딩] 오류:', error)
      if (!destroyed) { setComments(data || []); setCommentsLoaded(true) }
    })

    const channel = supabase.channel(`comments:wishlist:${item.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `wishlist_id=eq.${item.id}` },
        ({ eventType, new: newRow, old: oldRow }) => {
          if (eventType === 'INSERT') setComments(prev => prev.find(c => c.id === newRow.id) ? prev : [...prev, newRow])
          else if (eventType === 'DELETE') setComments(prev => prev.filter(c => c.id !== oldRow.id))
        })
      .subscribe()

    return () => { destroyed = true; supabase.removeChannel(channel) }
  }, [item?.id])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  function handleShare() {
    const url = `${window.location.origin}/map?wish=${item.id}`
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => showToast('링크가 복사됐어요'))
    } else {
      showToast('복사를 지원하지 않는 환경이에요')
    }
  }

  async function handleAddComment(e) {
    e.preventDefault()
    const trimmed = commentText.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    const { data, error } = await supabase.from('comments').insert({
      wishlist_id: item.id,
      user_id: user?.id || null,
      nickname: user?.user_metadata?.name || user?.user_metadata?.full_name || '',
      avatar_url: user?.user_metadata?.avatar_url || '',
      content: trimmed,
    }).select().single()
    setSubmitting(false)
    if (!error && data) {
      setComments(prev => prev.find(c => c.id === data.id) ? prev : [...prev, data])
      setCommentText('')
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }

  async function handleDeleteComment(commentId) {
    const { error } = await supabase.from('comments').delete().eq('id', commentId)
    if (!error) setComments(prev => prev.filter(c => c.id !== commentId))
  }

  if (!item) return null
  const catColor = WISH_CATEGORY_COLORS[item.category]

  return (
    <Modal isOpen onClose={onClose}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 90 }}
          className="bg-warm-dark text-white text-sm px-4 py-2 rounded-full shadow-lg whitespace-nowrap pointer-events-none">
          {toast}
        </div>
      )}

      {/* 사진 */}
      {item.photo && (
        <div className="-mx-5 -mt-4 mb-4">
          <img src={item.photo} alt="" className="w-full max-h-56 object-cover" />
        </div>
      )}

      {/* 헤더: 장소명 + 공유 버튼 */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="text-lg font-bold text-warm-dark leading-snug">{item.name}</h2>
            {item.category && catColor && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium text-warm-dark shrink-0"
                style={{ background: catColor }}>
                {item.category}
              </span>
            )}
          </div>
          {item.location && (
            <p className="text-xs text-warm-light flex items-center gap-1">
              <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.686 2 6 4.686 6 8c0 4.5 6 12 6 12s6-7.5 6-12c0-3.314-2.686-6-6-6z" />
                <circle cx="12" cy="8" r="2" />
              </svg>
              {item.location}
            </p>
          )}
        </div>
        <button onClick={handleShare}
          className="shrink-0 p-2 rounded-full hover:bg-cream-100 active:scale-95 transition-colors"
          title="공유">
          <svg className="w-5 h-5 text-warm-light" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        </button>
      </div>

      {/* 분위기 태그 */}
      {item.moodTags?.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-3">
          {item.moodTags.map(tag => (
            <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-cream-100 text-warm-light border border-cream-200">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* 상세 정보 */}
      {item.hours && (
        <div className="flex items-center gap-2 mb-1.5 text-xs text-warm-light">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
          </svg>
          {item.hours}
        </div>
      )}
      {item.priceRange && (
        <div className="flex items-center gap-2 mb-1.5 text-xs text-warm-light">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {item.priceRange}
        </div>
      )}
      {item.memo && (
        <p className="text-sm text-warm-light leading-relaxed mb-3">{item.memo}</p>
      )}

      {/* 액션 버튼 */}
      <div className="flex gap-2 flex-wrap pt-3 border-t border-cream-100">
        {!item.visited && (
          <button
            onClick={() => { onVisit(); onClose() }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-warm-brown text-white text-sm font-medium hover:bg-warm-dark transition-colors active:scale-95">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            방문했어요
          </button>
        )}
        {item.lat && item.lng && (
          <button
            onClick={() => { onViewOnMap(); onClose() }}
            className="px-3 py-2 rounded-2xl border border-cream-200 text-warm-light text-xs hover:bg-cream-100 transition-colors active:scale-95 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            지도에서 확인
          </button>
        )}
        <button
          onClick={() => { onEdit(); onClose() }}
          className="px-3 py-2 rounded-2xl border border-cream-300 text-warm-brown text-sm hover:bg-cream-100 transition-colors active:scale-95">
          수정
        </button>
        <button
          onClick={onDelete}
          className="px-3 py-2 rounded-2xl border border-cream-200 text-red-400 text-sm hover:bg-red-50 transition-colors active:scale-95">
          삭제
        </button>
      </div>

      {/* 댓글 섹션 */}
      <div className="mt-5 pt-5 border-t border-cream-100">
        <p className="text-xs font-semibold text-warm-dark mb-3">
          댓글{comments.length > 0 ? ` ${comments.length}` : ''}
        </p>
        <div className="space-y-4 mb-4">
          {!commentsLoaded ? (
            <div className="py-4 flex justify-center">
              <div className="w-4 h-4 border-2 border-cream-300 border-t-warm-light rounded-full animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-xs text-cream-400 text-center py-3">첫 댓글을 남겨보세요</p>
          ) : (
            comments.map(comment => (
              <CommentItem key={comment.id} comment={comment} currentUserId={user?.id} onDelete={handleDeleteComment} />
            ))
          )}
          <div ref={commentsEndRef} />
        </div>
        <form
          onSubmit={handleAddComment}
          className="flex items-center gap-2.5 sticky bottom-0 bg-cream-50 pt-2"
          style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
        >
          {user?.user_metadata?.avatar_url ? (
            <img src={user.user_metadata.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-cream-200 shrink-0 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#c4a882">
                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
              </svg>
            </div>
          )}
          <div className="flex-1 flex items-center bg-white border border-cream-200 rounded-full px-4 py-2 gap-2 focus-within:border-warm-light transition-colors">
            <input
              type="text"
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="댓글 달기..."
              maxLength={200}
              className="flex-1 bg-transparent text-sm text-warm-dark placeholder-cream-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!commentText.trim() || submitting}
              className="text-warm-brown text-xs font-semibold disabled:opacity-30 transition-opacity shrink-0"
            >
              {submitting ? '...' : '게시'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  )
}

// ── WishFormFields ─────────────────────────────────────────────
function WishFormFields({ form, setForm, photoPreview, setPhotoPreview, photoRef }) {
  return (
    <>
      <div>
        <label className="text-xs text-warm-light mb-1.5 block font-medium">장소명 *</label>
        <input type="text" value={form.name} required
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          placeholder="어디에 가고 싶으신가요?" className={INPUT_CLS} />
      </div>
      <div>
        <label className="text-xs text-warm-light mb-1.5 block font-medium">주소</label>
        <input type="text" value={form.location}
          onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
          placeholder="예: 서울 마포구 연남동" className={INPUT_CLS} />
      </div>
      <div>
        <label className="text-xs text-warm-light mb-2 block font-medium">분위기</label>
        <div className="flex gap-2 flex-wrap">
          {MOOD_TAGS.map(tag => {
            const on = form.moodTags.includes(tag)
            return (
              <button key={tag} type="button"
                onClick={() => setForm(p => ({ ...p, moodTags: on ? p.moodTags.filter(t => t !== tag) : [...p.moodTags, tag] }))}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors active:scale-95 ${on ? 'bg-warm-brown text-white border-transparent' : 'bg-cream-50 text-warm-light border-cream-200 hover:bg-cream-100'}`}
              >{tag}</button>
            )
          })}
        </div>
      </div>
      <div>
        <label className="text-xs text-warm-light mb-1.5 block font-medium">사진</label>
        {photoPreview ? (
          <div className="relative">
            <img src={photoPreview} alt="" className="w-full h-36 object-cover rounded-2xl" />
            <button type="button"
              onClick={() => { setPhotoPreview(''); if (photoRef.current) photoRef.current.value = '' }}
              className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center text-white">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => photoRef.current?.click()}
            className="w-full h-24 rounded-2xl border-2 border-dashed border-cream-300 flex flex-col items-center justify-center gap-1.5 text-cream-400 hover:border-warm-light hover:text-warm-light transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs">사진 추가</span>
          </button>
        )}
        <input ref={photoRef} type="file" accept="image/*" className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (!file) return
            const reader = new FileReader()
            reader.onload = ev => setPhotoPreview(ev.target.result)
            reader.readAsDataURL(file)
          }}
        />
      </div>
      <div>
        <label className="text-xs text-warm-light mb-1.5 block font-medium">메모</label>
        <input type="text" value={form.memo}
          onChange={e => setForm(p => ({ ...p, memo: e.target.value }))}
          placeholder="기타 메모" className={INPUT_CLS} />
      </div>
    </>
  )
}

// ── WishListCard ───────────────────────────────────────────────
function WishListCard({ item, onVisit, onViewOnMap, highlighted, onViewDetail }) {
  const catColor = WISH_CATEGORY_COLORS[item.category]
  return (
    <div
      id={`wish-card-${item.id}`}
      onClick={onViewDetail}
      className={`bg-white rounded-2xl border overflow-hidden transition-all cursor-pointer hover:shadow-md ${
        item.visited ? 'opacity-60' : ''
      } ${highlighted ? 'border-warm-brown shadow-md ring-1 ring-warm-brown/30' : 'border-cream-200'}`}
    >
      {item.photo && <img src={item.photo} alt="" className="w-full h-40 object-cover" />}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-warm-dark text-base leading-snug">{item.name}</p>
            {item.location && (
              <p className="text-xs text-warm-light mt-0.5 flex items-center gap-1">
                <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.686 2 6 4.686 6 8c0 4.5 6 12 6 12s6-7.5 6-12c0-3.314-2.686-6-6-6z" />
                  <circle cx="12" cy="8" r="2" />
                </svg>
                {item.location}
              </p>
            )}
          </div>
          {item.category && catColor && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium text-warm-dark shrink-0" style={{ background: catColor }}>
              {item.category}
            </span>
          )}
        </div>
        {item.moodTags?.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-2">
            {item.moodTags.map(tag => (
              <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-cream-100 text-warm-light border border-cream-200">{tag}</span>
            ))}
          </div>
        )}
        {item.memo && <p className="text-sm text-warm-light leading-relaxed mb-3 line-clamp-2">{item.memo}</p>}
        {(!item.visited || (item.lat && item.lng)) && (
          <div className="flex gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
            {!item.visited && (
              <button onClick={onVisit}
                className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-warm-brown text-white text-sm font-medium hover:bg-warm-dark transition-colors active:scale-95">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                방문했어요
              </button>
            )}
            {item.lat && item.lng && (
              <button onClick={onViewOnMap}
                className="px-3 py-2 rounded-2xl border border-cream-200 text-warm-light text-xs hover:bg-cream-100 transition-colors active:scale-95 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                지도에서 확인
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────
export default function MealMap({ onViewMeal, onTabChange }) {
  const { currentSpace, addMeal, addWishlistItem, updateWishlistItem, deleteWishlistItem, cacheGeocoords, loadMealPhotos } = useApp()

  const [activeTab, setActiveTab] = useState('map')

  // ── 맛집 지도 ─────────────────────────────────────────────────
  const [mapContainer, setMapContainer] = useState(null)
  const setMapContainerRef = useCallback(node => setMapContainer(node), [])
  const [mapReady, setMapReady] = useState(false)
  const kakaoMapRef = useRef(null)
  const mealOverlaysRef = useRef([])
  const userOverlayRef = useRef(null)

  const [pins, setPins] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeFilters, setActiveFilters] = useState(new Set(['전체']))
  const [selectedCluster, setSelectedCluster] = useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const [flyTarget, setFlyTarget] = useState(null)
  const [locating, setLocating] = useState(false)
  const [mapInitFailed, setMapInitFailed] = useState(false)

  // ── 가고 싶은 곳 지도 ─────────────────────────────────────────
  const [wishMapNode, setWishMapNode] = useState(null)
  const setWishMapNodeRef = useCallback(node => setWishMapNode(node), [])
  const wishKakaoMapRef = useRef(null)
  const wishOverlaysRef = useRef([])
  const [wishMapReady, setWishMapReady] = useState(false)
  const [wishMapFailed, setWishMapFailed] = useState(false)
  const [highlightedWishId, setHighlightedWishId] = useState(null)
  const [wishFlyTarget, setWishFlyTarget] = useState(null)
  const wishUserOverlayRef = useRef(null)
  const [wishLocating, setWishLocating] = useState(false)

  // ── 근처 알림 ─────────────────────────────────────────────────
  const [nearbyWish, setNearbyWish] = useState(null)
  const [nearbyDismissed, setNearbyDismissed] = useState(false)
  const [bannerVisible, setBannerVisible] = useState(false)
  const hasCheckedNearbyRef = useRef(false)

  // ── 추가/수정/상세 모달 ─────────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_WISH_FORM)
  const [addPhotoPreview, setAddPhotoPreview] = useState('')
  const [savingAdd, setSavingAdd] = useState(false)
  const addPhotoRef = useRef()

  const [editingWish, setEditingWish] = useState(null)
  const [editForm, setEditForm] = useState(EMPTY_WISH_FORM)
  const [editPhotoPreview, setEditPhotoPreview] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const editPhotoRef = useRef()

  const [visitingWish, setVisitingWish] = useState(null)
  const [viewingWish, setViewingWish] = useState(null)
  const requestedPhotosRef = useRef(new Set())

  // ── 파생 상태 ─────────────────────────────────────────────────
  const meals = useMemo(() => (currentSpace?.meals || []).filter(m => m.location), [currentSpace?.meals])
  const wishlist = currentSpace?.wishlist || []
  const unvisited = wishlist.filter(w => !w.visited)
  const visited = wishlist.filter(w => w.visited)
  const uncachedKey = meals.filter(m => !m.lat || !m.lng).map(m => m.id).join(',')
  const wishlistWithCoords = useMemo(() => wishlist.filter(w => w.lat && w.lng && !w.visited), [wishlist])

  const activeMealTags = [...activeFilters].filter(f => f !== '전체')
  const filteredPins = activeFilters.has('전체') ? pins
    : activeMealTags.length === 0 ? []
    : pins.filter(p => activeMealTags.includes(p.meal.tag))

  const clusters = useMemo(() => {
    const map = {}
    filteredPins.forEach(({ meal, coords }) => {
      const key = `${Math.round(coords[0] * ROUND)},${Math.round(coords[1] * ROUND)}`
      if (!map[key]) map[key] = { coords, meals: [] }
      map[key].meals.push(meal)
    })
    return Object.values(map)
  }, [filteredPins])

  const selectedClusterKey = useMemo(() => {
    if (!selectedCluster) return null
    const [lat, lng] = selectedCluster.coords
    return `${Math.round(lat * ROUND)},${Math.round(lng * ROUND)}`
  }, [selectedCluster])

  // ── 맛집 지도 초기화 (현재 위치 우선) ─────────────────────────
  useEffect(() => {
    if (!mapContainer) return
    if (!window.kakao?.maps) { setMapInitFailed(true); return }

    let destroyed = false
    const failTimer = setTimeout(() => {
      if (!destroyed && !kakaoMapRef.current) setMapInitFailed(true)
    }, 10000)

    window.kakao.maps.load(() => {
      clearTimeout(failTimer)
      if (destroyed) return

      function initMap(lat, lng) {
        if (destroyed || kakaoMapRef.current) return
        try {
          const center = new window.kakao.maps.LatLng(lat, lng)
          const map = new window.kakao.maps.Map(mapContainer, { center, level: 5 })
          kakaoMapRef.current = map
          window.kakao.maps.event.trigger(map, 'resize')
          setMapReady(true)
        } catch (err) {
          console.error('[MealMap] 초기화 실패:', err)
          setMapInitFailed(true)
        }
      }

      if (navigator.geolocation) {
        const geoTimer = setTimeout(() => {
          if (!destroyed && !kakaoMapRef.current) initMap(SEOUL.lat, SEOUL.lng)
        }, 4000)

        navigator.geolocation.getCurrentPosition(
          pos => {
            clearTimeout(geoTimer)
            const { latitude, longitude } = pos.coords
            if (!destroyed && !kakaoMapRef.current) {
              initMap(latitude, longitude)
              setUserLocation([latitude, longitude])
            }
          },
          () => {
            clearTimeout(geoTimer)
            if (!destroyed && !kakaoMapRef.current) initMap(SEOUL.lat, SEOUL.lng)
          },
          { enableHighAccuracy: false, timeout: 4000, maximumAge: 60000 }
        )
      } else {
        initMap(SEOUL.lat, SEOUL.lng)
      }
    })

    return () => {
      destroyed = true
      clearTimeout(failTimer)
      mealOverlaysRef.current.forEach(o => o.setMap(null))
      mealOverlaysRef.current = []
      if (userOverlayRef.current) { userOverlayRef.current.setMap(null); userOverlayRef.current = null }
      kakaoMapRef.current = null
      setMapReady(false)
      setMapInitFailed(false)
    }
  }, [mapContainer])

  // ── 가고 싶은 곳 지도 초기화 ──────────────────────────────────
  useEffect(() => {
    if (!wishMapNode) return
    if (!window.kakao?.maps) { setWishMapFailed(true); return }

    let destroyed = false
    const failTimer = setTimeout(() => {
      if (!destroyed && !wishKakaoMapRef.current) setWishMapFailed(true)
    }, 8000)

    window.kakao.maps.load(() => {
      clearTimeout(failTimer)
      if (destroyed) return
      try {
        const firstItem = wishlistWithCoords[0]
        const center = firstItem
          ? new window.kakao.maps.LatLng(firstItem.lat, firstItem.lng)
          : new window.kakao.maps.LatLng(SEOUL.lat, SEOUL.lng)
        const map = new window.kakao.maps.Map(wishMapNode, { center, level: 5 })
        wishKakaoMapRef.current = map
        setWishMapReady(true)
      } catch (e) {
        console.error('[WishMap] 초기화 실패:', e)
        setWishMapFailed(true)
      }
    })

    return () => {
      destroyed = true
      clearTimeout(failTimer)
      wishOverlaysRef.current.forEach(o => o.setMap(null))
      wishOverlaysRef.current = []
      if (wishUserOverlayRef.current) { wishUserOverlayRef.current.setMap(null); wishUserOverlayRef.current = null }
      wishKakaoMapRef.current = null
      setWishMapReady(false)
      setWishMapFailed(false)
    }
  }, [wishMapNode])

  // ── 가고 싶은 곳 핀 갱신 ──────────────────────────────────────
  useEffect(() => {
    if (!wishMapReady || !wishKakaoMapRef.current) return
    wishOverlaysRef.current.forEach(o => o.setMap(null))
    wishOverlaysRef.current = []

    wishlistWithCoords.forEach(wish => {
      const isSelected = wish.id === highlightedWishId
      const el = document.createElement('div')
      el.innerHTML = makeWishPinHTML(isSelected)
      el.addEventListener('click', () => {
        setHighlightedWishId(wish.id)
        setTimeout(() => {
          document.getElementById(`wish-card-${wish.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }, 50)
      })
      const overlay = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(wish.lat, wish.lng),
        content: el,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: isSelected ? 10 : 1,
      })
      overlay.setMap(wishKakaoMapRef.current)
      wishOverlaysRef.current.push(overlay)
    })

    if (wishlistWithCoords.length > 0 && wishKakaoMapRef.current) {
      if (wishlistWithCoords.length === 1) {
        wishKakaoMapRef.current.setCenter(new window.kakao.maps.LatLng(wishlistWithCoords[0].lat, wishlistWithCoords[0].lng))
        wishKakaoMapRef.current.setLevel(5)
      } else {
        const bounds = new window.kakao.maps.LatLngBounds()
        wishlistWithCoords.forEach(w => bounds.extend(new window.kakao.maps.LatLng(w.lat, w.lng)))
        wishKakaoMapRef.current.setBounds(bounds, 60)
      }
    }
  }, [wishlistWithCoords, wishMapReady, highlightedWishId])

  // ── 맛집 마커 갱신 (fitBounds 제거) ──────────────────────────
  useEffect(() => {
    if (!mapReady || !kakaoMapRef.current) return
    mealOverlaysRef.current.forEach(o => o.setMap(null))
    mealOverlaysRef.current = []
    clusters.forEach(cluster => {
      const key = `${Math.round(cluster.coords[0] * ROUND)},${Math.round(cluster.coords[1] * ROUND)}`
      const isSelected = key === selectedClusterKey
      const el = document.createElement('div')
      el.innerHTML = makePinHTML(TAG_COLORS[cluster.meals[0].tag] || '#a07850', cluster.meals.length, isSelected)
      el.addEventListener('click', () => {
        setSelectedCluster(cluster)
        if (kakaoMapRef.current) {
          kakaoMapRef.current.panTo(new window.kakao.maps.LatLng(cluster.coords[0], cluster.coords[1]))
          kakaoMapRef.current.setLevel(3)
        }
      })
      const overlay = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(cluster.coords[0], cluster.coords[1]),
        content: el,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: isSelected ? 10 : 1,
      })
      overlay.setMap(kakaoMapRef.current)
      mealOverlaysRef.current.push(overlay)
    })
  }, [clusters, selectedClusterKey, mapReady])

  // ── 내 위치 마커 ──────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !kakaoMapRef.current) return
    if (userOverlayRef.current) { userOverlayRef.current.setMap(null); userOverlayRef.current = null }
    if (!userLocation) return
    const el = document.createElement('div')
    el.style.cssText = 'width:14px;height:14px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(59,130,246,0.25)'
    const overlay = new window.kakao.maps.CustomOverlay({
      position: new window.kakao.maps.LatLng(userLocation[0], userLocation[1]),
      content: el, xAnchor: 0.5, yAnchor: 0.5, zIndex: 20,
    })
    overlay.setMap(kakaoMapRef.current)
    userOverlayRef.current = overlay
  }, [userLocation, mapReady])

  // ── 지도 이동 (현재 위치 버튼 → level 5 유지) ──────────────────
  useEffect(() => {
    if (!flyTarget || !mapReady || !kakaoMapRef.current) return
    kakaoMapRef.current.panTo(new window.kakao.maps.LatLng(flyTarget[0], flyTarget[1]))
    kakaoMapRef.current.setLevel(5)
    setFlyTarget(null)
  }, [flyTarget, mapReady])

  // ── 가고 싶은 곳 지도 내 위치 마커 ──────────────────────────────
  useEffect(() => {
    if (!wishMapReady || !wishKakaoMapRef.current) return
    if (wishUserOverlayRef.current) { wishUserOverlayRef.current.setMap(null); wishUserOverlayRef.current = null }
    if (!userLocation) return
    const el = document.createElement('div')
    el.style.cssText = 'width:14px;height:14px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(59,130,246,0.25)'
    const overlay = new window.kakao.maps.CustomOverlay({
      position: new window.kakao.maps.LatLng(userLocation[0], userLocation[1]),
      content: el, xAnchor: 0.5, yAnchor: 0.5, zIndex: 20,
    })
    overlay.setMap(wishKakaoMapRef.current)
    wishUserOverlayRef.current = overlay
  }, [userLocation, wishMapReady])

  // ── 가고 싶은 곳 지도 이동 ───────────────────────────────────────
  useEffect(() => {
    if (!wishFlyTarget || !wishMapReady || !wishKakaoMapRef.current) return
    wishKakaoMapRef.current.panTo(new window.kakao.maps.LatLng(wishFlyTarget[0], wishFlyTarget[1]))
    wishKakaoMapRef.current.setLevel(5)
    setWishFlyTarget(null)
  }, [wishFlyTarget, wishMapReady])

  // ── 식사 핀 로드 (지오코딩) ───────────────────────────────────
  useEffect(() => {
    if (meals.length === 0) { setPins([]); return }
    async function loadPins() {
      setLoading(true)
      const results = await Promise.all(
        meals.map(async meal => {
          if (meal.lat && meal.lng) return { meal, coords: [meal.lat, meal.lng] }
          try {
            const coords = await geocodeKakao(meal.location)
            if (coords && currentSpace?.id) cacheGeocoords(currentSpace.id, meal.id, coords[0], coords[1])
            return { meal, coords }
          } catch { return { meal, coords: null } }
        })
      )
      setPins(results.filter(r => r.coords))
      setLoading(false)
    }
    loadPins()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meals.length, uncachedKey])

  // ── 식사 사진 로드 ────────────────────────────────────────────
  useEffect(() => {
    meals.forEach(m => {
      if (!m.photosLoaded && !requestedPhotosRef.current.has(m.id)) {
        requestedPhotosRef.current.add(m.id)
        loadMealPhotos(m.id)
      }
    })
  }, [meals.length])

  // ── 근처 위시 탐색 (1회) ──────────────────────────────────────
  useEffect(() => {
    if (hasCheckedNearbyRef.current) return
    const candidates = wishlist.filter(w => w.lat && w.lng && !w.visited)
    if (candidates.length === 0 || !navigator.geolocation) return
    hasCheckedNearbyRef.current = true
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords
        let closest = null, closestDist = Infinity
        candidates.forEach(w => {
          const d = haversineKm(latitude, longitude, w.lat, w.lng)
          if (d < closestDist) { closestDist = d; closest = w }
        })
        if (closest && closestDist < 1) {
          setNearbyWish({ item: closest, distanceM: Math.round(closestDist * 1000) })
          setTimeout(() => setBannerVisible(true), 80)
        }
      },
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    )
  }, [wishlist])

  // ── 핸들러 ────────────────────────────────────────────────────
  function handleToggleFilter(tag) {
    setActiveFilters(prev => {
      const next = new Set(prev)
      if (tag === '전체') return new Set(['전체'])
      next.delete('전체')
      if (next.has(tag)) { next.delete(tag); if (next.size === 0) next.add('전체') }
      else next.add(tag)
      return next
    })
  }

  function handleLocate() {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords = [pos.coords.latitude, pos.coords.longitude]
        setUserLocation(coords)
        setFlyTarget(coords)
        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    )
  }

  function handleWishLocate() {
    if (!navigator.geolocation) return
    setWishLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords = [pos.coords.latitude, pos.coords.longitude]
        setUserLocation(coords)
        setWishFlyTarget(coords)
        setWishLocating(false)
      },
      () => setWishLocating(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    )
  }

  function handleOpenAdd() {
    setAddForm(EMPTY_WISH_FORM)
    setAddPhotoPreview('')
    setShowAddModal(true)
  }

  async function handleSaveAdd(e) {
    e.preventDefault()
    if (!addForm.name.trim()) return
    setSavingAdd(true)
    let lat = null, lng = null
    if (addForm.location.trim()) {
      try { const coords = await geocodeKakao(addForm.location); if (coords) { lat = coords[0]; lng = coords[1] } } catch {}
    }
    let photoUrl = ''
    if (addPhotoPreview) photoUrl = await uploadPhotoToStorage(addPhotoPreview, currentSpace?.id)
    await addWishlistItem({ name: addForm.name.trim(), memo: addForm.memo.trim(), location: addForm.location.trim(), lat, lng, moodTags: addForm.moodTags, photo: photoUrl })
    setShowAddModal(false)
    setSavingAdd(false)
  }

  function handleOpenEdit(item) {
    setEditingWish(item)
    setEditForm({ name: item.name || '', location: item.location || '', memo: item.memo || '', moodTags: item.moodTags || [] })
    setEditPhotoPreview(item.photo || '')
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    if (!editForm.name.trim() || !editingWish) return
    setSavingEdit(true)
    let lat = editingWish.lat, lng = editingWish.lng
    if (editForm.location.trim() && editForm.location !== editingWish.location) {
      try { const coords = await geocodeKakao(editForm.location); if (coords) { lat = coords[0]; lng = coords[1] } } catch {}
    }
    let photoUrl = editingWish.photo || ''
    if (editPhotoPreview && editPhotoPreview !== editingWish.photo) {
      photoUrl = editPhotoPreview.startsWith('data:') ? await uploadPhotoToStorage(editPhotoPreview, currentSpace?.id) : editPhotoPreview
    } else if (!editPhotoPreview) {
      photoUrl = ''
    }
    await updateWishlistItem(editingWish.id, { name: editForm.name.trim(), memo: editForm.memo.trim(), location: editForm.location.trim(), lat, lng, moodTags: editForm.moodTags, photo: photoUrl })
    setEditingWish(null)
    setSavingEdit(false)
  }

  function handleDelete(id) {
    if (!window.confirm('이 장소를 삭제할까요?')) return
    deleteWishlistItem(id)
  }

  function handleViewOnMap(wish) {
    setHighlightedWishId(wish.id)
    setWishFlyTarget([wish.lat, wish.lng])
  }

  async function handleVisitSubmit(mealData) {
    const meal = await addMeal({ ...mealData, fromWishlist: true })
    if (meal && visitingWish?.id) {
      await updateWishlistItem(visitingWish.id, { visited: true, visitedAt: new Date().toISOString().split('T')[0] })
    }
    setVisitingWish(null)
  }

  // ── 렌더 ──────────────────────────────────────────────────────
  return (
    <div className={`flex flex-col ${activeTab === 'map' ? 'h-full' : ''}`}>

      {/* 탭 바 */}
      <div className="shrink-0 px-4 pt-3 pb-2">
        <div className="flex gap-1 p-1 bg-cream-100 rounded-2xl">
          <button
            onClick={() => { setActiveTab('map'); onTabChange?.('map') }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === 'map' ? 'bg-white text-warm-dark shadow-sm' : 'text-warm-light hover:text-warm-brown'}`}
          >
            맛집 지도
          </button>
          <button
            onClick={() => { setActiveTab('wishlist'); onTabChange?.('wishlist') }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === 'wishlist' ? 'bg-white text-warm-dark shadow-sm' : 'text-warm-light hover:text-warm-brown'}`}
          >
            가고 싶은 곳
          </button>
        </div>
      </div>

      {/* ── 탭 1: 맛집 지도 ── */}
      {activeTab === 'map' && (
        <>
          {/* 필터 + 배너 */}
          <div className="shrink-0 px-4 pb-2">
            {nearbyWish && !nearbyDismissed && (
              <div
                className="mb-2"
                style={{ transform: bannerVisible ? 'translateY(0)' : 'translateY(-6px)', opacity: bannerVisible ? 1 : 0, transition: 'transform 0.35s ease, opacity 0.35s ease' }}
              >
                <div className="flex items-center gap-3 px-4 py-3 bg-cream-100 border border-cream-300 rounded-2xl">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-rose-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setFlyTarget([nearbyWish.item.lat, nearbyWish.item.lng])}>
                    <p className="text-[11px] text-warm-light font-medium mb-0.5">근처에 가고 싶은 곳이 있어요</p>
                    <p className="text-sm font-semibold text-warm-dark truncate">
                      {nearbyWish.item.name}
                      <span className="text-xs text-warm-light font-normal ml-1.5">약 {nearbyWish.distanceM}m</span>
                    </p>
                  </div>
                  <button onClick={() => setNearbyDismissed(true)} className="text-cream-400 hover:text-warm-light transition-colors p-1 shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {MAP_FILTERS.map(opt => {
                const isActive = activeFilters.has(opt)
                return (
                  <button key={opt} onClick={() => handleToggleFilter(opt)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors active:scale-95 shrink-0 border ${
                      isActive ? 'bg-warm-brown text-white border-warm-brown shadow-sm' : 'bg-cream-100 text-warm-brown border-cream-200 hover:bg-cream-200'
                    }`}
                  >
                    {!isActive && TAG_COLORS[opt] && (
                      <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: TAG_COLORS[opt] }} />
                    )}
                    {opt}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 지도 — 고정 높이 */}
          <div className="shrink-0 px-4">
            <div className="relative rounded-2xl shadow-sm overflow-hidden" style={{ height: '45vh', minHeight: 280 }}>
              <div ref={setMapContainerRef} style={{ width: '100%', height: '100%' }} />
              {!mapReady && !mapInitFailed && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-cream-50/90 z-10 pointer-events-none">
                  <div className="w-5 h-5 border-2 border-cream-200 border-t-warm-brown rounded-full animate-spin mb-2" />
                  <p className="text-xs text-warm-light">지도 불러오는 중...</p>
                </div>
              )}
              {mapInitFailed && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-cream-50 z-10 px-6 text-center">
                  <svg className="w-8 h-8 text-cream-300 mb-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  <p className="text-sm font-medium text-warm-dark mb-1">지도를 불러올 수 없어요</p>
                  <p className="text-xs text-warm-light leading-relaxed">
                    카카오 개발자 콘솔 →<br />앱 설정 → 플랫폼 → Web에<br />현재 도메인이 등록됐는지 확인해주세요
                  </p>
                </div>
              )}
              <button onClick={handleLocate} disabled={locating}
                style={{ position: 'absolute', right: 12, bottom: 16, zIndex: 10 }}
                className="bg-white rounded-full w-10 h-10 shadow-md flex items-center justify-center hover:bg-cream-50 active:scale-95 transition-all disabled:opacity-60"
              >
                {locating ? (
                  <div className="w-4 h-4 border-2 border-cream-300 border-t-blue-400 rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="3" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                  </svg>
                )}
              </button>
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-cream-50/70 z-10">
                  <p className="text-sm text-warm-light">위치 찾는 중...</p>
                </div>
              )}
            </div>
          </div>

          {/* 스크롤 가능 영역 — 게시글 목록 */}
          <div className="flex-1 overflow-y-auto px-4 pt-3 pb-20 border-t border-cream-200">
            {selectedCluster && (
              <div className="bg-white rounded-2xl border border-cream-200 p-4 mb-3">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-warm-dark text-sm">
                      {selectedCluster.meals[0].restaurantName || selectedCluster.meals[0].location || '이 위치'}
                    </p>
                    <p className="text-xs text-warm-light mt-0.5">{selectedCluster.meals.length}개 식사 기록</p>
                  </div>
                  <button
                    onClick={() => setSelectedCluster(null)}
                    className="p-1.5 text-cream-400 hover:text-warm-light transition-colors rounded-lg hover:bg-cream-100"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div
                  className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide"
                  style={{ scrollSnapType: 'x mandatory' }}
                  onTouchStart={e => e.stopPropagation()}
                  onTouchMove={e => e.stopPropagation()}
                >
                  {selectedCluster.meals.map(meal => {
                    const liveMeal = currentSpace?.meals.find(m => m.id === meal.id) ?? meal
                    return (
                      <MealPinCard key={meal.id} meal={meal} liveMeal={liveMeal}
                        onClick={() => onViewMeal?.(liveMeal)}
                      />
                    )
                  })}
                </div>
              </div>
            )}
            {clusters.length === 0 && !loading && (
              <div className="py-8 text-center">
                <p className="text-sm font-medium text-warm-dark mb-1">아직 등록된 맛집이 없어요</p>
                <p className="text-xs text-warm-light">식사 기록에 위치를 입력하면<br />여기에 나타나요</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── 탭 2: 가고 싶은 곳 ── */}
      {activeTab === 'wishlist' && (
        <>
          {/* 위시리스트 지도 */}
          {wishlistWithCoords.length > 0 && (
            <div className="shrink-0 px-4 pb-2">
              <div className="relative rounded-2xl shadow-sm overflow-hidden" style={{ height: '38vh', minHeight: 220 }}>
                <div ref={setWishMapNodeRef} style={{ width: '100%', height: '100%' }} />
                {!wishMapReady && !wishMapFailed && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-cream-50/90 z-10 pointer-events-none">
                    <div className="w-5 h-5 border-2 border-cream-200 border-t-warm-brown rounded-full animate-spin mb-2" />
                    <p className="text-xs text-warm-light">지도 불러오는 중...</p>
                  </div>
                )}
                {wishMapFailed && (
                  <div className="absolute inset-0 flex items-center justify-center bg-cream-50 z-10">
                    <p className="text-xs text-warm-light text-center px-4">지도를 불러올 수 없어요</p>
                  </div>
                )}
                <button onClick={handleWishLocate} disabled={wishLocating}
                  style={{ position: 'absolute', right: 12, bottom: 12, zIndex: 10 }}
                  className="bg-white rounded-full w-10 h-10 shadow-md flex items-center justify-center hover:bg-cream-50 active:scale-95 transition-all disabled:opacity-60"
                >
                  {wishLocating ? (
                    <div className="w-4 h-4 border-2 border-cream-300 border-t-blue-400 rounded-full animate-spin" />
                  ) : (
                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="3" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* 위시리스트 목록 — 페이지 스크롤로 동작 */}
          <div className="px-4 pt-3 pb-28 border-t border-cream-200">
            <button onClick={handleOpenAdd}
              className="w-full py-3 rounded-2xl border-2 border-dashed border-cream-300 text-warm-light text-sm font-medium hover:border-warm-brown hover:text-warm-brown transition-colors active:scale-[0.98] flex items-center justify-center gap-2 mb-3"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              가고 싶은 곳 추가
            </button>

            {unvisited.length > 0 ? (
              <div className="space-y-3 mb-6">
                {unvisited.map(item => (
                  <WishListCard key={item.id} item={item}
                    highlighted={item.id === highlightedWishId}
                    onViewDetail={() => setViewingWish(item)}
                    onVisit={e => { e?.stopPropagation(); setVisitingWish(item) }}
                    onViewOnMap={item.lat && item.lng ? (e => { e?.stopPropagation(); handleViewOnMap(item) }) : null}
                  />
                ))}
              </div>
            ) : (
              <div className="py-10 text-center mb-6">
                <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-rose-300" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                </div>
                <p className="text-sm font-medium text-warm-dark mb-1">아직 가고 싶은 곳이 없어요</p>
                <p className="text-xs text-warm-light">위 버튼으로 가고 싶은 장소를 추가해보세요</p>
              </div>
            )}

            {visited.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold text-warm-light">방문 완료</span>
                  <div className="flex-1 h-px bg-cream-200" />
                  <span className="text-xs text-cream-400">{visited.length}곳</span>
                </div>
                <div className="space-y-3">
                  {visited.map(item => (
                    <WishListCard key={item.id} item={item}
                      highlighted={item.id === highlightedWishId}
                      onViewDetail={() => setViewingWish(item)}
                      onVisit={null}
                      onViewOnMap={item.lat && item.lng ? (e => { e?.stopPropagation(); handleViewOnMap(item) }) : null}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── 모달: 가고 싶은 곳 상세 ── */}
      {viewingWish && (
        <WishDetailModal
          item={viewingWish}
          onClose={() => setViewingWish(null)}
          onEdit={() => handleOpenEdit(viewingWish)}
          onDelete={() => {
            if (window.confirm('이 장소를 삭제할까요?')) {
              deleteWishlistItem(viewingWish.id)
              setViewingWish(null)
            }
          }}
          onVisit={() => setVisitingWish(viewingWish)}
          onViewOnMap={() => handleViewOnMap(viewingWish)}
        />
      )}

      {/* ── 모달: 가고 싶은 곳 추가 ── */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="가고 싶은 곳 추가">
        <form onSubmit={handleSaveAdd} className="space-y-4">
          <WishFormFields form={addForm} setForm={setAddForm} photoPreview={addPhotoPreview} setPhotoPreview={setAddPhotoPreview} photoRef={addPhotoRef} />
          <div className="flex gap-3 pt-1" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
            <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 rounded-2xl border border-cream-300 text-warm-brown text-sm font-medium hover:bg-cream-100 transition-colors">취소</button>
            <button type="submit" disabled={savingAdd} className="flex-1 py-3 rounded-2xl bg-warm-brown text-white text-sm font-medium hover:bg-warm-dark transition-colors disabled:opacity-60">{savingAdd ? '저장 중...' : '저장'}</button>
          </div>
        </form>
      </Modal>

      {/* ── 모달: 가고 싶은 곳 수정 ── */}
      <Modal isOpen={!!editingWish} onClose={() => setEditingWish(null)} title="가고 싶은 곳 수정">
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <WishFormFields form={editForm} setForm={setEditForm} photoPreview={editPhotoPreview} setPhotoPreview={setEditPhotoPreview} photoRef={editPhotoRef} />
          <div className="flex gap-3 pt-1" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
            <button type="button" onClick={() => setEditingWish(null)} className="flex-1 py-3 rounded-2xl border border-cream-300 text-warm-brown text-sm font-medium hover:bg-cream-100 transition-colors">취소</button>
            <button type="submit" disabled={savingEdit} className="flex-1 py-3 rounded-2xl bg-warm-brown text-white text-sm font-medium hover:bg-warm-dark transition-colors disabled:opacity-60">{savingEdit ? '수정 중...' : '수정 완료'}</button>
          </div>
        </form>
      </Modal>

      {/* ── 모달: 방문 기록 ── */}
      <Modal isOpen={!!visitingWish} onClose={() => setVisitingWish(null)}>
        {visitingWish && (
          <div className="pb-1">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-rose-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              <p className="text-sm font-semibold text-warm-dark">{visitingWish.name} 방문 기록</p>
            </div>
            <MealForm
              date={new Date()}
              initial={{ tag: '외식', restaurantName: visitingWish.name, location: visitingWish.location || '', lat: visitingWish.lat || null, lng: visitingWish.lng || null }}
              onSubmit={handleVisitSubmit}
              onCancel={() => setVisitingWish(null)}
            />
          </div>
        )}
      </Modal>

    </div>
  )
}
