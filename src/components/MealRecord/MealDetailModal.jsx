import { useState, useEffect, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'
import Modal from '../common/Modal'
import MealForm from './MealForm'
import PhotoGallery from '../common/PhotoGallery'
import { getOriginalUrl } from '../../lib/uploadPhoto'
import AuthorBadge from '../common/AuthorBadge'

const TAG_STYLES = {
  집밥: 'bg-green-50 text-green-700 border-green-200',
  외식: 'bg-amber-50 text-amber-700 border-amber-200',
  카페: 'bg-pink-50 text-pink-700 border-pink-200',
  배달: 'bg-blue-50 text-blue-700 border-blue-200',
}

// ── 상대 시간 포맷 ─────────────────────────────────────────────────────────
function formatTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const sec  = Math.floor(diff / 1000)
  const min  = Math.floor(sec  / 60)
  const hour = Math.floor(min  / 60)
  const day  = Math.floor(hour / 24)
  if (sec  < 60)  return '방금'
  if (min  < 60)  return `${min}분 전`
  if (hour < 24)  return `${hour}시간 전`
  if (day  < 7)   return `${day}일 전`
  return format(new Date(dateStr), 'M.d', { locale: ko })
}

// ── 댓글 단일 아이템 ──────────────────────────────────────────────────────
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
          <span className="text-xs font-semibold text-warm-dark">
            {comment.nickname || '익명'}
          </span>
          <span className="text-[10px] text-cream-400 shrink-0">
            {formatTimeAgo(comment.created_at)}
          </span>
          {isOwn && (
            <button
              onClick={() => onDelete(comment.id)}
              className="ml-auto text-[10px] text-cream-400 hover:text-red-400 transition-colors shrink-0"
            >
              삭제
            </button>
          )}
        </div>
        <p className="text-sm text-warm-dark leading-relaxed mt-0.5 break-words">
          {comment.content}
        </p>
      </div>
    </div>
  )
}

