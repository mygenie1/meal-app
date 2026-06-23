// Google Analytics (GA4) — SPA 라우트 추적
// 측정 ID: G-BBFV8FZ4LG. gtag.js는 index.html에서 로드(send_page_view:false).
// 페이지뷰는 라우트 변경마다 여기서 수동 전송 → 최초/이동 모두 1회씩, 중복 방지.

export const GA_ID = 'G-BBFV8FZ4LG'

// 민감/일회성 쿼리 파라미터 — page_path에서 제거 (개인정보·노이즈 방지).
// meal: 푸시 딥링크 게시글 id, code: 스페이스 초대 코드, access/refresh_token: 인증 토큰.
const STRIP_PARAMS = ['meal', 'code', 'access_token', 'refresh_token']

// pathname + 정제된 search 문자열을 반환 (민감 파라미터 제거)
export function sanitizePath(pathname, search) {
  if (!search) return pathname
  const params = new URLSearchParams(search)
  STRIP_PARAMS.forEach((p) => params.delete(p))
  const qs = params.toString()
  return qs ? `${pathname}?${qs}` : pathname
}

// 페이지뷰 1건 전송. 사용자 식별정보(user_id/이메일 등)는 절대 포함하지 않음.
export function trackPageView(pathname, search) {
  // 개발 환경은 전송 안 함 (실데이터 오염 방지). index.html이 localhost ga-disable도 함께 처리.
  if (!import.meta.env.PROD) return
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return

  const path = sanitizePath(pathname, search)
  window.gtag('event', 'page_view', {
    page_path: path,
    // origin + 정제 경로만 — 해시(#access_token 등) 제외로 토큰 유출 방지
    page_location: window.location.origin + path,
    page_title: document.title,
  })
}
