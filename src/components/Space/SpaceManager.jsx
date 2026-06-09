import { useState } from 'react'
import { useApp } from '../../context/AppContext'

const EMOJIS = ['🍽️', '🍜', '🍕', '🍱', '🍰', '☕', '🥗', '🍣', '🌮', '🥘']

export default function SpaceManager() {
  const { spaces, currentSpace, createSpace, switchSpace, deleteSpace, joinByCode } = useApp()
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🍽️')
  const [code, setCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [joining, setJoining] = useState(false)

  function handleCreate(e) {
    e.preventDefault()
    if (!name.trim()) return
    createSpace(name.trim(), emoji)
    setName('')
    setEmoji('🍽️')
    setShowCreate(false)
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

  return (
    <div className="space-y-4">
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
                {space.id !== currentSpace?.id && (
                  <button
                    onClick={() => {
                      if (confirm(`"${space.name}" 스페이스를 삭제할까요?`)) {
                        deleteSpace(space.id)
                      }
                    }}
                    className="text-xs text-warm-light hover:text-red-400 p-1"
                  >
                    삭제
                  </button>
                )}
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
            onChange={e => setName(e.target.value)}
            placeholder="스페이스 이름 (예: 우리 가족 식탁)"
            className="w-full px-3 py-2 rounded-xl bg-white border border-cream-200 text-sm text-warm-dark placeholder-cream-400 focus:outline-none focus:border-warm-light"
            autoFocus
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-xl border border-cream-300 text-warm-brown text-sm hover:bg-cream-200">
              취소
            </button>
            <button type="submit" className="flex-1 py-2 rounded-xl bg-warm-brown text-white text-sm hover:bg-warm-dark">
              만들기
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
    </div>
  )
}
