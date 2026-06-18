import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminGuard, { clearAdminToken, getAdminToken } from './AdminGuard'

const ADMIN_MANAGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-manage`
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const PERMISSION_LABELS = {
  view_users:         '사용자 목록 조회',
  delete_users:       '사용자 삭제',
  view_spaces:        '스페이스 조회',
  read_space_content: '스페이스 콘텐츠 조회',
  view_feedback:      '피드백 조회',
  manage_admins:      '관리자 관리',
}

const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS)

async function adminCall(action, body = {}) {
  const token = getAdminToken()
  return fetch(ADMIN_MANAGE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey':        SUPABASE_ANON_KEY,
      'x-admin-token': token ?? '',
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ action, ...body }),
  })
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function PermSummary({ permissions, isSuper }) {
  if (isSuper) {
    return <span className="text-xs text-amber-600 font-medium">전체 권한</span>
  }
  const granted = ALL_PERMISSIONS.filter(k => permissions?.[k] === true)
  if (granted.length === 0) {
    return <span className="text-xs text-stone-400">권한 없음</span>
  }
  return (
    <div className="flex flex-wrap gap-1">
      {granted.map(k => (
        <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-500">
          {PERMISSION_LABELS[k]}
        </span>
      ))}
    </div>
  )
}

// 삭제 확인 모달
function DeleteConfirmModal({ admin, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-xs">
        <h3 className="text-sm font-semibold text-warm-dark mb-1">관리자 삭제</h3>
        <p className="text-xs text-warm-light mb-1">
          <span className="font-semibold text-warm-dark">{admin.username}</span> 계정을 삭제할까요?
        </p>
        <p className="text-xs text-red-500 mb-5">이 작업은 되돌릴 수 없습니다.</p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2 text-xs text-warm-light rounded-xl border border-cream-300
              hover:bg-cream-50 transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2 text-xs font-medium text-white bg-red-500 rounded-xl
              hover:bg-red-600 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? '삭제 중…' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AdminsContent({ payload }) {
  const navigate  = useNavigate()
  const isSuper   = payload.role === 'super'
  const canManage = isSuper || payload.permissions?.manage_admins === true

  const [admins,      setAdmins]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)

  // 생성 폼
  const [showCreate,  setShowCreate]  = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPerms,    setNewPerms]    = useState({})
  const [creating,    setCreating]    = useState(false)
  const [createError, setCreateError] = useState(null)

  // 권한 수정 (인라인 expand)
  const [editingId,   setEditingId]   = useState(null)
  const [editPerms,   setEditPerms]   = useState({})
  const [savingPerms, setSavingPerms] = useState(false)

  // 활성/비활성 토글
  const [togglingId,  setTogglingId]  = useState(null)

  // 삭제 확인
  const [confirmDelete, setConfirmDelete] = useState(null) // admin 객체
  const [deletingId,    setDeletingId]    = useState(null)

  useEffect(() => {
    if (!canManage) {
      navigate('/admin', { replace: true })
      return
    }
    loadAdmins()
  }, [])

  async function loadAdmins() {
    setLoading(true)
    setError(null)
    try {
      const res  = await adminCall('list')
      const body = await res.json()
      if (!res.ok) {
        if (res.status === 401) { navigate('/admin/login', { replace: true }); return }
        setError(body.error || '불러오기 실패')
        return
      }
      setAdmins(body.admins ?? [])
    } catch {
      setError('네트워크 오류 — 다시 시도해주세요')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!newUsername.trim()) { setCreateError('아이디를 입력해주세요'); return }
    if (!newPassword)        { setCreateError('비밀번호를 입력해주세요'); return }
    if (newPassword.length < 8) { setCreateError('비밀번호는 8자 이상이어야 합니다'); return }

    setCreating(true)
    setCreateError(null)
    try {
      const res  = await adminCall('create', {
        username:    newUsername.trim(),
        password:    newPassword,
        permissions: newPerms,
      })
      const body = await res.json()
      if (!res.ok) {
        setCreateError(body.error || '생성 실패')
        return
      }
      setShowCreate(false)
      setNewUsername('')
      setNewPassword('')
      setNewPerms({})
      await loadAdmins()
    } catch {
      setCreateError('네트워크 오류')
    } finally {
      setCreating(false)
    }
  }

  async function handleToggle(admin) {
    setTogglingId(admin.id)
    try {
      const res  = await adminCall('toggle_active', { target_id: admin.id })
      const body = await res.json()
      if (!res.ok) {
        alert(body.error || '수정 실패')
        return
      }
      setAdmins(prev =>
        prev.map(a => a.id === admin.id ? { ...a, is_active: body.is_active } : a)
      )
    } catch {
      alert('네트워크 오류')
    } finally {
      setTogglingId(null)
    }
  }

  function startEdit(admin) {
    if (editingId === admin.id) { setEditingId(null); return }
    setEditingId(admin.id)
    setEditPerms(admin.permissions ?? {})
  }

  async function handleSavePerms(adminId) {
    setSavingPerms(true)
    try {
      const res  = await adminCall('update_permissions', {
        target_id:   adminId,
        permissions: editPerms,
      })
      const body = await res.json()
      if (!res.ok) {
        alert(body.error || '수정 실패')
        return
      }
      setAdmins(prev =>
        prev.map(a => a.id === adminId ? { ...a, permissions: { ...editPerms } } : a)
      )
      setEditingId(null)
    } catch {
      alert('네트워크 오류')
    } finally {
      setSavingPerms(false)
    }
  }

  async function handleDelete(adminId) {
    setDeletingId(adminId)
    try {
      const res  = await adminCall('delete', { target_id: adminId })
      const body = await res.json()
      if (!res.ok) {
        alert(body.error || '삭제 실패')
        return
      }
      setAdmins(prev => prev.filter(a => a.id !== adminId))
      setConfirmDelete(null)
    } catch {
      alert('네트워크 오류')
    } finally {
      setDeletingId(null)
    }
  }

  function handleLogout() {
    clearAdminToken()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="min-h-svh bg-stone-100">

      {/* 삭제 확인 모달 */}
      {confirmDelete && (
        <DeleteConfirmModal
          admin={confirmDelete}
          onConfirm={() => handleDelete(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
          loading={deletingId === confirmDelete.id}
        />
      )}

      {/* 헤더 */}
      <header className="bg-warm-brown text-white px-4 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-1.5 text-white/80 hover:text-white transition-colors shrink-0"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            <span className="text-sm">대시보드</span>
          </button>
          <span className="text-white/30 shrink-0">|</span>
          <span className="text-sm font-semibold">관리자 관리</span>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs text-white/70 hover:text-white transition-colors shrink-0 ml-2"
        >
          로그아웃
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* 목록 헤더 + 추가 버튼 */}
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-warm-dark">
            관리자 계정
            {!loading && (
              <span className="ml-2 font-normal text-warm-light">{admins.length}명</span>
            )}
          </h2>
          <button
            onClick={() => { setShowCreate(v => !v); setCreateError(null) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-warm-brown text-white
              text-xs font-medium hover:bg-warm-dark active:scale-95 transition-all shrink-0"
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            서브 관리자 추가
          </button>
        </div>

        {/* 생성 폼 */}
        {showCreate && (
          <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
            <h3 className="text-sm font-semibold text-warm-dark">새 서브 관리자</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-warm-light block mb-1">아이디</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  placeholder="관리자 아이디"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-cream-300
                    focus:outline-none focus:border-warm-brown bg-cream-50 text-warm-dark"
                />
              </div>

              <div>
                <label className="text-xs text-warm-light block mb-1">비밀번호 (8자 이상)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="비밀번호"
                  style={{ fontSize: '16px' }}
                  className="w-full px-3 py-2 rounded-xl border border-cream-300
                    focus:outline-none focus:border-warm-brown bg-cream-50 text-warm-dark"
                />
              </div>

              <div>
                <label className="text-xs text-warm-light block mb-2">권한 부여</label>
                <div className="space-y-2.5">
                  {ALL_PERMISSIONS.map(key => (
                    <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={newPerms[key] === true}
                        onChange={e => setNewPerms(prev => ({ ...prev, [key]: e.target.checked }))}
                        className="w-4 h-4 rounded accent-warm-brown"
                      />
                      <span className="text-xs text-warm-dark group-hover:text-warm-brown transition-colors">
                        {PERMISSION_LABELS[key]}
                        {key === 'manage_admins' && (
                          <span className="ml-1 text-amber-500 text-[10px]">⚠ 민감</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {createError && (
              <p className="text-xs text-red-500">{createError}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setShowCreate(false); setCreateError(null) }}
                className="flex-1 py-2 text-xs text-warm-light rounded-xl border border-cream-300
                  hover:bg-cream-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 py-2 text-xs font-medium text-white bg-warm-brown rounded-xl
                  hover:bg-warm-dark active:scale-95 transition-all disabled:opacity-50"
              >
                {creating ? '생성 중…' : '서브 관리자 생성'}
              </button>
            </div>
          </div>
        )}

        {/* 로딩 */}
        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 border-stone-200 border-t-stone-500 animate-spin" />
          </div>
        )}

        {/* 에러 */}
        {error && !loading && (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <p className="text-sm text-red-500 mb-3">{error}</p>
            <button onClick={loadAdmins} className="text-xs text-warm-brown underline">
              다시 시도
            </button>
          </div>
        )}

        {/* 관리자 카드 목록 */}
        {!loading && !error && admins.map(admin => {
          const isMe         = admin.id === payload.id
          const isAdminSuper = admin.role === 'super'
          const isExpanded   = editingId === admin.id
          const isToggling   = togglingId === admin.id
          const isDeleting   = deletingId === admin.id

          return (
            <div key={admin.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4">

                {/* 행 1: 아바타 + 이름/뱃지 + super 보호 뱃지 */}
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center
                    text-white font-bold text-sm shrink-0 ${
                    isAdminSuper ? 'bg-amber-500' : 'bg-warm-brown'
                  }`}>
                    {admin.username[0].toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold text-warm-dark break-all">
                        {admin.username}
                      </span>
                      {isMe && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium shrink-0">
                          나
                        </span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                        isAdminSuper
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-stone-100 text-stone-600'
                      }`}>
                        {isAdminSuper ? '총괄' : '서브'}
                      </span>
                      {!admin.is_active && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-500 font-medium shrink-0">
                          비활성
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-warm-light mt-0.5">
                      생성일: {formatDate(admin.created_at)}
                    </p>
                  </div>

                  {isAdminSuper && (
                    <div className="flex items-center gap-1 text-[10px] text-amber-600 shrink-0">
                      <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" viewBox="0 0 24 24">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0110 0v4"/>
                      </svg>
                      보호됨
                    </div>
                  )}
                </div>

                {/* 행 2: 권한 요약(좌) + 액션 버튼(우) */}
                <div className="flex items-center justify-between gap-3 mt-3 pl-12">
                  <div className="min-w-0 flex-1">
                    <PermSummary permissions={admin.permissions} isSuper={isAdminSuper} />
                  </div>

                  {!isAdminSuper && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* 활성/비활성 토글 */}
                      <button
                        onClick={() => handleToggle(admin)}
                        disabled={isToggling}
                        title={admin.is_active ? '비활성화' : '활성화'}
                        className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${
                          admin.is_active ? 'bg-warm-brown' : 'bg-stone-200'
                        } disabled:opacity-50`}
                      >
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow
                          transition-transform ${admin.is_active ? 'translate-x-4' : 'translate-x-0.5'}`}
                        />
                      </button>

                      {/* 권한 수정 버튼 */}
                      <button
                        onClick={() => startEdit(admin)}
                        title="권한 수정"
                        className={`p-1.5 rounded-lg transition-colors ${
                          isExpanded
                            ? 'bg-warm-brown/10 text-warm-brown'
                            : 'text-stone-400 hover:text-warm-brown hover:bg-cream-100'
                        }`}
                      >
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8"
                          strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>

                      {/* 삭제 버튼 (자기 자신 제외) */}
                      {!isMe && (
                        <button
                          onClick={() => setConfirmDelete(admin)}
                          disabled={isDeleting}
                          title="삭제"
                          className="p-1.5 rounded-lg transition-colors text-stone-400
                            hover:text-red-500 hover:bg-red-50 disabled:opacity-50"
                        >
                          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8"
                            strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                            <path d="M10 11v6M14 11v6"/>
                            <path d="M9 6V4h6v2"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 권한 수정 패널 (인라인 expand) */}
              {isExpanded && (
                <div className="border-t border-cream-100 p-5 bg-cream-50 space-y-3">
                  <p className="text-xs font-medium text-warm-dark">권한 수정</p>
                  <div className="space-y-2.5">
                    {ALL_PERMISSIONS.map(key => (
                      <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={editPerms[key] === true}
                          onChange={e => setEditPerms(prev => ({ ...prev, [key]: e.target.checked }))}
                          className="w-4 h-4 rounded accent-warm-brown"
                        />
                        <span className="text-xs text-warm-dark group-hover:text-warm-brown transition-colors">
                          {PERMISSION_LABELS[key]}
                          {key === 'manage_admins' && (
                            <span className="ml-1 text-amber-500 text-[10px]">⚠ 민감</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex-1 py-2 text-xs text-warm-light rounded-xl border border-cream-300
                        hover:bg-cream-100 transition-colors"
                    >
                      취소
                    </button>
                    <button
                      onClick={() => handleSavePerms(admin.id)}
                      disabled={savingPerms}
                      className="flex-1 py-2 text-xs font-medium text-white bg-warm-brown rounded-xl
                        hover:bg-warm-dark active:scale-95 transition-all disabled:opacity-50"
                    >
                      {savingPerms ? '저장 중…' : '저장'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* 빈 상태 */}
        {!loading && !error && admins.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
            <p className="text-sm text-warm-light">등록된 관리자가 없어요</p>
          </div>
        )}

      </main>
    </div>
  )
}

export default function AdminAdminsPage() {
  return (
    <AdminGuard>
      {(payload) => <AdminsContent payload={payload} />}
    </AdminGuard>
  )
}
