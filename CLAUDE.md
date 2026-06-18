# 식탁 일기 — CLAUDE.md

함께 먹는 사람들의 식사 추억 기록 + 우리만의 맛집 지도 웹앱.
Supabase 백엔드 연결 완료. Vercel 배포 완료. PWA 설치 가능.

---

## 배포 정보

| 항목 | 내용 |
|---|---|
| 서비스 URL | https://siktakilgi.com (구: meal-app-nine-snowy.vercel.app) |
| GitHub | https://github.com/mygenie1/meal-app |
| Vercel 계정 | mygenie1 |
| Supabase 프로젝트 | jsesigubkqnddcjqusjv (mygenie1 개인 계정) |
| Supabase URL | https://jsesigubkqnddcjqusjv.supabase.co |
| Storage 버킷 | `meal-photos` (public) — 사진 파일 저장 |

---

## 앱의 본질

다이어트 앱이 아니다. **커플·가족·친구가 함께한 식사 순간을 기록하는 추억 다이어리**다.
- 기능보다 감성이 중요하다
- 사진이 메인 콘텐츠, 달력은 진입점
- 맛집 지도가 킬러 기능 — "우리만 아는 맛집 지도"

---

## 기술 스택

| 항목 | 내용 |
|---|---|
| 프레임워크 | React 19 + Vite 8 |
| 스타일 | Tailwind CSS 3 |
| 라우팅 | react-router-dom 7 |
| 날짜 | date-fns 4 (locale: ko) |
| 지도 | Kakao Maps SDK (`window.kakao.maps`) — index.html `<script>` 태그로 로드 |
| 지오코딩 | Kakao Local API (`/v2/local/geo/coord2address`) + Nominatim 폴백 |
| 식당 자동완성 | Kakao Local API (`https://dapi.kakao.com/v2/local/search/keyword.json`) |
| 고유ID | uuid 14 |
| 데이터 저장 | Supabase (PostgreSQL) + Realtime 구독 |
| 사진 저장 | Supabase Storage `meal-photos` 버킷 (URL만 DB 저장) |
| PWA | vite-plugin-pwa + Workbox |

---

## 디자인 시스템

### 색상 (tailwind.config.js에 커스텀 정의)

```
cream-50  #fdfcf9   앱 전체 배경
cream-100 #faf7f0   카드 내부, 입력 필드 배경, 사진 lazy 플레이스홀더
cream-200 #f5ede0   구분선, 비활성 버튼, 호버 배경
cream-300 #ede0cc   테두리
cream-400 #d9c4a8   플레이스홀더, 보조 텍스트, 비활성 아이콘
cream-500 #c4a882   별점 채움색

warm-brown #6b4f3a  주요 액션 버튼, 활성 탭, 강조 텍스트
warm-dark  #3d2b1f  제목, 본문 텍스트
warm-light #a07850  보조 텍스트, 레이블
```

### 폰트
- Noto Sans KR (Google Fonts, @import in index.css)
- fallback: system-ui, sans-serif

### 레이아웃
- 최대 너비 `max-w-lg` (512px), 모바일 우선
- 하단 탭 고정 (`fixed bottom-0`), pb-28로 콘텐츠가 탭에 가리지 않게
- 헤더 `sticky top-0`, `backdrop-blur-sm`으로 스크롤 시 반투명

### 컴포넌트 규칙
- 모서리: `rounded-2xl` (카드, 입력, 버튼)
- 그림자: `shadow-sm` (카드에만 최소한으로)
- 아이콘: 이모지 사용 금지 — SVG stroke 아이콘 (strokeWidth 1.6)
- 버튼 액션: hover에 `transition-colors`, 탭에 `active:scale-95`

### iOS Safe Area (index.css)
```css
/* 노치/다이나믹 아일랜드 → 모든 sticky 헤더에 자동 적용 */
header.sticky { padding-top: calc(0.75rem + env(safe-area-inset-top)); }
/* 홈 인디케이터 → BottomNav 내부 flex div에 적용 */
.pb-safe { padding-bottom: env(safe-area-inset-bottom); }
/* Modal 저장 버튼 하단 여백 */
style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
```
- index.html: `viewport-fit=cover`, `apple-mobile-web-app-status-bar-style: black-translucent`

### z-index 계층
- BottomNav: `z-50`
- Modal: `z-[60]` — BottomNav보다 높아야 저장 버튼이 가리지 않음
- NotificationPanel: `z-[70]` — Modal보다 높음

---

## 폴더 구조

