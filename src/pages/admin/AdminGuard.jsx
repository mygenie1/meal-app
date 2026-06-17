import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// 클라이언트 측 토큰 페이로드 디코딩 (서명 검증 없음 — 만료 여부만 체크)
// 실제 서명 검증은 서버(admin-verify)에서만 수행
export function decodeAdminToken(token) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(padded + '='.repeat((4 - padded.length % 4) % 4)))
    if (!payload.exp || payload.exp < Date.now() / 1000) return null
    return payload
  } catch {
    return null
  }
}

export function getAdminToken() {
  return sessionStorage.getItem('admin_token')
}

export function clearAdminToken() {
  sessionStorage.removeItem('admin_token')
}

export default function AdminGuard({ children }) {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [payload, setPayload] = useState(null)

  useEffect(() => {
    const token = getAdminToken()
    if (!token) {
      navigate('/admin/login', { replace: true })
      return
    }
    const decoded = decodeAdminToken(token)
    if (!decoded) {
      clearAdminToken()
      navigate('/admin/login', { replace: true })
      return
    }
    setPayload(decoded)
    setChecking(false)
  }, [])

  if (checking) {
    return (
      <div className="min-h-svh flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 rounded-full border-2 border-stone-200 border-t-stone-600 animate-spin" />
      </div>
    )
  }

  return children(payload)
}
