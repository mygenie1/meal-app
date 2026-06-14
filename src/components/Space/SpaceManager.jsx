import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import Modal from '../common/Modal'
import BulkPhotoUpload from './BulkPhotoUpload'
import SettingsModal from './SettingsModal'
import FeedbackModal from './FeedbackModal'

const EMOJIS = ['🍽️', '🍜', '🍕', '🍱', '🍰', '☕', '🥗', '🍣', '🌮', '🥘']

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

  function copyCode(spaceCode) {
    navigator.clipboard.writeText(spaceCode).then(() => {
      alert(`코드 복사 완료: ${spaceCode}`)
    })
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

  const displayName = user?.user_metadata?.name
    || user?.user_metadata?.full_name
    || user?.email
    || '카카오 사용자'

  return (
    <div className="space-y-4">
      {/* 프로필 — 클릭하면 설정 열림 */}
      {user && (
        <button
          onClick={() => setShowSettings(true)}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl bg-white border border-cream-200 hover:border-cream-300 hover:bg-cream-50 active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-2.5">
            {user.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center" style={{ background: '#FEE500' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#3C1E1E">
                  <path d="M12 3C6.477 3 2 6.477 2 10.8c0 2.79 1.63 5.24 4.1 6.73l-1.05 3.85a.25.25 0 0 0 .38.27L9.7 19.2a11.2 11.2 0 0 0 2.3.24C17.523 19.44 22 15.963 22 11.64 22 7.317 17.523 3 12 3z" />
                </svg>
              </div>
            )}
            <p className="text-sm font-medium text-warm-dark truncate max-w-[180px]">{displayName}</p>
          </div>
          <svg className="w-4 h-4 text-cream-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* 현재 스페이스 */}
      {currentSpace && (
        <div className="bg-warm-brown/10 border border-warm-brown/20 rounded-2xl p-4">
          <p className="text-xs text-warm-light mb-1">현재 스페이스</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{currentSpace.emoji}</span>
              <div>
                <p className="font-semibold text-warm-dark">{currentSpace.name}</p>
                <p className="text-xs text-warm-light">{currentSpace.meals?.length || 0}개의 식사 기록</p>
              </div>
            </div>
            <button
              onClick={() => copyCode(currentSpace.code)}
              className="flex flex-col items-center"
            >
              <span className="bg-cream-200 px-3 py-1 rounded-full text-xs font-mono font-bold text-warm-brown tracking-widest hover:bg-cream-300 transition-colors">
                {currentSpace.code}
              </span>
              <span className="text-[10px] text-warm-light mt-0.5">탭하면 복사</span>
            </button>
          </div>
        </div>
      )}

      {/* 스페이스 목록 */}
      {spaces.length > 0 && (
        <div>
          <p className="text-xs text-warm-light mb-2">내 스페이스</p>
          <div className="space-y-2">
            {spaces.map(space => (
              <div
                key={space.id}
                className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                  space.id === currentSpace?.id
                    ? 'bg-cream-100 border-cream-300'
                    : 'bg-white border-cream-200 hover:border-cream-300'
                }`}
              >
                <button
                  className="flex items-center gap-2 flex-1 text-left"
                  onClick={() => switchSpace(space.id)}
                >
                  <span className="text-xl">{space.emoji}</span>
                  <div>
                    <p className="text-sm font-medium text-warm-dark">{space.name}</p>
                    <p className="text-xs text-warm-light">{space.meals?.length || 0}개 기록</p>
                  </div>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  {user && !space.ownerId && (
                    <button
                      onClick={() => handleClaim(space.id)}
                      disabled={claimingId === space.id}
                      title="이 스페이스를 내 계정과 연동"
                      className="text-[10px] px-2 py-1 rounded-lg border border-warm-brown/30 text-warm-brown hover:bg-warm-brown/10 transition-colors disabled:opacity-50"
                    >
                      {claimingId === space.id ? '연동 중...' : '내 것으로'}
                    </button>
                  )}
                  {user && space.ownerId === user.id && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-lg bg-warm-brown/10 text-warm-brown font-medium">내 스페이스</span>
                  )}
                  <button
                    onClick={() => {
                      const isOwner = user && space.ownerId === user.id
                      const ownerWarning = isOwner ? '\n\n이 스페이스의 오너입니다. 나가도 데이터는 유지됩니다.' : ''
                      if (confirm(`"${space.name}" 스페이스에서 나갈까요?${ownerWarning}`)) {
                        leaveSpace(space.id)
                      }
                    }}
                    className="text-xs text-warm-light hover:text-red-400 p-1 transition-colors"
                  >
                    나가기
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex gap-2">
        <button
          onClick={() => { setShowCreate(true); setShowJoin(false) }}
          className="flex-1 py-2.5 rounded-xl bg-warm-brown text-white text-sm font-medium hover:bg-warm-dark transition-colors"
        >
          + 새 스페이스
        </button>
        <button
          onClick={() => { setShowJoin(true); setShowCreate(false) }}
          className="flex-1 py-2.5 rounded-xl border border-cream-300 text-warm-brown text-sm font-medium hover:bg-cream-100 transition-colors"
        >
          코드로 참가
        </button>
      </div>

      {/* 사진 일괄 등록 버튼 — 스페이스가 있을 때만 */}
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
            className="w-full px-3 py-2 rounded-xl bg-white border border-cream-200 text-sm text-warm-dark placeholder-cream-400 focus:outline-none focus:border-warm-light"
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
            className="w-full px-3 py-2 rounded-xl bg-white border border-cream-200 text-sm text-warm-dark placeholder-cream-400 focus:outline-none focus:border-warm-light font-mono tracking-widest text-center uppercase"
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
          <p className="text-3xl mb-2">👥</p>
          <p className="text-sm">스페이스를 만들어 함께 기록을 시작해보세요</p>
        </div>
      )}

      {/* 피드백 보내기 카드 */}
      <button
        onClick={() => setShowFeedback(true)}
        className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white border border-cream-200 hover:border-cream-300 hover:bg-cream-50 active:scale-[0.99] transition-all text-left"
      >
        <div className="w-10 h-10 rounded-full bg-warm-brown/10 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-warm-brown" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-warm-dark">피드백 보내기</p>
          <p className="text-xs text-warm-light mt-0.5">버그나 의견이 있으신가요?<br />스크린샷과 함께 알려주세요!</p>
        </div>
      </button>

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
