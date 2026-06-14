import { useState } from 'react'
import { useApp } from '../context/AppContext'

const FEATURES = [
  {
    text: '사진과 함께 식사 기록',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    text: '우리만의 맛집 지도',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.686 2 6 4.686 6 8c0 4.5 6 12 6 12s6-7.5 6-12c0-3.314-2.686-6-6-6z" />
        <circle cx="12" cy="8" r="2" />
      </svg>
    ),
  },
  {
    text: '함께 공유하는 식사 다이어리',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
]

export default function LoginPage() {
  const { signIn } = useApp()
  const [loading, setLoading] = useState(false)

  async function handleKakaoLogin() {
    setLoading(true)
    await signIn()
    // 리다이렉트 후 페이지가 떠나므로 setLoading(false)는 실행 안 됨
  }

  return (
    <div className="min-h-svh bg-cream-50 flex flex-col">
      <div className="w-full max-w-sm mx-auto px-8 flex-1 flex flex-col">
        {/* 로고 */}
        <div className="flex flex-col items-center pt-20 pb-8">
          <div className="w-20 h-20 bg-warm-brown rounded-2xl flex items-center justify-center mb-6 shadow-sm">
            <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              {/* 포크 */}
              <path d="M5 2v6a2 2 0 0 0 2 2v12M9 2v6a2 2 0 0 1-2 2" />
              {/* 스푼 */}
              <path d="M16 2c-1.7 0-3 1.8-3 4s1.3 4 3 4 3-1.8 3-4-1.3-4-3-4zM16 10v12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-warm-dark tracking-tight">식탁 일기</h1>
          <p className="text-sm text-warm-light mt-2 text-center leading-relaxed">
            함께한 식사 순간을 기록하고<br />
            우리만의 맛집 지도를 만들어보세요
          </p>
        </div>

        {/* 기능 소개 */}
        <div className="space-y-3 mb-10">
          {FEATURES.map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 border border-cream-200">
              <span className="text-warm-brown shrink-0">{icon}</span>
              <span className="text-sm text-warm-dark">{text}</span>
            </div>
          ))}
        </div>

        {/* 카카오 로그인 버튼 — 하단 고정 */}
        <div className="mt-auto pb-10">
          <button
            onClick={handleKakaoLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-base transition-transform active:scale-[0.99] disabled:opacity-60"
            style={{ background: '#FEE500', color: '#191919' }}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-[#191919]/30 border-t-[#191919] rounded-full animate-spin" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#191919">
                <path d="M12 3C6.477 3 2 6.477 2 10.8c0 2.79 1.63 5.24 4.1 6.73l-1.05 3.85a.25.25 0 0 0 .38.27L9.7 19.2a11.2 11.2 0 0 0 2.3.24C17.523 19.44 22 15.963 22 11.64 22 7.317 17.523 3 12 3z" />
              </svg>
            )}
            {loading ? '카카오 연결 중...' : '카카오로 시작하기'}
          </button>

          <p className="text-xs text-cream-400 text-center mt-4 leading-relaxed">
            로그인 시 서비스 이용약관에 동의하게 됩니다.<br />
            기존 데이터는 로그인 후에도 그대로 유지돼요.
          </p>
        </div>
      </div>
    </div>
  )
}
