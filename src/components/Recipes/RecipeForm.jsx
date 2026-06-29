import { useState, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { uploadPhotoToStorage } from '../../lib/uploadPhoto'

// 외부 링크 검증 — 빈 값 허용, http(s):// 만 통과
export function isValidHttpUrl(str) {
  if (!str) return true
  try {
    const u = new URL(str)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

// 레시피 추가/수정 폼 — 부모(RecipeList)의 Modal 안에 렌더됨
// initial: 수정 시 기존 레시피 객체 / null이면 신규
export default function RecipeForm({ initial, onSubmit, onCancel }) {
  const { currentSpace } = useApp()
  const [name, setName] = useState(initial?.name || '')
  const [memo, setMemo] = useState(initial?.memo || '')
  const [linkUrl, setLinkUrl] = useState(initial?.linkUrl || '')
  const [photoPreview, setPhotoPreview] = useState(initial?.photo || '')
  const [ingredients, setIngredients] = useState(
    initial?.ingredients?.length
      ? initial.ingredients.map(i => ({ name: i.name, amount: i.amount || '', unit: i.unit || '' }))
      : [{ name: '', amount: '', unit: '' }]
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const photoRef = useRef(null)

  function handlePhotoPick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPhotoPreview(reader.result)
    reader.readAsDataURL(file)
  }

  function updateIngredient(idx, field, val) {
    setIngredients(prev => prev.map((ing, i) => (i === idx ? { ...ing, [field]: val } : ing)))
  }
  function addIngredientRow() {
    setIngredients(prev => [...prev, { name: '', amount: '', unit: '' }])
  }
  function removeIngredientRow(idx) {
    setIngredients(prev => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError('레시피 이름을 입력해주세요'); return }
    if (linkUrl.trim() && !isValidHttpUrl(linkUrl.trim())) {
      setError('링크는 http:// 또는 https:// 로 시작하는 주소만 가능해요')
      return
    }
    setError('')
    setSaving(true)
    try {
      // 사진: 새로 고른 data: URL이면 업로드, 그대로면 기존 URL 유지, 지웠으면 빈 값
      let photoUrl = initial?.photo || ''
      if (!photoPreview) {
        photoUrl = ''
      } else if (photoPreview !== initial?.photo) {
        photoUrl = photoPreview.startsWith('data:')
          ? await uploadPhotoToStorage(photoPreview, currentSpace?.id)
          : photoPreview
      }

      const cleanIngredients = ingredients
        .map(i => ({ name: i.name.trim(), amount: (i.amount || '').trim(), unit: (i.unit || '').trim() }))
        .filter(i => i.name)

      await onSubmit({
        name: name.trim(),
        memo: memo.trim(),
        linkUrl: linkUrl.trim(),
        photo: photoUrl,
        ingredients: cleanIngredients,
      })
      // 성공 시 부모가 모달을 닫음
    } catch (err) {
      console.error('[RecipeForm] 저장 실패:', err)
      setError('저장에 실패했어요. 다시 시도해주세요')
      setSaving(false)
    }
  }

  const labelCls = 'block text-xs font-medium text-warm-light mb-1.5'
  const inputCls =
    'w-full min-w-0 px-3 py-2.5 rounded-xl bg-cream-100 border border-cream-300 text-base text-warm-dark placeholder-cream-400 focus:outline-none focus:border-warm-light'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 대표 사진 */}
      <div>
        <span className={labelCls}>대표 사진 (선택)</span>
        {photoPreview ? (
          <div className="relative">
            <img src={photoPreview} alt="" className="w-full h-40 object-cover rounded-2xl" />
            <button
              type="button"
              onClick={() => { setPhotoPreview(''); if (photoRef.current) photoRef.current.value = '' }}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center text-lg leading-none"
              aria-label="사진 삭제"
            >
              ×
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => photoRef.current?.click()}
            className="w-full h-28 rounded-2xl border-2 border-dashed border-cream-300 bg-cream-100 flex flex-col items-center justify-center text-cream-400 hover:border-warm-light transition-colors"
          >
            <svg className="w-7 h-7 mb-1" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-xs">사진 추가</span>
          </button>
        )}
        <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoPick} />
      </div>

      {/* 이름 */}
      <div>
        <label className={labelCls}>이름 *</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="예) 김치찌개"
          className={inputCls}
        />
      </div>

      {/* 메모 / 조리법 */}
      <div>
        <label className={labelCls}>메모 (조리법 등)</label>
        <textarea
          value={memo}
          onChange={e => setMemo(e.target.value)}
          placeholder="재료 손질, 조리 순서, 팁 등을 자유롭게 적어요"
          rows={4}
          className={`${inputCls} resize-none`}
        />
      </div>

      {/* 외부 링크 */}
      <div>
        <label className={labelCls}>외부 링크 (유튜브 등)</label>
        <input
          type="url"
          inputMode="url"
          value={linkUrl}
          onChange={e => setLinkUrl(e.target.value)}
          placeholder="https://..."
          className={inputCls}
        />
      </div>

      {/* 재료 목록 */}
      <div>
        <span className={labelCls}>재료</span>
        <div className="space-y-2">
          {ingredients.map((ing, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={ing.name}
                onChange={e => updateIngredient(idx, 'name', e.target.value)}
                placeholder="재료명"
                className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-cream-100 border border-cream-300 text-base text-warm-dark placeholder-cream-400 focus:outline-none focus:border-warm-light"
              />
              <input
                type="text"
                value={ing.amount}
                onChange={e => updateIngredient(idx, 'amount', e.target.value)}
                placeholder="수량"
                className="w-16 shrink-0 px-2 py-2 rounded-xl bg-cream-100 border border-cream-300 text-base text-warm-dark placeholder-cream-400 focus:outline-none focus:border-warm-light text-center"
              />
              <input
                type="text"
                value={ing.unit}
                onChange={e => updateIngredient(idx, 'unit', e.target.value)}
                placeholder="단위"
                className="w-16 shrink-0 px-2 py-2 rounded-xl bg-cream-100 border border-cream-300 text-base text-warm-dark placeholder-cream-400 focus:outline-none focus:border-warm-light text-center"
              />
              <button
                type="button"
                onClick={() => removeIngredientRow(idx)}
                className="shrink-0 w-8 h-8 rounded-lg text-cream-400 hover:text-warm-brown hover:bg-cream-200 flex items-center justify-center transition-colors disabled:opacity-30"
                disabled={ingredients.length <= 1}
                aria-label="재료 삭제"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addIngredientRow}
          className="mt-2 text-sm text-warm-brown font-medium hover:text-warm-dark transition-colors"
        >
          + 재료 추가
        </button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* 저장 / 취소 */}
      <div
        className="flex gap-2 pt-2 sticky bottom-0 bg-cream-50"
        style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex-1 py-3 rounded-2xl bg-cream-200 text-warm-dark font-medium transition-colors active:scale-95 disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-[2] py-3 rounded-2xl bg-warm-brown text-white font-medium hover:bg-warm-dark transition-colors active:scale-95 disabled:opacity-50"
        >
          {saving ? '저장 중...' : initial ? '수정 완료' : '레시피 저장'}
        </button>
      </div>
    </form>
  )
}