```
meal-app/
├── public/
│   ├── favicon.svg
│   ├── icon.svg                         PWA 아이콘 원본 (포크+스푼, warm-brown)
│   ├── icon-192x192.png                 PWA 아이콘
│   ├── icon-512x512.png                 PWA 아이콘
│   ├── apple-touch-icon.png             iOS 홈화면 아이콘
│   └── offline.html                     오프라인 폴백 페이지
├── scripts/
│   └── gen-icons.mjs                    SVG → PNG 아이콘 생성 스크립트
├── src/
│   ├── App.jsx                          라우팅 루트, AppProvider 래핑, 오프라인/ConnectErrorBanner
│   ├── main.jsx                         React 진입점
│   ├── index.css                        Tailwind 지시어, 전역 스타일, Safe Area, Kakao 오버라이드
│   │
│   ├── lib/
│   │   ├── supabase.js                  Supabase 클라이언트 초기화 (15초 타임아웃 fetch 래퍼)
│   │   ├── uploadPhoto.js               사진 업로드 + 썸네일 헬퍼
│   │   │                                uploadPhotoWithThumbnail() — 400px thumb + 1200px original 병렬 업로드
│   │   │                                parsePhoto() / getThumbUrl() / getOriginalUrl() — DB 항목 파싱
│   │   │                                uploadPhotoToStorage() — 레거시 단일 업로드 (하위 호환)
│   │   │                                Storage 전용 클라이언트 (타임아웃 없음, 업로드가 15초 초과 가능)
│   │   ├── notify.js                    알림 전송 헬퍼
│   │   │                                buildFromUser(user) — user 객체 → { id, nickname, avatar_url }
│   │   │                                  내부적으로 getUserAvatarUrl()로 kakaocdn URL 필터링
│   │   │                                sendNotification({ toUserId, spaceId, mealId, fromUser, type, message })
│   │   │                                MealForm(new_meal) / MealDetailModal(comment, rating)에서 호출
│   │   ├── linkify.jsx                  URL 자동 하이퍼링크 변환 (.jsx — JSX 반환)
│   │   │                                linkify(text) — https:// URL → <a>, \n → <br/>
│   │   │                                <a> onClick stopPropagation — 부모 버튼 클릭 차단
│   │   │                                적용: MealDetailModal(review/memo/댓글), FeedCard, DayDetail, MealMap 위시 댓글
│   │   └── firebase.js                  Firebase FCM 클라이언트 (동적 import — Vercel 빌드 충돌 방지)
│   │                                    getMessagingInstance() — 브라우저 런타임에만 firebase/messaging 로드
│   │                                    requestFCMToken() — 권한 요청 + SW 등록 + 토큰 발급 (단계별 로그)
│   │                                    onFCMMessage(callback) — 포그라운드 메시지 리스너
│   │
│   ├── context/
│   │   └── AppContext.jsx               전체 상태 관리 + Supabase CRUD + Realtime 구독
│   │                                    boot() → space_members 기반으로 내 스페이스만 조회 (spaces 직접 조회 X)
│   │                                    loadAllSpaceData() → MEAL_LIST_SELECT로 photo/photos 제외 조회
│   │                                    loadMealPhotos(mealId) → 개별 meal 사진 lazy 로드
│   │                                    photosLoaded flag: false=미로드, true=로드완료(빈 배열 포함)
│   │                                    최대 3회 자동 재시도 (1.5s → 3s → 5s)
│   │                                    ratingsMap: { [mealId]: [{id, user_id, nickname, rating}] }
│   │                                    addOrUpdateRating() / deleteRating() — upsert on UNIQUE(meal_id,user_id)
│   │                                    notifications: 최신 50건, Realtime 구독 (filter: user_id=eq.${user.id})
│   │                                    notifEnabled: localStorage 'notif_enabled' 값, false면 배지/목록 숨김
│   │                                    setNotifEnabledPref() — 상태 + localStorage 동시 업데이트
│   │                                    markNotificationRead() / markAllNotificationsRead()
│   │                                    registerFCMToken(userId) — 로그인 직후 FCM 토큰 요청 + fcm_tokens upsert
│   │                                    leaveSpace() → supabase.rpc('leave_space') 호출 (오너 자동 승계)
│   │                                      → DB 재조회로 stale state 방지
│   │                                    deleteAccount() — transfer_owned_spaces RPC 먼저 호출 후
│   │                                      space_members/fcm_tokens/notifications 정리 →
│   │                                      supabase.rpc('delete_user_account') 직접 호출 (Edge Function 제거)
│   │                                    getUserAvatarUrl(user) — kakaocdn URL 필터링 헬퍼 (모듈 레벨)
│   │
│   ├── components/
│   │   ├── common/
│   │   │   ├── BottomNav.jsx            하단 탭 네비게이션 5탭 (홈/달력/지도/재료/스페이스)
│   │   │   ├── Header.jsx               상단 헤더
│   │   │   ├── Avatar.jsx               공용 아바타 컴포넌트
│   │   │   │                            kakaocdn URL → 모든 계정 유형에서 기본 이니셜 아이콘으로 대체
│   │   │   │                            size prop: xs/sm/md/lg, 유효 URL 없으면 warm-brown 이니셜 원
│   │   │   │                            onError로 이미지 로드 실패 시 자동 숨김
│   │   │   ├── AuthorBadge.jsx          게시글 작성자 표시 (아바타 + 닉네임)
│   │   │   ├── LazyImage.jsx            IntersectionObserver 기반 lazy 이미지 로드
│   │   │   │                            뷰포트 150px 이내 진입 시 로드, 이전엔 bg-cream-100 플레이스홀더
│   │   │   │                            로드 완료 후 opacity fade-in transition
│   │   │   ├── Modal.jsx                바텀시트 모달 (iOS body-lock, z-[60], 90dvh)
│   │   │   │                            createPortal(…, document.body) — CSS 스태킹 컨텍스트 우회
│   │   │   │                            뒤로가기 버튼으로 모달 닫기 (history.pushState + popstate)
│   │   │   ├── NotificationPanel.jsx    알림 벨 + 알림 패널
│   │   │   │                            NotificationBell: 벨 아이콘 + 미읽음 배지 (>9 → "9+")
│   │   │   │                            NotificationPanel: top-sheet, z-[70], 알림 목록
│   │   │   │                            항목 클릭 → 읽음 처리 + 해당 meal 상세 열기
│   │   │   │                            "전체 읽음" 버튼
│   │   │   ├── InstallBanner.jsx        PWA 홈화면 설치 안내 배너 (z-[80])
│   │   │   │                            Android: beforeinstallprompt → "설치하기" 버튼
│   │   │   │                            iOS Safari: "공유 → 홈 화면에 추가" 텍스트 안내
│   │   │   │                            install_banner_dismissed (localStorage) 로 닫기 기억
│   │   │   │                            display-mode: standalone이면 표시 안 함
│   │   │   ├── PhotoGallery.jsx         터치 스와이프 사진 갤러리 (LazyImage + 도트 인디케이터 + n/total 뱃지)
│   │   │   │                            호출 측에서 URL 해석 완료된 문자열 배열을 받음
│   │   │   ├── FullscreenViewer.jsx     사진 전체화면 뷰어
│   │   │   ├── StarRating.jsx           별점 입력/표시 (1~5, 클릭 토글)
│   │   │   └── BannerSlot.jsx           위치별 배너 표시 컴포넌트
│   │   │                                slot prop으로 banners 테이블에서 is_active 배너 1개 조회
│   │   │                                info 타입: 텍스트 카드 (title + body)
│   │   │                                image 타입: 이미지 + 선택적 link_url (새 탭)
│   │   │                                disclosure 있으면 배너 아래 작은 회색 텍스트로 고지 문구 표시
│   │   │                                fixed prop: BottomNav 바로 위 고정 표시 (z-[49])
│   │   │
│   │   ├── Calendar/
│   │   │   └── CalendarGrid.jsx         월간 달력 그리드
│   │   │                                좌우 스와이프로 월 전환
│   │   │                                "년 월" 클릭 → 연/월 피커 패널 (2020~현재+2)
│   │   │                                날짜 셀 배경: getThumbUrl() + LazyImage
│   │   │
│   │   ├── MealRecord/
│   │   │   ├── MealForm.jsx             태그 우선 입력 폼
│   │   │   │                            Step1: 날짜 + 태그(2×2) + 끼니 선택
│   │   │   │                            Step2: 태그별 맞춤 필드 (집밥/외식/카페/배달)
│   │   │   │                            저장 시 uploadPhotoWithThumbnail() 호출 (썸네일+원본 병렬 업로드)
│   │   │   │                            식당 자동완성: VITE_KAKAO_MAP_KEY 있으면 카카오 API,
│   │   │   │                              없으면 일반 텍스트 입력 폴백
│   │   │   │                            끼니 자동 감지: getAutoMealTime() — 5~11시=아침,
│   │   │   │                              11~15시=점심, 15시~=저녁
│   │   │   │                            사진 최대 5장 (스크롤 썸네일 + ×삭제 + +추가)
│   │   │   │                            날짜 수정: 투명 date input 오버레이 패턴
│   │   │   ├── MealCard.jsx             식사 기록 카드
│   │   │   │                            썸네일: getThumbUrl() + LazyImage (bg-cream-100 플레이스홀더)
│   │   │   ├── MealDetailModal.jsx      식사 상세 모달 (PhotoGallery full-bleed + 수정/삭제)
│   │   │   │                            마운트 시 loadMealPhotos() 호출
│   │   │   │                            photos → getOriginalUrl() 변환 후 PhotoGallery에 전달
│   │   │   │                            사진 로딩 중: 베이지 플레이스홀더 표시
│   │   │   │                            RatingsSection: 평균 별점 표시 + 내 별점 입력 (같은 별 탭 시 삭제)
│   │   │   │                            댓글 목록 + 입력 (Realtime 구독, 삭제 가능)
│   │   │   │                            댓글/별점 등록 시 meal 작성자에게 알림 발송
│   │   │   │                            AuthorBadge: 작성자 표시
│   │   │   └── DayDetail.jsx            날짜별 식사 목록 (아침→점심→저녁 순 정렬)
│   │   │                                수정 버튼 클릭 시 loadMealPhotos() 호출 후 MealForm 진입
│   │   │
│   │   ├── Map/
│   │   │   └── MealMap.jsx              Kakao Maps SDK 기반 지도 컴포넌트
│   │   │                                탭1 맛집지도: 클러스터 핀 + 태그 필터 + 카드 패널
│   │   │                                  MealPinCard(button) 클릭 → onViewMeal prop 호출
│   │   │                                  현재위치 파란 점 + 위치 버튼
│   │   │                                탭2 가고싶은곳: 위시리스트 지도 + 목록
│   │   │                                  미방문 핀만 지도 표시 (visited:false)
│   │   │                                  "지도에서 확인" → 탭 유지, 해당 핀으로 panTo/setLevel(4)
│   │   │                                  wishFlyTarget 패턴 (mapReady 전 클릭도 안전)
│   │   │                                  현재위치 파란 점 + 위치 버튼 (wishUserOverlayRef)
│   │   │
│   │   ├── Ingredients/
│   │   │   └── IngredientList.jsx       살 것 목록 / 남은 재료 (체크박스)
│   │   │
│   │   │   └── MealMap.jsx              (위 설명 참조)
│   │   │                                SITE_URL 상수: VITE_PUBLIC_SITE_URL || 'https://siktakilgi.com'
│   │   │                                위시리스트 공유 링크 생성 시 SITE_URL 사용 (Vercel 주소 방지)
│   │   └── Space/
│   │       ├── SpaceManager.jsx         스페이스 생성·전환·코드 참가 + 사진 일괄 등록 버튼
│       │                            구성원 목록: get_space_members RPC, 오너 배지, "나" 레이블
│       │                            오너 전용: 멤버 강퇴(remove_space_member), 초대코드 재발급(regenerate_invite_code)
│       │                            isGhostOwner 감지: owner_id 있지만 목록에 오너 없음 → "내 것으로" 버튼
│       │                            SITE_URL 상수: VITE_PUBLIC_SITE_URL || 'https://siktakilgi.com' (초대 링크 고정 도메인)
│       │                            leaveSpace → leave_space RPC (오너면 자동 승계 후 탈퇴)
│   │       ├── SettingsModal.jsx        설정 모달 (프로필/닉네임/알림 토글/로그아웃/회원탈퇴)
│   │       │                            알림 토글: notifEnabled ↔ setNotifEnabledPref()
│   │       │                            회원탈퇴: 2단계 확인 → supabase.rpc('delete_user_account') 직접 호출
│   │       │                            탈퇴 후 signOut() + navigate('/login')
│   │       └── BulkPhotoUpload.jsx      사진 일괄 등록
│   │                                    EXIF 바이너리 스캔으로 날짜 추출 (외부 라이브러리 없음)
│   │                                    Canvas로 로컬 압축 후 uploadPhotoWithThumbnail() 호출
│   │                                    날짜별 자동 묶음 → 태그/끼니 선택 후 일괄 저장
│   │
│   └── pages/
│       ├── admin/
│       │   ├── AdminGuard.jsx           관리자 세션 토큰 검증 + 권한 주입 (getAdminToken/clearAdminToken)
│       │   ├── AdminLoginPage.jsx       관리자 로그인 (/admin/login)
│       │   ├── AdminDashboard.jsx       관리자 대시보드 (/admin)
│       │   ├── AdminUsersPage.jsx       사용자 관리 — 조회/차단/복구/영구삭제 (/admin/users)
│       │   ├── AdminSpacesPage.jsx      스페이스 목록/통계 열람 (/admin/spaces)
│       │   ├── AdminFeedbackPage.jsx    피드백 목록 + 첨부 사진 열람 (/admin/feedback)
│       │   └── AdminBannersPage.jsx     배너 관리 (/admin/banners)
│       │                                슬롯별 배너 생성/수정/삭제/활성화 토글
│       │                                이미지 배너: Storage 버킷 'banners' 서명 업로드
│       │                                광고 고지 문구(disclosure) 입력란 + 쿠팡 파트너스 빠른 입력 버튼
│       │                                FormPanel/BannerRow/SlotSection 모두 모듈 레벨 컴포넌트
│       │                                  (BannersContent 내부 정의 시 매 렌더마다 unmount → 포커스 소실)
│       ├── HomePage.jsx                 홈 피드 (히어로 CTA + 식탁 리포트 + 추억 카드 + 최근 피드)
│       │                                마운트 시 requestedPhotosRef로 중복 없이 전체 loadMealPhotos
│       │                                FeedCard: ratingsMap 기반 평균 별점 표시
│       │                                헤더 우측: [검색][벨][스페이스 배지] 순서
│       │                                NotificationPanel: 벨 클릭 시 top-sheet 열림
│       │                                식탁 리포트: reportMonth state, ‹ › 화살표로 월 전환
│       │                                  현재 월 = "이번 달 식탁 리포트", 과거 = "2026년 5월 식탁 리포트"
│       │                                  경계: 미래(현재 월 이후) 및 가장 오래된 meal 월 이전 disabled
│       │                                  통계 집계(태그 비율/새가게/별점/기록일) 모두 reportMonth 기준
│       ├── CalendarPage.jsx             달력 (월간 그리드)
│       ├── MapPage.jsx                  맛집 지도 전체화면
│       │                                viewingMeal 상태 + MealDetailModal 렌더 (MealMap 외부)
│       ├── IngredientsPage.jsx          재료 목록
│       └── SpacesPage.jsx               스페이스 관리 + 설정 버튼
│
├── ratings-migration.sql                ratings 테이블 생성 + 기존 meals.rating 마이그레이션
├── notifications-migration.sql          notifications 테이블 생성
├── space-member-management-rpc.sql      구성원 관리 RPC 3종 (get/remove/regenerate)
├── owner-succession-migration.sql       오너 승계 RPC + spaces.owner_id FK
├── banners-disclosure-migration.sql     banners.disclosure 컬럼 추가
├── .env                                 환경변수 (gitignore, Vercel에 별도 설정)
├── tailwind.config.js                   커스텀 색상(cream, warm) + 폰트 정의
├── postcss.config.js
├── vite.config.js                       PWA 플러그인 포함
└── package.json
```

