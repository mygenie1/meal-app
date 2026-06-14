import { useState, useEffect, useRef } from 'react'
import Modal from '../common/Modal'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'
import { uploadPhotoToStorage } from '../../lib/uploadPhoto'

const TYPES = [
  { key: 'bug', label: '버그' },
  { key: 'suggestion', label: '제안' },
  { key: 'praise', label: '칭찬' },
  { key: 'etc', label: '기타' },
]

export default function FeedbackModal({ isOpen, onClose, onSuccess }) {
  const { user } = useApp()
  const [type, setType] = useState('bug')
  const [content, setContent] = useState('')
  const [screenshot, setScreenshot] = useState(null) // base64 미리보기
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setType('bug')
      setContent('')
      setScreenshot(null)
      setError('')
      setSubmitting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [isOpen])

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      setError('JPG 또는 PNG 이미지만 첨부할 수 있어요')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('5MB 이하 이미지만 첨부할 수 있어요')
      return
    }
    setError('')
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = ev => resolve(ev.target.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    setScreenshot(base64)
  }

  function removeScreenshot() {
    setScreenshot(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit() {
    if (!content.trim() || submitting) return
    setSubmitting(true)
    setError('')
    try {
      let screenshotUrl = null
      if (screenshot) {
        const url = await uploadPhotoToStorage(screenshot, 'feedback')
        // 업로드 실패 시 base64가 그대로 반환됨 → URL이 아니면 저장하지 않음
        screenshotUrl = url && url.startsWith('http') ? url : null
      }
      const nickname = user?.user_metadata?.name || user?.user_metadata?.full_name || '멤버'
      const { error: insertError } = await supabase.from('feedback').insert({
        user_id: user?.id || null,
        nickname,
        type,
        content: content.trim(),
        screenshot_url: screenshotUrl,
      })
      if (insertError) throw insertError
      onClose()
      onSuccess?.()
    } catch (err) {
      console.error('[FeedbackModal] 피드백 전송 실패:', err)
      setError('전송에 실패했어요. 잠시 후 다시 시도해주세요.')
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="피드백 보내기">
      <div className="space-y-5 pb-2">
        {/* 안내 문구 */}
        <p className="text-xs text-warm-light leading-relaxed">
          버그, 개선 아이디어, 칭찬 모두 환영해요.<br />
          스크린샷을 함께 보내면 더 빠르게 확인할 수 있어요!
        </p>

        {/* 유형 선택 */}
        <div>
          <label className="text-xs text-warm-light block mb-2">유형</label>
          <div className="flex gap-2 flex-wrap">
            {TYPES.map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setType(t.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  type === t.key
                    ? 'bg-warm-brown text-white'
                    : 'bg-cream-100 text-warm-light hover:bg-cream-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* 내용 입력 */}
        <div>
          <label className="text-xs text-warm-light block mb-2">
            내용 <span className="text-warm-brown">*</span>
          </label>
          <textarea
            value={content}
            onChange={e => { setContent(e.target.value); setError('') }}
            placeholder="어떤 점이 궁금하거나 불편하셨나요?"
            rows={5}
            maxLength={1000}
            className="w-full px-4 py-3 rounded-2xl bg-cream-50 border border-cream-200 text-base text-warm-dark placeholder-cream-400 focus:outline-none focus:border-warm-light transition-colors resize-none"
            style={{ fontSize: '16px' }}
          />
          <p className="text-[11px] text-cream-400 text-right mt-1">{content.length}/1000</p>
        </div>

        {/* 스크린샷 첨부 */}
        <div>
          <label className="text-xs text-warm-light block mb-2">스크린샷 (선택)</label>
          {screenshot ? (
            <div className="relative inline-block">
              <img
                src={screenshot}
                alt="첨부 스크린샷"
                className="w-24 h-24 rounded-2xl object-cover border border-cream-200"
              />
              <button
                type="button"
                onClick={removeScreenshot}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-warm-dark text-white flex items-center justify-center shadow-sm active:scale-90 transition-transform"
                aria-label="스크린샷 삭제"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-24 h-24 rounded-2xl border-2 border-dashed border-cream-300 flex flex-col items-center justify-center gap-1 text-cream-400 hover:bg-cream-50 hover:border-cream-400 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-[11px]">사진 추가</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        {/* 보내기 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={!content.trim() || submitting}
          className="w-full py-3.5 rounded-2xl bg-warm-brown text-white text-sm font-medium hover:bg-warm-dark active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ marginBottom: 'max(8px, env(safe-area-inset-bottom))' }}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              보내는 중…
            </span>
          ) : '보내기'}
        </button>
      </div>
    </Modal>
  )
}
