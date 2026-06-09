import { useState, useRef } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import StarRating from '../common/StarRating'

const TAGS = ['집밥', '외식', '카페', '배달']

const emptyForm = {
  restaurantName: '',
  location: '',
  rating: 0,
  review: '',
  memo: '',
  tag: '',
  photo: '',
}

export default function MealForm({ date, onSubmit, onCancel, initial }) {
  const [form, setForm] = useState(initial || emptyForm)
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

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({ ...form, date: format(date, 'yyyy-MM-dd') })
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* 날짜 */}
      <p className="text-xs text-warm-light font-medium mb-4">
        {format(date, 'yyyy년 M월 d일 (eee)', { locale: ko })}
      </p>

      {/* ─── 사진 (메인) ─── */}
      <div className="mb-5">
        {form.photo ? (
          <div className="relative rounded-2xl overflow-hidden">
            <img
              src={form.photo}
              alt="식사 사진"
              className="w-full object-cover"
              style={{ maxHeight: '260px' }}
            />
            <button
              type="button"
              onClick={() => set('photo', '')}
              className="absolute top-3 right-3 bg-black/50 text-white rounded-full w-7 h-7 flex items-center justify-center text-base hover:bg-black/70 transition-colors"
            >
              ×
            </button>
            <button
              type="button"
              onClick={() => fileRef.current.click()}
              className="absolute bottom-3 right-3 bg-black/50 text-white rounded-full px-3 py-1 text-xs hover:bg-black/70 transition-colors"
            >
              바꾸기
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current.click()}
            className="w-full border-2 border-dashed border-cream-300 rounded-2xl flex flex-col items-center justify-center text-cream-400 hover:border-cream-400 hover:bg-cream-100 transition-colors"
            style={{ height: '180px' }}
          >
            <svg className="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm font-medium">사진 추가</span>
            <span className="text-xs mt-0.5 opacity-70">선택사항이에요</span>
          </button>
        )}
        <input
          type="file"
          ref={fileRef}
          accept="image/*"
          className="hidden"
          onChange={handlePhoto}
        />
      </div>

      <div className="space-y-4">
        {/* 식당 이름 */}
        <div>
          <label className="text-xs text-warm-light mb-1.5 block font-medium">식당 이름</label>
          <input
            type="text"
            value={form.restaurantName}
            onChange={e => set('restaurantName', e.target.value)}
            placeholder="어디서 드셨나요?"
            className="w-full px-4 py-3 rounded-2xl bg-cream-100 border border-cream-200 text-sm text-warm-dark placeholder-cream-400 focus:outline-none focus:border-warm-light transition-colors"
          />
        </div>

        {/* 위치 */}
        <div>
          <label className="text-xs text-warm-light mb-1.5 block font-medium">위치</label>
          <input
            type="text"
            value={form.location}
            onChange={e => set('location', e.target.value)}
            placeholder="예: 서울 마포구 연남동"
            className="w-full px-4 py-3 rounded-2xl bg-cream-100 border border-cream-200 text-sm text-warm-dark placeholder-cream-400 focus:outline-none focus:border-warm-light transition-colors"
          />
          <p className="text-[11px] text-cream-400 mt-1 ml-1">입력하면 지도에 핀으로 표시돼요</p>
        </div>

        {/* 별점 */}
        <div>
          <label className="text-xs text-warm-light mb-1.5 block font-medium">별점</label>
          <StarRating value={form.rating} onChange={val => set('rating', val)} />
        </div>

        {/* 한줄평 */}
        <div>
          <label className="text-xs text-warm-light mb-1.5 block font-medium">한줄평</label>
          <input
            type="text"
            value={form.review}
            onChange={e => set('review', e.target.value)}
            placeholder="맛은 어땠나요?"
            className="w-full px-4 py-3 rounded-2xl bg-cream-100 border border-cream-200 text-sm text-warm-dark placeholder-cream-400 focus:outline-none focus:border-warm-light transition-colors"
          />
        </div>

        {/* 메모 */}
        <div>
          <label className="text-xs text-warm-light mb-1.5 block font-medium">메모</label>
          <textarea
            value={form.memo}
            onChange={e => set('memo', e.target.value)}
            placeholder="더 남기고 싶은 이야기가 있나요?"
            rows={3}
            className="w-full px-4 py-3 rounded-2xl bg-cream-100 border border-cream-200 text-sm text-warm-dark placeholder-cream-400 focus:outline-none focus:border-warm-light resize-none transition-colors"
          />
        </div>

        {/* 태그 */}
        <div>
          <label className="text-xs text-warm-light mb-2 block font-medium">태그</label>
          <div className="flex gap-2 flex-wrap">
            {TAGS.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => set('tag', form.tag === tag ? '' : tag)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  form.tag === tag
                    ? 'bg-warm-brown text-white'
                    : 'bg-cream-200 text-warm-brown hover:bg-cream-300'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 버튼 */}
      <div className="flex gap-3 mt-7">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 rounded-2xl border border-cream-300 text-warm-brown text-sm font-medium hover:bg-cream-100 transition-colors"
        >
          취소
        </button>
        <button
          type="submit"
          className="flex-1 py-3 rounded-2xl bg-warm-brown text-white text-sm font-medium hover:bg-warm-dark transition-colors"
        >
          저장하기
        </button>
      </div>
    </form>
  )
}