---

## Supabase DB 구조

데이터는 localStorage 대신 Supabase PostgreSQL에 저장됨.
`currentSpaceId`, `notif_enabled`만 localStorage에 저장 (UI 상태값).

### 테이블

```
spaces        id, name, emoji, code(6자리 unique), owner_id(FK → auth.users ON DELETE SET NULL), created_at
space_members id, space_id(FK), user_id, joined_at   ← created_at 아님, joined_at
meals         id, space_id(FK), date, title, restaurant_name, location, lat, lng,
              rating, review, memo, tag,
              photo(TEXT, 레거시 base64 단일),
              photos(TEXT[], Storage URL 또는 JSON photo 객체 문자열 배열),
              meal_time(아침|점심|저녁), user_id(FK), created_at
ingredients   id, space_id(FK), type(toBuy|remaining), text, done, created_at
ratings       id, meal_id(FK), user_id(FK), nickname, rating(1~5),
              created_at, UNIQUE(meal_id, user_id)
comments      id, meal_id(FK), user_id, nickname, avatar_url, content, created_at
notifications id, user_id(FK), space_id(FK), meal_id(FK),
              from_user_id(FK), from_nickname, from_avatar_url,
              type(new_meal|comment|rating), message, is_read, created_at
meal_photos   id, meal_id(FK), storage_path, created_at  ← 미사용 (향후 확장용)
banners       id, slot(calendar_top|ingredients_bottom), type(info|image), title, body,
              image_url, link_url, disclosure(text, null=숨김), is_active, created_at
```

