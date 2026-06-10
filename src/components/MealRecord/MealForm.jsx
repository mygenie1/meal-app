import { useState, useRef } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import StarRating from '../common/StarRating'
import { useApp } from '../../context/AppContext'

async function geocodeKr(query) {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '1',
    countrycodes: 'kr',
    'accept-language': 'ko',
  })
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { headers: { 'Accept-Language': 'ko' } }
  )
  const data = await res.json()
  if (data[0]) return [parseFloat(data[0].lat), parseFloat(data[0].lon)]
  return null
}

const TAG_STYLE = {
  집밥: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-50 text-green-700' },
  외식: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-50 text-amber-700' },
  카페: { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', badge: 'bg-pink-50 text-pink-700' },
  배달: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-50 text-blue-700' },
}

function TagIcon({ tag, className = 'w-7 h-7' }) {
  if (tag === '집밥') return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 22V12h6v10" />
    </svg>
  )
  if (tag === '외식') return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  )
  if (tag === '카페') return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )
  if (tag === '배달') return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    </svg>
  )
  return null
}

const TAGS = [
  { key: '집밥', desc: '직접 요리한 홈 쿠킹' },
  { key: '외식', desc: '식당, 맛집에서 외식' },
  { key: '카페', desc: '카페, 디저트 가게' },
  { key: '배달', desc: '배달 음식 주문' },
]

const INPUT_CLS = 'w-full px-4 py-3 rounded-2xl bg-cream-100 border border-cream-200 text-sm text-warm-dark placeholder-cream-400 focus:outline-none focus:border-warm-light transition-colors'
const LABEL_CLS = 'text-xs text-warm-light mb-1.5 block font-medium'

