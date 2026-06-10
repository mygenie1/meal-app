import { useState, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useApp } from '../../context/AppContext'

// ─── EXIF 날짜 추출 (바이너리 스캔) ─────────────────────────────────────
function extractExifDate(buffer) {
  const bytes = new Uint8Array(buffer.slice(0, 65536))
  let str = ''
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i])
  const m = str.match(/(\d{4}):(\d{2}):(\d{2}) \d{2}:\d{2}:\d{2}/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return null
}

// ─── 이미지 압축 (캔버스, max 1200px) ───────────────────────────────────
function compressImage(file) {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 1200
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX }
        else { width = Math.round((width * MAX) / height); height = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
      URL.revokeObjectURL(url)
    }
    img.onerror = () => { resolve(null); URL.revokeObjectURL(url) }
    img.src = url
  })
}

const TAGS = ['집밥', '외식', '카페', '배달']
const MEAL_TIMES = ['아침', '점심', '저녁']
const TAG_STYLE = {
  집밥: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', sel: 'bg-green-100 border-green-400' },
  외식: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', sel: 'bg-amber-100 border-amber-400' },
  카페: { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', sel: 'bg-pink-100 border-pink-400' },
  배달: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', sel: 'bg-blue-100 border-blue-400' },
}

export default function BulkPhotoUpload({ onClose }) {
  const { currentSpace, addMeal } = useApp()
  const [phase, setPhase] = useState('idle')
  const [groups, setGroups] = useState([])
  const [tag, setTag] = useState('외식')
  const [mealTime, setMealTime] = useState('')
  const [progress, setProgress] = useState(0)
  const [savedCount, setSavedCount] = useState(0)
  const fileRef = useRef()

  async function handleFiles(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setPhase('loading')
    setProgress(0)

    const today = format(new Date(), 'yyyy-MM-dd')
    const results = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      let date = today

      try {
        const buf = await file.arrayBuffer()
        const exifDate = extractExifDate(buf)
        if (exifDate) date = exifDate
      } catch {}

      const compressed = await compressImage(file)
      if (compressed) results.push({ date, photo: compressed })
      setProgress(Math.round(((i + 1) / files.length) * 100))
    }

    // 날짜별로 묶기
    const grouped = {}
    results.forEach(({ date, photo }) => {
      if (!grouped[date]) grouped[date] = []
      grouped[date].push(photo)
    })

    const groupList = Object.entries(grouped)
      .map(([date, photos]) => ({ date, photos }))
      .sort((a, b) => a.date.localeCompare(b.date))

    setGroups(groupList)
    setPhase('preview')
    e.target.value = ''
  }

  async function handleSave() {
    setPhase('saving')
    setSavedCount(0)
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i]
      await addMeal({
        date: g.date, tag, mealTime,
        photos: g.photos, photo: g.photos[0],
        title: '', restaurantName: '', location: '',
        lat: null, lng: null, rating: 0, review: '', memo: '',
      })
      setSavedCount(i + 1)
    }
    setPhase('done')
  }

  // ── idle ──────────────────────────────────────────────────────────────
  if (phase === 'idle') {
    return (
      <div>
        <p className="text-sm text-warm-light leading-relaxed mb-5">
          여러 장의 사진을 한 번에 올리면 EXIF 날짜를 읽어 날짜별로 자동 묶어 저장해요.
        </p>
        <button
          type="button"
          onClick={() => fileRef.current.click()}
          className="w-full border-2 border-dashed border-cream-300 rounded-2xl flex flex-col items-center justify-center text-cream-400 hover:border-cream-400 hover:bg-cream-50 transition-colors py-12"
        >
          <svg className="w-10 h-10 mb-2 opacity-50" fill="none" stroke="currentColor" strokeWidth="1.4" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-medium text-warm-light">사진 선택</span>
          <span className="text-xs mt-1 opacity-70">여러 장 동시 선택 가능</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFiles}
        />
        <button
          type="button"
          onClick={onClose}
          className="w-full mt-3 py-3 rounded-2xl border border-cream-300 text-warm-brown text-sm font-medium hover:bg-cream-100 transition-colors"
        >
          취소
        </button>
      </div>
    )
  }

  // ── loading ───────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-12 h-12 border-3 border-cream-200 border-t-warm-brown rounded-full animate-spin mb-5"
          style={{ borderWidth: '3px' }} />
        <p className="text-sm font-medium text-warm-dark mb-1">사진 분석 중</p>
        <p className="text-xs text-warm-light">EXIF 날짜를 읽고 있어요 ({progress}%)</p>
        <div className="w-48 h-1.5 bg-cream-200 rounded-full mt-4 overflow-hidden">
          <div
            className="h-full bg-warm-brown rounded-full transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    )
  }

  // ── preview ───────────────────────────────────────────────────────────
  if (phase === 'preview') {
    const totalPhotos = groups.reduce((acc, g) => acc + g.photos.length, 0)

    return (
      <div>
        <p className="text-sm text-warm-light mb-3">
          사진 {totalPhotos}장 → {groups.length}개 날짜로 묶었어요
        </p>

        {/* 태그 선택 */}
        <div className="mb-4">
          <p className="text-xs text-warm-light mb-2 font-medium">태그 (모든 기록에 적용)</p>
          <div className="flex gap-2">
            {TAGS.map(t => {
              const s = TAG_STYLE[t]
              const active = tag === t
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTag(t)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors active:scale-95 ${
                    active ? `${s.sel} ${s.text}` : `${s.bg} ${s.border} ${s.text} opacity-60`
                  }`}
                >
                  {t}
                </button>
              )
            })}
          </div>
        </div>

        {/* 끼니 선택 */}
        <div className="mb-5">
          <p className="text-xs text-warm-light mb-2 font-medium">끼니 (모든 기록에 적용)</p>
          <div className="flex gap-2">
            {MEAL_TIMES.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setMealTime(prev => prev === t ? '' : t)}
                className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors active:scale-95 ${
                  mealTime === t
                    ? 'bg-warm-brown text-white border-warm-brown'
                    : 'bg-cream-100 text-warm-light border-cream-200 hover:bg-cream-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* 날짜별 그룹 미리보기 */}
        <div className="space-y-3 mb-5 max-h-64 overflow-y-auto">
          {groups.map(g => (
            <div key={g.date} className="bg-cream-100 rounded-2xl p-3">
              <p className="text-xs font-semibold text-warm-dark mb-2">
                {format(parseISO(g.date), 'yyyy년 M월 d일 (eee)', { locale: ko })}
                <span className="ml-1.5 text-warm-light font-normal">{g.photos.length}장</span>
              </p>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {g.photos.map((p, i) => (
                  <img
                    key={i}
                    src={p}
                    alt={`사진 ${i + 1}`}
                    className="shrink-0 w-14 h-14 object-cover rounded-xl"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div
          className="sticky bottom-0 bg-cream-50 pt-3 -mx-5 px-5 border-t border-cream-100"
          style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
        >
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setGroups([]); setPhase('idle') }}
              className="flex-1 py-3 rounded-2xl border border-cream-300 text-warm-brown text-sm font-medium hover:bg-cream-100 transition-colors"
            >
              다시 선택
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 py-3 rounded-2xl bg-warm-brown text-white text-sm font-medium hover:bg-warm-dark transition-colors"
            >
              {groups.length}개 날짜 저장
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── saving ────────────────────────────────────────────────────────────
  if (phase === 'saving') {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-12 h-12 border-3 border-cream-200 border-t-warm-brown rounded-full animate-spin mb-5"
          style={{ borderWidth: '3px' }} />
        <p className="text-sm font-medium text-warm-dark mb-1">저장 중</p>
        <p className="text-xs text-warm-light">{savedCount} / {groups.length}</p>
      </div>
    )
  }

  // ── done ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className="font-semibold text-warm-dark mb-1">저장 완료!</p>
      <p className="text-sm text-warm-light mb-6">{groups.length}개 날짜의 식사 기록이 추가됐어요</p>
      <button
        type="button"
        onClick={onClose}
        className="bg-warm-brown text-white px-8 py-3 rounded-2xl text-sm font-medium hover:bg-warm-dark transition-colors"
      >
        닫기
      </button>
    </div>
  )
}
