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

export default function PrivacyPage() {
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

        <h1 className="text-xl font-bold text-warm-dark mb-1 mt-2">개인정보처리방침</h1>
        <p className="text-xs text-cream-400 mb-6">
          운영: {OPERATOR} · 시행일: {EFFECTIVE_DATE}
        </p>

        <Section title="1. 수집하는 개인정보 항목">
          <p>식탁일기는 서비스 제공에 필요한 최소한의 정보만 수집합니다.</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li><span className="font-medium">필수</span>: 이메일 주소, 닉네임/이름</li>
            <li><span className="font-medium">자동 수집</span>: 카카오 로그인 시 카카오 계정 이메일·이름, 접속 기기 정보(OS, 브라우저 유형)</li>
            <li><span className="font-medium">서비스 이용 중 생성</span>: 식사 기록(날짜·제목·사진·위치·메모·별점·댓글), 스페이스 정보, 재료 목록, 가고 싶은 곳 위시리스트</li>
            <li><span className="font-medium">선택</span>: 푸시 알림 수신을 위한 FCM 기기 토큰(이용자 동의 후 수집)</li>
          </ul>
        </Section>

        <Section title="2. 개인정보 수집·이용 목적">
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>회원 가입·로그인 및 본인 확인</li>
            <li>식사 기록, 스페이스 공유 등 서비스 핵심 기능 제공</li>
            <li>위치 정보 기반 맛집 지도·지오코딩 기능 제공</li>
            <li>새 기록·댓글·별점 등 활동 알림 발송(FCM 푸시)</li>
            <li>서비스 오류 분석 및 개선</li>
          </ul>
        </Section>

        <Section title="3. 개인정보 보유·이용 기간 및 파기">
          <p>개인정보는 서비스 이용 기간 동안 보유하며, 회원 탈퇴 시 즉시 파기합니다.</p>
          <p>단, 관계 법령에 따라 일정 기간 보존이 필요한 경우 해당 기간 동안 별도 보관 후 파기합니다.</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>전자상거래 등에서의 소비자 보호에 관한 법률: 계약·청약 철회 기록 5년, 대금 결제 기록 5년, 소비자 불만 3년 (현재 유료 서비스 없음)</li>
            <li>통신비밀보호법: 서비스 이용 관련 로그 3개월</li>
          </ul>
          <p>계정 탈퇴 시 이메일 주소, 닉네임, 식사 기록, 사진, 댓글, 별점, 알림, 재료 목록, 스페이스 멤버십 정보가 삭제됩니다.</p>
        </Section>

        <Section title="4. 개인정보 처리 위탁">
          <p>서비스 제공을 위해 아래 업체에 개인정보 처리를 위탁합니다.</p>
          <div className="overflow-hidden rounded-lg border border-cream-200 mt-1">
            <table className="w-full text-[11px]">
              <thead className="bg-cream-100">
                <tr>
                  <th className="py-1.5 px-2 text-left text-warm-light font-medium">수탁사</th>
                  <th className="py-1.5 px-2 text-left text-warm-light font-medium">위탁 업무</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                <tr>
                  <td className="py-1.5 px-2 text-warm-dark">Supabase Inc.</td>
                  <td className="py-1.5 px-2 text-warm-light">데이터베이스·스토리지·인증 인프라</td>
                </tr>
                <tr>
                  <td className="py-1.5 px-2 text-warm-dark">Google LLC (Firebase)</td>
                  <td className="py-1.5 px-2 text-warm-light">푸시 알림(FCM) 발송</td>
                </tr>
                <tr>
                  <td className="py-1.5 px-2 text-warm-dark">Google LLC (Google Analytics)</td>
                  <td className="py-1.5 px-2 text-warm-light">서비스 이용 통계·방문 분석</td>
                </tr>
                <tr>
                  <td className="py-1.5 px-2 text-warm-dark">Vercel Inc.</td>
                  <td className="py-1.5 px-2 text-warm-light">웹 서버 호스팅</td>
                </tr>
                <tr>
                  <td className="py-1.5 px-2 text-warm-dark">Kakao Corp.</td>
                  <td className="py-1.5 px-2 text-warm-light">카카오 소셜 로그인, 지도·장소 검색 API</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-1.5">각 수탁사의 개인정보 처리 방침은 해당 업체 홈페이지에서 확인하실 수 있습니다.</p>
          <p className="mt-1.5"><span className="font-medium">Google Analytics 안내</span>: 식탁일기는 서비스 개선을 위해 Google Analytics(GA4)를 사용하여 방문 통계를 수집합니다. 수집 항목은 페이지뷰, 기기·브라우저 정보, 대략적 위치(국가/지역 수준)이며, 이 과정에서 쿠키가 사용됩니다. 식탁일기는 이메일·계정 식별자(user_id) 등 개인을 식별할 수 있는 정보를 Google Analytics로 전송하지 않으며, 익명화된 이용 통계만 수집합니다.</p>
        </Section>

        <Section title="5. 제휴 마케팅 (쿠팡 파트너스)">
          <p>식탁일기는 쿠팡 파트너스 활동의 일환으로, 서비스 내 일부 배너를 통해 쿠팡 상품을 소개할 수 있습니다. 이 경우 이용자의 구매 여부에 따라 운영자에게 일정 수수료가 지급됩니다.</p>
          <p>제휴 배너는 하단에 "<span className="font-medium">쿠팡 파트너스 활동으로 일정 수수료를 받습니다</span>" 문구가 표시됩니다.</p>
          <p>이용자의 개인정보는 제휴 목적으로 쿠팡에 제공되지 않습니다.</p>
        </Section>

        <Section title="6. 이용자의 권리">
          <p>이용자는 언제든지 다음 권리를 행사할 수 있습니다.</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>개인정보 열람·수정: 앱 내 설정 화면에서 직접 변경</li>
            <li>계정 삭제(탈퇴): 설정 → 회원탈퇴 (즉시 처리) — <a href="/account-deletion" className="font-medium text-warm-brown underline underline-offset-2">계정 삭제 안내</a></li>
            <li>개인정보 처리에 관한 문의·이의 제기: {CONTACT}</li>
          </ul>
        </Section>

        <Section title="7. 푸시 알림 및 위치 정보">
          <p><span className="font-medium">푸시 알림</span>: 이용자가 직접 동의한 경우에만 FCM 기기 토큰이 수집되며, 설정 화면에서 언제든지 비활성화할 수 있습니다. 기기 운영체제 알림 설정에서도 비활성화할 수 있습니다.</p>
          <p><span className="font-medium">위치 정보</span>: 현재 위치 기반 지도 기능 사용 시 이용자 기기에서 직접 위치 정보를 요청합니다. 위치 정보는 서버에 저장되지 않으며, 지도 표시에만 사용됩니다. 식사 기록 시 입력되는 식당 위치(위도·경도)는 이용자가 직접 입력한 정보입니다.</p>
        </Section>

        <Section title="8. 개인정보 보호책임자">
          <p>개인정보 보호 관련 불만이나 문의는 아래로 연락해 주세요.</p>
          <ul className="space-y-0.5 mt-1">
            <li className="font-medium text-warm-dark">운영자: {OPERATOR}</li>
            <li>이메일: <span className="font-medium text-warm-brown">{CONTACT}</span></li>
          </ul>
          <p className="mt-1.5">접수된 문의는 영업일 기준 5일 이내에 답변드립니다.</p>
        </Section>

        <Section title="9. 방침 변경 고지">
          <p>개인정보처리방침을 변경할 경우 시행 7일 전에 서비스 내 공지합니다. 중요한 권리·의무 변경은 30일 전에 공지합니다.</p>
        </Section>

        <div className="pt-4 border-t border-cream-200 text-[11px] text-cream-400 space-y-0.5">
          <p>운영: {OPERATOR}</p>
          <p>시행일: {EFFECTIVE_DATE}</p>
        </div>
      </div>
    </div>
  )
}