### SQL 마이그레이션 파일
- `supabase-rls-migration.sql` — space_members 기반 RLS 정책 + join_space_by_code RPC
- `ratings-migration.sql` — ratings 테이블 생성, 기존 meals.rating 값 마이그레이션
- `notifications-migration.sql` — notifications 테이블 생성
- `space-member-management-rpc.sql` — 구성원 관리 RPC 3종 (get_space_members / remove_space_member / regenerate_invite_code)
- `owner-succession-migration.sql` — 오너 승계 RPC 2종 (leave_space / transfer_owned_spaces) + spaces.owner_id FK
- `banners-disclosure-migration.sql` — banners.disclosure 컬럼 추가
→ **Supabase SQL Editor에서 직접 실행** (CLI/service_role 키 없음)

### Storage 버킷 `meal-photos`
```
meal-photos/
  {spaceId}/{uuid}.jpg          원본 (최대 1200px, JPEG 0.82)
  {spaceId}/thumb_{uuid}.jpg    썸네일 (최대 400px, JPEG 0.65)
```
- public 버킷, RLS 없음 (anon 전체 허용)

### photos[] 컬럼 포맷 (세 가지 혼재, 모두 호환)
```
1. JSON photo 객체 문자열 (신규): '{"thumb":"https://...thumb_xxx.jpg","original":"https://...xxx.jpg"}'
2. 레거시 Storage URL 문자열:     'https://...xxx.jpg'  → parsePhoto()가 {thumb: url, original: url}로 처리
3. 레거시 base64 문자열:          'data:image/jpeg;base64,...'  → 동일하게 폴백 처리
```

### rowToMeal 변환 규칙 (AppContext.jsx)
- `photosLoaded: false` — list 조회 시 (photo/photos 컬럼 제외된 상태). photos: []
- `photosLoaded: true` — loadMealPhotos() 완료 후. photos: 실제 데이터
- `row.photos` 배열 있으면 그대로 사용, 없으면 `row.photo` 단일값을 `[row.photo]`로 래핑 (하위 호환)
- `meal_time` → `mealTime` 카멜케이스 변환

### MEAL_LIST_SELECT (AppContext.jsx)
```javascript
// photo, photos 컬럼 제외 — base64로 인한 조회 타임아웃 방지
const MEAL_LIST_SELECT = 'id, space_id, date, title, restaurant_name, location, lat, lng, rating, review, memo, tag, meal_time, created_at'
```
- `loadAllSpaceData`, `joinByCode`, Realtime INSERT 핸들러 모두 이 select 사용
- 사진은 `loadMealPhotos(mealId)` 로 개별 lazy 로드

### RLS 정책
- **space_members 기반 권한 관리** (`supabase-rls-migration.sql` 실행 완료)
- spaces: 내가 space_members에 있는 스페이스만 조회/수정 가능
- meals / ingredients / wishlist: 내가 멤버인 스페이스의 데이터만 접근 가능
- space_members: 자기 자신의 레코드만 조회/삽입/삭제 가능 (SELECT RLS = user_id = auth.uid())
- ratings / notifications: `FOR ALL TO authenticated USING (true) WITH CHECK (true)` (완화된 정책)

