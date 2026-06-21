import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'

const WHO_OPTIONS = [
  { label: '커플', emoji: '💑', spaceName: '우리 식탁' },
  { label: '가족', emoji: '👨‍👩‍👧', spaceName: '가족 식탁' },
  { label: '친구', emoji: '👫', spaceName: '맛집 모임' },
  { label: '혼자 먼저 써보기', emoji: '🙋', spaceName: '나의 식탁' },
]

const TOTAL_STEPS = 7

// Steps: 0=환영, 1=누구와, 2=스페이스, 3=달력, 4=지도, 5=가고싶은곳, 6=첫기록

export default function TutorialFlow({ onComplete }) {
  const { createSpace, joinByCode } = useApp()
  const navigate = useNavigate()

  const [currentStep, setCurrentStep] = useState(0)
  const [fade, setFade] = useState(false)
  const [selectedType, setSelectedType] = useState(null)
  const [showJoinInput, setShowJoinInput] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [spaceError, setSpaceError] = useState('')

  // 한국어 입력 시 포커스 해제 버그 방지: uncontrolled input
  const spaceNameRef = useRef(null)
  const didAutoOpen = useRef(false)

  function goStep(n) {
    setFade(true)
    setTimeout(() => {
      setCurrentStep(n)
      setFade(false)
    }, 200)
  }
  const goNext = () => goStep(currentStep + 1)

  function handleComplete({ openMealForm, openBulkUpload } = {}) {
    if (!didAutoOpen.current) {
      didAutoOpen.current = true
      if (openBulkUpload) {
        navigate('/', { state: { openBulkUpload: true } })
      } else if (openMealForm) {
        navigate('/', { state: { openMealForm: true } })
      }
    }
    onComplete()
  }

  async function handleCreateSpace() {
    const name = (spaceNameRef.current?.value || '').trim() || selectedType?.spaceName || '우리 식탁'
    setCreating(true)
    setSpaceError('')
    const result = await createSpace(name)
    setCreating(false)
    if (result) {
      goNext()
    } else {
      setSpaceError('식탁을 만들지 못했어요. 다시 시도해주세요.')
    }
  }

  async function handleJoinSpace() {
    if (joinCode.length !== 6) return
    setJoining(true)
    setSpaceError('')
    const result = await joinByCode(joinCode)
    setJoining(false)
    if (result) {
      goNext()
    } else {
      setSpaceError('코드를 확인해주세요. 일치하는 식탁이 없어요.')
    }
  }

  // ── 스텝 렌더 함수 (함수로 호출 — <Component />가 아닌 {fn()} 패턴)
  // <StepComponent />로 사용하면 state 변경 시 함수 참조가 바뀌어 unmount/remount 발생,
  // input 포커스가 풀리는 버그가 생김. 함수 직접 호출로 DOM 유지.

  function renderStep0() {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 text-center">
        <div className="w-20 h-20 bg-warm-brown rounded-2xl flex items-center justify-center mb-8 shadow-sm">
          <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 2v6a2 2 0 0 0 2 2v12M9 2v6a2 2 0 0 1-2 2" />
            <path d="M16 2c-1.7 0-3 1.8-3 4s1.3 4 3 4 3-1.8 3-4-1.3-4-3-4zM16 10v12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-warm-dark mb-3">
          식탁일기에 오신 걸<br />환영해요
        </h1>
        <p className="text-sm text-warm-light leading-relaxed">
          함께 먹은 한 끼를 사진으로 남기고,<br />
          먹은 날들을 달력에 차곡차곡 기록해보세요.
        </p>
        <p className="text-xs text-cream-400 mt-6">설정은 나중에 언제든 바꿀 수 있어요</p>
      </div>
    )
  }

  function renderStep1() {
    return (
      <div className="flex flex-col px-8 pt-4">
        <h2 className="text-xl font-bold text-warm-dark mb-2">누구와 함께 기록할까요?</h2>
        <p className="text-sm text-warm-light mb-8">
          식탁일기는 함께 먹은 기록을<br />
          하나의 공간에 모아두는 방식이에요.
        </p>
        {WHO_OPTIONS.map(option => (
          <button
            key={option.label}
            onClick={() => {
              setSelectedType(option)
              goNext()
            }}
            className="w-full text-left px-5 py-4 mb-3 bg-white rounded-2xl border border-cream-200 flex items-center gap-3 active:border-warm-brown transition-colors">
            <span className="text-2xl">{option.emoji}</span>
            <span className="font-medium text-warm-dark">{option.label}</span>
          </button>
        ))}
      </div>
    )
  }

  function renderStep2() {
    return (
      <div className="flex flex-col px-8 pt-4 overflow-y-auto">
        <h2 className="text-xl font-bold text-warm-dark mb-2">
          식탁을 만들거나<br />초대받은 곳에 들어가세요
        </h2>
        <p className="text-sm text-warm-light mb-8">
          함께 기록할 공간을 만들고,<br />
          초대 코드로 다른 사람을 초대할 수 있어요.
        </p>

        <div className="bg-white rounded-2xl border border-cream-200 p-5 mb-3">
          <h3 className="font-semibold text-warm-dark mb-3">새 식탁 만들기</h3>
          {/* uncontrolled input — onChange 없으므로 타이핑 시 re-render 없음 */}
          <input
            ref={spaceNameRef}
            defaultValue={selectedType?.spaceName || '우리 식탁'}
            placeholder={selectedType?.spaceName || '우리 식탁'}
            style={{ fontSize: 16 }}
            className="w-full px-4 py-3 rounded-xl border border-cream-300 bg-cream-50 text-warm-dark outline-none focus:border-warm-light"
          />
          <button
            onClick={handleCreateSpace}
            disabled={creating}
            className="w-full mt-3 bg-warm-brown text-white rounded-xl py-3 font-medium disabled:opacity-50">
            {creating ? '만드는 중...' : '만들기'}
          </button>
        </div>

        <div className="flex items-center gap-3 my-2">
          <div className="flex-1 h-px bg-cream-200" />
          <span className="text-xs text-cream-400">또는</span>
          <div className="flex-1 h-px bg-cream-200" />
        </div>

        <button
          onClick={() => setShowJoinInput(v => !v)}
          className="w-full border border-cream-300 text-warm-dark rounded-xl py-3 font-medium">
          초대 코드로 참가하기
        </button>

        {showJoinInput && (
          <div className="mt-3">
            <input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="6자리 코드 입력"
              maxLength={6}
              style={{ fontSize: 16 }}
              className="w-full px-4 py-3 rounded-xl border border-cream-300 bg-cream-50 text-center font-mono tracking-widest text-lg text-warm-dark outline-none focus:border-warm-light"
            />
            <button
              onClick={handleJoinSpace}
              disabled={joinCode.length !== 6 || joining}
              className="w-full mt-2 bg-warm-brown text-white rounded-xl py-3 font-medium disabled:opacity-50">
              {joining ? '참가 중...' : '참가하기'}
            </button>
          </div>
        )}

        {spaceError && (
          <p className="text-xs text-red-400 mt-3 text-center">{spaceError}</p>
        )}
      </div>
    )
  }

  function renderStep3() {
    return (
      <div className="flex flex-col items-center px-8 pt-4 text-center">
        <div className="w-full bg-cream-100 rounded-2xl p-5 mb-8">
          <div className="grid grid-cols-7 gap-1 text-xs">
            {['일', '월', '화', '수', '목', '금', '토'].map(d => (
              <div key={d} className="text-center text-cream-400 py-1">{d}</div>
            ))}
            {Array.from({ length: 30 }, (_, i) => i + 1).map(d => (
              <div key={d}
                className={`text-center py-1.5 rounded-lg text-xs font-medium
                  ${[3, 7, 12, 18, 24].includes(d)
                    ? 'bg-warm-brown text-white'
                    : 'text-warm-dark'}`}>
                {d}
              </div>
            ))}
          </div>
        </div>
        <h2 className="text-xl font-bold text-warm-dark mb-3">먹은 날들이 달력에 쌓여요</h2>
        <p className="text-sm text-warm-light leading-relaxed">
          사진으로 남긴 한 끼는<br />
          날짜별로 달력에 정리돼요.<br /><br />
          나중에 달력을 넘기다 보면<br />
          그날 먹은 음식과 장소를 다시 볼 수 있어요.
        </p>
      </div>
    )
  }

  function renderStep4() {
    return (
      <div className="flex flex-col items-center px-8 pt-4 text-center">
        <div className="w-24 h-24 bg-cream-100 rounded-full flex items-center justify-center mb-8">
          <svg viewBox="0 0 24 24" fill="none" stroke="#6b4f3a" strokeWidth="1.6" className="w-12 h-12" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
        </div>

        <h2 className="text-xl font-bold text-warm-dark mb-3">
          우리만의 맛집 지도
        </h2>
        <p className="text-sm text-warm-light leading-relaxed">
          식사를 기록할 때 장소를 입력하면<br />
          지도에 핀으로 표시돼요.<br /><br />
          우리가 함께 다녀온 곳들이<br />
          지도 위에 하나씩 쌓여가요.
        </p>

        <div className="w-full bg-cream-100 rounded-2xl p-6 mt-6">
          <div className="relative h-32 bg-cream-200 rounded-xl overflow-hidden">
            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-1/3 left-0 right-0 h-px bg-warm-light" />
              <div className="absolute top-2/3 left-0 right-0 h-px bg-warm-light" />
              <div className="absolute left-1/3 top-0 bottom-0 w-px bg-warm-light" />
              <div className="absolute left-2/3 top-0 bottom-0 w-px bg-warm-light" />
            </div>
            {[
              { top: '20%', left: '25%', color: 'bg-amber-400' },
              { top: '50%', left: '55%', color: 'bg-pink-400' },
              { top: '30%', left: '70%', color: 'bg-amber-400' },
            ].map((pin, i) => (
              <div
                key={i}
                style={{ top: pin.top, left: pin.left }}
                className={`absolute w-4 h-4 ${pin.color} rounded-full border-2 border-white shadow-sm -translate-x-1/2 -translate-y-1/2`}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  function renderStep5() {
    return (
      <div className="flex flex-col items-center px-8 pt-4 text-center">
        <div className="w-24 h-24 bg-cream-100 rounded-full flex items-center justify-center mb-8">
          <svg viewBox="0 0 24 24" fill="none" stroke="#6b4f3a" strokeWidth="1.6" className="w-12 h-12" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </div>

        <h2 className="text-xl font-bold text-warm-dark mb-3">
          가고 싶은 곳을 저장해요
        </h2>
        <p className="text-sm text-warm-light leading-relaxed">
          다음에 가보고 싶은 곳을 미리 저장해두면<br />
          지도에서 한눈에 볼 수 있어요.<br /><br />
          "오늘 어디 가지?" 버튼을 누르면<br />
          저장된 곳 중 하나를 랜덤으로 추천해드려요.
        </p>

        <div className="w-full bg-white rounded-2xl border border-cream-200 p-4 mt-6 text-left">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="font-semibold text-warm-dark text-sm">연남동 파스타집</p>
              <p className="text-xs text-cream-400">양식 · 0.4km</p>
            </div>
            <span className="text-xs bg-pink-50 text-pink-500 px-2 py-1 rounded-full">
              #로맨틱
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-warm-brown text-white text-xs rounded-lg py-1.5 text-center">
              ♡ 가고싶어요 2
            </div>
            <div className="flex-1 border border-cream-300 text-warm-dark text-xs rounded-lg py-1.5 text-center">
              지도에서 확인
            </div>
          </div>
        </div>
      </div>
    )
  }

  function renderStep6() {
    return (
      <div className="flex flex-col items-center px-8 pt-4 text-center">
        <div className="w-20 h-20 bg-cream-100 rounded-full flex items-center justify-center mb-8">
          <svg className="w-9 h-9 text-warm-brown" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-warm-dark mb-3">첫 식탁을 남겨볼까요?</h2>
        <p className="text-sm text-warm-light leading-relaxed mb-8">
          오늘 먹은 음식 사진이 있다면<br />
          첫 기록으로 남겨보세요.
        </p>
        <div className="w-full flex flex-col">
          <button
            onClick={() => handleComplete({ openMealForm: true })}
            className="w-full bg-warm-brown text-white rounded-2xl py-4 font-semibold mb-3 active:scale-[0.99] transition-transform">
            첫 식사 기록하기
          </button>
          <div className="bg-cream-100 rounded-2xl p-4 mb-3">
            <p className="text-xs text-cream-400 text-center mb-3">올릴 사진이 많다면 이 기능을 활용해보세요</p>
            <button
              onClick={() => handleComplete({ openBulkUpload: true })}
              className="w-full border border-warm-brown text-warm-brown rounded-xl py-3 font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.99] transition-transform">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-4 h-4">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 21V9" />
              </svg>
              사진 한번에 올리기
            </button>
          </div>
          <button
            onClick={() => handleComplete({})}
            className="w-full text-warm-light text-sm py-2">
            나중에 할게요
          </button>
        </div>
      </div>
    )
  }

  const stepRenderers = [renderStep0, renderStep1, renderStep2, renderStep3, renderStep4, renderStep5, renderStep6]

  function renderBottomButton() {
    if (currentStep === 0) {
      return (
        <button onClick={goNext} className="w-full bg-warm-brown text-white rounded-2xl py-4 font-semibold active:scale-[0.99] transition-transform">
          시작하기
        </button>
      )
    }
    if (currentStep === 3) {
      return (
        <button onClick={goNext} className="w-full bg-warm-brown text-white rounded-2xl py-4 font-semibold active:scale-[0.99] transition-transform">
          좋아요
        </button>
      )
    }
    if (currentStep === 4) {
      return (
        <button onClick={goNext} className="w-full bg-warm-brown text-white rounded-2xl py-4 font-semibold active:scale-[0.99] transition-transform">
          다음
        </button>
      )
    }
    if (currentStep === 5) {
      return (
        <button onClick={goNext} className="w-full bg-warm-brown text-white rounded-2xl py-4 font-semibold active:scale-[0.99] transition-transform">
          좋아요
        </button>
      )
    }
    return null
  }

  return (
    <div className="fixed inset-0 bg-cream-50 flex flex-col z-50"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}>

      {/* 헤더 행 — 뒤로가기 / 건너뛰기 (제목과 별도 행으로 분리해 겹침 방지) */}
      <div className="flex items-center justify-between px-6 pt-3 pb-1 shrink-0 h-14">
        {currentStep > 0 ? (
          <button
            onClick={() => goStep(currentStep - 1)}
            className="w-9 h-9 rounded-full bg-cream-100 flex items-center justify-center active:scale-95 transition-transform"
            aria-label="뒤로">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-5 h-5 text-warm-dark">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        ) : (
          <span className="w-9 h-9" />
        )}
        {(currentStep === 1 || currentStep === 2) ? (
          <button onClick={goNext} className="text-sm text-cream-400 px-1 active:opacity-70 transition-opacity">
            건너뛰기
          </button>
        ) : (
          <span />
        )}
      </div>

      {/* 콘텐츠 — 함수 직접 호출로 DOM 유지 (포커스 버그 방지) */}
      <div
        className="flex-1 overflow-hidden transition-opacity duration-200"
        style={{ opacity: fade ? 0 : 1 }}>
        {stepRenderers[currentStep]()}
      </div>

      {/* 하단 영역 */}
      <div className="px-8" style={{ paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))' }}>
        <div className="flex justify-center gap-2 mb-6">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300
                ${i === currentStep ? 'w-6 h-2 bg-warm-brown' : 'w-2 h-2 bg-cream-300'}`}
            />
          ))}
        </div>
        {renderBottomButton()}
      </div>
    </div>
  )
}
