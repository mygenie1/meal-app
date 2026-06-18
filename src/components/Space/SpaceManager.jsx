import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import Modal from '../common/Modal'
import BulkPhotoUpload from './BulkPhotoUpload'
import SettingsModal from './SettingsModal'
import FeedbackModal from './FeedbackModal'
import Avatar from '../common/Avatar'

const MINI_DISMISSED_KEY = 'install_mini_dismissed'

function isStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

function isIOSSafari() {
  const ua = navigator.userAgent
  return /iphone|ipad|ipod/i.test(ua) && !/crios|fxios|opios|mercury/i.test(ua)
}

function isIOSNonSafari() {
  const ua = navigator.userAgent
  return /iphone|ipad|ipod/i.test(ua) && /crios|fxios|opios|mercury/i.test(ua)
}

function InstallMiniCard() {
  const [show, setShow] = useState(false)
  const [mode, setMode] = useState(null) // 'ios' | 'android' | 'ios-other'
  const [prompt, setPrompt] = useState(null)

  useEffect(() => {
    if (isStandaloneMode() || localStorage.getItem(MINI_DISMISSED_KEY) === 'true') return

    if (isIOSSafari()) {
      setMode('ios')
      setShow(true)
    } else if (isIOSNonSafari()) {
      setMode('ios-other')
      setShow(true)
    } else if (window.__installPrompt) {
      setPrompt(window.__installPrompt)
      setMode('android')
      setShow(true)
    }
    // Android에서 아직 __installPrompt가 없을 경우 대기
    const handler = (e) => {
      if (isStandaloneMode() || localStorage.getItem(MINI_DISMISSED_KEY) === 'true') return
      if (mode === null && !isIOSSafari() && !isIOSNonSafari()) {
        e.preventDefault()
        window.__installPrompt = e
        setPrompt(e)
        setMode('android')
        setShow(true)
      }
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function handleDismiss() {
    setShow(false)
    localStorage.setItem(MINI_DISMISSED_KEY, 'true')
  }

  async function handleInstall() {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      setShow(false)
      window.__installPrompt = null
    }
    setPrompt(null)
  }

  if (!show) return null

  return (
    <div className="bg-white rounded-2xl border border-cream-200 p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-warm-brown/10 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-warm-brown" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.5a6.5 6.5 0 100-13 6.5 6.5 0 000 13zM12 2v1m0 18v1M4.22 4.22l.7.7m14.14 14.14l.7.7M2 12h1m18 0h1M4.22 19.78l.7-.7M19.08 4.92l.7-.7" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-warm-dark text-sm">앱처럼 사용하기</p>
          {mode === 'ios' && (
            <p className="text-xs text-warm-light mt-0.5 leading-relaxed">
              Safari 하단{' '}
              <svg className="inline w-3 h-3 mb-0.5 align-middle" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {' '}→ <span className="font-medium text-warm-dark">홈 화면에 추가</span>
            </p>
          )}
          {mode === 'android' && (
            <p className="text-xs text-warm-light mt-0.5">홈화면에 추가하면 앱처럼 사용해요</p>
          )}
          {mode === 'ios-other' && (
            <p className="text-xs text-warm-light mt-0.5">Safari로 열면 홈 화면에 추가할 수 있어요</p>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className="text-cream-400 hover:text-warm-light transition-colors shrink-0 mt-0.5"
          aria-label="닫기"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {mode === 'android' && prompt && (
        <button
          onClick={handleInstall}
          className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-warm-brown text-white text-sm font-medium hover:bg-warm-dark transition-colors active:scale-[0.99]"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          앱 설치하기
        </button>
      )}
    </div>
  )
}

const EMOJIS = ['🍽️', '🍜', '🍕', '🍱', '🍰', '☕', '🥗', '🍣', '🌮', '🥘']

// 초대 메시지 브라우저 안내 문구 — 여기서 한 곳에서만 수정
const BROWSER_GUIDE = '👉 안드로이드는 Chrome, 아이폰은 Safari로 열어주세요.'

function buildInviteMessage(origin, code) {
  return [
    '[식탁일기] 우리 식탁에 초대할게요 🍽',
    '',
    '아래 링크를 눌러 참가하세요.',
    BROWSER_GUIDE,
    `${origin}/join?code=${code}`,
    '',
    `(링크가 안 열리면 식탁일기 앱에서 코드 입력: ${code})`,
  ].join('\n')
}

function lastRecordLabel(space) {
  const dates = (space.meals || []).map(m => m.date).filter(Boolean)
  if (dates.length === 0) return ''
  const latest = dates.reduce((a, b) => (a > b ? a : b))
  const diff = Math.floor((Date.now() - new Date(latest).getTime()) / 86400000)
  if (diff <= 0) return '오늘 기록'
  if (diff === 1) return '어제 기록'
  return `마지막 기록 ${diff}일 전`
}

export default function SpaceManager() {
  const { user, spaces, currentSpace, createSpace, switchSpace, leaveSpace, joinByCode, claimSpace } = useApp()
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackToast, setFeedbackToast] = useState(false)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🍽️')
  const [code, setCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [joining, setJoining] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [claimingId, setClaimingId] = useState(null)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [leaveTargetSpace, setLeaveTargetSpace] = useState(null)
  const [memberCount, setMemberCount] = useState(null)
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  // 구성원 관리
  const [members, setMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [kickTarget, setKickTarget] = useState(null)
  const [kicking, setKicking] = useState(false)
  const [showRegenCodeModal, setShowRegenCodeModal] = useState(false)
  const [regenningCode, setRegenningCode] = useState(false)
  const [displayCode, setDisplayCode] = useState(null) // null이면 currentSpace.code 사용

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    setCreateError('')
    const result = await createSpace(name.trim(), emoji)
    setCreating(false)
    if (result) {
      setName('')
      setEmoji('🍽️')
      setShowCreate(false)
    } else {
      setCreateError('스페이스 생성에 실패했어요. 네트워크 연결과 Supabase 설정을 확인해주세요.')
    }
  }

  async function handleJoin(e) {
    e.preventDefault()
    setJoining(true)
    setJoinError('')
    const result = await joinByCode(code.trim())
    setJoining(false)
    if (result) {
      setCode('')
      setShowJoin(false)
    } else {
      setJoinError('코드를 찾을 수 없어요. 올바른 코드인지 확인해주세요.')
    }
  }

  async function copyInviteLink(spaceCode) {
    const message = buildInviteMessage(window.location.origin, spaceCode)
    try {
      await navigator.clipboard.writeText(message)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = message
      ta.style.cssText = 'position:fixed;left:-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  async function handleClaim(spaceId) {
    setClaimingId(spaceId)
    await claimSpace(spaceId)
    setClaimingId(null)
  }

  function handleFeedbackSuccess() {
    setFeedbackToast(true)
    setTimeout(() => setFeedbackToast(false), 2500)
  }

  async function handleLeaveClick(space) {
    setLeaveTargetSpace(space)
    setMemberCount(null)
    setCopied(false)
    setShowLeaveModal(true)
    // space_members SELECT RLS가 "user_id = auth.uid()" (본인 레코드만) 이므로
    // 직접 조회하면 항상 1을 반환 → SECURITY DEFINER RPC로 RLS 우회해 실제 멤버 수 조회.
    // 조회 실패 시 2로 가정해 Case B (일반 확인 문구) 표시 — 오탐(혼자 경고 잘못 표시) 방지.
    try {
      const { data: count, error } = await supabase.rpc('get_space_member_count', { p_space_id: space.id })
      setMemberCount(error ? 2 : (count ?? 1))
    } catch {
      setMemberCount(2)
    }
  }

  async function handleLeaveSpace() {
    if (!leaveTargetSpace) return
    await leaveSpace(leaveTargetSpace.id)
    setShowLeaveModal(false)
    setLeaveTargetSpace(null)
  }

  // 스페이스 전환 시 displayCode 초기화
  useEffect(() => {
    setDisplayCode(null)
  }, [currentSpace?.id])

  // 멤버 목록 로드
  useEffect(() => {
    if (!currentSpace?.id) { setMembers([]); return }
    loadMembers(currentSpace.id)
  }, [currentSpace?.id])

  async function loadMembers(spaceId) {
    setMembersLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_space_members', { p_space_id: spaceId })
      if (error) {
        console.error('[SpaceManager] get_space_members 오류:', error.message)
        setMembers([])
      } else {
        setMembers(data ?? [])
      }
    } catch (e) {
      console.error('[SpaceManager] get_space_members 예외:', e)
      setMembers([])
    } finally {
      setMembersLoading(false)
    }
  }

  async function handleKick() {
    if (!kickTarget || !currentSpace) return
    setKicking(true)
    try {
      const { error } = await supabase.rpc('remove_space_member', {
        p_space_id: currentSpace.id,
        p_target_user_id: kickTarget.user_id,
      })
      if (error) {
        console.error('[SpaceManager] remove_space_member 오류:', error.message)
        alert('내보내기에 실패했어요')
      } else {
        setMembers(prev => prev.filter(m => m.user_id !== kickTarget.user_id))
        setKickTarget(null)
      }
    } catch (e) {
      console.error('[SpaceManager] remove_space_member 예외:', e)
      alert('내보내기에 실패했어요')
    } finally {
      setKicking(false)
    }
  }

  async function handleRegenCode() {
    if (!currentSpace) return
    setRegenningCode(true)
    try {
      const { data: newCode, error } = await supabase.rpc('regenerate_invite_code', {
        p_space_id: currentSpace.id,
      })
      if (error) {
        console.error('[SpaceManager] regenerate_invite_code 오류:', error.message)
        alert('코드 변경에 실패했어요')
      } else {
        setDisplayCode(newCode)
        setShowRegenCodeModal(false)
      }
    } catch (e) {
      console.error('[SpaceManager] regenerate_invite_code 예외:', e)
      alert('코드 변경에 실패했어요')
    } finally {
      setRegenningCode(false)
    }
  }

  const displayName = user?.user_metadata?.name
    || user?.user_metadata?.full_name
    || user?.email
    || '카카오 사용자'

  const isOwner = !!(currentSpace?.ownerId && currentSpace.ownerId === user?.id)
  const activeCode = displayCode ?? currentSpace?.code
  // ownerId가 설정됐지만 그 유저가 더 이상 space_members에 없는 경우 (유령 오너)
  const isGhostOwner = !!(currentSpace?.ownerId && !membersLoading && members.length > 0 && !members.some(m => m.is_owner))

  return (
    <div className="space-y-4">
      {/* 프로필 — 클릭하면 설정 열림 */}
      {user && (
        <button
          onClick={() => setShowSettings(true)}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl bg-white border border-cream-200 hover:border-cream-300 hover:bg-cream-50 active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-2.5">
            <Avatar url={user.user_metadata?.avatar_url} nickname={displayName} size="md" className="shrink-0" />
            <p className="text-sm font-medium text-warm-dark truncate max-w-[180px]">{displayName}</p>
          </div>
          <svg className="w-4 h-4 text-cream-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* 현재 스페이스 (강조 카드) */}
      {currentSpace && (
        <div className="bg-white rounded-2xl border border-cream-200 shadow-sm p-5">
          <p className="text-xs text-warm-brown font-medium mb-3">현재 스페이스</p>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 bg-warm-brown/10 rounded-2xl flex items-center justify-center text-3xl shrink-0">
              {currentSpace.emoji}
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-warm-dark truncate">{currentSpace.name}</p>
              <p className="text-sm text-warm-light mt-0.5">{currentSpace.meals?.length || 0}개의 식사 기록</p>
            </div>
          </div>

          {/* 초대 링크 */}
          <div className="flex items-center justify-between bg-cream-50 rounded-xl px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs text-cream-400 mb-0.5">초대 코드</p>
              <p className="font-mono tracking-widest text-lg font-bold text-warm-dark">{activeCode}</p>
            </div>
            <button
              onClick={() => copyInviteLink(activeCode)}
              className="flex items-center gap-1.5 border border-cream-300 rounded-xl px-3 py-1.5 text-sm text-warm-brown hover:bg-cream-100 transition-colors shrink-0"
            >
              {linkCopied ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  복사됨
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  초대 링크 복사
                </>
              )}
            </button>
          </div>

          {/* 구성원 목록 */}
          <div className="mt-4 border-t border-cream-100 pt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-warm-light">
                구성원{!membersLoading && members.length > 0 && ` · ${members.length}명`}
              </p>
              {isOwner && (
                <button
                  onClick={() => setShowRegenCodeModal(true)}
                  className="text-xs text-cream-400 hover:text-warm-light transition-colors flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  초대코드 변경
                </button>
              )}
            </div>
            {membersLoading ? (
              <div className="flex justify-center py-3">
                <div className="w-4 h-4 border-2 border-cream-300 border-t-warm-brown rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                {members.map(member => (
                  <div key={member.user_id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar nickname={member.display_name} size="xs" className="shrink-0" />
                      <span className="text-sm text-warm-dark truncate">{member.display_name}</span>
                      {member.is_owner && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-warm-brown/10 text-warm-brown shrink-0">
                          오너
                        </span>
                      )}
                      {member.user_id === user?.id && (
                        <span className="text-[10px] text-cream-400 shrink-0">나</span>
                      )}
                    </div>
                    {isOwner && member.user_id !== user?.id && (
                      <button
                        onClick={() => setKickTarget(member)}
                        className="text-xs text-cream-400 hover:text-red-400 shrink-0 transition-colors"
                      >
                        내보내기
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* 유령 오너: ownerId는 있지만 그 유저가 더 이상 멤버가 아닌 경우 */}
            {isGhostOwner && !isOwner && (
              <div className="mt-3 flex items-center justify-between bg-amber-50 rounded-xl px-3 py-2">
                <p className="text-xs text-amber-700">오너 자리가 비었어요</p>
                <button
                  onClick={() => handleClaim(currentSpace.id)}
                  disabled={claimingId === currentSpace.id}
                  className="text-xs font-medium text-warm-brown hover:text-warm-dark transition-colors disabled:opacity-50"
                >
                  {claimingId === currentSpace.id ? '연동 중...' : '내 것으로'}
                </button>
              </div>
            )}
          </div>

          {/* 스페이스 나가기 */}
          <div className="flex justify-end mt-3">
            <button
              onClick={() => handleLeaveClick(currentSpace)}
              className="text-xs text-cream-400 underline hover:text-warm-light transition-colors"
            >
              스페이스 나가기
            </button>
          </div>
        </div>
      )}

      {/* 참여 중인 스페이스 목록 */}
      {spaces.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-cream-400">참여 중인 스페이스</p>
            <span className="text-xs text-cream-400">{spaces.length}</span>
          </div>
          <div className="space-y-2">
            {spaces.map(space => {
              const isCurrent = space.id === currentSpace?.id
              const last = lastRecordLabel(space)
              return (
                <div
                  key={space.id}
                  className={`flex items-center gap-3 bg-white rounded-2xl border px-4 py-3 transition-colors ${
                    isCurrent ? 'border-warm-brown' : 'border-cream-200 hover:border-cream-300'
                  }`}
                >
                  <button
                    onClick={() => switchSpace(space.id)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    <div className="w-10 h-10 bg-cream-100 rounded-xl flex items-center justify-center text-xl shrink-0">
                      {space.emoji}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-warm-dark truncate">{space.name}</p>
                        {isCurrent && (
                          <span className="bg-warm-brown text-white text-xs px-2 py-0.5 rounded-full shrink-0">현재</span>
                        )}
                      </div>
                      <p className="text-xs text-cream-400 truncate">
                        {space.meals?.length || 0}개 기록{last ? ` · ${last}` : ''}
                      </p>
                    </div>
                  </button>

                  {/* 연동/나가기 */}
                  <div className="flex items-center gap-1 shrink-0">
                    {user && (!space.ownerId || (space.id === currentSpace?.id && isGhostOwner)) && (
                      <button
                        onClick={() => handleClaim(space.id)}
                        disabled={claimingId === space.id}
                        title="이 스페이스를 내 계정과 연동"
                        className="text-[10px] px-2 py-1 rounded-lg border border-warm-brown/30 text-warm-brown hover:bg-warm-brown/10 transition-colors disabled:opacity-50"
                      >
                        {claimingId === space.id ? '연동 중...' : '내 것으로'}
                      </button>
                    )}
                    <button
                      onClick={() => handleLeaveClick(space)}
                      className="text-xs text-cream-400 hover:text-red-400 p-1 transition-colors"
                      aria-label="나가기"
                    >
                      나가기
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="space-y-2">
        <button
          onClick={() => { setShowCreate(true); setShowJoin(false) }}
          className="w-full py-3 rounded-2xl bg-warm-brown text-white text-sm font-medium hover:bg-warm-dark transition-colors active:scale-[0.99]"
        >
          + 새 스페이스 만들기
        </button>
        <button
          onClick={() => { setShowJoin(true); setShowCreate(false) }}
          className="w-full py-3 rounded-2xl border border-warm-brown text-warm-brown text-sm font-medium hover:bg-warm-brown/5 transition-colors active:scale-[0.99]"
        >
          코드로 참가하기
        </button>
      </div>

      {/* 사진 일괄 등록 버튼 */}
      {currentSpace && (
        <button
          onClick={() => setShowBulkUpload(true)}
          className="w-full py-2.5 rounded-xl border border-cream-200 text-warm-light text-sm font-medium hover:bg-cream-100 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          사진 일괄 등록
        </button>
      )}

      {/* 스페이스 생성 폼 */}
      {showCreate && (
        <form onSubmit={handleCreate} className="bg-cream-100 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-medium text-warm-dark">새 스페이스 만들기</p>
          <div className="flex gap-2 flex-wrap">
            {EMOJIS.map(e => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={`text-xl w-9 h-9 rounded-lg transition-colors ${
                  emoji === e ? 'bg-warm-brown/20 ring-1 ring-warm-brown' : 'hover:bg-cream-200'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setCreateError('') }}
            placeholder="스페이스 이름 (예: 우리 가족 식탁)"
            className="w-full px-3 py-2 rounded-xl bg-white border border-cream-200 text-base text-warm-dark placeholder-cream-400 focus:outline-none focus:border-warm-light"
            autoFocus
          />
          {createError && (
            <p className="text-xs text-red-400">{createError}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowCreate(false); setCreateError('') }}
              className="flex-1 py-2 rounded-xl border border-cream-300 text-warm-brown text-sm hover:bg-cream-200"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={creating}
              className="flex-1 py-2 rounded-xl bg-warm-brown text-white text-sm hover:bg-warm-dark disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {creating ? '만드는 중...' : '만들기'}
            </button>
          </div>
        </form>
      )}

      {/* 코드 참가 폼 */}
      {showJoin && (
        <form onSubmit={handleJoin} className="bg-cream-100 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-medium text-warm-dark">코드로 참가</p>
          <input
            type="text"
            value={code}
            onChange={e => { setCode(e.target.value.toUpperCase()); setJoinError('') }}
            placeholder="6자리 코드 입력"
            maxLength={6}
            className="w-full px-3 py-2 rounded-xl bg-white border border-cream-200 text-base text-warm-dark placeholder-cream-400 focus:outline-none focus:border-warm-light font-mono tracking-widest text-center uppercase"
            autoFocus
          />
          {joinError && <p className="text-xs text-red-400">{joinError}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowJoin(false)} className="flex-1 py-2 rounded-xl border border-cream-300 text-warm-brown text-sm hover:bg-cream-200">
              취소
            </button>
            <button
              type="submit"
              disabled={joining}
              className="flex-1 py-2 rounded-xl bg-warm-brown text-white text-sm hover:bg-warm-dark disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {joining ? '검색 중...' : '참가'}
            </button>
          </div>
        </form>
      )}

      {spaces.length === 0 && !showCreate && (
        <div className="text-center py-8 text-cream-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-cream-300" fill="none" stroke="currentColor" strokeWidth="1.4" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm font-medium text-warm-light mb-1">참여 중인 스페이스가 없어요</p>
          <p className="text-xs text-cream-400">새 스페이스를 만들거나 코드로 참가해보세요</p>
        </div>
      )}

      {/* 설치 미니카드 */}
      <InstallMiniCard />

      {/* 피드백 카드 */}
      <div className="bg-cream-100 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-warm-brown" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-warm-dark">버그나 의견이 있으신가요?</p>
            <p className="text-sm text-warm-light mt-0.5">스크린샷과 함께 알려주세요</p>
          </div>
        </div>
        <button
          onClick={() => setShowFeedback(true)}
          className="w-full mt-3 py-2.5 rounded-xl bg-warm-brown text-white text-sm font-medium hover:bg-warm-dark transition-colors active:scale-[0.99]"
        >
          피드백 보내기
        </button>
      </div>

      {/* 사진 일괄 등록 모달 */}
      <Modal isOpen={showBulkUpload} onClose={() => setShowBulkUpload(false)} title="사진 일괄 등록">
        <BulkPhotoUpload onClose={() => setShowBulkUpload(false)} />
      </Modal>

      {/* 설정 모달 */}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* 피드백 모달 */}
      <FeedbackModal
        isOpen={showFeedback}
        onClose={() => setShowFeedback(false)}
        onSuccess={handleFeedbackSuccess}
      />

      {/* 스페이스 나가기 확인 모달 */}
      <Modal isOpen={showLeaveModal} onClose={() => setShowLeaveModal(false)}>
        {memberCount === null ? (
          <div className="p-8 flex justify-center">
            <div className="w-8 h-8 border-2 border-cream-300 border-t-warm-brown rounded-full animate-spin" />
          </div>
        ) : memberCount <= 1 ? (
          /* Case A: 나 혼자 */
          <div className="p-6">
            <h3 className="font-bold text-warm-dark text-lg mb-2">
              정말 나가시겠어요?
            </h3>
            <p className="text-sm text-warm-light leading-relaxed mb-4">
              현재 이 식탁에는 나 혼자예요.<br />
              나가면 함께할 멤버가 없는 스페이스가 돼요.<br /><br />
              <span className="text-warm-brown font-medium">
                멤버가 없는 스페이스는 30일 후 자동으로 삭제돼요.
              </span>
              <br /><br />
              초대 코드를 복사해두면 나중에 다시 참가할 수 있어요.
            </p>

            <div className="bg-cream-100 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-cream-400 mb-1">초대 코드</p>
                <p className="font-mono tracking-widest font-bold text-warm-dark">
                  {leaveTargetSpace?.code}
                </p>
              </div>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(leaveTargetSpace?.code || '')
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
                className="text-xs text-warm-brown font-medium border border-warm-brown rounded-lg px-3 py-1.5 active:scale-95 transition-transform"
              >
                {copied ? '복사됨 ✓' : '복사'}
              </button>
            </div>

            <button
              onClick={handleLeaveSpace}
              className="w-full bg-red-50 text-red-500 rounded-xl py-3 font-medium mb-2 active:scale-[0.99] transition-transform"
            >
              그래도 나갈게요
            </button>
            <button
              onClick={() => setShowLeaveModal(false)}
              className="w-full text-warm-light text-sm py-2"
            >
              취소
            </button>
          </div>
        ) : (
          /* Case B: 다른 멤버도 있음 */
          <div className="p-6">
            <h3 className="font-bold text-warm-dark text-lg mb-2">
              스페이스에서 나갈까요?
            </h3>
            <p className="text-sm text-warm-light mb-6">
              나가도 기록은 그대로 남아요.<br />
              {leaveTargetSpace?.ownerId === user?.id && (
                <>오너 권한은 가장 오래된 멤버에게 자동으로 넘어가요.<br /></>
              )}
              초대 코드로 다시 참가할 수 있어요.
            </p>
            <button
              onClick={handleLeaveSpace}
              className="w-full bg-red-50 text-red-500 rounded-xl py-3 font-medium mb-2 active:scale-[0.99] transition-transform"
            >
              나갈게요
            </button>
            <button
              onClick={() => setShowLeaveModal(false)}
              className="w-full text-warm-light text-sm py-2"
            >
              취소
            </button>
          </div>
        )}
      </Modal>

      {/* 멤버 내보내기 확인 모달 */}
      <Modal isOpen={!!kickTarget} onClose={() => setKickTarget(null)}>
        <div className="p-6">
          <h3 className="font-bold text-warm-dark text-lg mb-2">멤버 내보내기</h3>
          <p className="text-sm text-warm-light leading-relaxed mb-6">
            <span className="font-medium text-warm-dark">{kickTarget?.display_name}</span>님을
            스페이스에서 내보낼까요?<br />
            기록은 그대로 남아요.
          </p>
          <button
            onClick={handleKick}
            disabled={kicking}
            className="w-full bg-red-50 text-red-500 rounded-xl py-3 font-medium mb-2 active:scale-[0.99] transition-transform disabled:opacity-50"
          >
            {kicking ? '내보내는 중...' : '내보내기'}
          </button>
          <button
            onClick={() => setKickTarget(null)}
            className="w-full text-warm-light text-sm py-2"
          >
            취소
          </button>
        </div>
      </Modal>

      {/* 초대코드 변경 확인 모달 */}
      <Modal isOpen={showRegenCodeModal} onClose={() => setShowRegenCodeModal(false)}>
        <div className="p-6">
          <h3 className="font-bold text-warm-dark text-lg mb-2">초대코드 변경</h3>
          <p className="text-sm text-warm-light leading-relaxed mb-6">
            새 코드가 발급되고 기존 코드는 더 이상 쓸 수 없게 됩니다.<br />
            이미 참가한 멤버에게는 영향이 없어요.
          </p>
          <button
            onClick={handleRegenCode}
            disabled={regenningCode}
            className="w-full bg-warm-brown text-white rounded-xl py-3 font-medium mb-2 active:scale-[0.99] transition-transform disabled:opacity-50"
          >
            {regenningCode ? '변경 중...' : '코드 변경'}
          </button>
          <button
            onClick={() => setShowRegenCodeModal(false)}
            className="w-full text-warm-light text-sm py-2"
          >
            취소
          </button>
        </div>
      </Modal>

      {/* 초대 링크 복사 토스트 */}
      {linkCopied && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-28 z-[90] px-5 py-3 rounded-2xl bg-warm-dark text-white text-sm font-medium shadow-lg flex items-center gap-2">
          <svg className="w-4 h-4 text-green-300 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          초대 링크가 복사되었어요
        </div>
      )}

      {/* 피드백 전송 완료 토스트 */}
      {feedbackToast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-28 z-[90] px-5 py-3 rounded-2xl bg-warm-dark text-white text-sm font-medium shadow-lg flex items-center gap-2">
          <svg className="w-4 h-4 text-green-300 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          소중한 의견 감사해요!
        </div>
      )}
    </div>
  )
}