// ── 별점 섹션 (평균 표시 + 내 별점 입력) ────────────────────────────────
function RatingsSection({ mealId }) {
  const { user, ratingsMap, addOrUpdateRating, deleteRating, spaces, currentSpace } = useApp()
  const ratings = ratingsMap?.[mealId] || []
  const myRating = ratings.find(r => r.user_id === user?.id)
  const [saving, setSaving] = useState(false)

  const avg = ratings.length > 0
    ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length
    : null
  const floorAvg = avg !== null ? Math.floor(avg) : 0

  async function handleRate(value) {
    if (!user || saving) return
    setSaving(true)
    if (myRating?.rating === value) {
      await deleteRating(mealId)
    } else {
      await addOrUpdateRating(mealId, value)
      // 식사 작성자에게 별점 알림 (내 게시글이 아닐 때만)
      try {
        const meal = spaces?.flatMap(s => s.meals).find(m => m.id === mealId)
        if (meal?.userId && meal.userId !== user.id) {
          const fromNickname = user.user_metadata?.name || user.user_metadata?.full_name || '멤버'
          const { error: notifErr } = await supabase.from('notifications').insert({
            user_id: meal.userId,
            space_id: currentSpace?.id || null,
            meal_id: mealId,
            from_user_id: user.id,
            from_nickname: fromNickname,
            from_avatar_url: user.user_metadata?.avatar_url || '',
            type: 'new_rating',
            message: `${fromNickname}님이 별점 ${value}점을 남겼어요`,
            is_read: false,
          })
          if (notifErr) console.error('[RatingsSection] 알림 생성 실패:', notifErr)
        }
      } catch (e) {
        console.error('[RatingsSection] 알림 처리 중 오류:', e)
      }
    }
    setSaving(false)
  }

  if (!user && ratings.length === 0) return null

  return (
    <div className="mb-3">
      {ratings.length > 0 && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="flex gap-0.5">
            {[1,2,3,4,5].map(i => (
              <span key={i} className={`text-xl ${i <= floorAvg ? 'star-filled' : 'star-empty'}`}>★</span>
            ))}
          </div>
          {ratings.length >= 2 && (
            <span className="text-xs text-warm-light">{ratings.length}명 평가</span>
          )}
        </div>
      )}
      {user && (
        <div>
          <p className="text-[10px] text-cream-400 mb-1">
            {myRating ? '내 별점 (다시 탭하면 취소)' : '내 별점'}
          </p>
          <div className={`flex gap-1 ${saving ? 'opacity-50 pointer-events-none' : ''}`}>
            {[1,2,3,4,5].map(i => (
              <button
                key={i}
                onClick={() => handleRate(i)}
                className={`text-xl transition-colors active:scale-90 ${i <= (myRating?.rating || 0) ? 'star-filled' : 'star-empty'}`}
              >★</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── 지도 미니 뷰 ──────────────────────────────────────────────────────────
function SmallMap({ lat, lng }) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || !window.kakao?.maps) return
    let overlay = null
    let destroyed = false
    window.kakao.maps.load(() => {
      if (destroyed || !containerRef.current) return
      const center = new window.kakao.maps.LatLng(lat, lng)
      const map = new window.kakao.maps.Map(containerRef.current, { center, level: 4 })
      map.setDraggable(false)
      map.setZoomable(false)
      const pinEl = document.createElement('div')
      pinEl.style.cssText = 'width:14px;height:14px;background:#6b4f3a;border:2.5px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.3)'
      overlay = new window.kakao.maps.CustomOverlay({
        position: center, content: pinEl, xAnchor: 0.5, yAnchor: 0.5,
      })
      overlay.setMap(map)
    })
    return () => { destroyed = true; if (overlay) overlay.setMap(null) }
  }, [lat, lng])

  return <div ref={containerRef} className="rounded-2xl overflow-hidden" style={{ height: 150 }} />
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────
export default function MealDetailModal({ meal, onClose }) {
  const { user, updateMeal, deleteMeal, loadMealPhotos, currentSpace } = useApp()
  const [editing, setEditing] = useState(false)

  // ── 댓글 상태 ──
  const [comments, setComments]           = useState([])
  const [commentsLoaded, setCommentsLoaded] = useState(false)
  const [commentText, setCommentText]     = useState('')
  const [submitting, setSubmitting]       = useState(false)
  const commentsEndRef = useRef(null)

  const liveMeal = currentSpace?.meals.find(m => m.id === meal?.id) ?? meal

  // 사진 lazy 로딩
  useEffect(() => {
    if (meal?.id && !meal.photosLoaded) loadMealPhotos(meal.id)
  }, [meal?.id])

  // 댓글 로딩 + Realtime 구독
  useEffect(() => {
    if (!meal?.id) return
    let destroyed = false

    async function fetchComments() {
      const { data } = await supabase
        .from('comments')
        .select('*')
        .eq('meal_id', meal.id)
        .order('created_at')
      if (!destroyed) {
        setComments(data || [])
        setCommentsLoaded(true)
      }
    }
    fetchComments()

    const channel = supabase
      .channel(`comments:meal:${meal.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments', filter: `meal_id=eq.${meal.id}` },
        ({ eventType, new: newRow, old: oldRow }) => {
          if (eventType === 'INSERT') {
            setComments(prev =>
              prev.find(c => c.id === newRow.id) ? prev : [...prev, newRow]
            )
          } else if (eventType === 'DELETE') {
            setComments(prev => prev.filter(c => c.id !== oldRow.id))
          }
        }
      )
      .subscribe()

    return () => {
      destroyed = true
      supabase.removeChannel(channel)
    }
  }, [meal?.id])

  if (!meal) return null

  const dateObj = parseISO(liveMeal.date)
  const photos  = (liveMeal.photos?.length > 0 ? liveMeal.photos : (liveMeal.photo ? [liveMeal.photo] : []))
    .map(p => getOriginalUrl(p))
    .filter(Boolean)

  async function handleDownload(url) {
    try {
      const res    = await fetch(url)
      const blob   = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `식탁일기_${liveMeal.date}.jpg`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    } catch {
      window.open(url, '_blank')
    }
  }

  function handleEdit(data) {
    updateMeal(liveMeal.id, data)
    setEditing(false)
    onClose()
  }

  function handleDelete() {
    if (window.confirm('이 기록을 삭제할까요?')) {
      deleteMeal(meal.id)
      onClose()
    }
  }

  async function handleAddComment(e) {
    e.preventDefault()
    const trimmed = commentText.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    const { data, error } = await supabase
      .from('comments')
      .insert({
        meal_id:    meal.id,
        user_id:    user?.id    || null,
        nickname:   user?.user_metadata?.name || user?.user_metadata?.full_name || '',
        avatar_url: user?.user_metadata?.avatar_url || '',
        content:    trimmed,
      })
      .select()
      .single()
    setSubmitting(false)
    if (!error && data) {
      setComments(prev => prev.find(c => c.id === data.id) ? prev : [...prev, data])
      setCommentText('')
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      // 식사 작성자에게 알림 (내 게시글이 아닐 때만)
      try {
        if (liveMeal.userId && liveMeal.userId !== user?.id) {
          const fromNickname = user?.user_metadata?.name || user?.user_metadata?.full_name || '멤버'
          const { error: notifErr } = await supabase.from('notifications').insert({
            user_id: liveMeal.userId,
            space_id: currentSpace?.id || null,
            meal_id: liveMeal.id,
            from_user_id: user?.id || null,
            from_nickname: fromNickname,
            from_avatar_url: user?.user_metadata?.avatar_url || '',
            type: 'new_comment',
            message: `${fromNickname}님이 댓글을 남겼어요: ${trimmed.length > 20 ? trimmed.slice(0, 20) + '…' : trimmed}`,
            is_read: false,
          })
          if (notifErr) console.error('[handleAddComment] 알림 생성 실패:', notifErr)
        }
      } catch (e) {
        console.error('[handleAddComment] 알림 처리 중 오류:', e)
      }
    }
  }

  async function handleDeleteComment(commentId) {
    const { error } = await supabase.from('comments').delete().eq('id', commentId)
    if (!error) setComments(prev => prev.filter(c => c.id !== commentId))
  }

  // 수정 모드
  if (editing) {
    return (
      <Modal isOpen onClose={onClose}>
        <button
          onClick={() => setEditing(false)}
          className="flex items-center gap-1 text-sm text-warm-light mb-5 hover:text-warm-brown transition-colors"
        >
          ← 돌아가기
        </button>
        <MealForm
          date={dateObj}
          initial={liveMeal}
          onSubmit={handleEdit}
          onCancel={() => setEditing(false)}
        />
      </Modal>
    )
  }

  const hasMap = !!(liveMeal.lat && liveMeal.lng)

  return (
    <Modal isOpen onClose={onClose}>

      {/* ① 사진 */}
      {!liveMeal.photosLoaded ? (
        <div className="-mx-5 -mt-4 mb-5 h-48 bg-cream-100 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-cream-300 border-t-warm-light rounded-full animate-spin" />
        </div>
      ) : photos.length > 0 ? (
        <div className="-mx-5 -mt-4 mb-5">
          <PhotoGallery photos={photos} maxHeight={300} onDownload={handleDownload} />
        </div>
      ) : null}

      {/* ② 제목 */}
      {liveMeal.title && (
        <h2 className="text-lg font-bold text-warm-dark mb-1 leading-snug">{liveMeal.title}</h2>
      )}

      {/* ② 날짜 + 끼니 + 태그 */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <p className="text-xs text-cream-400">
          {format(dateObj, 'yyyy년 M월 d일 (eee)', { locale: ko })}
        </p>
        {liveMeal.mealTime && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cream-200 text-warm-light font-medium">
            {liveMeal.mealTime}
          </span>
        )}
        {liveMeal.tag && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${TAG_STYLES[liveMeal.tag] || 'bg-cream-100 text-warm-light border-cream-200'}`}>
            {liveMeal.tag}
          </span>
        )}
        {liveMeal.fromWishlist && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-400 font-medium border border-rose-100 flex items-center gap-1">
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            가고 싶었던 곳
          </span>
        )}
      </div>

      {/* ② 작성자 */}
      <AuthorBadge meal={liveMeal} className="mb-2" />

      {/* ② 별점 */}
      <RatingsSection mealId={liveMeal.id} />

      {/* ③ 식당명 */}
      {liveMeal.restaurantName && (
        <p className={`font-semibold text-warm-dark leading-snug mb-1 ${liveMeal.title ? 'text-sm' : 'text-base'}`}>
          {liveMeal.restaurantName}
        </p>
      )}

      {/* ③ 한줄평 */}
      {liveMeal.review && (
        <p className="text-sm text-warm-dark mb-2 leading-relaxed">{liveMeal.review}</p>
      )}

      {/* ③ 메모 */}
      {liveMeal.memo && (
        <p className="text-xs text-warm-light leading-relaxed whitespace-pre-line mb-3">{liveMeal.memo}</p>
      )}

      {/* ④ 위치 + 지도 */}
      {liveMeal.location && (
        <p className="text-xs text-warm-light flex items-center gap-1 mb-2 mt-1">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.686 2 6 4.686 6 8c0 4.5 6 12 6 12s6-7.5 6-12c0-3.314-2.686-6-6-6z" />
            <circle cx="12" cy="8" r="2" />
          </svg>
          {liveMeal.location}
        </p>
      )}

      {hasMap && <SmallMap lat={liveMeal.lat} lng={liveMeal.lng} />}

      {/* ⑤ 수정 / 삭제 */}
      <div className="flex gap-3 pt-4 mt-4 border-t border-cream-100">
        <button
          onClick={() => setEditing(true)}
          className="flex-1 py-2.5 rounded-2xl border border-cream-300 text-warm-brown text-sm font-medium hover:bg-cream-100 transition-colors"
        >
          수정
        </button>
        <button
          onClick={handleDelete}
          className="flex-1 py-2.5 rounded-2xl border border-red-100 text-red-400 text-sm font-medium hover:bg-red-50 transition-colors"
        >
          삭제
        </button>
      </div>

      {/* ⑥ 댓글 섹션 */}
      <div className="mt-5 pt-5 border-t border-cream-100">
        <p className="text-xs font-semibold text-warm-dark mb-3">
          댓글{comments.length > 0 ? ` ${comments.length}` : ''}
        </p>

        {/* 댓글 목록 */}
        <div className="space-y-4 mb-4">
          {!commentsLoaded ? (
            <div className="py-4 flex justify-center">
              <div className="w-4 h-4 border-2 border-cream-300 border-t-warm-light rounded-full animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-xs text-cream-400 text-center py-3">첫 댓글을 남겨보세요</p>
          ) : (
            comments.map(comment => (
              <CommentItem
                key={comment.id}
                comment={comment}
                currentUserId={user?.id}
                onDelete={handleDeleteComment}
              />
            ))
          )}
          <div ref={commentsEndRef} />
        </div>

        {/* 댓글 입력창 */}
        <form
          onSubmit={handleAddComment}
          className="flex items-center gap-2.5 sticky bottom-0 bg-cream-50 pt-2"
          style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
        >
          {user?.user_metadata?.avatar_url ? (
            <img
              src={user.user_metadata.avatar_url}
              alt=""
              className="w-7 h-7 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-cream-200 shrink-0 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#c4a882">
                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
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
