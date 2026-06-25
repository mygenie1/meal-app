import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'

// 실제 제공 기능만 — 과장/허위 없이. 비로그인 크롤러가 읽는 유일한 콘텐츠(SEO)이므로 텍스트로 렌더.
const FEATURES = [
  {
    title: '함께 기록하는 식사',
    desc: '집밥·외식·카페·배달을 사진과 별점, 메모로 남겨요. 달력으로 그날의 식탁을 한눈에.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: '우리만의 맛집 지도',
    desc: '다녀온 곳과 가보고 싶은 곳을 지도에 핀으로. 우리끼리만 아는 맛집 지도를 만들어요.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.686 2 6 4.686 6 8c0 4.5 6 12 6 12s6-7.5 6-12c0-3.314-2.686-6-6-6z" />
        <circle cx="12" cy="8" r="2" />
      </svg>
    ),
  },
  {
    title: '함께 공유하는 식탁',
    desc: '가족·연인·친구를 초대해 서로의 기록에 별점과 댓글을 남기고, 새 기록은 알림으로 연결돼요.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
        <circle cx="9" cy="7" r="3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 20c0-3.314 2.686-5 6-5s6 1.686 6 5" />
        <circle cx="17" cy="7" r="2.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 20c0-2.761-1.79-4.5-4.5-4.5" />
      </svg>
    ),
  },
  {
    title: '냉장고 재료 관리',
    desc: '살 것과 남은 재료를 정리하고, 남은 재료로 집밥을 기록하면 수량이 자동으로 차감돼요.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
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
        const msg = e.message
        setError(
          msg.includes('already registered') || msg.includes('already in use')
            ? '이미 가입된 이메일이에요. 아래 로그인 탭에서 로그인해 주세요.'
            : msg
        )
      } else if (data.user?.identities?.length === 0) {
        // Email Enumeration Protection: 중복 이메일을 error 없이 identities:[]로 반환
        setError('이미 가입된 이메일이에요. 아래 로그인 탭에서 로그인해 주세요.')
      } else if (!data.session) {
        // 정상 신규 가입 — 이메일 인증 대기
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
      redirectTo: 'https://siktakilgi.com/reset-password',
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

  function scrollToStart() {
    document.getElementById('start')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-svh bg-cream-50">
      <div className="w-full max-w-md mx-auto px-6 pb-12">
        {/* ── 히어로 ───────────────────────────── */}
        <header
          className="flex flex-col items-center text-center pb-10"
          style={{ paddingTop: 'calc(3.5rem + env(safe-area-inset-top))' }}
        >
          <img
            src="/icon.svg"
            alt="식탁일기 로고"
            width="80"
            height="80"
            className="w-20 h-20 rounded-[1.4rem] shadow-sm mb-5"
          />
          <p className="text-[11px] font-bold tracking-[0.2em] text-warm-brown/70 mb-2">함께 먹는 사람들의 식사 다이어리</p>
          <h1 className="text-[2rem] leading-tight font-bold text-warm-dark tracking-tight">식탁일기</h1>
          <p className="text-[15px] text-warm-light mt-3 leading-relaxed max-w-[19rem]">
            함께한 식사 순간을 사진으로 기록하고,
            우리만의 맛집 지도를 만들어요.
          </p>
          <button
            onClick={scrollToStart}
            className="mt-7 inline-flex items-center gap-1.5 bg-warm-brown text-white px-6 py-3 rounded-full text-sm font-semibold shadow-sm hover:bg-warm-dark transition-colors active:scale-[0.98]"
          >
            지금 시작하기
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
          </button>
        </header>

        {/* ── 기능 소개 (실제 텍스트 — SEO) ─────────── */}
        <section className="pb-12">
          <div className="text-center mb-6">
            <p className="text-[11px] font-bold tracking-[0.2em] text-warm-brown mb-1.5">WHAT YOU CAN DO</p>
            <h2 className="text-lg font-bold text-warm-dark">식탁일기로 할 수 있는 것</h2>
          </div>
          <div className="space-y-3">
            {FEATURES.map(({ icon, title, desc }) => (
              <div key={title} className="flex gap-4 bg-white rounded-2xl px-4 py-4 border border-cream-200 shadow-sm">
                <span className="shrink-0 w-11 h-11 rounded-xl bg-cream-100 text-warm-brown flex items-center justify-center">
                  {icon}
                </span>
                <div className="min-w-0 pt-0.5">
                  <h3 className="text-[15px] font-semibold text-warm-dark mb-1">{title}</h3>
                  <p className="text-[13px] text-warm-light leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 로그인 영역 (기존 로직·문구 그대로 보존) ── */}
        <section id="start" className="scroll-mt-6 pt-2">
          <div className="text-center mb-6">
            <h2 className="text-lg font-bold text-warm-dark">지금 바로 시작해요</h2>
            <p className="text-[13px] text-warm-light mt-1">카카오 또는 이메일로 간편하게</p>
          </div>
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
                로그인 시{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline text-warm-light">이용약관</a>
                {' '}및{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline text-warm-light">개인정보처리방침</a>
                에 동의하게 됩니다.<br />
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

              {emailMode === 'signup' && (
                <p className="text-xs text-cream-400 text-center mt-3 leading-relaxed">
                  가입을 진행하면{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline text-warm-light">이용약관</a>
                  {' '}및{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline text-warm-light">개인정보처리방침</a>
                  에 동의하는 것으로 간주됩니다.
                </p>
              )}
            </>
          )}
        </section>

        {/* ── 푸터 ───────────────────────────── */}
        <footer className="pt-10 pb-6 text-center">
          <p className="text-xs text-cream-400 leading-relaxed">
            운영: 팀 마이지니 · 문의 admin@siktakilgi.com
          </p>
          <div className="flex items-center justify-center gap-3 mt-2 text-xs">
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-warm-light underline">이용약관</a>
            <span className="text-cream-300">·</span>
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-warm-light underline">개인정보처리방침</a>
          </div>
        </footer>
      </div>
    </div>
  )
}