export default function MealForm({ date, onSubmit, onCancel, initial }) {
  const { currentSpace, deleteIngredient } = useApp()

  const [step, setStep] = useState(() => initial?.tag ? 'form' : 'tag')
  const [form, setForm] = useState({
    title: '', restaurantName: '', location: '', lat: null, lng: null,
    rating: 0, review: '', memo: '', tag: '', photo: '', ...initial,
  })
  const [geoStatus, setGeoStatus] = useState(
    () => (initial?.lat && initial?.lng) ? 'found' : 'idle'
  )
  const [usedIngredientIds, setUsedIngredientIds] = useState([])
  const [ingredientsOpen, setIngredientsOpen] = useState(false)
  const fileRef = useRef()

  function set(key, val) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  function handlePhoto(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => set('photo', ev.target.result)
    reader.readAsDataURL(file)
  }

  function handleLocationChange(e) {
    setForm(prev => ({ ...prev, location: e.target.value, lat: null, lng: null }))
    setGeoStatus('idle')
  }

  async function handleLocationBlur() {
    const location = form.location.trim()
    if (!location || form.lat) return
    setGeoStatus('loading')
    try {
      const coords = await geocodeKr(location)
      if (coords) {
        setForm(prev => ({ ...prev, lat: coords[0], lng: coords[1] }))
        setGeoStatus('found')
      } else {
        setGeoStatus('notfound')
      }
    } catch {
      setGeoStatus('notfound')
    }
  }

  const needsGeo = form.tag === '외식' || form.tag === '카페'

  async function handleSubmit(e) {
    e.preventDefault()
    let { lat, lng } = form

    if (needsGeo && form.location.trim() && !lat && geoStatus === 'idle') {
      setGeoStatus('loading')
      try {
        const coords = await geocodeKr(form.location)
        if (coords) { lat = coords[0]; lng = coords[1]; setGeoStatus('found') }
        else setGeoStatus('notfound')
      } catch {
        setGeoStatus('notfound')
      }
    }

    if (form.tag === '집밥' && usedIngredientIds.length > 0) {
      await Promise.all(usedIngredientIds.map(id => deleteIngredient('remaining', id)))
    }

    onSubmit({ ...form, date: format(date, 'yyyy-MM-dd'), lat, lng })
  }

  function selectTag(tag) {
    set('tag', tag)
    setStep('form')
  }

  const isGeocoding = geoStatus === 'loading'
  const remainingIngredients = currentSpace?.ingredients?.remaining || []
  const style = TAG_STYLE[form.tag] || {}

  // ── Step 1: 태그 선택 ────────────────────────────────────────────
  if (step === 'tag') {
    return (
      <div>
        <p className="text-xs text-warm-light font-medium mb-1">
          {format(date, 'yyyy년 M월 d일 (eee)', { locale: ko })}
        </p>
        <p className="text-lg font-semibold text-warm-dark mb-5">어떤 식사였나요?</p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {TAGS.map(({ key, desc }) => {
            const s = TAG_STYLE[key]
            return (
              <button
                key={key}
                type="button"
                onClick={() => selectTag(key)}
                className={`flex flex-col items-center justify-center gap-2.5 py-6 rounded-2xl border-2 ${s.bg} ${s.border} hover:opacity-80 transition-all active:scale-95`}
              >
                <span className={s.text}>
                  <TagIcon tag={key} className="w-8 h-8" />
                </span>
                <div className="text-center">
                  <p className={`text-sm font-semibold ${s.text}`}>{key}</p>
                  <p className="text-[11px] text-warm-light mt-0.5 leading-snug px-1">{desc}</p>
                </div>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="w-full py-3 rounded-2xl border border-cream-300 text-warm-brown text-sm font-medium hover:bg-cream-100 transition-colors"
        >
          취소
        </button>
      </div>
    )
  }

  // ── Step 2: 태그별 폼 ─────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit}>
      {/* 태그 배지 + 날짜 + 변경 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${style.bg} ${style.border} ${style.text}`}>
            <TagIcon tag={form.tag} className="w-3.5 h-3.5" />
            {form.tag}
          </span>
          <p className="text-xs text-warm-light">
            {format(date, 'M월 d일 (eee)', { locale: ko })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setStep('tag')}
          className="text-xs text-warm-light hover:text-warm-brown transition-colors"
        >
          변경
        </button>
      </div>

      <div className="space-y-4">
        {/* 사진 */}
        <div>
          {form.photo ? (
            <div className="relative rounded-2xl overflow-hidden">
              <img src={form.photo} alt="식사 사진" className="w-full object-cover" style={{ maxHeight: '240px' }} />
              <button
                type="button"
                onClick={() => set('photo', '')}
                className="absolute top-3 right-3 bg-black/50 text-white rounded-full w-7 h-7 flex items-center justify-center text-base hover:bg-black/70 transition-colors"
              >×</button>
              <button
                type="button"
                onClick={() => fileRef.current.click()}
                className="absolute bottom-3 right-3 bg-black/50 text-white rounded-full px-3 py-1 text-xs hover:bg-black/70 transition-colors"
              >바꾸기</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current.click()}
              className="w-full border-2 border-dashed border-cream-300 rounded-2xl flex flex-col items-center justify-center text-cream-400 hover:border-cream-400 hover:bg-cream-100 transition-colors"
              style={{ height: '160px' }}
            >
              <svg className="w-7 h-7 mb-1.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-sm font-medium">사진 추가</span>
              <span className="text-xs mt-0.5 opacity-70">선택사항이에요</span>
            </button>
          )}
          <input type="file" ref={fileRef} accept="image/*" className="hidden" onChange={handlePhoto} />
        </div>

        {/* 제목 — 모든 태그 공통 */}
        <div>
          <label className={LABEL_CLS}>제목</label>
          <input
            type="text"
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder={
              form.tag === '집밥' ? '오늘 만든 요리 이름은?' :
              form.tag === '카페' ? '어떤 음료를 마셨나요?' :
              '오늘 식사를 한 줄로 표현하면?'
            }
            className={INPUT_CLS}
          />
        </div>

        {/* 외식: 식당 이름 + 위치 */}
        {form.tag === '외식' && (
          <>
            <div>
              <label className={LABEL_CLS}>식당 이름</label>
              <input type="text" value={form.restaurantName} onChange={e => set('restaurantName', e.target.value)} placeholder="어디서 드셨나요?" className={INPUT_CLS} />
            </div>
            <LocationField form={form} geoStatus={geoStatus} onLocationChange={handleLocationChange} onLocationBlur={handleLocationBlur} />
          </>
        )}

        {/* 카페: 카페 이름 + 위치 */}
        {form.tag === '카페' && (
          <>
            <div>
              <label className={LABEL_CLS}>카페 이름</label>
              <input type="text" value={form.restaurantName} onChange={e => set('restaurantName', e.target.value)} placeholder="어느 카페였나요?" className={INPUT_CLS} />
            </div>
            <LocationField form={form} geoStatus={geoStatus} onLocationChange={handleLocationChange} onLocationBlur={handleLocationBlur} />
          </>
        )}

        {/* 배달: 가게 이름 */}
        {form.tag === '배달' && (
          <div>
            <label className={LABEL_CLS}>가게 이름</label>
            <input type="text" value={form.restaurantName} onChange={e => set('restaurantName', e.target.value)} placeholder="어느 가게에서 시켰나요?" className={INPUT_CLS} />
          </div>
        )}

        {/* 별점 — 외식/카페/배달 */}
        {form.tag !== '집밥' && (
          <div>
            <label className={LABEL_CLS}>별점</label>
            <StarRating value={form.rating} onChange={val => set('rating', val)} />
          </div>
        )}

        {/* 한줄평 — 외식/카페/배달 */}
        {form.tag !== '집밥' && (
          <div>
            <label className={LABEL_CLS}>한줄평</label>
            <input
              type="text"
              value={form.review}
              onChange={e => set('review', e.target.value)}
              placeholder={form.tag === '카페' ? '음료나 분위기는 어땠나요?' : '맛은 어땠나요?'}
              className={INPUT_CLS}
            />
          </div>
        )}

        {/* 메모 — 집밥/외식/배달 (카페 제외) */}
        {form.tag !== '카페' && (
          <div>
            <label className={LABEL_CLS}>메모</label>
            <textarea
              value={form.memo}
              onChange={e => set('memo', e.target.value)}
              placeholder={form.tag === '집밥' ? '레시피나 특별한 점을 남겨볼까요?' : '더 남기고 싶은 이야기가 있나요?'}
              rows={3}
              className={`${INPUT_CLS} resize-none`}
            />
          </div>
        )}

        {/* 집밥 전용: 재료 사용하기 */}
        {form.tag === '집밥' && remainingIngredients.length > 0 && (
          <div className="rounded-2xl border border-cream-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setIngredientsOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 bg-cream-100 hover:bg-cream-200 transition-colors"
            >
              <span className="text-sm font-medium text-warm-dark">재료 사용하기</span>
              <div className="flex items-center gap-2">
                {usedIngredientIds.length > 0 && (
                  <span className="text-xs bg-warm-brown text-white px-2 py-0.5 rounded-full font-medium">
                    {usedIngredientIds.length}개 선택
                  </span>
                )}
                <svg
                  className={`w-4 h-4 text-cream-400 transition-transform ${ingredientsOpen ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>
            {ingredientsOpen && (
              <div className="px-4 py-3 space-y-2.5">
                <p className="text-xs text-warm-light mb-2">체크한 재료는 저장 시 목록에서 제거돼요</p>
                {remainingIngredients.map(item => (
                  <label key={item.id} className="flex items-center gap-3 cursor-pointer group">
                    <button
                      type="button"
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                        usedIngredientIds.includes(item.id)
                          ? 'bg-warm-brown border-warm-brown'
                          : 'border-cream-300 group-hover:border-warm-light'
                      }`}
                      onClick={() => setUsedIngredientIds(prev =>
                        prev.includes(item.id)
                          ? prev.filter(id => id !== item.id)
                          : [...prev, item.id]
                      )}
                    >
                      {usedIngredientIds.includes(item.id) && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <span className={`text-sm transition-colors ${
                      usedIngredientIds.includes(item.id)
                        ? 'text-cream-400 line-through'
                        : 'text-warm-dark'
                    }`}>
                      {item.text}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 저장 버튼 */}
      <div
        className="sticky bottom-0 bg-cream-50 pt-4 mt-6 -mx-5 px-5 border-t border-cream-100"
        style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
      >
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-2xl border border-cream-300 text-warm-brown text-sm font-medium hover:bg-cream-100 transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isGeocoding}
            className="flex-1 py-3 rounded-2xl bg-warm-brown text-white text-sm font-medium hover:bg-warm-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isGeocoding ? '주소 확인 중...' : '저장하기'}
          </button>
        </div>
      </div>
    </form>
  )
}

function LocationField({ form, geoStatus, onLocationChange, onLocationBlur }) {
  return (
    <div>
      <label className={LABEL_CLS}>위치</label>
      <input
        type="text"
        value={form.location}
        onChange={onLocationChange}
        onBlur={onLocationBlur}
        placeholder="예: 서울 마포구 연남동"
        className={INPUT_CLS}
      />
      {geoStatus === 'idle' && !form.location && (
        <p className="text-[11px] text-cream-400 mt-1 ml-1">입력하면 지도에 핀으로 표시돼요</p>
      )}
      {geoStatus === 'idle' && form.location && (
        <p className="text-[11px] text-cream-400 mt-1 ml-1">입력 완료 후 잠시 기다려주세요</p>
      )}
      {geoStatus === 'loading' && (
        <p className="text-[11px] text-warm-light mt-1 ml-1">주소 검색 중...</p>
      )}
      {geoStatus === 'found' && (
        <p className="text-[11px] text-green-600 mt-1 ml-1">지도에 핀으로 표시됩니다</p>
      )}
      {geoStatus === 'notfound' && (
        <p className="text-[11px] text-amber-500 mt-1 ml-1">주소를 찾을 수 없어요. 더 자세히 입력해보세요</p>
      )}
    </div>
  )
}
