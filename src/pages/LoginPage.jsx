import { useState } from 'react'
import { useApp } from '../context/AppContext'

export default function LoginPage() {
  const { signIn } = useApp()
  const [loading, setLoading] = useState(false)

  async function handleKakaoLogin() {
    setLoading(true)
    await signIn()
    // 리다이렉트 후 페이지가 떠나므로 setLoading(false)는 실행 안 됨
  }

  return (
    <div className="min-h-svh bg-cream-50 flex flex-col items-center justify-center px-8">
      {/* 로고 */}
      <div className="flex flex-col items-center mb-10">
        <div className="w-20 h-20 rounded-3xl bg-warm-brown flex items-center justify-center mb-5 shadow-md">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <path d="M8 32V14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M14 32V10" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M20 32V18" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M6 36h28" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="28" cy="14" r="8" fill="white" fillOpacity="0.2" stroke="white" strokeWidth="2"/>
            <path d="M25 14h6M28 11v6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-warm-dark tracking-tight">식탁 일기</h1>
        <p className="text-sm text-warm-light mt-2 text-center leading-relaxed">
          함께한 식사 순간을 기록하고<br />우리만의 맛집 지도를 만들어보세요
        </p>
      </div>

      {/* 기능 소개 */}
      <div className="w-full max-w-xs space-y-3 mb-10">
        {[
          { icon: '📷', text: '사진과 함께 식사 기록' },
          { icon: '🗺️', text: '우리만의 맛집 지도' },
          { icon: '💕', text: '함께 공유하는 식사 다이어리' },
        ].map(({ icon, text }) => (
          <div key={text} className="flex items-center gap-3 bg-cream-100 rounded-2xl px-4 py-3">
            <span className="text-lg">{icon}</span>
            <span className="text-sm text-warm-dark font-medium">{text}</span>
          </div>
        ))}
      </div>

      {/* 카카오 로그인 버튼 */}
      <div className="w-full max-w-xs">
        <button
          onClick={handleKakaoLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-semibold text-sm transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-60 shadow-sm"
          style={{ background: '#FEE500', color: '#3C1E1E' }}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-[#3C1E1E]/30 border-t-[#3C1E1E] rounded-full animate-spin" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#3C1E1E">
              <path d="M12 3C6.477 3 2 6.477 2 10.8c0 2.79 1.63 5.24 4.1 6.73l-1.05 3.85a.25.25 0 0 0 .38.27L9.7 19.2a11.2 11.2 0 0 0 2.3.24C17.523 19.44 22 15.963 22 11.64 22 7.317 17.523 3 12 3z"/>
            </svg>
          )}
          {loading ? '카카오 연결 중...' : '카카오로 시작하기'}
        </button>

        <p className="text-center text-[11px] text-cream-400 mt-4 leading-relaxed">
          로그인 시 서비스 이용약관에 동의하게 됩니다.<br />
          기존 데이터는 로그인 후에도 그대로 유지돼요.
        </p>
      </div>
    </div>
  )
}