### RPC 목록 (SECURITY DEFINER — RLS 우회)
- `join_space_by_code(p_code)` — 코드로 스페이스 탐색 후 멤버 등록
- `get_space_members(p_space_id)` — 스페이스 멤버 목록 (호출자가 멤버여야 실행 가능)
  - RETURNS TABLE: user_id, display_name, joined_at, is_owner
  - 내부에서 sm0 별칭 필수 (RETURNS TABLE의 user_id 출력 컬럼과 충돌 방지)
- `remove_space_member(p_space_id, p_target_user_id)` — 멤버 강퇴 (오너만, 자신 강퇴 불가)
- `regenerate_invite_code(p_space_id)` — 초대코드 재발급 (오너만, 6자리 대문자 hex 반환)
  - `SET search_path = public, extensions` 필수 (gen_random_bytes가 extensions 스키마)
- `leave_space(p_space_id)` — 스페이스 나가기 + 오너면 joined_at ASC 기준 다음 멤버에게 자동 승계
- `transfer_owned_spaces(p_user_id)` — 해당 유저 소유 스페이스 전체 일괄 승계 (계정 삭제 전 호출)
- `delete_user_account(user_id)` — auth.users 계정 삭제 (회원탈퇴, SECURITY DEFINER)

### 환경변수 (.env)
```
VITE_SUPABASE_URL=https://jsesigubkqnddcjqusjv.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_KAKAO_MAP_KEY=...            ← 카카오 지도 + 식당 자동완성 (없으면 텍스트 입력 폴백)
VITE_PUBLIC_SITE_URL=https://siktakilgi.com  ← 초대/공유 링크 고정 도메인 (없으면 하드코딩 fallback 사용)
```
Vercel 배포 시 대시보드 → Settings → Environment Variables에 동일하게 설정 필요.

---

## 핵심 기능 상세

### 스페이스 시스템
- 하나의 앱에 스페이스 여러 개 생성 가능
- 각 스페이스는 이름 + 이모지 아이콘 + 6자리 랜덤 코드 보유
- 코드 공유 → **어느 기기에서도** 해당 스페이스로 참가 가능 (Supabase 덕분에)
- 스페이스 삭제 시 다음 스페이스로 자동 전환 (meals, ingredients CASCADE 삭제)

### 홈 피드 (HomePage)
- 헤더 우측: [검색][알림 벨][스페이스 배지] 순서
- "오늘 식사 기록하기" 버튼 → Modal + DayDetail 열림
- 통계 카드 (가로 스크롤): 함께한 식사 횟수, 이번 달 횟수, 자주 찾은 곳 Top3, 즐겨 먹는 것, 최애 맛집(별점 5점)
- 최근 기록 피드: 날짜 내림차순 → 같은 날은 아침/점심/저녁 순, 카드 클릭 시 MealDetailModal
- FeedCard: ratingsMap 기반 평균 별점 표시 (없으면 meal.rating 폴백)
- 스페이스 없을 때: 스페이스 만들기 안내 화면

### 달력 (CalendarPage)
- `date-fns`로 월간 그리드 생성 (일요일 시작)
- 식사 기록 있는 날: 사진 있으면 썸네일 배경 + 어두운 오버레이, 없으면 베이지 배경
- **좌우 스와이프**로 월 전환 (터치 dx 50px 이상)
- **"2026년 6월" 클릭** → 연/월 피커 패널 열림 (인라인, 모달 아님)
  - 연도 ‹ › 로 이동 (2020 ~ 현재+2년)
  - 3×4 월 그리드, 현재 선택 월 warm-brown 하이라이트
  - 선택 즉시 이동, 취소 버튼
- 날짜 클릭 → Modal + DayDetail 렌더
  - 기록 없는 날: 바로 MealForm
  - 기록 있는 날: 목록(아침→점심→저녁 순) + "추가" 버튼

### 식사 기록 폼 (MealForm) — 태그 우선 플로우
- **Step 1**: 날짜 입력 + 태그(집밥/외식/카페/배달) 2×2 그리드 + 끼니(아침/점심/저녁) 선택
  - 끼니는 현재 시각으로 자동 선택 (`getAutoMealTime()`)
  - 편집 모드(initial에 tag 있음)는 Step 1 건너뜀
- **Step 2**: 태그 배지 + 날짜(투명 오버레이 date input, 한국어 포맷 표시) + 끼니 pill
  - 사진: 최대 5장, 100×100 썸네일 스크롤, ×삭제 / +추가
  - 집밥: 제목 → 메모 → 재료 사용하기(접이식, 저장 시 자동 삭제)
  - 외식: 제목 → 식당 자동완성 → 위치(Kakao geocoding) → 별점 → 한줄평 → 메모
  - 카페: 제목 → 카페 자동완성 → 위치 → 별점 → 한줄평
  - 배달: 제목 → 가게 자동완성(이름만, 위치 없음) → 별점 → 한줄평 → 메모
- 저장 버튼: `sticky bottom-0`, safe-area 하단 패딩
- 저장 시 스페이스의 다른 멤버들에게 'new_meal' 알림 자동 발송

### 끼니 자동 감지
```javascript
// MealForm.jsx — getAutoMealTime()
5~11시  → 아침
11~15시 → 점심
15시~   → 저녁
```

### 사용자별 별점 (ratings)
- `ratings` 테이블: `UNIQUE(meal_id, user_id)` — 1인 1회
- `ratingsMap` 상태: `{ [mealId]: [{id, user_id, nickname, rating}] }` — AppContext에서 관리
- `addOrUpdateRating(mealId, rating)`: upsert, 같은 별 재탭 시 `deleteRating()` (토글 삭제)
- 평균 = `Math.floor(sum / count)`, "N명 평가" 표시 (2명 이상일 때)
- 별점 등록 시 meal 작성자에게 'rating' 알림 발송
- 표시: MealDetailModal RatingsSection, FeedCard, DayDetail 카드, 지도 핀카드

### 댓글 기능 (comments)
- `comments` 테이블: meal_id, user_id, nickname, avatar_url, content
- MealDetailModal 내부에서 Realtime 구독 (comments:meal:{mealId} 채널)
- 내 댓글만 삭제 가능
- 댓글 등록 시 meal 작성자에게 'comment' 알림 발송

### 알림 기능 (notifications)
- 트리거 3종: 새 기록(new_meal), 댓글(comment), 별점(rating)
- NotificationBell: 헤더 벨 아이콘, 미읽음 배지 (>9 → "9+")
- NotificationPanel: top-sheet (z-[70]), 최신 50건, 항목 클릭 시 해당 meal 상세 열기
- Realtime 구독: `filter: user_id=eq.${user.id}` — 내 알림만 수신
- 알림 설정 (SettingsModal): notifEnabled 토글 → localStorage 저장 → 꺼진 경우 배지 0, 목록 빈 상태

