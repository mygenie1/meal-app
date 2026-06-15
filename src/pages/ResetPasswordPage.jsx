import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleUpdatePassword() {
    if (newPassword.length < 6) { setError('비밀번호는 6자 이상이어야 해요'); return }
    if (newPassword !== confirm) { setError('비밀번호가 일치하지 않아요'); return }
    setLoading(true)
    setError('')
    const { error: e } = await supabase.auth.updateUser({ password: newPassword })
    setLoading(false)
    if (e) {
      setError(e.message)
    } else {
      setDone(true)
      setTimeout(() => navigate('/'), 1500)
    }
  }

  return (
    <div className="min-h-svh bg-cream-50 flex flex-col items-center justify-center px-8">
      <div className="w-full max-w-sm">
        <div className="w-14 h-14 bg-warm-brown rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </div>

        {done ? (
          <div className="text-center">
            <h2 className="text-xl font-bold text-warm-dark mb-2">비밀번호가 변경됐어요</h2>
            <p className="text-sm text-warm-light">잠시 후 홈으로 이동합니다</p>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-warm-dark text-center mb-2">새 비밀번호 설정</h2>
            <p className="text-sm text-warm-light text-center mb-6">새로 사용할 비밀번호를 입력해주세요</p>

            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="새 비밀번호 (6자 이상)"
              style={{ fontSize: 16 }}
              className="w-full px-4 py-3 rounded-xl border border-cream-300 bg-cream-50 text-warm-dark outline-none focus:border-warm-light mb-3"
            />
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="비밀번호 확인"
              style={{ fontSize: 16 }}
              className="w-full px-4 py-3 rounded-xl border border-cream-300 bg-cream-50 text-warm-dark outline-none focus:border-warm-light mb-4"
              onKeyDown={e => e.key === 'Enter' && handleUpdatePassword()}
            />

            {error && (
              <p className="text-xs text-red-400 mb-3 text-center">{error}</p>
            )}

            <button
              onClick={handleUpdatePassword}
              disabled={loading || !newPassword || !confirm}
              className="w-full bg-warm-brown text-white rounded-2xl py-4 font-semibold disabled:opacity-50 transition-transform active:scale-[0.99]">
              {loading ? '변경 중...' : '비밀번호 변경'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
