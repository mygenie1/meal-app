import { useState, useEffect } from 'react'
import Modal from '../common/Modal'
import { useApp } from '../../context/AppContext'
import { version } from '../../../package.json'

export default function SettingsModal({ isOpen, onClose }) {
  const { user, signOut, updateProfile } = useApp()

  const [nickname, setNickname] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveState, setSaveState] = useState('idle') // idle | saved | error

  // 모달 열릴 때마다 현재 닉네임으로 초기화
  useEffect(() => {
    if (isOpen) {
      setNickname(
        user?.user_metadata?.name ||
        user?.user_metadata?.full_name ||
        ''
      )
      setSaveState('idle')
    }
  }, [isOpen, user])

  const avatarUrl = user?.user_metadata?.avatar_url
  const displayEmail = user?.email || ''

  async function handleSaveNickname() {
    const trimmed = nickname.trim()
    if (!trimmed) return
    setSaving(true)
    const ok = await updateProfile({ name: trimmed })
    setSaving(false)
    setSaveState(ok ? 'saved' : 'error')
    if (ok) setTimeout(() => setSaveState('idle'), 2000)
  }

  function handleSignOut() {
    if (confirm('로그아웃 할까요?')) {
      onClose()
      signOut()
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="설정">
      <div className="space-y-6 pb-2">

        {/* ── 프로필 ── */}
        <section>
          <p className="text-[11px] font-semibold text-warm-light tracking-widest uppercase mb-3">프로필</p>
          <div className="bg-white rounded-2xl border border-cream-200 overflow-hidden">

            {/* 아바타 + 이메일 */}
            <div className="flex items-center gap-3 px-4 py-4 border-b border-cream-100">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="프로필 사진"
                  className="w-14 h-14 rounded-full object-cover shrink-0 ring-2 ring-cream-200"
                />
              ) : (
                <div
                  className="w-14 h-14 rounded-full shrink-0 flex items-center justify-center ring-2 ring-cream-200"
                  style={{ background: '#FEE500' }}
                >
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="#3C1E1E">
                    <path d="M12 3C6.477 3 2 6.477 2 10.8c0 2.79 1.63 5.24 4.1 6.73l-1.05 3.85a.25.25 0 0 0 .38.27L9.7 19.2a11.2 11.2 0 0 0 2.3.24C17.523 19.44 22 15.963 22 11.64 22 7.317 17.523 3 12 3z" />
                  </svg>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[11px] text-cream-400 mb-0.5">카카오 계정</p>
                <p className="text-sm text-warm-dark font-medium truncate">{displayEmail}</p>
              </div>
            </div>

            {/* 닉네임 수정 */}
            <div className="px-4 py-3.5">
              <label className="text-xs text-warm-light block mb-2">닉네임</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nickname}
                  onChange={e => { setNickname(e.target.value); setSaveState('idle') }}
                  onKeyDown={e => e.key === 'Enter' && handleSaveNickname()}
                  placeholder="닉네임 입력"
                  maxLength={20}
                  className="flex-1 px-3 py-2 rounded-xl bg-cream-50 border border-cream-200 text-sm text-warm-dark placeholder-cream-400 focus:outline-none focus:border-warm-light transition-colors"
                />
                <button
                  onClick={handleSaveNickname}
                  disabled={saving || !nickname.trim()}
                  className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-colors shrink-0 disabled:opacity-50 ${
                    saveState === 'saved'
                      ? 'bg-green-500 text-white'
                      : saveState === 'error'
                      ? 'bg-red-400 text-white'
                      : 'bg-warm-brown text-white hover:bg-warm-dark'
                  }`}
                >
                  {saving ? '저장 중' : saveState === 'saved' ? '저장됨' : saveState === 'error' ? '실패' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── 앱 설정 ── */}
        <section>
          <p className="text-[11px] font-semibold text-warm-light tracking-widest uppercase mb-3">앱 설정</p>
          <div className="bg-white rounded-2xl border border-cream-200 overflow-hidden divide-y divide-cream-100">

            {/* 알림 (준비 중) */}
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-3">
                <svg className="w-4 h-4 text-cream-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <div>
                  <p className="text-sm text-warm-dark">알림 설정</p>
                  <p className="text-[11px] text-cream-400">준비 중</p>
                </div>
              </div>
              {/* 비활성 토글 */}
              <div className="w-10 h-6 rounded-full bg-cream-200 relative opacity-40 shrink-0 cursor-not-allowed">
                <div className="absolute left-1 top-1 w-4 h-4 rounded-full bg-white shadow-sm" />
              </div>
            </div>

            {/* 앱 버전 */}
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-3">
                <svg className="w-4 h-4 text-cream-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm text-warm-dark">앱 버전</p>
              </div>
              <span className="text-xs text-cream-400 font-mono">v{version}</span>
            </div>
          </div>
        </section>

        {/* ── 계정 ── */}
        <section>
          <p className="text-[11px] font-semibold text-warm-light tracking-widest uppercase mb-3">계정</p>
          <div className="bg-white rounded-2xl border border-cream-200 overflow-hidden divide-y divide-cream-100">

            {/* 로그아웃 */}
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-cream-50 active:bg-cream-100 transition-colors text-left"
            >
              <svg className="w-4 h-4 text-warm-light shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <p className="text-sm text-warm-dark">로그아웃</p>
            </button>

            {/* 회원 탈퇴 (준비 중) */}
            <button
              disabled
              className="w-full flex items-center gap-3 px-4 py-3.5 opacity-40 cursor-not-allowed text-left"
            >
              <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
              </svg>
              <div>
                <p className="text-sm text-red-400">회원 탈퇴</p>
                <p className="text-[11px] text-cream-400">준비 중</p>
              </div>
            </button>
          </div>
        </section>

      </div>
    </Modal>
  )
}