### 사진 저장 방식 (uploadPhoto.js)
새 사진 저장 시 Supabase Storage에 두 버전 병렬 업로드:
```
썸네일: Canvas 400px, JPEG 0.65 → meal-photos/{spaceId}/thumb_{uuid}.jpg
원본:   Canvas 1200px, JPEG 0.82 → meal-photos/{spaceId}/{uuid}.jpg
```
DB `photos[]` 컬럼에 JSON 문자열로 저장:
```json
{"thumb":"https://...thumb_uuid.jpg","original":"https://...uuid.jpg"}
```

파싱 헬퍼 (레거시 URL / base64도 자동 호환):
```javascript
parsePhoto(entry)      // → { thumb, original }
getThumbUrl(entry)     // → 썸네일 URL (레거시는 원본 URL 반환)
getOriginalUrl(entry)  // → 원본 URL
```

### 사진 lazy 로딩 (photosLoaded 패턴)
`MEAL_LIST_SELECT`로 meals 전체 조회 시 photo/photos 컬럼 제외 → 타임아웃 방지.

각 meal 객체에 `photosLoaded: boolean` flag:
- `false` — 아직 사진 미로드 (list 조회 직후, Realtime INSERT 직후)
- `true` — 사진 로드 완료 (빈 배열이어도 true)

`loadMealPhotos(mealId)` — 개별 meal의 photo/photos만 조회해서 state 갱신:
- 홈 피드: 마운트 시 `requestedPhotosRef`(Set)으로 중복 방지하며 전체 자동 로드
- MealDetailModal: 모달 열릴 때 자동 호출 (사진 로딩 중엔 베이지 플레이스홀더)
- DayDetail 수정: 수정 버튼 클릭 시 먼저 로드 완료 대기 후 MealForm 진입

### 사진 표시 계층
| 위치 | URL 종류 | 컴포넌트 |
|---|---|---|
| 홈 피드 FeedCard | getOriginalUrl() | PhotoGallery |
| 달력 날짜 셀 | getThumbUrl() | LazyImage |
| MealCard 썸네일 | getThumbUrl() | LazyImage |
| MealDetailModal | getOriginalUrl() | PhotoGallery |

### Modal 컴포넌트
- `createPortal(…, document.body)` — 모든 CSS 스태킹 컨텍스트 우회, z-index 확실히 보장
- iOS body scroll lock (position:fixed + scrollY 복원)
- 뒤로가기 버튼으로 모달 닫기 (history.pushState + popstate 핸들러)
- `isOpen` prop: `true`일 때 렌더, `false`이면 `null` 반환

### 사진 일괄 등록 (BulkPhotoUpload)
- 스페이스 화면 "사진 일괄 등록" 버튼 → Modal
- 사진 다중 선택 → EXIF 바이너리 스캔(ArrayBuffer 첫 64KB, 외부 라이브러리 없음)으로 날짜 추출
- Canvas로 로컬 1200px 압축 후 `uploadPhotoWithThumbnail()` 호출 (Storage에 thumb+original 업로드)
- 날짜별 자동 묶음 미리보기 (날짜당 썸네일 스크롤)
- 태그 + 끼니 전체 적용 선택 → 일괄 저장
- 단계별 UX: 선택 → 로딩(진행%) → 미리보기 → 저장 중 → 완료

### 맛집 지도 (MealMap) — Kakao Maps SDK
**탭1: 맛집 지도**
- currentSpace의 위치 있는 식사를 지도에 표시 (커스텀 오버레이 핀)
- 동일 좌표 클러스터링, 핀 색상: 집밥=초록, 외식=노랑, 카페=핑크, 배달=파랑
- 상단 가로 스크롤 태그 필터 (전체/집밥/외식/카페/배달)
- 핀 클릭 → 하단 인라인 패널 (MealPinCard 가로 스크롤)
- MealPinCard(button) 클릭 → `onViewMeal` prop 호출 → MapPage에서 MealDetailModal 렌더
- 현재 위치 GPS 파란 점 + 위치 버튼 (handleLocate)

**탭2: 가고 싶은 곳**
- 미방문(visited:false) 위시리스트 핀만 지도에 표시
- "지도에서 확인" 버튼: 탭 전환 없이 wishlist 지도에서 해당 핀으로 panTo + setLevel(4)
  - `wishFlyTarget` 상태로 지도 이동 처리 (wishMapReady 전 클릭도 안전)
- 현재 위치 GPS 파란 점 + 위치 버튼 (handleWishLocate, wishUserOverlayRef)
- 핀 클릭 → wish-card-{id} scrollIntoView
- **근처 배너** ("근처에 가고 싶은 곳이 있어요"):
  - `hasRealLocation` state — GPS 실제 위치 취득 성공 시에만 true, 배너 표시 조건에 포함
  - 배너 클릭 시 가고싶은곳 탭(`setActiveTab('wishlist')`)으로 전환 + `wishFlyTarget` + 읽음 처리
  - 서울시청 기본값일 때는 배너 숨김

**MapPage 구조**
- `viewingMeal` 상태를 MapPage에서 관리 (MealMap 외부)
- `<MealMap onViewMeal={setViewingMeal} />` + `<MealDetailModal meal={viewingMeal} />`
- MealDetailModal을 MealMap 외부에 렌더 → CSS 스태킹 이슈 방지

### Supabase Realtime
- `meals`, `ingredients` 테이블 Realtime 구독 (spacesChannel 제거 — 나가기/참가는 DB 직접 조회로 대체)
- INSERT: `MEAL_LIST_SELECT` 기준으로 수신 → `photosLoaded: false`로 추가 (사진 제외)
  - 이미 로컬에 있는 ID는 중복 추가 방지
- DELETE: `old` 레코드에 id만 있어서 전체 스페이스/타입에서 필터링
- `notifications`: `filter: user_id=eq.${user.id}` — 내 알림만 수신
- 다른 기기/사용자 변경사항 새로고침 없이 즉시 반영

