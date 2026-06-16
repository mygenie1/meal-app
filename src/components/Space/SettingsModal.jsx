import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../common/Modal'
import { useApp } from '../../context/AppContext'
import { uploadAvatar } from '../../lib/uploadPhoto'
import { supabase } from '../../lib/supabase'
import { version } from '../../../package.json'

export default function SettingsModal({ isOpen, onClose }) {
  const navigate = useNavigate()
  const { user, signOut, deleteAccount, updateProfile, notifEnabled, setNotifEnabledPref } = useApp()

  const [nickname, setNickname] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveState, setSaveState] = useState('idle') // idle | saved | error

  // 프로필 사진
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const photoInputRef = useRef(null)

  // 앱 업데이트
  const [checking, setChecking] = useState(false)

  // 개발자 디버그 패널
  const [debugOpen, setDebugOpen] = useState(false)
  const [debugInfo, setDebugInfo] = useState(null)
  const [debugLoading, setDebugLoading] = useState(false)

  // 회원 탈퇴
  const [deleteStep, setDeleteStep] = useState('idle') // idle | confirm1 | confirm2
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setNickname(user?.user_metadata?.name || user?.user_metadata?.full_name || '')
      setSaveState('idle')
      setPhotoError('')
      setDeleteStep('idle')
      setDeleteInput('')
      setDeleteError('')
    }
  }, [isOpen, user])

  const rawAvatarUrl = user?.user_metadata?.avatar_url
  const displayEmail = user?.email || ''
  const provider = user?.app_metadata?.provider
  // 이메일 계정인데 카카오 CDN URL이 저장된 경우 기본 아바타로 대체
  const isKakaoAvatar = rawAvatarUrl?.includes('kakaocdn') || rawAvatarUrl?.includes('k.kakaocdn')
  const avatarUrl = (provider === 'email' && isKakaoAvatar) ? null : rawAvatarUrl
  const providerLabel = provider === 'kakao' ? '카카오'
    : provider === 'email' ? '이메일'
    : provider || '소셜'

  // 닫기 처리: 탈퇴 플로우 중이면 idle로 복귀
  function handleModalClose() {
    if (deleteStep !== 'idle') {
      setDeleteStep('idle')
      setDeleteInput('')
      setDeleteError('')
    } else {
      onClose()
    }
  }

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

  // 프로필 사진 변경
  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      setPhotoError('JPG 또는 PNG 파일만 업로드 가능해요')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('5MB 이하 파일만 업로드 가능해요')
      return
    }

    setPhotoUploading(true)
    setPhotoError('')
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = e => resolve(e.target.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const publicUrl = await uploadAvatar(base64, user.id)
      await updateProfile({ avatar_url: publicUrl })
    } catch (err) {
      console.error('[SettingsModal] 사진 업로드 오류:', err)
      setPhotoError('사진 업로드에 실패했어요. 다시 시도해주세요.')
    } finally {
      setPhotoUploading(false)
      if (photoInputRef.current) photoInputRef.current.value = ''
    }
  }

  // 개발자 디버그 정보 수집
  async function loadDebugInfo() {
    setDebugLoading(true)
    try {
      const permission = 'Notification' in window ? Notification.permission : 'unsupported'
      const hasNotifApi = 'Notification' in window

      let swState = 'unsupported'
      let swScope = ''
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration().catch(() => null)
        if (reg) {
          swState = reg.active ? 'active' : reg.waiting ? 'waiting' : reg.installing ? 'installing' : 'registered'
          swScope = reg.scope || ''
        } else {
          swState = 'not registered'
        }
      }

      const { data: tokenRows } = await supabase
        .from('fcm_tokens')
        .select('token, created_at')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
      const tokenCount = tokenRows?.length ?? 0
      const latestToken = tokenRows?.[0]?.token
      const tokenSuffix = latestToken ? '...' + latestToken.slice(-8) : '없음'

      const isStandalone =
        window.navigator.standalone === true ||
        window.matchMedia('(display-mode: standalone)').matches

      setDebugInfo({ permission, hasNotifApi, swState, swScope, tokenCount, tokenSuffix, isStandalone })
    } catch (err) {
      console.error('[Debug] 정보 로드 실패:', err)
      setDebugInfo({ error: err.message })
    } finally {
      setDebugLoading(false)
    }
  }

  function handleDebugToggle() {
    const next = !debugOpen
    setDebugOpen(next)
    if (next && !debugInfo) loadDebugInfo()
  }

  // 앱 업데이트: 캐시 삭제 후 새로고침
  async function handleCheckUpdate() {
    setChecking(true)
    try {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
      const reg = await navigator.serviceWorker?.getRegistration()
      if (reg) await reg.update().catch(() => {})
    } catch {}
    window.location.reload()
  }

  // 회원 탈퇴 확정
  async function handleDeleteAccount() {
    if (deleteInput !== '탈퇴' || deleting) return
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteAccount()
    } catch (err) {
      console.error('[SettingsModal] 탈퇴 오류:', err)
      setDeleteError('탈퇴 처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.')
      setDeleteStep('idle')
      setDeleteInput('')
      setDeleting(false)
      return
    }
    // 탈퇴 완료 — signOut 에러 무시하고 로그인 페이지로 이동
    try {
      await supabase.auth.signOut()
    } catch (e) {
      // 이미 탈퇴된 계정은 로그아웃 에러 무시
    }
    navigate('/login')
  }

  const modalTitle = deleteStep === 'idle' ? '설정' : '회원 탈퇴'

  return (
    <Modal isOpen={isOpen} onClose={handleModalClose} title={modalTitle}>

      {/* ── 회원 탈퇴 Step 1: 안내 ── */}
      {deleteStep === 'confirm1' && (
        <div className="space-y-5 pb-2">
          <div className="rounded-2xl border border-red-100 bg-red-50 p-4 space-y-2">
            <p className="text-sm font-semibold text-red-600">탈퇴 전 꼭 확인해주세요</p>
            <ul className="space-y-1.5">
              {[
                provider === 'kakao'
                  ? '로그인 정보(카카오 계정 연결)가 해제돼요'
                  : `${providerLabel} 계정 정보가 삭제돼요`,
                '스페이스 멤버에서 자동으로 나가게 돼요',
                '작성한 식사 기록·댓글은 스페이스에 남아요',
                '탈퇴 후 같은 계정으로 재가입해도 이전 데이터와 연결되지 않아요',
              ].map(t => (
                <li key={t} className="flex items-start gap-2 text-xs text-red-500">
                  <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setDeleteStep('idle')}
              className="flex-1 py-3 rounded-xl border border-cream-300 text-sm text-warm-dark font-medium hover:bg-cream-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={() => setDeleteStep('confirm2')}
              className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 active:scale-95 transition-all"
            >
              계속하기
            </button>
          </div>
        </div>
      )}

      {/* ── 회원 탈퇴 Step 2: "탈퇴" 입력 ── */}
      {deleteStep === 'confirm2' && (
        <div className="space-y-5 pb-2">
          <div className="space-y-2">
            <p className="text-sm text-warm-dark font-medium">정말 탈퇴하시겠어요?</p>
            <p className="text-xs text-cream-400">
              아래 입력창에 <span className="font-semibold text-red-500">탈퇴</span>를 입력하면 버튼이 활성화돼요
            </p>
          </div>
          <input
            type="text"
            value={deleteInput}
            onChange={e => setDeleteInput(e.target.value)}
            placeholder="탈퇴"
            className="w-full px-4 py-3 rounded-xl border border-cream-200 bg-cream-50 text-sm text-warm-dark placeholder-cream-300 focus:outline-none focus:border-red-300 transition-colors"
          />
          {deleteError && <p className="text-xs text-red-500">{deleteError}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => { setDeleteStep('idle'); setDeleteInput(''); setDeleteError('') }}
              className="flex-1 py-3 rounded-xl border border-cream-300 text-sm text-warm-dark font-medium hover:bg-cream-50 transition-colors"
              disabled={deleting}
            >
              취소
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={deleteInput !== '탈퇴' || deleting}
              className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-600 active:scale-95 transition-all"
            >
              {deleting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  탈퇴 중…
                </span>
              ) : '탈퇴하기'}
            </button>
          </div>
        </div>
      )}

      {/* ── 기본 설정 화면 ── */}
      {deleteStep === 'idle' && (
        <div className="space-y-6 pb-2">

          {/* ── 프로필 ── */}
          <section>
            <p className="text-[11px] font-semibold text-warm-light tracking-widest uppercase mb-3">프로필</p>
            <div className="bg-white rounded-2xl border border-cream-200 overflow-hidden">

              {/* 아바타 + 이메일 */}
              <div className="flex items-center gap-3 px-4 py-4 border-b border-cream-100">
                {/* 클릭 가능한 아바타 */}
                <div
                  className="relative shrink-0 cursor-pointer"
                  onClick={() => !photoUploading && photoInputRef.current?.click()}
                  title="프로필 사진 변경"
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="프로필 사진"
                      className={`w-14 h-14 rounded-full object-cover ring-2 ring-cream-200 transition-opacity ${photoUploading ? 'opacity-50' : ''}`}
                    />
                  ) : provider === 'kakao' ? (
                    <div
                      className={`w-14 h-14 rounded-full flex items-center justify-center ring-2 ring-cream-200 transition-opacity ${photoUploading ? 'opacity-50' : ''}`}
                      style={{ background: '#FEE500' }}
                    >
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="#3C1E1E">
                        <path d="M12 3C6.477 3 2 6.477 2 10.8c0 2.79 1.63 5.24 4.1 6.73l-1.05 3.85a.25.25 0 0 0 .38.27L9.7 19.2a11.2 11.2 0 0 0 2.3.24C17.523 19.44 22 15.963 22 11.64 22 7.317 17.523 3 12 3z" />
                      </svg>
                    </div>
                  ) : (
                    <div
                      className={`w-14 h-14 rounded-full flex items-center justify-center ring-2 ring-cream-200 transition-opacity ${photoUploading ? 'opacity-50' : ''}`}
                      style={{ background: 'rgba(107,79,58,0.15)' }}
                    >
                      <svg className="w-7 h-7 text-warm-brown" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                  )}
                  {/* 카메라 배지 */}
                  <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-warm-brown border-2 border-white flex items-center justify-center">
                    {photoUploading ? (
                      <span className="w-2.5 h-2.5 border border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-cream-400 mb-0.5">{providerLabel} 계정</p>
                  <p className="text-sm text-warm-dark font-medium truncate">{displayEmail}</p>
                  {photoError && (
                    <p className="text-[11px] text-red-400 mt-1">{photoError}</p>
                  )}
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

              {/* 알림 토글 */}
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <svg className={`w-4 h-4 shrink-0 ${notifEnabled ? 'text-warm-brown' : 'text-cream-400'}`} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <div>
                    <p className="text-sm text-warm-dark">알림</p>
                    <p className="text-[11px] text-cream-400">{notifEnabled ? '새 기록·댓글·별점 알림 받는 중' : '알림 꺼짐'}</p>
                  </div>
                </div>
                <button
                  onClick={() => setNotifEnabledPref(!notifEnabled)}
                  className={`w-10 h-6 rounded-full relative shrink-0 transition-colors duration-200 ${notifEnabled ? 'bg-warm-brown' : 'bg-cream-200'}`}
                  aria-pressed={notifEnabled}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${notifEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
              </div>

              {/* 앱 업데이트 확인 */}
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <svg className={`w-4 h-4 shrink-0 ${checking ? 'text-warm-brown' : 'text-cream-400'}`} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <p className="text-sm text-warm-dark">앱 업데이트 확인</p>
                </div>
                <button
                  onClick={handleCheckUpdate}
                  disabled={checking}
                  className="text-xs text-warm-brown font-medium disabled:opacity-50 flex items-center gap-1.5 active:scale-95 transition-all"
                >
                  {checking ? (
                    <>
                      <span className="w-3 h-3 border border-warm-brown border-t-transparent rounded-full animate-spin" />
                      확인 중...
                    </>
                  ) : '업데이트 확인'}
                </button>
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

              {/* 회원 탈퇴 */}
              <button
                onClick={() => setDeleteStep('confirm1')}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-red-50 active:bg-red-100 transition-colors text-left"
              >
                <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                </svg>
                <p className="text-sm text-red-400">회원 탈퇴</p>
              </button>
            </div>
          </section>

          {/* ── 개발자 정보 (접기/펼치기) ── */}
          <section>
            <button
              onClick={handleDebugToggle}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-cream-300 tracking-widest uppercase mb-3"
            >
              <svg className={`w-3 h-3 transition-transform duration-200 ${debugOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              개발자 정보
            </button>

            {debugOpen && (
              <div className="bg-warm-dark rounded-2xl p-4 space-y-2.5">
                {debugLoading ? (
                  <p className="text-xs text-cream-400 text-center py-2">수집 중...</p>
                ) : debugInfo?.error ? (
                  <p className="text-xs text-red-400">{debugInfo.error}</p>
                ) : debugInfo ? (
                  <>
                    <DebugRow label="알림 권한" value={debugInfo.permission}
                      ok={debugInfo.permission === 'granted'} bad={debugInfo.permission === 'denied'} />
                    <DebugRow label="Notification API" value={debugInfo.hasNotifApi ? '지원' : '미지원'}
                      ok={debugInfo.hasNotifApi} bad={!debugInfo.hasNotifApi} />
                    <DebugRow label="Service Worker" value={debugInfo.swState}
                      ok={debugInfo.swState === 'active'} bad={debugInfo.swState === 'not registered'} />
                    <DebugRow label="FCM 토큰 수" value={`${debugInfo.tokenCount}개`}
                      ok={debugInfo.tokenCount === 1} bad={debugInfo.tokenCount === 0} warn={debugInfo.tokenCount > 1} />
                    <DebugRow label="토큰 끝 8자리" value={debugInfo.tokenSuffix} mono />
                    <DebugRow label="PWA 독립 앱" value={debugInfo.isStandalone ? '예 (standalone)' : '아니오 (브라우저)'}
                      ok={debugInfo.isStandalone} />
                    <div className="pt-1 border-t border-warm-light/20">
                      <button
                        onClick={loadDebugInfo}
                        className="text-[11px] text-cream-400 hover:text-cream-200 transition-colors"
                      >
                        새로고침
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            )}
          </section>

        </div>
      )}
    </Modal>
  )
}

function DebugRow({ label, value, ok, bad, warn, mono }) {
  const valueColor = ok ? 'text-green-400' : bad ? 'text-red-400' : warn ? 'text-yellow-400' : 'text-cream-200'
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] text-cream-400 shrink-0">{label}</span>
      <span className={`text-[11px] ${valueColor} ${mono ? 'font-mono' : 'font-medium'} text-right break-all`}>{value}</span>
    </div>
  )
}
