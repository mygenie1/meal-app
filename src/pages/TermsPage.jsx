import { useNavigate } from 'react-router-dom'

// 시행일 — 출시일에 맞게 수정
const EFFECTIVE_DATE = '2026년 6월 19일'
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

export default function TermsPage() {
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

        <h1 className="text-xl font-bold text-warm-dark mb-1 mt-2">이용약관</h1>
        <p className="text-xs text-cream-400 mb-6">
          운영: {OPERATOR} · 시행일: {EFFECTIVE_DATE}
        </p>

        <Section title="제1조 목적">
          <p>본 약관은 팀 마이지니(이하 "운영자")가 제공하는 식탁일기(siktakilgi.com, 이하 "서비스")의 이용 조건 및 절차를 규정합니다.</p>
        </Section>

        <Section title="제2조 서비스 정의">
          <p>식탁일기는 이용자가 식사 기록(사진·메모·위치 등)을 저장하고, 스페이스를 통해 가족·커플·친구 등과 공유할 수 있는 온라인 식사 다이어리 서비스입니다.</p>
          <p>서비스는 웹 브라우저 및 PWA(홈 화면 설치) 방식으로 제공됩니다.</p>
        </Section>

        <Section title="제3조 약관의 효력과 변경">
          <p>본 약관은 서비스 화면에 게시함으로써 효력이 발생합니다.</p>
          <p>운영자는 약관을 변경할 경우 변경 사항을 시행 7일 전에 서비스 내 공지하며, 변경 약관에 동의하지 않는 이용자는 서비스 이용을 중단하고 탈퇴할 수 있습니다.</p>
          <p>공지 후 계속 이용할 경우 변경 약관에 동의한 것으로 간주됩니다.</p>
        </Section>

        <Section title="제4조 이용 계약 및 계정">
          <p>이용자는 카카오 로그인 또는 이메일/비밀번호 방식으로 계정을 생성하여 서비스를 이용할 수 있습니다.</p>
          <p>계정 정보(이메일, 비밀번호 등)는 이용자 본인이 관리하며, 타인에게 양도하거나 공유할 수 없습니다.</p>
          <p>본인의 계정 도용 또는 부정 이용에 의한 피해에 대해 운영자는 책임을 지지 않습니다.</p>
          <p>만 14세 미만인 경우 법정대리인의 동의가 필요합니다.</p>
        </Section>

        <Section title="제5조 이용자의 의무">
          <p>이용자는 다음 행위를 해서는 안 됩니다.</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>타인의 개인정보, 계정을 무단으로 이용하는 행위</li>
            <li>허위 정보를 등록하거나 서비스를 부정한 목적으로 이용하는 행위</li>
            <li>타인의 저작권, 초상권, 명예 등 권리를 침해하는 콘텐츠 게시</li>
            <li>서버나 네트워크에 과부하를 주거나 서비스 운영을 방해하는 행위</li>
            <li>음란·폭력·혐오 등 불법적이거나 사회통념에 반하는 콘텐츠 게시</li>
            <li>기타 관련 법령에 위반되는 행위</li>
          </ul>
          <p className="mt-1.5">위반 시 운영자는 사전 통보 없이 해당 콘텐츠 삭제 또는 계정 이용 제한 조치를 취할 수 있습니다.</p>
        </Section>

        <Section title="제6조 게시물의 권리와 책임">
          <p>이용자가 서비스에 등록한 식사 기록, 사진, 메모 등 모든 콘텐츠(이하 "게시물")의 저작권은 이용자 본인에게 있습니다.</p>
          <p>이용자는 운영자에게 서비스 제공·운영·개선 목적에 한하여 게시물을 사용할 수 있는 비독점적·무상 권리를 허락합니다.</p>
          <p>게시물에 제3자의 저작물이 포함된 경우, 이에 대한 법적 책임은 해당 이용자에게 있습니다.</p>
          <p>계정 탈퇴 시 게시물은 삭제되며, 스페이스를 함께 사용하던 다른 구성원의 접근도 중단됩니다.</p>
        </Section>

        <Section title="제7조 서비스의 변경 및 중단">
          <p>운영자는 서비스의 전부 또는 일부를 운영 정책에 따라 변경·종료할 수 있으며, 이 경우 사전에 서비스 내 공지합니다.</p>
          <p>서버 점검, 설비 장애, 천재지변 등 불가피한 사유로 서비스가 일시 중단될 수 있으며, 운영자는 이로 인한 손해에 대해 고의·중과실이 없는 한 책임을 지지 않습니다.</p>
        </Section>

        <Section title="제8조 면책">
          <p>운영자는 다음 사항에 대해 책임을 지지 않습니다.</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>이용자 간 분쟁으로 인한 피해</li>
            <li>이용자가 직접 제공한 정보의 부정확·허위로 인한 손해</li>
            <li>이용자의 귀책 사유로 인한 서비스 이용 장애</li>
            <li>천재지변, 전쟁, 해킹 등 불가항력으로 인한 서비스 장애</li>
            <li>이용자 기기·네트워크 환경으로 인한 오류</li>
          </ul>
        </Section>

        <Section title="제9조 준거법 및 관할">
          <p>본 약관은 대한민국 법령에 따라 해석되며, 서비스와 관련한 분쟁은 대한민국 법원을 관할 법원으로 합니다.</p>
        </Section>

        <Section title="제10조 문의">
          <p>서비스 이용 관련 문의는 아래 이메일로 연락해 주세요.</p>
          <p className="font-medium text-warm-brown">{CONTACT}</p>
        </Section>

        <div className="pt-4 border-t border-cream-200 text-[11px] text-cream-400 space-y-0.5">
          <p>운영: {OPERATOR}</p>
          <p>시행일: {EFFECTIVE_DATE}</p>
        </div>
      </div>
    </div>
  )
}