### Supabase 연결 안정성
- `supabase.js`: 모든 DB 요청에 15초 타임아웃 (AbortController)
- `uploadPhoto.js`: Storage 전용 클라이언트 — 타임아웃 없음
- `AppContext.jsx` boot 시퀀스:
  1. Phase 1: `space_members` 조인으로 내 스페이스만 조회 (`spaces` 직접 조회 X, RLS 의존 X) → 앱 즉시 오픈
  2. Phase 2: 각 space의 `meals`(MEAL_LIST_SELECT) + `ingredients` 순차 백그라운드 로드
  3. Phase 1 실패 시: 최대 3회 자동 재시도 (1.5s → 3s → 5s)
  4. 모든 재시도 실패 시: 빈 상태로 앱 오픈 + 상단 `ConnectErrorBanner`
- `ConnectErrorBanner`: 황색 배너, 재시도 / 닫기 버튼
- `leaveSpace()`: DB 삭제 후 `space_members` 재조회 → 실제 멤버십 기준으로 state 필터링 (stale state 방지)

### 재료 목록
- 살 것(toBuy) / 남은 재료(remaining) 두 섹션
- 집밥 폼에서 사용한 재료 → 저장 시 자동 삭제

### PWA
- 홈화면 설치 가능 (Android Chrome / iOS Safari)
- 앱 이름: 식탁일기 / 테마 컬러: #6b4f3a
- 오프라인 감지 시 OfflineBanner 표시 (App.jsx)
- Workbox로 앱 쉘 전체 프리캐시 → 오프라인에서도 앱 로드 가능
- manifest `start_url` / `scope` = `https://siktakilgi.com/` (vite.config.js VitePWA 설정)

### 아바타 정책
- 모든 계정(카카오·이메일 공통): kakaocdn / k.kakaocdn URL → 유효하지 않은 것으로 간주
- 유효 URL 없을 때: warm-brown 배경에 닉네임 첫 글자 이니셜 표시
- `Avatar.jsx` 컴포넌트 공통 사용, `getUserAvatarUrl()` 헬퍼(AppContext/notify.js)로 저장 시에도 필터링

### 튜토리얼
- 사용자별 localStorage 키: `tutorial_completed_{userId}` — 재가입 시 튜토리얼 재노출
- 마지막 단계 버튼 3종: "첫 기록 남기기" / "사진 한번에 올리기" / "나중에 하기"
  - "사진 한번에 올리기": navigate('/', { state: { openBulkUpload: true } })
  - HomePage의 useEffect에서 location.state.openBulkUpload 감지 → BulkPhotoUpload 모달 오픈

### 회원탈퇴 플로우
1. SettingsModal: 2단계 확인 (안내 → "탈퇴" 직접 입력)
2. AppContext.deleteAccount():
   - `space_members`, `fcm_tokens`, `notifications` 본인 레코드 삭제
   - `supabase.rpc('delete_user_account', { user_id })` 호출 (SECURITY DEFINER RPC)
3. signOut() 후 navigate('/login')
→ Supabase SQL Editor에서 `delete_user_account` 함수 생성 필요 (auth.users 삭제 포함)

---

## 라우팅

| 경로 | 페이지 | 설명 |
|---|---|---|
| `/` | HomePage | 홈 피드 (통계 + 최근 기록) |
| `/calendar` | CalendarPage | 월간 달력 |
| `/map` | MapPage | 맛집 지도 |
| `/ingredients` | IngredientsPage | 재료 목록 |
| `/spaces` | SpacesPage | 스페이스 관리 |

---

## 개발 서버 실행

```bash
cd Desktop/meal-app
npm run dev
# → http://localhost:5173
```

---

## 앱 기획 의도 및 방향성

### 타깃
- 1인도 가능하지만 마케팅 타깃은 커플, 가족, 친구 등 함께 먹는 사람들
- 핵심 페르소나: 데이트할 때 뭐 먹었는지 기록하고 싶은 커플

### 이 앱이 아닌 것
- 다이어트/칼로리 관리 앱이 아님
- 요리 레시피 앱이 아님
- 일반 메모앱이 아님

### 이 앱인 것
- 함께한 식사 순간의 추억 기록장
- 우리만의 맛집 지도 (킬러 기능)
- 감성적인 식사 다이어리

### 기능 우선순위
1. 달력 + 식사 기록 (핵심)
2. 사진 기록 (메인 콘텐츠)
3. 맛집 지도 (킬러 기능, 차별점)
4. 재료 목록 (부가 기능)
5. 요리 추천 (MVP에서 제외)

### 디자인 원칙
- 심플하고 깔끔하되 다이어리 감성
- 사진이 잘 보이는 레이아웃 최우선
- 빈 화면에는 따뜻한 안내 문구
- 모바일 우선 (핸드폰에서 주로 사용)

---

## 완료된 작업

