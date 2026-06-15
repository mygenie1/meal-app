import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'

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
  const [authTab, setAuthTab] = useState('kakao')
  const [emailMode, setEmailMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showEmailSent, setShowEmailSent] = useState(false)

  async function handleKakaoLogin() {
    setLoading(true)
    await signIn()
    // 리다이렉트 후 페이지가 떠나므로 setLoading(false)는 실행 안 됨
  }

  async function handleEmailLogin() {
    if (!email.includes('@')) { setError('올바른 이메일을 입력해주세요'); return }
    setLoading(true)
    setError('')
    try {
      const { error: e } = await supabase.auth.signInWithPassword({ email, password })
      if (e) {
        setError(e.message.includes('Invalid login') || e.message.includes('invalid_credentials')
          ? '이메일 또는 비밀번호가 올바르지 않아요'
          : e.message)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleEmailSignup() {
    if (!email.includes('@')) { setError('올바른 이메일을 입력해주세요'); return }
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 해요'); return }
    setLoading(true)
    setError('')
    try {
      const { data, error: e } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name: nickname || email.split('@')[0], avatar_url: '' },
        },
      })
      if (e) {
        setError(e.message)
      } else if (!data.session) {
        // 이메일 인증 필요 (세션 없음)
        setShowEmailSent(true)
      }
      // data.session이 있으면 AppContext onAuthStateChange가 자동 로그인 처리
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword() {
    if (!email.includes('@')) { setError('이메일을 먼저 입력해주세요'); return }
    setError('')
    const { error: e } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://meal-app-nine-snowy.vercel.app/reset-password',
    })
    if (!e) alert('비밀번호 재설정 링크를 이메일로 보내드렸어요')
  }

  function switchTab(tab) {
    setAuthTab(tab)
    setError('')
    setShowEmailSent(false)
  }

  function switchMode(mode) {
    setEmailMode(mode)
    setError('')
  }

  return (
    <div className="min-h-svh bg-cream-50 flex flex-col">
      <div className="w-full max-w-sm mx-auto px-8 flex-1 flex flex-col">
        {/* 로고 */}
        <div className="flex flex-col items-center pt-16 pb-6">
          <div className="w-16 h-16 bg-warm-brown rounded-2xl flex items-center justify-center mb-4 shadow-sm">
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 2v6a2 2 0 0 0 2 2v12M9 2v6a2 2 0 0 1-2 2" />
              <path d="M16 2c-1.7 0-3 1.8-3 4s1.3 4 3 4 3-1.8 3-4-1.3-4-3-4zM16 10v12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-warm-dark tracking-tight">식탁 일기</h1>
          <p className="text-sm text-warm-light mt-1.5 text-center leading-relaxed">
            함께한 식사 순간을 기록하고<br />
            우리만의 맛집 지도를 만들어보세요
          </p>
        </div>

        {/* 기능 소개 */}
        <div className="space-y-2.5 mb-6">
          {FEATURES.map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 border border-cream-200">
              <span className="text-warm-brown shrink-0">{icon}</span>
              <span className="text-sm text-warm-dark">{text}</span>
            </div>
          ))}
        </div>

        {/* 로그인 영역 */}
        <div className="mt-auto pb-10">
          {/* 탭 전환 */}
          <div className="flex bg-cream-100 rounded-2xl p-1 mb-5">
            <button
              onClick={() => switchTab('kakao')}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all
                ${authTab === 'kakao' ? 'bg-white text-warm-dark shadow-sm' : 'text-warm-light'}`}>
              카카오로 시작
            </button>
            <button
              onClick={() => switchTab('email')}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all
                ${authTab === 'email' ? 'bg-white text-warm-dark shadow-sm' : 'text-warm-light'}`}>
              이메일로 시작
            </button>
          </div>

          {authTab === 'kakao' ? (
            <>
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
            </>
          ) : showEmailSent ? (
            /* 인증 이메일 발송 안내 */
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-cream-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-warm-brown" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-bold text-warm-dark mb-2">인증 이메일을 보냈어요</h3>
              <p className="text-sm text-warm-light leading-relaxed">
                {email}로 인증 링크를 보냈어요.<br />
                이메일을 확인하고 링크를 클릭해주세요.<br /><br />
                <span className="text-warm-brown font-medium">
                  이메일이 안 보이면 스팸함도 확인해주세요 😊
                </span>
              </p>
              <button
                onClick={() => setShowEmailSent(false)}
                className="mt-6 text-sm text-warm-brown font-medium">
                다시 입력하기
              </button>
            </div>
          ) : (
            /* 이메일 폼 */
            <>
              {/* 로그인 / 회원가입 모드 전환 */}
              <div className="flex justify-center gap-6 mb-5">
                <button
                  onClick={() => switchMode('login')}
                  className={`text-sm font-medium pb-1 border-b-2 transition-all
                    ${emailMode === 'login' ? 'border-warm-brown text-warm-dark' : 'border-transparent text-cream-400'}`}>
                  로그인
                </button>
                <button
                  onClick={() => switchMode('signup')}
                  className={`text-sm font-medium pb-1 border-b-2 transition-all
                    ${emailMode === 'signup' ? 'border-warm-brown text-warm-dark' : 'border-transparent text-cream-400'}`}>
                  회원가입
                </button>
              </div>

              {/* 닉네임 (회원가입 시에만) */}
              {emailMode === 'signup' && (
                <input
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  placeholder="닉네임"
                  style={{ fontSize: 16 }}
                  className="w-full px-4 py-3 rounded-xl border border-cream-300 bg-cream-50 text-warm-dark outline-none focus:border-warm-light mb-3"
                />
              )}

              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="이메일"
                style={{ fontSize: 16 }}
                className="w-full px-4 py-3 rounded-xl border border-cream-300 bg-cream-50 text-warm-dark outline-none focus:border-warm-light mb-3"
              />

              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="비밀번호 (6자 이상)"
                style={{ fontSize: 16 }}
                className="w-full px-4 py-3 rounded-xl border border-cream-300 bg-cream-50 text-warm-dark outline-none focus:border-warm-light mb-4"
                onKeyDown={e => e.key === 'Enter' && (emailMode === 'login' ? handleEmailLogin() : handleEmailSignup())}
              />

              {error && (
                <p className="text-xs text-red-400 mb-3 text-center">{error}</p>
              )}

              <button
                onClick={emailMode === 'login' ? handleEmailLogin : handleEmailSignup}
                disabled={loading || !email || !password}
                className="w-full bg-warm-brown text-white rounded-2xl py-4 font-semibold disabled:opacity-50 transition-transform active:scale-[0.99]">
                {loading ? '처리 중...' : emailMode === 'login' ? '로그인' : '회원가입'}
              </button>

              {emailMode === 'login' && (
                <button
                  onClick={handleResetPassword}
                  className="w-full text-xs text-cream-400 mt-3 py-2">
                  비밀번호를 잊으셨나요?
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
