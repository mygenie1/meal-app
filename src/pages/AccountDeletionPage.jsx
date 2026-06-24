import { useNavigate, Link } from 'react-router-dom'

// 시행일 — 개인정보처리방침과 동일하게 유지
const EFFECTIVE_DATE = '2026년 6월 19일'
const APP_NAME = '식탁일기'
const OPERATOR = '팀 마이지니'
const CONTACT = 'admin@siktakilgi.com'

function Section({ title, children }) {
  return (
    <section className="mb-7">
      <h2 className="text-sm font-bold text-warm-dark mb-2.5 pb-1.5 border-b border-cream-200">{title}</h2>
      <div className="text-xs text-warm-dark leading-relaxed space-y-1.5">{children}</div>
    </section>
  )
}

export default function AccountDeletionPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-svh bg-cream-50">
      <div className="max-w-lg mx-auto px-5 pb-16">
        {/* 헤더 */}
        <div className="sticky top-0 bg-cream-50 py-4 mb-2 border-b border-cream-100 z-10">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-warm-light hover:text-warm-brown transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            돌아가기
          </button>
        </div>

        <h1 className="text-xl font-bold text-warm-dark mb-1 mt-2">계정 및 데이터 삭제 안내</h1>
        <p className="text-xs text-cream-400 mb-6">
          앱: {APP_NAME} · 개발자: {OPERATOR} · 시행일: {EFFECTIVE_DATE}
        </p>

        <Section title="안내">
          <p>
            {APP_NAME}({OPERATOR})은(는) 이용자가 언제든지 본인의 계정과 관련 데이터를 삭제할 수 있도록
            지원합니다. 아래 방법으로 직접 탈퇴하거나, 운영자에게 삭제를 요청하실 수 있습니다.
          </p>
        </Section>

        <Section title="1. 앱에서 직접 계정 삭제하기">
          <p>{APP_NAME} 앱 안에서 직접 계정을 삭제(회원 탈퇴)할 수 있습니다.</p>
          <ol className="list-decimal list-inside space-y-1 ml-1">
            <li>{APP_NAME} 앱을 실행하고 로그인합니다.</li>
            <li>하단 탭에서 <span className="font-medium">스페이스</span> 화면으로 이동합니다.</li>
            <li>우측 상단의 <span className="font-medium">설정</span>(톱니바퀴) 버튼을 누릅니다.</li>
            <li>설정 화면 맨 아래의 <span className="font-medium">회원 탈퇴</span>를 누릅니다.</li>
            <li>안내에 따라 2단계 확인(안내 확인 → "탈퇴" 입력)을 완료하면 계정이 즉시 삭제됩니다.</li>
          </ol>
        </Section>

        <Section title="2. 운영자에게 삭제 요청하기">
          <p>
            앱에서 직접 삭제하기 어려운 경우, 아래 이메일로 계정 삭제를 요청해 주세요.
            본인 확인 후 처리해 드립니다.
          </p>
          <ul className="space-y-0.5 mt-1">
            <li>이메일: <span className="font-medium text-warm-brown">{CONTACT}</span></li>
            <li>요청 시 가입한 이메일 주소(또는 카카오 계정 이메일)를 함께 알려주세요.</li>
          </ul>
          <p className="mt-1.5">접수된 요청은 영업일 기준 5일 이내에 처리됩니다.</p>
        </Section>

        <Section title="3. 삭제되는 데이터">
          <p>계정 삭제(탈퇴) 시 아래 데이터가 삭제됩니다.</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>계정 정보: 이메일 주소, 닉네임/이름, 프로필 사진</li>
            <li>식사 기록: 날짜·제목·사진·위치·메모·별점·한줄평</li>
            <li>작성한 댓글 및 별점</li>
            <li>가보고 싶은 곳(위시리스트) 및 재료 목록 데이터</li>
            <li>스페이스 멤버십 정보</li>
            <li>푸시 알림 기기 토큰(FCM) 및 알림 내역</li>
          </ul>
          <p className="mt-1.5">
            ※ 여러 명이 함께 쓰는 스페이스의 공동 콘텐츠 중 다른 구성원이 작성한 기록은 유지되며,
            탈퇴한 이용자의 식별 정보(작성자 표시 등)는 제거됩니다.
          </p>
        </Section>

        <Section title="4. 데이터 보관 기간">
          <p>회원 탈퇴 시 위 데이터는 <span className="font-medium">즉시 삭제</span>되며 복구되지 않습니다.</p>
          <p>
            다만 관계 법령에 따라 일정 기간 보존이 필요한 항목은 해당 기간 동안 별도 보관 후 파기합니다.
          </p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>전자상거래 등에서의 소비자 보호에 관한 법률: 계약·청약 철회 기록 5년, 대금 결제 기록 5년, 소비자 불만 3년 (현재 유료 서비스 없음)</li>
            <li>통신비밀보호법: 서비스 이용 관련 로그 3개월</li>
          </ul>
          <p className="mt-1.5">
            자세한 내용은 <Link to="/privacy" className="font-medium text-warm-brown underline underline-offset-2">개인정보처리방침</Link>을 참고해 주세요.
          </p>
        </Section>

        <Section title="5. 문의">
          <p>계정 및 데이터 삭제와 관련한 문의는 아래로 연락해 주세요.</p>
          <ul className="space-y-0.5 mt-1">
            <li className="font-medium text-warm-dark">앱: {APP_NAME}</li>
            <li className="font-medium text-warm-dark">개발자: {OPERATOR}</li>
            <li>이메일: <span className="font-medium text-warm-brown">{CONTACT}</span></li>
          </ul>
        </Section>

        <div className="pt-4 border-t border-cream-200 text-[11px] text-cream-400 space-y-0.5">
          <p>앱: {APP_NAME} · 개발자: {OPERATOR}</p>
          <p>시행일: {EFFECTIVE_DATE}</p>
        </div>
      </div>
    </div>
  )
}