| 작업 | 내용 |
|---|---|
| Supabase 연결 | localStorage → Supabase DB 전환, 크로스 디바이스 스페이스 공유 |
| PWA 설정 | vite-plugin-pwa, 아이콘 3종, 오프라인 페이지, Workbox 프리캐시 |
| Vercel 배포 | https://meal-app-nine-snowy.vercel.app, GitHub 푸시 시 자동 배포 |
| 아이폰 safe area 대응 | viewport-fit=cover, header.sticky padding-top, .pb-safe, iOS body-lock |
| Supabase Realtime | spaces/meals/ingredients 실시간 구독, INSERT 중복 방지, DELETE 전체 스캔 |
| 홈 피드 | 통계 카드(가로 스크롤) + 최근 기록 피드 + 오늘 기록 버튼 |
| 식사 상세 모달 | MealDetailModal 신설, 수정/삭제 포함 |
| 맛집 지도 태그 필터 | 전체/집밥/외식/카페/배달 상단 스크롤 필터 바 |
| 태그별 식사 기록 폼 개편 | Step1 태그·날짜·끼니 → Step2 태그별 맞춤 필드 |
| 집밥 재료 연동 | 폼에서 남은 재료 체크 → 저장 시 자동 삭제 |
| 달력 스와이프 | 좌우 터치(50px 이상)로 월 전환 |
| 달력 연/월 피커 | "년 월" 클릭 → 인라인 패널, 2020~현재+2, 3×4 월 그리드 |
| 아침/점심/저녁 끼니 분류 | meals.meal_time 컬럼, 홈피드/달력 아침→점심→저녁 정렬 |
| 끼니 시간대 자동 감지 | getAutoMealTime(): 5~11시=아침, 11~15시=점심, 15시~=저녁 |
| 사진 여러 장 업로드 | photos[] 배열 저장, 최대 5장, PhotoGallery 스와이프 갤러리 |
| 홈 피드 날짜 수정 | 폼에서 날짜 직접 수정 (투명 date input 오버레이 패턴) |
| 식당 자동완성 | Kakao Local API (VITE_KAKAO_MAP_KEY), 350ms 디바운스, 인라인 드롭다운, 폴백 |
| 사진 일괄 등록 | EXIF 날짜 추출 + Canvas 압축 + 날짜별 묶음 + 태그/끼니 일괄 저장 |
| Supabase 연결 안정성 | 15초 타임아웃, boot=spaces만, 백그라운드 순차 로드, 3회 재시도, ConnectErrorBanner |
| meals 타임아웃 해결 | MEAL_LIST_SELECT (photo/photos 제외), base64 대용량 컬럼 조회 제거 |
| 사진 lazy 로딩 | photosLoaded flag + loadMealPhotos(), 상세 모달/수정 시에만 사진 조회 |
| 사진 Storage 업로드 | base64 → Supabase Storage meal-photos 버킷, URL만 DB 저장 |
| 썸네일 최적화 | uploadPhotoWithThumbnail: 400px thumb + 1200px original 병렬 업로드 |
| LazyImage 컴포넌트 | IntersectionObserver lazy 로드 + bg-cream-100 플레이스홀더 + fade-in |
| 표시 계층 분리 | 피드/달력=getThumbUrl, 상세모달=getOriginalUrl, 레거시 URL 자동 호환 |
| 스페이스 권한 강화 | space_members 테이블 + RLS 정책 + join_space_by_code RPC |
| 설정 화면 | SettingsModal: 프로필/닉네임 수정, 알림 토글, 로그아웃 |
| 게시글 작성자 표시 | AuthorBadge 컴포넌트, meals.user_id 기반, 피드/상세 표시 |
| 댓글 기능 | comments 테이블, Realtime 구독, 내 댓글 삭제, 작성자 알림 |
| 사용자별 별점 | ratings 테이블 UNIQUE(meal_id,user_id), ratingsMap 상태, 평균 표시, 알림 |
| 알림 기능 | notifications 테이블, NotificationBell/Panel, Realtime, 읽음 처리 |
| 달력 사진 미리로딩 | CalendarGrid에서 사진 lazy 프리로드, 스크롤 월 변경 수정 |
| 지도 상세보기 모달 | MealPinCard(button), Modal createPortal → 클릭/표시 안정화 |
| 가고싶은곳 지도 개선 | 미방문 핀만 표시, "지도에서 확인" 탭 유지 panTo, GPS 현재위치 버튼 |
| 알림 벨 위치 수정 | 헤더 [검색][벨][스페이스 배지] 순서로 변경 |
| 알림 설정 활성화 | 설정 화면 토글 → notifEnabled localStorage 저장, 꺼짐 시 배지/목록 숨김 |
| 이메일 로그인 | 이메일/비밀번호 회원가입·로그인, 비밀번호 재설정, provider 기반 동적 레이블 |
| 회원 탈퇴 | Edge Function `delete-account` 호출, 확인 2단계(안내→"탈퇴" 입력), 로컬 세션 정리 |
| 튜토리얼 7단계 | 스페이스 유형 선택 → 이름 입력 → 초대/참가 → 지도 소개 → 가고싶은곳 소개 → 첫 기록 CTA |
| 튜토리얼 버그 수정 | uncontrolled input(ref+defaultValue)으로 한글 포커스 해제 버그 해결, 뒤로가기 버튼 추가 |
| 스페이스 나가기 UX | 나가기 확인 모달 (Case A 혼자/Case B 다른멤버 코드 복사), 즉시 목록 제거 |
| 스페이스 나가기 버그 수정 | leaveSpace 후 DB 재조회 방식으로 stale state 방지, boot() space_members 기반 조회로 전환 |
| 이메일 계정 기본 아바타 | kakaocdn URL 감지 → 이메일 계정이면 warm-brown 배경 기본 아이콘으로 대체 |
| 프로필 사진 upsert | uploadAvatar에 upsert:true → 두 번째 업로드 시 RLS 에러 방지 |
| Avatar 공용 컴포넌트 | Avatar.jsx 신설 — 모든 계정 kakaocdn URL 이니셜로 대체, size prop(xs/sm/md/lg) |
| 아바타 일관성 | MealDetailModal/SettingsModal/SpaceManager/AuthorBadge 등 전체 Avatar 컴포넌트 적용 |
| 회원탈퇴 Edge Function 제거 | delete-account Edge Function → 프론트 직접 RPC(`delete_user_account`) 호출로 대체 |
| 튜토리얼 사용자별 키 | `tutorial_completed_{userId}` — 재가입 시 튜토리얼 재노출 |
| 튜토리얼 사진 한번에 올리기 | 마지막 단계에 "사진 한번에 올리기" 버튼 추가, navigate state로 BulkPhotoUpload 오픈 |
| 설정 개발자 정보 제거 | SettingsModal에서 디버그 섹션(debugOpen/debugInfo) 완전 제거 |
| 가고싶은곳 배너 버그 수정 | hasRealLocation: GPS 실제 취득 시에만 배너 표시, 클릭 시 가고싶은곳 탭으로 이동 |
| 식탁 리포트 월 전환 | reportMonth state + ‹ › 화살표, 첫 기록 월~현재 월 범위, 과거 월 집계 |
| 도메인 변경 | siktakilgi.com 적용 — LoginPage redirectTo, send-push 아이콘, manifest start_url/scope |
| 스페이스 구성원 관리 | SpaceManager에 멤버 목록(get_space_members RPC), 오너 배지, 강퇴(remove_space_member), 초대코드 재발급(regenerate_invite_code) 추가 |
| 스페이스 오너 승계 | leave_space/transfer_owned_spaces RPC + spaces.owner_id FK ON DELETE SET NULL + isGhostOwner UI + claimSpace 확장 |
| 배너 광고 고지 문구 | banners.disclosure 컬럼 + AdminBannersPage 입력란·쿠팡 파트너스 빠른 입력 + BannerSlot 표시 + admin-banners Edge Function 처리 |
| 초대 링크 도메인 고정 | SITE_URL 상수 (VITE_PUBLIC_SITE_URL fallback) — SpaceManager 초대 링크·MealMap 공유 링크 모두 siktakilgi.com 고정 |

---

## 다음 단계

- **Claude Design으로 전체 UI 개선** — 전반적인 디자인 리뉴얼
- **앱스토어 / 플레이스토어 등록** — PWA → 네이티브 앱 래핑 (Capacitor 등)
