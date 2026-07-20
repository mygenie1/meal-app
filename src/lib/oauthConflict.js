// 카카오 등 다른 provider로 이미 가입된 이메일에 애플 등 새 provider로 로그인 시도하면
// Supabase 가 자동 계정 연결(auth-identity-linking)을 거부하며 에러를 돌려준다 —
// 정확한 문구/코드가 경로(웹 OAuth 콜백 쿼리 vs 네이티브 signInWithIdToken 응답)와
// 버전마다 달라 폭넓게 키워드로 매칭한다. 카카오(App.jsx appUrlOpen)/애플(AppContext
// 네이티브 signInApple) 양쪽 공용 — 복제 금지, 한쪽 수정 시 양쪽 반영됨.
const EMAIL_CONFLICT_ERROR_RE = /email|already|multiple.?accounts|identity_already_exists|linking/i

export const EMAIL_CONFLICT_MESSAGE = '이미 가입된 이메일이에요. 기존에 사용하던 방식(카카오 등)으로 로그인해 주세요.'

export function isEmailConflictError(message) {
  return !!message && EMAIL_CONFLICT_ERROR_RE.test(message)
}
