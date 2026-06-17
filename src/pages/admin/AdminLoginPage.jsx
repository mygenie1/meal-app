import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { decodeAdminToken } from './AdminGuard'

const ADMIN_AUTH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-auth`

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!username.trim() || !password) return
    setError('')
    setLoading(true)

    try {
      const res = await fetch(ADMIN_AUTH_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username: username.trim(), password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '로그인 실패')
        return
      }

      // 토큰 유효성 간단 확인 후 저장
      const decoded = decodeAdminToken(data.token)
      if (!decoded) {
        setError('토큰 형식 오류 — 관리자에게 문의하세요')
        return
      }

      sessionStorage.setItem('admin_token', data.token)
      navigate('/admin', { replace: true })
    } catch {
      setError('네트워크 오류 — 다시 시도해주세요')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-svh bg-stone-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-warm-brown mb-4">
            <svg width="24" height="24" fill="none" stroke="white" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-warm-dark">관리자 로그인</h1>
          <p className="text-sm text-warm-light mt-1">식탁일기 관리자 전용</p>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-warm-light mb-1.5">아이디</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="관리자 아이디"
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl bg-cream-100 border border-cream-300
                text-sm text-warm-dark placeholder-cream-400
                focus:outline-none focus:ring-2 focus:ring-warm-brown/30 focus:border-warm-brown
                disabled:opacity-50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-warm-light mb-1.5">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="비밀번호"
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl bg-cream-100 border border-cream-300
                text-sm text-warm-dark placeholder-cream-400
                focus:outline-none focus:ring-2 focus:ring-warm-brown/30 focus:border-warm-brown
                disabled:opacity-50 transition-colors"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="w-full py-3 rounded-xl bg-warm-brown text-white text-sm font-semibold
              hover:bg-warm-dark transition-colors active:scale-95
              disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <p className="text-center text-xs text-stone-400 mt-6">
          이 페이지는 관리자 전용입니다
        </p>
      </div>
    </div>
  )
}
