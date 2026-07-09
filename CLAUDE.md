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
| Storage 버킷 | `meal-photos` (public) — 사진 파일 저장 / `banners` (public) — 배너 이미지 저장 |

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
| 지도 | Kakao Maps SDK (`window.kakao.maps`) — index.html `<script>` 태그로 로드. ★ iOS(Capacitor)는 origin 거부 → `map-embed.html` iframe 프록시 경유(isNative 분기, "A3-2" 참조) |
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
- BannerSlot fixed: `z-[49]` — BottomNav 바로 위
- Modal: `z-[60]` — BottomNav보다 높아야 저장 버튼이 가리지 않음
- NotificationPanel: `z-[70]` — Modal보다 높음
- InstallBanner: `z-[80]`

---

## 폴더 구조

```
meal-app/
├── public/
│   ├── .well-known/
│   │   └── assetlinks.json              TWA Digital Asset Links (com.siktakilgi.app ↔ www.siktakilgi.com)
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
│   │                                    RootRouter: /admin → AdminRoutes, /terms|/privacy → PublicRoutes, 나머지 → AppProvider
│   ├── main.jsx                         React 진입점
│   ├── index.css                        Tailwind 지시어, 전역 스타일, Safe Area, Kakao 오버라이드
│   │
│   ├── map-embed/
│   │   └── main.js                      ★ map-embed.html(루트, Vite 멀티페이지 엔트리)의 vanilla 스크립트
│   │                                    카카오 SDK 로드 + init/setPins/panTo/userLoc/select 렌더 + search/geocode RPC
│   │                                    부모(capacitor://localhost) ↔ iframe postMessage 브릿지 (React 미포함, www 배포)
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
│   │   │                                sendNotification({ toUserIds, spaceId, mealId, fromUser, type, message })
│   │   │                                  INSERT error 발생 시 console.error 로깅 (침묵 실패 금지)
│   │   │                                getSpaceMemberIds(spaceId) — get_space_member_ids RPC 호출
│   │   │                                  RPC가 auth.users JOIN으로 실존 멤버만 반환 (유령 멤버 자동 제외)
│   │   │                                  error/결과 모두 console 로깅
│   │   │                                MealForm(new_meal) / MealDetailModal(comment, rating)에서 호출
│   │   ├── linkify.jsx                  URL 자동 하이퍼링크 변환 (.jsx — JSX 반환)
│   │   │                                linkify(text) — https:// URL → <a>, \n → <br/>
│   │   │                                <a> onClick stopPropagation — 부모 버튼 클릭 차단
│   │   │                                적용: MealDetailModal(review/memo/댓글), FeedCard, DayDetail, MealMap 위시 댓글
│   │   ├── firebase.js                  Firebase FCM 클라이언트 (동적 import — Vercel 빌드 충돌 방지)
│   │   │                                getMessagingInstance() — 브라우저 런타임에만 firebase/messaging 로드
│   │   │                                requestFCMToken() — 권한 요청 + SW 등록 + 토큰 발급 (단계별 로그)
│   │   │                                onFCMMessage(callback) — 포그라운드 메시지 리스너
│   │   ├── platform.js                  isNative() — Capacitor 네이티브 여부 (웹=false)
│   │   ├── mapEmbed.js                  map-embed iframe 상수(EMBED_ORIGIN/EMBED_URL) + embedSearch/embedGeocode(isNative 분기)
│   │   └── mapEmbedRpc.js               createMapEmbedRpc — 부모↔embed iframe 검색/지오코딩 RPC(reqId 매칭+타임아웃)
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
│   │   │   ├── BannerSlot.jsx           위치별 배너 표시 컴포넌트
│   │   │   │                            slot prop으로 banners 테이블에서 is_active 배너 1개 조회
│   │   │   │                            info 타입: 텍스트 카드 (title + body)
│   │   │   │                            image 타입: 이미지 + 선택적 link_url (새 탭)
│   │   │   │                            disclosure 있으면 배너 아래 작은 회색 텍스트로 고지 문구 표시
│   │   │   │                            fixed prop: BottomNav 바로 위 고정 표시 (z-[49])
│   │   │   ├── MapEmbedRpcProvider.jsx   ★ 네이티브 전용 — map-embed 숨김 iframe 상시 mount + useMapEmbedRpc() context
│   │   │   │                            (웹은 children 그대로 통과 → rpc=null). MealForm/위시폼 검색·지오코딩 위임
│   │   │   └── MapEmbedView.jsx          ★ 네이티브 전용 — 보이는 지도 iframe. props→postMessage(init/setPins/panTo/
│   │   │                                userLoc/select), pinClick 수신. e.source로 자기 iframe만 처리(다중 격리)
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
│   │   │   │                            집밥 저장 시 사용 재료 → meals.used_ingredients(jsonb) 저장
│   │   │   │                              qty 0 이하 항목은 ingredients에서 삭제, 저장 1회만 차감
│   │   │   │                              수정 모드 재차감 없음, 복구 없음
│   │   │   ├── MealCard.jsx             식사 기록 카드
│   │   │   │                            썸네일: getThumbUrl() + LazyImage (bg-cream-100 플레이스홀더)
│   │   │   ├── MealDetailModal.jsx      식사 상세 모달 (PhotoGallery full-bleed + 수정/삭제)
│   │   │   │                            마운트 시 loadMealPhotos() 호출
│   │   │   │                            photos → getOriginalUrl() 변환 후 PhotoGallery에 전달
│   │   │   │                            사진 로딩 중: 베이지 플레이스홀더 표시
│   │   │   │                            RatingsSection: 평균 별점 표시 + 내 별점 입력 (같은 별 탭 시 삭제)
│   │   │   │                            댓글 목록 + 입력 (Realtime 구독, 삭제 가능)
│   │   │   │                            ★ 댓글 알림: mealId = data.meal_id (댓글 INSERT DB 응답, FK 검증됨)
│   │   │   │                              liveMeal.id(로컬 state)를 쓰면 FK 위반 가능 — 반드시 data.meal_id
│   │   │   │                            별점 알림: addOrUpdateRating() 성공(ok===true) 시에만 발송
│   │   │   │                            집밥일 때 메모 위에 "사용 재료" 섹션 (used_ingredients 표시)
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
│   │   │                                SITE_URL 상수: VITE_PUBLIC_SITE_URL || 'https://siktakilgi.com'
│   │   │                                위시리스트 공유 링크 생성 시 SITE_URL 사용 (Vercel 주소 방지)
│   │   │
│   │   ├── Ingredients/
│   │   │   └── IngredientList.jsx       살 것 목록 / 남은 재료 (수량 관리)
│   │   │                                살것(toBuy): 체크박스 유지 — 체크 시 remaining으로 이동
│   │   │                                남은재료(remaining): 체크박스 없음 — 수량 조절 + 삭제만
│   │   │                                QtyStepper: 수량 직접입력(16px font-size), onDirectChange 패턴
│   │   │                                  + / - 버튼 + 숫자 직접 입력 (빈 string → 1 복원)
│   │   │                                빈 상태 문구 간소화 (탭별 짧은 안내)
│   │   │
│   │   ├── Recipes/                       레시피 관리 (재료 탭 재료/레시피 토글로 진입)
│   │   │   ├── RecipeList.jsx             카드 목록 + 자체검색(name/memo) + 추가 모달, 카드에 해먹은 횟수
│   │   │   ├── RecipeForm.jsx             추가/수정 폼(이름필수/메모/외부링크 http(s)검증/대표사진/재료 동적). isValidHttpUrl
│   │   │   └── RecipeDetailModal.jsx      상세 — 자체 Modal 1개 안에서 detail↔cart↔edit↔record 뷰 전환
│   │   │                                  cart=재료 담기(없는것만/전체), record=이 레시피로 기록하기(신규 집밥 MealForm prefill)
│   │   │                                  ★ 중첩 모달/popstate 충돌 회피 위해 뷰 전환 방식
│   │   │
│   │   └── Space/
│   │       ├── SpaceManager.jsx         스페이스 생성·전환·코드 참가 + 사진 일괄 등록 버튼
│   │       │                            구성원 목록: get_space_members RPC, 오너 배지, "나" 레이블
│   │       │                            오너 전용: 멤버 강퇴(remove_space_member), 초대코드 재발급(regenerate_invite_code)
│   │       │                            isGhostOwner 감지: owner_id 있지만 목록에 오너 없음 → "내 것으로" 버튼
│   │       │                            SITE_URL 상수: VITE_PUBLIC_SITE_URL || 'https://siktakilgi.com' (초대 링크 고정 도메인)
│   │       │                            leaveSpace → leave_space RPC (오너면 자동 승계 후 탈퇴)
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
│       │   ├── AdminAdminsPage.jsx      관리자 계정 관리 — 추가/삭제/권한 편집 (/admin/admins)
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
│       ├── SpacesPage.jsx               스페이스 관리 + 설정 버튼
│       ├── TermsPage.jsx                이용약관 (/terms) — AppProvider 밖, 비로그인 접근 가능
│       ├── PrivacyPage.jsx              개인정보처리방침 (/privacy) — AppProvider 밖, 비로그인 접근 가능
│       │                                운영자: 팀 마이지니 / 문의: admin@siktakilgi.com (다음 스마트워크)
│       └── AccountDeletionPage.jsx      계정 삭제 안내 (/account-deletion) — 플레이 데이터보안 요구사항
│   (LoginPage: 로그인 전 화면 = 랜딩+로그인 한 페이지, 로고 /icon.svg 통일, 목업 public/landing/)
│
├── recipes-migration.sql                recipes/recipe_ingredients 테이블 + meals.recipe_id + RLS (레시피 Phase 1)
├── ratings-migration.sql                ratings 테이블 생성 + 기존 meals.rating 마이그레이션
├── notifications-migration.sql          notifications 테이블 생성
├── space-member-management-rpc.sql      구성원 관리 RPC 3종 (get/remove/regenerate)
├── owner-succession-migration.sql       오너 승계 RPC + spaces.owner_id FK
├── banners-disclosure-migration.sql     banners.disclosure 컬럼 추가
├── get-space-member-ids-rpc.sql         알림 수신자 조회 RPC (auth.users JOIN으로 유령 멤버 제외)
├── delete-account-migration.sql         meals/comments/ratings FK → ON DELETE SET NULL,
│                                        notifications.user_id FK → ON DELETE CASCADE
├── .env                                 환경변수 (gitignore, Vercel에 별도 설정)
├── map-embed.html                       ★ 카카오맵 iframe 프록시 페이지 (Vite 멀티페이지 엔트리, www 배포). src/map-embed/main.js 로드
├── capacitor.config.json                iOS 네이티브 설정 (iosScheme:capacitor, server.allowNavigation:[www.siktakilgi.com] — iframe 로드 허용)
├── tailwind.config.js                   커스텀 색상(cream, warm) + 폰트 정의
├── postcss.config.js
├── vite.config.js                       PWA(Workbox) + 멀티페이지 input(index/map-embed). navigateFallbackDenylist에 map-embed 등재
└── package.json
```

---

## Supabase DB 구조

데이터는 localStorage 대신 Supabase PostgreSQL에 저장됨.
`currentSpaceId`, `notif_enabled`만 localStorage에 저장 (UI 상태값).

### 테이블

```
spaces         id, name, emoji, code(6자리 unique), owner_id(FK → auth.users ON DELETE SET NULL), created_at
space_members  id, space_id(FK), user_id(FK → auth.users ON DELETE CASCADE), joined_at
               ← 컬럼명 joined_at (created_at 아님!) UNIQUE(space_id, user_id)
meals          id, space_id(FK), date, title, restaurant_name, location, lat, lng,
               rating, review, memo, tag,
               photo(TEXT, 레거시 base64 단일),
               photos(TEXT[], Storage URL 또는 JSON photo 객체 문자열 배열),
               meal_time(아침|점심|저녁), user_id(FK ON DELETE SET NULL), created_at,
               used_ingredients(jsonb, nullable) — 집밥 저장 시 사용 재료 스냅샷,
               recipe_id(FK → recipes ON DELETE SET NULL, nullable) — "이 레시피로 기록하기"로 연결(Phase 3)
ingredients    id, space_id(FK), type(toBuy|remaining), text, quantity(integer default 1),
               done, created_at  ← ★ 컬럼명은 quantity (qty 아님)
recipes        id, space_id(FK → spaces ON DELETE CASCADE),
               author_id(FK → auth.users ON DELETE SET NULL), name, memo,
               link_url(text, http(s)만), photo(text, 단일 URL — wishlist.photo 방식),
               created_at, updated_at
recipe_ingredients id, recipe_id(FK → recipes ON DELETE CASCADE), name, amount(text),
               unit(text), sort_order(integer default 0)
ratings        id, meal_id(FK), user_id(FK ON DELETE SET NULL), nickname, rating(1~5),
               created_at, UNIQUE(meal_id, user_id)
comments       id, meal_id(FK), user_id(FK ON DELETE SET NULL), nickname, avatar_url,
               content, created_at
notifications  id, user_id(FK ON DELETE CASCADE), space_id(FK), meal_id(FK),
               from_user_id(FK ON DELETE SET NULL), from_nickname, from_avatar_url,
               type(new_meal|comment|rating), message, is_read, created_at
meal_photos    id, meal_id(FK), storage_path, created_at  ← 미사용 (향후 확장용)
banners        id, slot(calendar_top|ingredients_bottom), type(info|image), title, body,
               image_url, link_url, disclosure(text, null=숨김), is_active, created_at
admin_accounts id, email, password_hash, role(super|sub),
               permissions(jsonb) — sub 계정 권한 배열, super는 role 체크로 모든 권한 우회
               ← 관리자 전용 테이블, auth.users와 무관한 별도 인증
```

### 관리자 권한 항목 (admin_accounts.permissions jsonb 배열)
```
view_users        사용자 목록 조회
delete_users      사용자 삭제/차단
view_spaces       스페이스 목록 조회
read_space_content  스페이스 내 콘텐츠 열람
view_feedback     피드백 목록 조회
manage_admins     관리자 계정 추가/삭제/권한 편집
manage_banners    배너 생성/수정/삭제/활성화
```

### SQL 마이그레이션 파일
- `supabase-rls-migration.sql` — space_members 기반 RLS 정책 + join_space_by_code RPC
- `recipes-migration.sql` — recipes/recipe_ingredients 테이블 + meals.recipe_id 컬럼 + RLS 4종 (레시피 Phase 1)
- `ratings-migration.sql` — ratings 테이블 생성, 기존 meals.rating 값 마이그레이션
- `notifications-migration.sql` — notifications 테이블 생성
- `space-member-management-rpc.sql` — 구성원 관리 RPC 3종 (get_space_members / remove_space_member / regenerate_invite_code)
- `owner-succession-migration.sql` — 오너 승계 RPC 2종 (leave_space / transfer_owned_spaces) + spaces.owner_id FK
- `banners-disclosure-migration.sql` — banners.disclosure 컬럼 추가
- `get-space-member-ids-rpc.sql` — 알림 수신자 RPC (auth.users JOIN, 유령 멤버 제외)
- `delete-account-migration.sql` — FK DELETE 규칙 정리 (meals/comments/ratings SET NULL, notifications CASCADE)
→ **Supabase SQL Editor에서 직접 실행** (CLI/service_role 키 없음)

### Storage 버킷
```
meal-photos/
  {spaceId}/{uuid}.jpg          원본 (최대 1200px, JPEG 0.82)
  {spaceId}/thumb_{uuid}.jpg    썸네일 (최대 400px, JPEG 0.65)
banners/
  {filename}                    배너 이미지 (관리자 업로드)
```
- 두 버킷 모두 public, RLS 없음 (anon 전체 허용)

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
const MEAL_LIST_SELECT = 'id, space_id, date, title, restaurant_name, location, lat, lng, rating, review, memo, tag, meal_time, used_ingredients, created_at'
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
- `get_space_member_ids(p_space_id)` — 알림 수신자 user_id 배열 반환
  - `JOIN auth.users u ON u.id = sm.user_id` — 탈퇴/삭제 계정(유령 멤버) 자동 제외
  - GRANT EXECUTE TO authenticated 필수
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
  - 집밥: 제목 → 메모 → 재료 사용하기(접이식, 저장 시 자동 차감)
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

### 재료 목록 (IngredientList)
- 살것(toBuy) / 남은재료(remaining) 두 섹션
- **살것**: 체크박스 유지 — 체크 시 remaining으로 이동
- **남은재료**: 체크박스 없음 — QtyStepper(수량) + 삭제만
  - QtyStepper: − / 숫자 직접입력 / + 버튼, 입력 16px, 빈 값이면 1 복원
  - ingredients.quantity 컬럼(integer default 1)으로 저장 (★ 컬럼명 quantity — qty 아님)
- **집밥 연동 (재료 차감)**:
  - MealForm 집밥 "사용할 재료" → 저장 성공 시 qty 차감 (0 이하 시 행 삭제)
  - meals.used_ingredients(jsonb) 컬럼에 사용 내역 스냅샷 저장
  - 수정 모드에서는 재차감 없음, 복구도 없음 (단순 수정)
  - MealDetailModal 집밥 상세에서 메모 위에 "사용 재료" 섹션 표시

### 레시피 (Recipes) — Phase 1~4 완성
자주 해먹는 요리를 스페이스 공유로 기록(meals처럼 멤버 공통). 재료 탭 상단 **재료/레시피 토글**(IngredientsPage)로 진입.
- **DB/구조**: `recipes` + `recipe_ingredients`(amount/unit text, sort_order) + `meals.recipe_id`(FK SET NULL). RLS는 space_members 기반(recipe_ingredients는 recipes 경유 join). `recipes-migration.sql`.
  - AppContext: `rowToRecipe`(placeUrl 전례 camelCase, `recipe_ingredients`→`ingredients`), `addRecipe/updateRecipe(재료 삭제 후 재삽입)/deleteRecipe`, loadAllSpaceData/joinByCode에 로드. Realtime 미구독(새로고침 반영).
- **컴포넌트**: `components/Recipes/` — `RecipeList`(카드 목록 + 자체검색 name/memo), `RecipeForm`(이름필수/메모/외부링크 http(s)만 검증/대표사진 wishlist방식/재료 동적), `RecipeDetailModal`(**자체 Modal 1개 안에서 `detail↔cart↔edit↔record` 뷰 전환** — 중첩 모달/popstate 충돌 회피).
- **재료 담기(Phase 2)**: 상세 cart 뷰 — `없는것만`(기본)/`전체` 토글. 매칭은 `normalize`(trim+소문자+공백제거) 후 **완전일치**(부분일치 금지). 보유(`remaining`)/이미담김(`toBuy`) 분류(have/incart/new), 체크박스 수동 가감. 담기 = `addIngredient('toBuy', "이름 (분량)", 1)` **INSERT만**(quantity=1, 차감/냉장고 불변).
- **식사기록 연결(Phase 3)**: 상세 "이 레시피로 기록하기" → record 뷰에서 **신규 집밥 MealForm**(`prefill={tag:집밥, title, recipeId}`) → addMeal에 recipe_id 저장. **해먹은 횟수** = meals 중 recipeId 일치 count(상세·카드 표시).
  - ★ MealForm `prefill` prop: `seed = initial ?? prefill`은 값-init에만, 신규/수정 판정·차감·알림은 `initial`만 → 레시피로 기록 시 `!initial` 차감·알림 정상. (visitingWish=의도적 수정모드 경로 재사용 금지)
- **통합검색(Phase 4)**: `runUnifiedSearch` 4번째 옵션 인자 `{recipes}`(비파괴), 순서 meal→wish→recipe, `RecipeResultCard` + `onSelectRecipe` → Home/Map 둘 다 RecipeDetailModal 재사용.

### 사용자별 별점 (ratings)
- `ratings` 테이블: `UNIQUE(meal_id, user_id)` — 1인 1회
- `ratingsMap` 상태: `{ [mealId]: [{id, user_id, nickname, rating}] }` — AppContext에서 관리
- `addOrUpdateRating(mealId, rating)`: upsert, 같은 별 재탭 시 `deleteRating()` (토글 삭제)
- 평균 = `Math.floor(sum / count)`, "N명 평가" 표시 (2명 이상일 때)
- 별점 등록 시 meal 작성자에게 'rating' 알림 발송 (addOrUpdateRating 반환값 ok===true 시에만)
- 표시: MealDetailModal RatingsSection, FeedCard, DayDetail 카드, 지도 핀카드

### 댓글 기능 (comments)
- `comments` 테이블: meal_id, user_id, nickname, avatar_url, content
- MealDetailModal 내부에서 Realtime 구독 (comments:meal:{mealId} 채널)
- 내 댓글만 삭제 가능
- 댓글 등록 시 meal 작성자에게 'comment' 알림 발송
  - **mealId는 반드시 댓글 INSERT DB 응답의 `data.meal_id` 사용** (FK 검증됨)
  - liveMeal.id(로컬 state) 사용 금지 — optimistic update 경쟁 조건으로 값 불일치 가능

### 알림 기능 (notifications)
- 트리거 3종: 새 기록(new_meal), 댓글(comment), 별점(rating)
- NotificationBell: 헤더 벨 아이콘, 미읽음 배지 (>9 → "9+")
- NotificationPanel: top-sheet (z-[70]), 최신 50건, 항목 클릭 시 해당 meal 상세 열기
- Realtime 구독: `filter: user_id=eq.${user.id}` — 내 알림만 수신
- 알림 설정 (SettingsModal): **단일 마스터 토글**(기존 "알림"+"푸시 알림" 2개 병합). 실제 푸시 제어:
  - **OFF** → `unregisterFCMToken`(이 기기 현재 토큰만 삭제) + `notifEnabled=false`(localStorage) + 인앱 벨 배지/목록 숨김. send-push가 이 기기로 발송 못 함.
  - **ON** → `registerFCMToken({prompt:true})`(토글 탭=제스처, iOS 권한 호환) + `notifEnabled=true`. 거부/미지원 시 안내 문구, 토글 유지.
  - ★ **boot 재등록 게이트**: `localStorage notif_enabled!=='false'`일 때만 boot에서 토큰 등록 → 끈 토큰이 다음 실행에 되살아나지 않음. (send-push/DB 스키마 무변경 — 클라 토큰 등록/해제로만 제어)
- **notify.js 에러 로깅**: INSERT 실패 시 error.code/message 출력. 침묵 실패 금지.
- **수신자 필터**: getSpaceMemberIds → get_space_member_ids RPC (auth.users JOIN) → 실존 멤버만

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

### 배너 시스템 (BannerSlot)
- `banners` 테이블 슬롯별 1개 활성 배너 표시
- **슬롯**: `calendar_top` (달력 탭 상단 흐름), `ingredients_bottom` (재료탭 하단 fixed, 네비 위)
- **타입**: `info` (제목+본문 텍스트 카드), `image` (이미지+선택적 클릭 링크)
- `disclosure` 있으면 배너 하단에 작은 회색 고지 문구 표시 (광고 표시 의무)
- `link_url` 있으면 배너 클릭 시 새 탭으로 이동
- fixed 배너: `z-[49]` (BottomNav z-50보다 낮음)
- **쿠팡 파트너스**: 자동 광고 API는 판매 15만원 조건 미달로 보류 → 현재 수동 이미지+링크 배너

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
- 헤더 돋보기 = 통합검색(`UnifiedSearch`) 오버레이 트리거 (아래 "통합검색" 참조)

### 통합검색 (UnifiedSearch) — 홈/지도 공용
게시글(meals) + 가고 싶은 곳(wishlist) + 레시피(recipe)를 한 검색에서 함께 찾고, 결과에 타입 배지 표시.

- **공유 모듈** (복제 금지 — 한쪽 수정 시 양쪽 반영):
  - `lib/unifiedSearch.js` `runUnifiedSearch(meals, wishlist, q, { recipes = [] } = {})` → `{ type:'meal'|'wishlist'|'recipe', item }[]`
    - meal 필터: title/restaurantName/review/memo · wishlist 필터: name/location/memo/category · recipe 필터: name/memo
    - meal은 날짜 desc + 끼니순 정렬 후 검색. 결과 순서: meal → wishlist → recipe
    - ★ recipes는 4번째 **옵션 인자(비파괴)** — 미전달 시 기존과 100% 동일. 직접 호출처는 UnifiedSearch.jsx 1곳
  - `components/common/UnifiedSearch.jsx` — 전체화면 오버레이(z-[70]): 검색 입력 헤더 + 결과 목록 + 빈/힌트 상태. `onSelectMeal/onSelectWish/onSelectRecipe` prop
  - `components/MealRecord/FeedCard.jsx` (meal 결과 + 홈 피드 공용, `photoArrOf` 포함)
  - `components/common/WishResultCard.jsx` (wishlist 결과 카드, "가보고 싶은 곳" 배지)
  - `components/common/RecipeResultCard.jsx` (recipe 결과 카드, "레시피" 배지, 사진/이름/메모)
- **홈(HomePage)**: 헤더 돋보기 → UnifiedSearch. meal 클릭 → `setSelectedMeal`(상세), wishlist 클릭 → `navigate('/map', { state:{ tab:'wish', wishId } })`, recipe 클릭 → `RecipeDetailModal`(상세)
- **지도(MapPage)**: 헤더 돋보기 → 동일 UnifiedSearch. meal 클릭 → `setViewingMeal`(상세), wishlist 클릭 → 위시탭 전환 + 핀 이동, recipe 클릭 → `RecipeDetailModal`(상세)
  - ★ Home/Map 둘 다 `RecipeDetailModal` 재사용(onSave=updateRecipe, onDelete=deleteRecipe) — 검색에서 열어도 담기/기록/수정 그대로
- **wishlist 결과 → 핀 이동**: MapPage가 `focusWishId` + `focusWishNonce`(재클릭도 재이동) prop으로 MealMap에 전달 → MealMap이 `wishFlyTarget` + `highlightedWishId` + 카드 scrollIntoView (홈 딥링크는 마운트 시 nonce=1)

### 카카오 장소 링크 (place_url)
카카오 `keywordSearch` 결과의 `place_url`(`http://place.map.kakao.com/{id}`)을 저장 → 게시물/위시리스트에서 "카카오맵에서 보기" 링크.

- DB: `meals.place_url`, `wishlist.place_url` (text, nullable) — `place-url-migration.sql` (적용 완료)
- 매핑(AppContext): `rowToMeal`/`mealToRow`/`rowToWishlist`/`addWishlistItem`/`updateWishlistItem`에 `placeUrl` ↔ `place_url`, `MEAL_LIST_SELECT`에 포함
- 저장: MealForm(외식/카페/배달)·MealMap 위시 폼의 장소 선택 시 `place.place_url` 저장
  - **이름 직접 타이핑 시 placeUrl 비움** (이름·링크 불일치 방지 — `handleNameChange`)
- 표시: MealDetailModal / 위시 상세·리스트 카드에 링크 (있을 때만, `target="_blank" rel="noopener noreferrer"`)
- ★ 링크는 **검색으로 장소 선택한 것부터** 생김 — 기존 데이터/직접입력은 링크 미표시(회귀 없음), 재저장(장소 재선택) 시 생성

### [보류] 지도 공유 링크(naver.me/kko.to) 붙여넣기 → 장소 자동 추출
- **정식 "URL→장소" API 없음**: 카카오 로컬·네이버 검색 API 모두 키워드/좌표 기반만 제공, 단축URL→장소 엔드포인트 없음
- 우회(리다이렉트 추적 + `og:title` 추출 → 카카오 재검색)는 **best-effort**: 성공률 불확실, 네이버 단축링크 특히 취약, 지도 페이지 스크래핑/비공식 API는 약관 회색지대
- **핵심 가치는 이미 확보**: 검색으로 장소 선택 시 place_url이 저장됨
- **결론: 보류.** 재추진 시 ① og:title이 카카오/네이버에서 쓸 만한지 실현성 검증 → ② best-effort + 실패 시 수동 입력 폴백 전제로 재검토

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

### PWA
- 홈화면 설치 가능 (Android Chrome / iOS Safari)
- 앱 이름: 식탁일기 / 테마 컬러: #6b4f3a
- 오프라인 감지 시 OfflineBanner 표시 (App.jsx)
- Workbox로 앱 쉘 전체 프리캐시 → 오프라인에서도 앱 로드 가능
- manifest `start_url` / `scope` / `id` = `'/'` (상대경로 — apex 절대값이면 www와 cross-origin으로 무시됨. vite.config.js VitePWA 설정)

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

### 랜딩페이지 (LoginPage) — 로그인 전 화면
- 로그인 전 화면을 **랜딩 + 로그인 한 페이지**로 개편: 히어로 + 기능 소개 4종 + 로그인(카카오/이메일) + 푸터.
- **로고 단일 소스**: 정식 로고 `/icon.svg`로 통일(앱 아이콘/파비콘과 동일 소스).
- **스크린샷 목업**: `public/landing/mockup-*.png`, `alt`/lazy 적용.
  - ★ Workbox `globIgnores: ['**/landing/**']`로 **프리캐시 제외**(설치 용량 절감) — vite.config.js.
- **로그인 로직 무변경**(UI 래퍼만 추가). 비로그인 정적 소개 콘텐츠 확보 → SEO 2순위 해소.
- 계정 삭제 안내: `/account-deletion`(플레이 데이터보안 요구사항).

### 이메일 로그인 / 약관
- 이메일/비밀번호 회원가입·로그인, 비밀번호 재설정
- **이메일 Enumeration Protection 대응**: 이미 가입된 이메일은 error 대신 `identities:[]`로 반환됨
  - `data.user?.identities?.length === 0` 체크 → "이미 가입된 이메일" 안내 (error.message가 없어도 처리)
- `/terms` (이용약관) / `/privacy` (개인정보처리방침): AppProvider 밖 PublicRoutes — 비로그인 접근 가능
- 로그인 화면 카카오/이메일 동의 문구에서 /terms · /privacy 링크
- 운영자: 팀 마이지니 / 문의: admin@siktakilgi.com (다음 스마트워크) / 시행일: 2026년 6월 19일

---

## 관리자 시스템

### 인증 구조
- `admin_accounts` 테이블: email, password_hash, role(super|sub), permissions(jsonb)
- **super** 계정: `role='super'` 체크로 모든 권한 자동 통과 (permissions 무시)
- **sub** 계정: permissions 배열에 있는 권한만 허용
- 게이트웨이 인증: Supabase anon key (`Authorization: Bearer ...` + `apikey: ...` 헤더)
- 함수 인증: 커스텀 헤더 `x-admin-token` (로그인 후 발급된 세션 토큰)

### Edge Functions (supabase/functions/)
```
admin-auth        로그인 → x-admin-token 발급
admin-verify      토큰 검증 + 권한 반환 (AdminGuard에서 호출)
admin-users       사용자 목록/차단/복구/삭제 (view_users, delete_users)
admin-spaces      스페이스 목록/통계 (view_spaces, read_space_content)
admin-feedback    피드백 목록 + 사진 (view_feedback)
admin-manage      관리자 계정 CRUD (manage_admins)
admin-space-delete  스페이스 강제 삭제 (view_spaces)
admin-user-delete   사용자 영구 삭제 (delete_users)
admin-stats       전체 통계 집계 (view_users)
admin-push-stats  푸시 토큰 현황 (view_users)
admin-banners     배너 CRUD + 이미지 업로드 (manage_banners)
_shared/
  adminAuth.ts    토큰 검증 + 권한 체크 공용 헬퍼 (모든 함수에서 import)
```

### CORS 주의사항
- 모든 Edge Function: `Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS`
- **상태 변경은 PATCH 대신 POST + action 파라미터 패턴** 사용 (일부 환경 CORS 이슈 회피)
  - 예: `POST /admin-users` body `{ action: 'ban', userId: '...' }`

### 관리자 라우팅
- `/admin/login` → AdminLoginPage (인증 없음)
- `/admin` → AdminDashboardPage (요약 통계)
- `/admin/users` → AdminUsersPage
- `/admin/spaces` → AdminSpacesPage
- `/admin/spaces/:id` → AdminSpaceDetailPage
- `/admin/feedback` → AdminFeedbackPage
- `/admin/admins` → AdminAdminsPage
- `/admin/banners` → AdminBannersPage
- App.jsx RootRouter에서 `/admin`으로 시작하면 AdminRoutes 분기 (AppProvider 완전 분리)

---

## ★ 알림 시스템 — 풀스택 완성 (인앱 + 안드로이드 푸시 + iOS 푸시 + 딥링크)

### 증상 (2026-06-17~)
인앱 알림 + FCM 푸시 알림 전체 미작동. → **2026-06-20 안드로이드 완전 동작 → 2026-06-21 iOS 푸시·딥링크·유도 배너까지 완성**.

### 1) 인앱 알림 (해결)

**원인1 — 댓글 알림 mealId FK 위반 (409)** → **해결됨**
- 증상: `notifications_meal_id_fkey` FK 위반으로 INSERT 실패
- 원인: `handleAddComment`에서 `mealId: liveMeal.id`(로컬 state) 사용
  → optimistic update 패턴으로 로컬 id가 실제 `meals.id`와 달라질 수 있음
- 수정: MealDetailModal에서 댓글 INSERT DB 응답 `data.meal_id` 사용 (FK 검증됨)
- 추가: 별점 알림도 `addOrUpdateRating` 성공(ok===true) 후에만 발송

**원인2 — 수신자에 유령 멤버 포함, user_id FK 위반 (23503)** → **해결됨**
- 증상: `notifications_user_id_fkey` 위반, 배열 INSERT 전체 롤백
- 원인: `get_space_member_ids`가 `auth.users`에 없는 탈퇴/삭제 잔존(유령 멤버) user_id 반환
- 수정: RPC에 `JOIN auth.users u ON u.id = sm.user_id` 추가 → 실존 멤버만 반환

**진단 가속의 핵심 — notify.js 침묵 실패 제거**
- try/catch가 JS 예외만 잡고 Supabase error 응답은 무시하던 것을
  `const { error }` 구조 분해 후 `console.error` 로깅으로 변경.
- INSERT/RPC 에러가 콘솔에 드러나면서 원인1·2를 빠르게 특정.

### 2) 유령 멤버 근본 원인 (해결)
- 근본 원인: `space_members.user_id`에 **FK가 아예 없었음**(`space_id`엔 있었음)
  → 유저 삭제 시 멤버 행이 잔존 → 유령 멤버 발생.
- 해결: 잔존 유령 `DELETE` + `space_members.user_id`에 **FK `ON DELETE CASCADE`** 추가.
  이제 유저 삭제 시 멤버가 자동 정리됨 (유령 재발 차단).

### 3) 푸시(FCM) — 안드로이드 해결, iOS 미확인

**서버 발송은 처음부터 정상이었음** (실측 확인)
- `on-notification-insert` 트리거(AFTER INSERT, anon JWT 헤더) → `send-push` → FCM v1.
- send-push 호출 시 FCM v1이 `{"name":"projects/siktak-ilgi/messages/..."}` 발급 →
  OAuth/서비스계정 키/토큰 유효성/send 전부 통과 확인.

**원인A — 수신자 기기에 fcm_token 미등록**
- 실제 수신자 기기가 권한 denied였거나, 권한 허용 후 앱 새로고침을 안 함.
- `registerFCMToken`이 로그인 직후 세션 1회(`hasBootedRef`)만 실행돼 재등록 안 됨.
- 조치: 각 수신 기기에서 권한 허용 상태로 앱 새로고침 → `fcm_tokens`에 토큰 저장 확인.

**원인B (핵심) — Service Worker 스코프 충돌** → **해결됨**
- Workbox(`/sw.js`, **push 핸들러 없음**)와 FCM SW(`/firebase-messaging-sw.js`)가
  같은 scope `/`를 공유 → 단일 registration 슬롯을 다툼.
- Workbox가 `skipWaiting:false` + `clientsClaim:true`로 계속 active →
  FCM SW는 PWA 창이 열려 있는 동안 **waiting에 머묾**.
- PushSubscription이 active 워커(=Workbox, 핸들러 없음)에 묶여
  **data-only push가 조용히 폐기** → "서버 발송 성공 + 기기 무표시".
- 포그라운드 `onMessage`도 구독 소유 SW가 페이지로 forward해야 발동하는데,
  구독이 Workbox에 묶여 forward 불가 → 포그라운드도 미표시였음.
- **해결**: FCM SW를 전용 스코프 `'/firebase-cloud-messaging-push-scope'`로 등록 분리
  (`src/lib/firebase.js`, `getToken`에도 동일 registration 전달).
  FCM SW가 자기 registration/구독을 소유 → **백그라운드+포그라운드 양쪽 표시 정상화**.
- 결과: **안드로이드 PWA에서 인앱+푸시 완전 동작 확인** (2026-06-20).

### 4) 푸시(FCM) — iOS 해결 (2026-06-21)

iOS 웹푸시 전제: **iOS 16.4+ & 홈화면 추가 PWA(standalone) & 사용자 제스처 권한**.

**원인C — 권한 요청이 부팅 시 자동 호출** → **해결됨**
- iOS는 `Notification.requestPermission()`을 **사용자 탭(제스처) 안에서만** 허용. 부팅 자동 호출은 차단(안드로이드는 허용돼서 됐던 것).
- 해결: `firebase.js requestFCMToken({ prompt })` — `prompt:false`(부팅)는 `granted`일 때만 조용히 토큰 등록, `'default'`면 프롬프트 안 함. `prompt:true`(버튼 탭)일 때만 권한 요청.
- SettingsModal "알림 켜기" 버튼 + 유도 배너 버튼이 제스처 진입점. `getMessagingInstance`에 `isSupported()` 게이트 추가.

**원인D (핵심) — manifest start_url/scope가 cross-origin이라 iOS가 무시** → **해결됨**
- 사이트는 `www.siktakilgi.com` 서빙(apex는 308→www)인데, manifest `start_url`/`scope`가 절대값 `https://siktakilgi.com/`(apex) → manifest 받은 origin(www)과 **cross-origin → 무시**("start_url ignored" 경고) → iOS가 정상 standalone PWA로 미인식 → 설정>알림에 앱 미등록·권한 팝업 안 뜸 (위치 권한은 standalone 무관이라 떴음).
- 해결: `vite.config.js` manifest `start_url:'/'`, `scope:'/'`, `id:'/'` (상대경로 → 서빙 origin 기준 same-origin). `index.html`에 표준 `mobile-web-app-capable` 보강.

### 5) 알림 클릭 딥링크 — 해당 게시글 열기 (인앱/푸시, 안드로이드/iOS, 콜드/웜)
- **send-push**: `webpush.fcm_options.link = https://www.siktakilgi.com/?meal=<meal_id>` (meal 없으면 홈), `data.meal_id` 유지.
- **SW notificationclick** (`firebase-messaging-sw.js`): `data.meal_id` 읽어
  - 기존 창 있으면 `client.focus()` + `postMessage({type:'OPEN_MEAL', mealId})` (★ 안드로이드 — focus만으론 이동 안 됨)
  - 없으면 `openWindow('/?meal=<id>')` (콜드스타트/iOS)
- **앱 수신** (`App.jsx` AppContent): warm = `serviceWorker` message 리스너 → `navigate('/', {state:{openMealId}})` / cold = 마운트 시 `?meal=` 파싱 → state 변환 + URL 정리.
- **게시글 열기 공유**: `HomePage.openMealById(mealId)` — 인앱 NotificationPanel·푸시 딥링크 공용. 데이터 로딩 전이면 spaces 변경 시 재시도, 열거나 못 찾으면 state 정리(재오픈 방지·graceful).
- 포그라운드 알림도 FCM SW(전용 스코프)로 표시 → 그 SW notificationclick이 클릭 처리(`AppContext` onFCMMessage).

### 6) 알림 목록 무한스크롤 + 유도 배너
- **무한스크롤**: 최초 4개 + 끝 도달 시 10개씩(cursor 방식, `created_at` 기준). 안읽은 뱃지는 목록과 별개로 `count` 쿼리. 알림창 높이 `75dvh → 40dvh`.
- **유도 배너 2종 (standalone로 배타적)**: not-standalone → `InstallBanner`(앱 설치), standalone+`permission==='default'` → `NotifyBanner`(알림 켜기, 버튼 탭 = `registerFCMToken({prompt:true})` 재사용). 거부/닫기 → "설정 > 알림 받기에서 켤 수 있어요" 안내 + **각 7일 억제**(localStorage).

**★ 테스트 시 SW/manifest 캐시 주의**
- 설치형 PWA는 옛 SW/manifest가 끈질기게 남음 → **PWA 완전 삭제 + 사이트 데이터 삭제 후 재설치**. (일반 PWA 캐시보다 더 끈질김)
- iOS는 manifest 변경 후 **재설치 필수**(설치 시점 manifest가 고정됨).
- 검증: `chrome://inspect`(안드로이드) → Service Workers에서 `/firebase-cloud-messaging-push-scope`에 `firebase-messaging-sw.js` activated 확인. iOS는 Mac 없으면 화면 로그/`fcm_tokens` DB로 판별.

---

## SEO / 검색 노출

### 1순위 — 완료 (2026-06-23)
- **index.html 메타 보강** (기존 OG/트위터카드/파비콘은 이미 양호 — 보강만):
  - `<title>` `식탁일기` → `식탁일기 - 함께한 식사의 기록`
  - `<link rel="canonical" href="https://www.siktakilgi.com/">` 추가
  - `og:url` apex → www 통일 (`https://www.siktakilgi.com/`) — 서빙이 www이므로 도메인 신호 일원화
- **public/robots.txt** 신규: 전체 크롤 허용 + `/admin` 제외 + `Sitemap:` 위치 명시
- **public/sitemap.xml** 신규: 공개 3페이지(`/`, `/terms`, `/privacy`), www 기준, lastmod 포함
- **★ robots.txt / sitemap.xml 정적 서빙**: public/ 파일은 Vite가 dist 루트로 복사,
  Vercel이 **정적 파일을 SPA catch-all rewrite보다 우선** 서빙 (assetlinks.json과 동일 원리).
  빌드 후 dist 포함 + 배포 후 URL 직접 반환 확인 완료.
- **Google Search Console**: `google-site-verification` 메타 태그로 소유권 인증 완료,
  sitemap 제출 → 상태 성공, 발견 3페이지.
- **네이버 서치어드바이저**: `naver-site-verification` 메타 태그로 소유권 인증,
  robots.txt 검증, sitemap 제출 + 웹페이지 수집 요청 완료.
- **★ 두 인증 메타 태그(`google-site-verification` / `naver-site-verification`)는
  index.html `<head>`에 있음 — 절대 건드리지 말 것.**

### Google Analytics (GA4) — 연동 완료 (2026-06-23)
- **측정 ID**: `G-BBFV8FZ4LG`. index.html `<head>`에 gtag 스니펫,
  `config(..., { send_page_view: false })` — 자동 페이지뷰 끄고 라우터에서 수동 전송(중복 방지).
  localhost/127.0.0.1은 `window['ga-disable-G-BBFV8FZ4LG']=true`로 차단(개발 데이터 오염 방지).
- **src/lib/analytics.js** `trackPageView(pathname, search)`:
  - SPA 라우트 변경 시 `gtag('event','page_view', {page_path, page_location, page_title})` 수동 전송.
  - **민감/일회성 쿼리(`meal`, `code`, `access_token`, `refresh_token`)는 page_path에서 제거**,
    `page_location`은 `origin + 정제경로`만(해시 토큰 유출 방지).
  - `import.meta.env.PROD`에서만 전송. **사용자 식별정보(user_id/이메일) 절대 미전송.**
- **App.jsx `GAListener`**: `useLocation` 구독 → 최초 1회 + 라우트 변경마다 페이지뷰,
  `useRef`로 정제경로 기준 연속 중복 제거(콜드스타트 `?meal=`→`/` replace 중복 방지).
- **개인정보처리방침(/privacy)**: 처리 위탁 섹션에 Google LLC(Google Analytics) 추가 +
  쿠키 사용·식별정보 미전송·익명 통계만 수집 명시.
- **★ head 마크업 깨짐 교훈**: GA 추가 중 google verification 태그가 `>` 없이 안 닫혀
  떠도는 `>`가 화면 좌상단에 텍스트로 노출됐음(수정 완료). index.html `<head>` 직접 편집 시
  각 `<meta>`/`<link>`가 독립적으로 self-close(`/>`) 됐는지 반드시 확인.

### 현황 / 한계
- 로그인 기반 SPA → 목표는 **"앱 발견성"**(브랜드 검색 + 공유 미리보기 + 공개페이지 위생).
  내부 콘텐츠(사용자 기록)는 로그인 뒤라 검색 대상 아님 — **의도된 정상**.
- 공개(크롤 가능) 페이지: `/`(로그인), `/terms`, `/privacy`.
- 실제 검색 노출은 수집·색인까지 **며칠~몇 주** 소요.

### 2순위 — 비로그인 소개 콘텐츠 (완료)
- **비로그인 정적 소개 콘텐츠 — 해결됨**: 로그인 전 화면(LoginPage)을 **랜딩+로그인 한 페이지**로 개편
  (히어로 + 기능 4종 + 로그인 + 푸터 + 스크린샷 목업) → 검색엔진이 "이 앱이 뭔지" 읽을 정적 텍스트 확보.
  구글 색인 기준 2순위 해소. (아래 "랜딩페이지" 참조)
- (선택/나중) **라우트별 title/description** (`/terms`, `/privacy`), **JSON-LD WebApplication 스키마**.

---

## iOS 앱 (Capacitor) — Phase A1~A3 완료, Phase B(빌드) 예정

웹/PWA/안드로이드 TWA를 **그대로 두고** iOS 앱스토어용 네이티브 래퍼만 추가. 맥 없이 Codemagic(클라우드 맥)으로 빌드 예정. Bundle ID = `com.siktakilgi.app`(안드로이드와 통일).

### 도입 방식 — 방식2(dist 번들), 원격 URL 로드 아님
- `capacitor.config.json`: `appId=com.siktakilgi.app`, `appName=식탁일기`, `webDir=dist`, **`server.url` 없음**(로컬 번들). `cap sync ios`가 dist를 iOS에 번들.
- `server.hostname='www.siktakilgi.com'` + `iosScheme='capacitor'` → iOS WebView origin = `capacitor://www.siktakilgi.com`(카카오 지도 도메인 매칭 시도, A3-2). iOS는 https 로컬 스킴 예약이라 불가.
- ★ `capacitor.config`는 **Capacitor 네이티브 빌드만** 읽음 → 웹/Vercel/안드로이드 TWA 무영향(dist에 유출 없음).

### 네이티브 게이트 — `src/lib/platform.js` `isNative()` (= `Capacitor.isNativePlatform()`)
웹에선 항상 false → 기존 웹 경로 100% 유지. 네이티브에서만 분기:
- `main.jsx`: SW 등록을 `!isNative()`일 때만(`vite.config` `injectRegister:null` + 수동 `registerSW()`). 네이티브에서 Workbox SW가 stale index.html 서빙하는 사고 방지.
- `InstallBanner`/`NotifyBanner`: 네이티브 early-return(웹푸시 유도/설치 안내는 웹 전용).
- Android TWA는 **웹 컨텍스트**라 `isNative()=false` → 게이트 영향 없음(기존 웹푸시 그대로).

### A1 — 설치 + 번들 + 게이트
- `@capacitor/core`,`@capacitor/ios`(deps) + `@capacitor/cli`(dev). `npx cap add ios` → `ios/` Xcode 프로젝트 **커밋**(생성물 `App/App/public`·`Pods/`·`build/`·생성 config는 `ios/.gitignore`로 제외 → Codemagic이 `cap sync`로 재생성).

### A2 — 네이티브 푸시 (`@capacitor-firebase/messaging`)
- APNs→FCM 스위즐링으로 **통합 FCM 토큰** → 기존 `send-push`(FCM v1) 백엔드 재사용.
- 클라: `registerFCMToken`이 `isNative()`면 `registerNativeFCMToken`(권한+`getToken`→`fcm_tokens`에 `platform:'ios'`). 웹 경로 무변경.
- **`fcm_tokens.platform` 컬럼**(`text NOT NULL default 'web'`, `fcm-tokens-platform-migration.sql`) — 기존 행 백필로 회귀 없음.
- `send-push` platform 분기: **ios**=`notification`+`apns(aps)`, **web/android**=기존 `webpush` data-only(100% 보존).
- 딥링크(네이티브): `notificationActionPerformed`(App.jsx) → `data.meal_id` → `navigate('/', {state:{openMealId}})` 재사용.
- iOS 설정: `AppDelegate.swift` APNs 브리지 3종, `GoogleService-Info.plist`(`ios/App/App/`, **커밋**·pbxproj 4곳 배선), `capacitor.config` `experimental.ios.spm.packageOptions` 심링크 옵션.

### A3-1 — 카카오 OAuth 네이티브 (`@capacitor/browser`,`@capacitor/app`)
- ★ 우리는 **implicit flow**(supabase-js 기본, `flowType` override 안 함) → 토큰이 URL 해시로 옴 → PKCE `code_verifier` 문제 **원래 없음**.
- 네이티브 `signIn()`: `redirectTo='com.siktakilgi.app://login-callback'` + `skipBrowserRedirect` → `Browser.open`. 카카오→Supabase(https)→302 커스텀 스킴(#access_token) → `App.jsx` `appUrlOpen`(네이티브 게이트) → `setSession` → 기존 boot. **웹 경로(redirectTo=origin) 무변경.**
- Info.plist `CFBundleURLTypes`에 `com.siktakilgi.app` 스킴. Supabase Redirect URLs에 `com.siktakilgi.app://login-callback` 추가(완료). 카카오 콘솔은 변경 불필요(커스텀 스킴은 Supabase→앱 구간).
- 이메일 로그인이 폴백 → OAuth 최악에도 앱 사용 가능.

### A3-2 — 카카오 지도 origin → ★ iframe 프록시로 해결 (map-embed, Phase 1~4 완료)
- 문제: iOS는 `capacitor://localhost` origin 강제 → 카카오 JS SDK 가 등록 도메인(http(s))만 허용해 거부.
  `server.hostname` 위장 트릭은 불확실 → **폐기**(capacitor.config hostname 없음 = localhost 원복, ed78f35).
- 해결: **카카오 등록 도메인(www.siktakilgi.com)에서 서빙되는 경량 `map-embed.html` 을 iframe 으로 임베드.**
  iframe 문서 origin = www → SDK referer 검증 통과. 부모(capacitor://localhost) ↔ iframe postMessage 브릿지.
- GPS 는 hostname 무관(capacitor:// 도 secure context) — 부모가 취득해 `userLoc` 으로 iframe 전달. Info.plist 위치 설명 추가 완료.

#### map-embed iframe 프록시 구조 (★ iOS 카카오 지도/검색 = 전부 이 경로)
- **embed 페이지**: `map-embed.html`(Vite 멀티페이지 엔트리) + `src/map-embed/main.js`(vanilla, React 미포함).
  카카오 SDK(services 포함, autoload=false) 로드, `%VITE_KAKAO_MAP_KEY%` 빌드타임 주입. **www 로 배포**(Vercel).
  ★ SW `navigateFallbackDenylist` 에 `/map-embed(-test)?\.html` 등재 필수 — 없으면 Workbox 가 index.html 로 폴백(0ced35c/3b49b2c).
- **프로토콜**(부모 `src:'siktak'` → embed, embed `src:'siktak-embed'` → 부모):
  - 렌더: `init`/`setPins`/`panTo`/`userLoc`/`select` → embed, `ready`/`pinClick`/`boundsChanged` ← embed.
  - `boundsChanged`(Phase 4b): embed 가 지도 `idle` 시 `{bounds:{swLat,swLng,neLat,neLng}, center, level}` 송신(120ms 디바운스, 초기 렌더 후 1회). 부모 `MapEmbedView onBoundsChange` → `MealMap setMapBounds` → 웹과 **동일한 `visiblePins` 필터** 재사용.
  - RPC: `search`(keywordSearch)/`geocode`(coord2Address, reqId 매칭+타임아웃) ↔ `search:result`/`geocode:result`.
  - `PARENT_ALLOWLIST` 에 `capacitor://localhost` 등재(부모 origin 검증). embed forward addressSearch 없음 → 지오코딩은 keywordSearch 첫 결과로 근사.
- **부모 클라이언트**:
  - `src/lib/mapEmbed.js` — `EMBED_ORIGIN='https://www.siktakilgi.com'`·`EMBED_URL`·`NATIVE_PARENT_ORIGIN`, `embedSearch/embedGeocode`(isNative면 RPC, 아니면 웹 폴백).
  - `src/lib/mapEmbedRpc.js` — `createMapEmbedRpc({getTarget,targetOrigin,timeout})`, reqId nonce 매칭.
  - `components/common/MapEmbedRpcProvider.jsx` — 네이티브 전용 **숨김 iframe 1개 상시 mount**(App 루트) + `useMapEmbedRpc()` context. 웹은 children 그대로 통과(rpc=null).
  - `components/common/MapEmbedView.jsx` — 네이티브 전용 **보이는 지도 iframe**. props(pins/userLoc/fly/selectedId)→postMessage, pinClick 수신. `e.source` 로 자기 iframe 만 처리(다중 iframe 격리 필수).
- **연결(Phase 4, 전부 `isNative()` 분기 — 웹/안드로이드/TWA 100% 기존 인라인 지도·검색 유지)**:
  - 지도 A/B: MealMap 맛집/위시 지도 → MapEmbedView(클러스터→대표핀, pinClick→기존 handlePinClick/위시 하이라이트).
  - 지도 C: MealDetailModal `SmallMap` → MapEmbedView(detail, 단일 핀).
  - 검색/지오코딩 D~G: MealForm/위시폼 → 숨김 iframe RPC. 입력창·드롭다운·place_url·차감 흐름 그대로, 응답 소스만 교체.
- **capacitor.config**: `server.allowNavigation:["www.siktakilgi.com"]`(iframe 원격 로드 허용). hostname 없음(localhost).
- **★ 축소 패리티(iOS 한정)**: ~~맛집 목록 bounds 필터~~ → **Phase 4b 에서 복원됨**(`boundsChanged`). 남은 것: 클러스터 카운트 배지 없음 / 지도 배경클릭 선택해제 없음. 이 둘의 완전 패리티는 embed 프로토콜 추가 확장(mapClick/카운트)+www 재배포 필요.
- **★ Phase 4b 배포 순서**: embed(`map-embed.html`/`src/map-embed/main.js`) 변경은 **www(Vercel)에 먼저 배포**돼야 iframe 이 새 프로토콜을 쓴다. 앱(네이티브)만 먼저 올리면 `boundsChanged` 를 아무도 안 보내 `mapBounds=null` → 전체 표시로 **graceful degrade**(깨지진 않음).
- **★ 미검증(Phase C 첫 iOS 실기기)**: ① allowNavigation 으로 iframe 이 WKWebView 안에서 실제 로드되는지, ② iframe origin=www 로 카카오 도메인 검증 통과하는지 — iframe 설계의 핵심 미지수. 실패 시 degrade/"카카오맵 앱으로 열기" 폴백은 설계만.

### Phase B (Codemagic/Mac) 이월 — 빌드 시 필수
- ★ **`npx cap sync ios` 반드시 실행** — Windows 심링크 실패로 `ios/App/CapApp-SPM/Package.swift`에 플러그인(messaging/browser/app) 미등록 → Mac에서 재생성해야 3종 포함(안 하면 푸시·OAuth·앱 누락 빌드).
- **Push Notifications capability + `aps-environment` entitlement** + 서명/프로비저닝(App Store Connect API 키).
- (완료·코드 반영) `Info.plist` `NSLocationWhenInUseUsageDescription`(지도 GPS)·`UIBackgroundModes: remote-notification`. GoogleService-Info.plist 배선·커밋.
- **Phase C**: SE2 실기기로 로그인(OAuth)/푸시/딥링크/**map-embed iframe 지도·검색**(로드·카카오 origin 통과·핀/클릭/GPS/검색) 실측.

---

## 출시 준비

### 플레이스토어(안드로이드 TWA) — 비공개 테스트 진행 중

**완료된 단계**
- [x] PWABuilder로 `.aab` 생성. Package ID: `com.siktakilgi.app`
- [x] 서명 키(`signing.keystore` + `signing-key-info`) — ★ 별도 안전 백업 필수
  - 앱 업데이트 시 반드시 'Use mine'으로 같은 키 사용. 분실 시 업데이트 불가.
- [x] `public/.well-known/assetlinks.json` 게시 + Google Digital Asset Links 검증 통과 (`www.siktakilgi.com ↔ com.siktakilgi.app`)
- [x] 앱 업데이트 방식: `git push` → Vercel 자동 배포 (앱 껍데기 변경 시만 재패키징)
- [x] 구글 플레이 개발자 계정 승인 완료 (2026-06-23)
- [x] **앱 설정 전체 완료**: 개인정보/광고/콘텐츠등급(**12세**)/타겟연령(**13+**)/데이터보안/
  광고ID(**아니요** + 출시 오류는 "사용 중지")/카테고리/스토어 등록정보. 계정삭제 URL = `/account-deletion`.
- [x] **비공개 테스트 트랙에 `.aab` 업로드.** 본인 폰에서 standalone/로그인/푸시/딥링크 정상 확인.

**다음 단계 (프로덕션까지)**
1. ★ **비공개 테스트 12명 / 14일 필수** (신규 개인 계정 요건). 테스터 모으기 →
   가족·친구 → 품앗이 커뮤니티 → 유료 대행 순.
2. 14일 중 **업데이트 1회 권장**("개선한 티") — 레시피 기능 추가가 그 근거로 활용 가능.
3. 14일 충족 후 **프로덕션 신청** — 설문 성의껏 답변(★ PWA/TWA는 약점으로 보여 거절 사유에 잘 답해야).
- 스토어 등록물(설명/그래픽/스크린샷)은 Claude Design 브랜딩 프롬프트로 제작 가능.

### 애플 앱스토어 — 보류

- iOS는 PWA(홈화면 추가)로 이미 푸시까지 동작 → 당장 불필요
- 애플 앱스토어: 연 $99 + Mac 필수(Xcode) + TWA 방식 심사 거부 위험
- **결정**: 구글 출시 완성 후, Mac 확보되면 검토
  - 길 A: PWABuilder iOS 시도 → 거부 시 길 B: Capacitor 래핑
- ★ 개발용 아이폰은 **iOS 17+ 모델 필요**(개발자 로그인/사이드로드 요건) — 아이폰 8 불가
- Mac 미보유 시 **클라우드 맥 단기 임대(4~7만원)** 로 대체 가능

### 배포 방식 요약

| 항목 | 내용 |
|---|---|
| 안드로이드 | TWA (PWABuilder) — 플레이스토어 |
| iOS | PWA 홈화면 추가 (현재) / 앱스토어 보류 |
| 앱 업데이트 | `git push` → Vercel 자동 배포 (TWA 재패키징 불필요) |
| Package ID | `com.siktakilgi.app` |
| 서명 키 | 별도 안전 백업 — 분실 시 업데이트 불가 |

### 출시 전 체크리스트
- [x] 알림 — 인앱 + 안드로이드 + **iOS** FCM 푸시 + 클릭 딥링크 완성 (2026-06-21)
- [x] assetlinks.json 게시 + Digital Asset Links 검증 통과 (2026-06-22)
- [x] SEO 1순위 — title/canonical/og:url(www) + robots/sitemap + 구글/네이버 등록 (2026-06-23)
- [x] Google Analytics(GA4) 연동 + SPA 라우트 추적 + 방침 GA 고지 (2026-06-23)
- [x] 구글 플레이 개발자 계정 승인 완료 (2026-06-23)
- [x] 레시피 관리 기능 완성 (Phase 1~4) — 비공개 테스트 중 업데이트 근거로 활용 가능
- [x] 랜딩페이지 개편 (로그인 전 화면 = 랜딩+로그인, 로고 통일, 목업) — SEO 2순위 해소
- [x] 플레이 콘솔 앱 설정 전체 완료 + 비공개 테스트 트랙에 .aab 업로드
- [ ] ★ **비공개 테스트 12명 / 14일 채우기 → 프로덕션 신청 (1순위)**
- [ ] 스토어 등록물 제작 (스크린샷/설명/피처 그래픽 — Claude Design 의뢰)
- [ ] **약관/개인정보처리방침 시행일(EFFECTIVE_DATE 현재 2026-06-19)을 출시일로 변경**
- [ ] 관리자 비밀번호 변경 (현재 채팅에 노출된 초기 비밀번호 사용 중)
- [ ] 오너 승계 실제 테스트 (멤버 2명 스페이스에서 오너 탈퇴 시나리오)
- [ ] 이메일 인증메일 실제 수신 확인
  - Supabase 기본 SMTP: 하루 3건 제한 → 출시 전 별도 SMTP 서비스(Resend 등) 연동 검토
- [ ] admin@siktakilgi.com 수신 테스트 (다음 스마트워크 메일)
- [ ] 테스트 계정 / 유령 데이터 정리
- [ ] Android TWA 포그라운드 알림 아이콘 확인

---

## 반복 함정 (다음 세션에서도 주의)

| 함정 | 올바른 방법 |
|---|---|
| `space_members.created_at` 사용 | 컬럼명은 `joined_at` (created_at 없음) |
| `gen_random_bytes` / `gen_salt` 직접 호출 | `extensions` 스키마 소속 → RPC에 `SET search_path = public, extensions` 필수 |
| PWA 캐시로 오래된 코드가 보임 | 테스트는 항상 **시크릿 창** 사용 (캐시 없음) |
| 설치형 PWA의 SW 캐시 | 일반 PWA 캐시보다 더 끈질김 → **PWA 삭제 + 사이트 데이터 삭제 후 재설치**해야 새 SW 적용 |
| Workbox sw.js와 FCM SW 같은 scope `/` 등록 | 충돌(단일 슬롯 다툼) → FCM SW는 **전용 scope `/firebase-cloud-messaging-push-scope`**로 분리 등록 |
| data-only FCM 페이로드 | 브라우저 자동 표시 없음 → SW가 직접 `showNotification` 호출해야 표시됨 |
| Supabase RPC/INSERT error 무시 | 반드시 `const { error }` 받아서 `console.error` 로깅 — 침묵 실패 금지 |
| 댓글 알림에 `liveMeal.id` 사용 | 반드시 댓글 INSERT 응답의 `data.meal_id` 사용 (FK 검증됨) |
| `get_space_members` 내부 변수명 | sm 대신 `sm0` 별칭 필수 (RETURNS TABLE의 user_id 컬럼과 충돌) |
| Edge Function CORS — PATCH 메서드 | 상태 변경은 `POST + action` 패턴 사용 (CORS Allow-Methods에 PATCH 누락 이슈) |
| admin sub 계정 권한 | super는 role 체크로 우회, sub는 permissions jsonb 배열 확인 필수 |
| 카카오 place_url | **검색으로 장소 선택 시에만** 저장됨 — 직접 입력/기존 데이터는 링크 없음, 이름 직접 수정 시 placeUrl 비움 |
| 새 컬럼 insert 전 마이그레이션 | place_url 등 새 컬럼은 **배포(push) 전에 ADD COLUMN 먼저** — 없으면 insert 전체가 실패(저장 회귀) |
| 통합검색 로직 수정 | `lib/unifiedSearch.js` 한 곳만 고치면 홈/지도 양쪽 반영 (UnifiedSearch 공용) |
| iOS 알림 권한 요청 | `Notification.requestPermission()`은 **사용자 탭(제스처) 안에서만** — 부팅 자동 호출은 iOS가 차단(안드로이드는 허용). 버튼에서만 `prompt:true` |
| manifest start_url/scope 절대값 | 서빙 origin과 cross-origin이면 무시("ignored" 경고) → iOS standalone 미인식·푸시 불가. **상대경로 `/`** 사용 |
| iOS 푸시 안 됨 | 16.4+ & 홈화면 PWA(standalone) & 제스처 권한 3개 모두 필수. manifest 변경 후 **재설치** 필요(설치 시점 고정) |
| 알림 클릭 이동 안 됨 | SW notificationclick에서 `data.meal_id`로 딥링크 — 기존 창은 `focus()`만으론 이동 안 됨, `postMessage(OPEN_MEAL)` 필요(안드로이드) |
| iOS 원격 디버깅 | Mac+Safari 필요 → Mac 없으면 화면 로그/`fcm_tokens` DB로 판별 |
| 검색엔진 소유권 인증 메타 | index.html `<head>`의 `google-site-verification`/`naver-site-verification` 태그 삭제 금지 (지우면 소유권 인증 풀림) |
| robots.txt/sitemap.xml 서빙 | public/에 두면 정적 파일이라 SPA catch-all rewrite보다 우선 서빙됨 (assetlinks.json과 동일) |
| canonical/도메인 신호 | www로 통일 (서빙이 www, apex는 308→www). og:url·canonical 모두 `https://www.siktakilgi.com/` |
| index.html `<head>` 직접 편집 | 각 `<meta>`/`<link>`가 독립 self-close(`/>`)인지 확인 — 한 태그라도 `>` 빠지면 떠도는 `>`가 화면에 텍스트로 새어나옴(실제 발생) |
| GA 페이지뷰에 쿼리/식별정보 포함 | `analytics.js`가 `meal`/`code`/토큰 쿼리 제거 + user_id/이메일 미전송. 새 민감 쿼리 추가 시 `STRIP_PARAMS`에도 추가 |
| GA 자동 페이지뷰 중복 | index.html은 `send_page_view:false`, 페이지뷰는 라우터(GAListener)에서만 수동 전송 — config에서 다시 켜지 말 것 |
| 두 개의 히스토리-Modal 동시 전환 | 한 Modal을 닫으며(setState null) 다른 Modal을 같은 틱에 열면, 닫히는 Modal cleanup의 `history.back()`이 비동기 popstate를 쏘고 그걸 **방금 열린 Modal의 리스너가 잡아 즉시 닫음**(창 안 뜸·에러 없음). → 두 번째 모달 대신 **같은 모달 인스턴스 안 뷰 전환**으로 처리 (RecipeDetailModal detail↔cart↔edit↔record 패턴) |
| MealForm 프리필 시 차감·알림 죽음 | MealForm은 `initial`이 truthy면 수정 모드로 판정해 차감·new_meal 알림을 건너뜀(`!initial` 가드). 신규인데 값만 채우려면 `initial` 말고 **`prefill` prop** 사용(seed=initial??prefill는 값-init에만, 판정은 initial). "이 레시피로 기록하기"가 이 경로 — initial 쓰면 신규 집밥 차감/알림이 죽음 |
| Capacitor 네이티브 코드가 웹 회귀 유발 | 네이티브 전용은 반드시 `isNative()` 게이트 + 플러그인 **lazy import**(`await import('@capacitor/...')`). 웹은 `isNative()=false`라 로드 안 됨. Android TWA도 웹 컨텍스트라 false — 게이트가 TWA를 막지 않음 |
| Windows에서 `cap sync` 심링크 EPERM | Windows는 SPM 심링크 생성 불가 → `ios/App/CapApp-SPM/Package.swift`에 플러그인 미등록 상태로 커밋됨. **Codemagic(Mac)이 빌드 전 `npx cap sync ios` 실행해야** messaging/browser/app 포함(안 하면 푸시·OAuth·앱 누락 빌드) |
| iOS는 로컬 콘텐츠에 https 스킴 불가 | https는 WKWebView가 원격 전용으로 예약 → iOS 앱 origin은 `capacitor://`. `server.hostname`으로 호스트명만 바꿀 수 있음(스킴은 capacitor 고정). 카카오 지도 도메인 매칭은 실기기 실측 필요 |
| Supabase OAuth를 PKCE로 가정 | 우리는 `flowType` 미설정 → **implicit flow**(토큰이 URL 해시). 네이티브 복귀는 `exchangeCodeForSession`(PKCE)이 아니라 해시 파싱 후 `setSession`. flowType 바꾸면 웹까지 영향 |
| 알림 토글 껐는데 boot가 토큰 재등록 | 토글 OFF로 토큰 삭제해도 boot가 무조건 `registerFCMToken` 호출하면 되살아남. boot 등록을 `localStorage notif_enabled!=='false'` 게이트로 감쌀 것 |
| capacitor.config가 웹에 영향 준다는 오해 | `capacitor.config`는 Capacitor 네이티브 빌드만 읽음. 웹(vite/dist/Vercel)·안드로이드 TWA는 안 읽음. `server.hostname`/plist 등 iOS 설정은 웹 무영향 |
| iOS 카카오 지도/검색이 kakao 직접호출로 남음 | 네이티브는 `window.kakao` 도메인 검증에 막힘 → MealMap/MealForm/SmallMap/위시폼은 **`isNative()` 분기**로 map-embed iframe/RPC 경유(`MapEmbedView`·`embedSearch`·`embedGeocode`). 웹은 rpc=null → 기존 직접호출 |
| map-embed iframe src 상대경로 | 네이티브에서 `/map-embed.html`은 `capacitor://localhost`로 로드돼 **똑같이 카카오에 막힘**. 반드시 절대 URL `https://www.siktakilgi.com/map-embed.html`(`EMBED_URL`) 사용 |
| map-embed 다중 iframe 메시지 혼선 | 지도 iframe + 숨김 RPC iframe 공존 → `MapEmbedView`는 `e.source`로 자기 iframe만, `mapEmbedRpc`는 `reqId`로만 매칭해 격리. ready/pinClick(reqId 없음)과 search:result(reqId 있음) 구분 |
| embed 프로토콜엔 forward addressSearch 없음 | 지오코딩(주소→좌표)은 `search`(keywordSearch) 첫 결과 좌표로 **근사**(`embedGeocode`). 장소 선택 시엔 좌표가 직접 오므로 폴백 용도 |
| map-embed 프로토콜 확장 시 | iframe은 **배포된 www embed**를 로드 → 프로토콜 추가(bounds/mapClick/카운트)는 **www 재배포 선행** 후에야 네이티브가 사용 가능(Phase 4b) |

---

## 라우팅

| 경로 | 페이지 | 설명 |
|---|---|---|
| `/` | HomePage | 홈 피드 (통계 + 최근 기록) |
| `/calendar` | CalendarPage | 월간 달력 |
| `/map` | MapPage | 맛집 지도 |
| `/ingredients` | IngredientsPage | 재료 목록 |
| `/spaces` | SpacesPage | 스페이스 관리 |
| `/reset-password` | ResetPasswordPage | 비밀번호 재설정 |
| `/terms` | TermsPage | 이용약관 (비로그인 접근 가능) |
| `/privacy` | PrivacyPage | 개인정보처리방침 (비로그인 접근 가능) |
| `/join?code=...` | (App.jsx 처리) | 초대 링크 → 로그인 후 자동 참가 |
| `/admin/login` | AdminLoginPage | 관리자 로그인 |
| `/admin` | AdminDashboardPage | 관리자 대시보드 |
| `/admin/users` | AdminUsersPage | 사용자 관리 |
| `/admin/spaces` | AdminSpacesPage | 스페이스 목록 |
| `/admin/spaces/:id` | AdminSpaceDetailPage | 스페이스 상세 |
| `/admin/feedback` | AdminFeedbackPage | 피드백 목록 |
| `/admin/admins` | AdminAdminsPage | 관리자 계정 관리 |
| `/admin/banners` | AdminBannersPage | 배너 관리 |

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
| Vercel 배포 | https://siktakilgi.com, GitHub 푸시 시 자동 배포 |
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
| 이메일 enumeration protection | identities[] 체크로 중복 이메일 "이미 가입된 이메일" 안내 |
| 회원 탈퇴 | 확인 2단계(안내→"탈퇴" 입력) → delete_user_account RPC 직접 호출 |
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
| 스페이스 구성원 관리 | SpaceManager에 멤버 목록(get_space_members RPC), 오너 배지, 강퇴, 초대코드 재발급 |
| 스페이스 오너 승계 | leave_space/transfer_owned_spaces RPC + spaces.owner_id FK ON DELETE SET NULL + isGhostOwner UI |
| 배너 시스템 | banners 테이블, BannerSlot 컴포넌트, info/image 타입, disclosure 고지 문구, fixed 위치 |
| 배너 관리자 페이지 | AdminBannersPage — 슬롯별 배너 CRUD, 이미지 업로드(Storage banners 버킷), 쿠팡 빠른입력 |
| 초대 링크 도메인 고정 | SITE_URL 상수 (VITE_PUBLIC_SITE_URL fallback) — SpaceManager·MealMap 모두 siktakilgi.com 고정 |
| 관리자 시스템 | admin_accounts(super/sub), 권한 7종, Edge Functions 11종, x-admin-token 인증, CORS POST+action |
| 재료 수량 기능 | ingredients.quantity 컬럼, QtyStepper 컴포넌트, 남은재료 체크 제거(수량+삭제만), 살것 체크 유지 |
| 집밥 재료 차감 | meals.used_ingredients(jsonb), MealDetailModal "사용 재료" 섹션, 저장 1회만 차감 |
| 이용약관·개인정보처리방침 | /terms /privacy 페이지, 비로그인 접근, 쿠팡 파트너스 고지 포함 |
| 알림 mealId FK 수정 | 댓글 알림 mealId를 data.meal_id(DB 응답)로 변경 — FK 위반(409) 해결 |
| 알림 user_id FK 수정 | get_space_member_ids RPC JOIN auth.users — 유령 멤버 제외, 배치 INSERT 실패(23503) 해결 |
| notify.js 에러 로깅 | INSERT/RPC error console.error 추가 — 침묵 실패 방지, 원인 진단 가능 |
| FK 삭제 규칙 정리 | meals/comments/ratings.user_id ON DELETE SET NULL, notifications.user_id ON DELETE CASCADE |
| 유령 멤버 근본 해결 | space_members.user_id에 FK 없던 것 → 잔존 유령 DELETE + FK ON DELETE CASCADE 추가 |
| FCM 푸시 SW 스코프 분리 | Workbox/FCM SW가 scope `/` 충돌 → FCM SW를 전용 스코프로 등록(firebase.js), 안드로이드 인앱+푸시 완전 동작 |
| 통합검색 wishlist 포함 | 홈 검색이 meals+wishlist, "가보고 싶은 곳" 배지, 결과 클릭 시 핀 이동 |
| 검색 공유 모듈화 | lib/unifiedSearch.js + UnifiedSearch/FeedCard/WishResultCard 추출 → 홈/지도 공용 |
| 지도 탭 검색 | 장식용 돋보기 → 실제 검색(UnifiedSearch 오버레이), meal→상세 / wishlist→위시탭+핀 이동 |
| 카카오 장소 링크 | meals/wishlist place_url 컬럼, 검색 선택 시 저장, 상세/카드에 "카카오맵에서 보기" 링크 |
| iOS 푸시 — 제스처 권한 | requestFCMToken({prompt}), 부팅은 granted만 조용히 등록, 버튼 탭에서만 권한 요청, isSupported 게이트 |
| iOS 푸시 — manifest 상대경로 | start_url/scope/id를 '/'로 (절대값 apex라 www와 cross-origin→무시→standalone 미인식 해결) + mobile-web-app-capable |
| 알림 클릭 딥링크 | send-push link=/?meal=, SW notificationclick focus+postMessage/openWindow, App warm+cold, openMealById 공유 |
| 알림 무한스크롤 | 최초 4개+10개씩 cursor, 안읽은 뱃지 별도 count, 알림창 75dvh→40dvh |
| 집밥 재료 차분 동기화 | 수정 시 기존 used_ingredients 대비 delta만 재고 조정(이중 차감 없음), 가상행으로 차감된 원본 표시 |
| 유도 배너 2종 | not-standalone→앱설치, standalone+권한default→알림켜기(registerFCMToken 재사용), 각 7일 억제 |
| iOS 댓글 입력 넘침 수정 | flex min-width:auto 넘침 → 입력행 min-w-0 (댓글/검색/닉네임 입력 공통) |
| TWA .aab 생성 | PWABuilder로 안드로이드 TWA 패키지 생성. Package ID: com.siktakilgi.app. 서명 키 별도 백업 |
| assetlinks.json 게시 | public/.well-known/assetlinks.json (SHA256 지문), vercel.json .well-known 정적 서빙 규칙 추가 |
| Digital Asset Links 검증 | www.siktakilgi.com ↔ com.siktakilgi.app 연결 확인. apex→www 308 리다이렉트도 정상 |
| manifest 상대경로 수정 | vite.config.js start_url/scope/id를 '/'로 (apex 절대값 → www cross-origin 문제 해결) |
| SEO 1순위 | title 보강 + canonical + og:url www 통일 + robots.txt/sitemap.xml(정적 우선 서빙) + 구글/네이버 등록 |
| Google Analytics(GA4) | G-BBFV8FZ4LG, gtag(send_page_view:false), analytics.js trackPageView SPA 라우트 추적, 민감 쿼리 제거, PROD만 전송, 방침 GA 고지 |
| index.html head 마크업 수정 | google verification 태그 미닫힘 → 떠도는 '>' 화면 노출 수정, 각 meta/link 독립 self-close |
| 레시피 관리 Phase 1 | recipes/recipe_ingredients 테이블 + meals.recipe_id 컬럼 + RLS, AppContext rowToRecipe/add·update·deleteRecipe + 로드, 재료 탭 재료/레시피 토글 + RecipeList/RecipeForm/RecipeDetailModal(이름/메모/링크 http(s)검증/사진/재료배열) + 자체검색. 담기·식사연결·통합검색은 Phase 2~4 |
| 레시피 관리 Phase 2 | RecipeDetailModal "재료 담기" — detail↔cart 뷰 전환, 없는것만/전체 토글, 보유(remaining)/장바구니(toBuy) 정규화 완전일치 비교로 분류(have/incart/new), 체크박스 수동 가감, 체크된 재료를 addIngredient('toBuy', "이름 (분량)", 1) 반복 INSERT(quantity=1 고정, 차감/냉장고 불변), 로컬 토스트 |
| 레시피 수정 버튼 무반응 수정 | 원인=상세 모달 닫기+수정 폼 모달 열기가 같은 틱→상세 cleanup의 history.back() popstate가 새 폼 모달을 즉시 닫음. 수정을 RecipeDetailModal 안 'edit' 뷰(detail↔cart↔edit)로 이동(중첩 모달 제거), 추가만 standalone 모달 유지. RecipeList는 detailId로 최신 recipe 조회→수정 직후 상세 갱신 |
| 레시피 관리 Phase 3 | 식사기록 연결. MealForm에 `prefill` prop 추가(seed=initial??prefill, 값-init만 seed / 신규·수정 판정·차감·알림은 initial 유지 — !initial 경로 그대로 작동). RecipeDetailModal "이 레시피로 기록하기" → 'record' 뷰에서 신규 집밥 MealForm(prefill={tag:집밥, title, recipeId}) → addMeal에 recipe_id 저장. meals select/rowToMeal/mealToRow에 recipe_id↔recipeId 매핑(조건부 set으로 회귀 방지). 해먹은 횟수 = meals 중 recipeId 일치 count(상세·카드 표시) |
| 레시피 관리 Phase 4 | 통합검색 레시피 연동(마지막). runUnifiedSearch 4번째 옵션 인자 `{recipes}`(비파괴, 미전달 시 기존 동일) + recipe 필터(name/memo) → meal→wish→recipe 순. UnifiedSearch에 RecipeResultCard("레시피" 배지) + onSelectRecipe. Home/Map 둘 다 RecipeDetailModal 재사용(검색에서도 담기/기록/수정 동작) |
| 랜딩페이지 개편 | 로그인 전 화면을 랜딩+로그인 한 페이지로(히어로+기능4종+로그인+푸터), 로고 /icon.svg 단일 소스 통일, 스크린샷 목업(public/landing/) + Workbox globIgnores로 프리캐시 제외. 로그인 로직 무변경. SEO 2순위(비로그인 소개) 해소 |
| 안드로이드 웹푸시 로고 복구 | firebase-messaging-sw.js icon/badge origin을 self.location.origin→canonical www 고정(apex 로드 시 아이콘 요청 308 리다이렉트로 기본아이콘 대체되던 문제). send-push SITE 상수와 도메인 통일 |
| iOS Capacitor A1 | @capacitor/core·ios·cli 설치, capacitor.config(webDir=dist, server.url 없음=번들), npx cap add ios, isNative() 게이트(SW/설치배너/웹푸시 네이티브 스킵). 웹 무영향 |
| iOS Capacitor A2 | @capacitor-firebase/messaging 네이티브 FCM 토큰(platform:'ios'), fcm_tokens.platform 컬럼, send-push platform 분기(ios=notification+apns / web·android=기존 webpush 보존), 딥링크(notificationActionPerformed), AppDelegate APNs 브리지, GoogleService-Info.plist 배선 |
| iOS Capacitor A3-1 | 카카오 OAuth 네이티브(implicit+커스텀 스킴 com.siktakilgi.app://login-callback, Browser.open, appUrlOpen→setSession), Info.plist CFBundleURLTypes. 웹 OAuth 무변경, 이메일 폴백 |
| iOS Capacitor A3-2 | 카카오 지도 origin — capacitor.config server.hostname=www.siktakilgi.com(iOS WebView origin 위장). 실측/폴백은 Phase C |
| 알림 토글 실제 푸시 제어 | 설정 알림 컨트롤 2개→단일 마스터 토글 병합. OFF=이 기기 FCM 토큰 삭제(unregisterFCMToken)+boot 재등록 게이트(notif_enabled), ON=권한요청+등록. send-push/DB 무변경(회귀 0) |
| 레시피 사소 UX 2건 | RecipeDetailModal handleRecord: addMeal 성공 시에만 토스트+뷰전환(실패 재시도, 반환값 유지). statusOf incart 감지를 buildBuyText 규칙과 통일(분량 포함 재료 중복담기 방지) |
| iOS Info.plist Phase B 키 | NSLocationWhenInUseUsageDescription(지도 GPS)+UIBackgroundModes remote-notification(백그라운드 푸시) 추가. 기존 커스텀 스킴 보존. 웹 무영향 |
| leaveSpace stale closure 수정 | spaces.filter를 functional setState로 → RPC 대기 중 Realtime 갱신 유실 방지. 대체 현재스페이스는 로컬 실재 스페이스로 |
| 카카오맵 iframe 프록시 Phase 1~2 | iOS capacitor:// origin 카카오 거부 우회 — www 서빙 `map-embed.html`(경량 vanilla) iframe 임베드. init/setPins 핀 렌더 + pinClick postMessage 브릿지. SW denylist(map-embed) + Vercel rewrite 정적 서빙 |
| 카카오맵 iframe Phase 3 | 검색/지오코딩 RPC — embed에 `search`(keywordSearch)/`geocode`(coord2Address) reqId 매칭+타임아웃, 부모 `mapEmbedRpc` 클라이언트. 테스트 하네스로 브라우저 검증 |
| 카카오맵 iframe Phase 4 (iOS 연결) | isNative() 분기로 지도 A/B/C(MealMap 2지도+MealDetailModal 미니맵)→MapEmbedView, 검색/지오코딩 D~G(MealForm/위시폼)→숨김 iframe RPC(MapEmbedRpcProvider). 웹/안드로이드 100% 인라인 유지. capacitor allowNavigation+하네스 제거. 축소 패리티(Phase C 실측 예정) |
| 카카오맵 iframe Phase 4b | bounds 필터 복원. embed 가 지도 idle 시 `boundsChanged`(bounds/center/level, 120ms 디바운스 + 초기 1회) 송신 → MapEmbedView `onBoundsChange` → MealMap `setMapBounds`. 웹의 `visiblePins` 필터를 그대로 공유(웹/안드로이드 `idle`→`getBounds` 경로 무변경, 회귀 0). embed 는 www 선배포 필요, 미배포 시 전체 표시로 graceful degrade |
| iOS 홈 네비바 밀림 수정 | 홈만 내부 스크롤 컨테이너(h-[100svh]+overflow-y-auto overscroll-contain, MapPage 패턴)로 전환 → body 스크롤 제거로 긴 관성 스크롤 중 fixed 네비바 컴포지팅 드리프트 원천 차단. bounces=false(a04f7de)로도 안 잡히던 홈 고유 증상 |

---

## 다음 단계

**플레이스토어(안드로이드 TWA) — 비공개 테스트 진행 중** 🚀
- 앱 설정 전체 완료 + 비공개 테스트 트랙에 `.aab` 업로드, 본인 폰 standalone/로그인/푸시/딥링크 정상 확인
- ★ **비공개 테스트 12명 / 14일 필수**(신규 개인 계정 요건) → 충족 후 프로덕션 신청
  - 테스터: 가족·친구 → 품앗이 커뮤니티 → 유료 대행 순. 14일 중 업데이트 1회 권장(레시피 추가가 근거)
  - 프로덕션 신청 설문 성의껏(PWA/TWA 약점 → 거절 사유 잘 답할 것)

**iOS 앱스토어 (Capacitor) — Phase A1~A3 + 카카오맵 iframe Phase 1~4 완료, Phase B(빌드) 예정** 📱
- 코드/설정 준비 완료(위 "iOS 앱 (Capacitor)" 섹션 참조): 번들·게이트·네이티브 푸시·OAuth·Info.plist 키.
- **카카오 지도 origin = map-embed iframe 프록시로 해결**(Phase 1~4): 지도 3곳+검색/지오코딩 전부 isNative() 분기로 iframe 경유. 웹/안드로이드 무변경. (위 "A3-2" 섹션 참조)
- **다음: Phase B(Codemagic 빌드)** — `cap sync ios`(플러그인 SPM 등록) + Push capability/`aps-environment` entitlement + 서명. → **Phase C**(SE2 실기기)로 로그인/푸시/딥링크 + **map-embed 지도·검색(로드/카카오 origin 통과/핀·클릭·GPS)** 실측. 실패 시 축소 패리티 보강/폴백은 Phase 4b.

**출시 전 체크리스트** (우선순위순)
1. ★ **비공개 테스트 12명/14일 채우기 → 프로덕션 신청 (1순위)**
2. 스토어 등록물 제작 (Claude Design 의뢰)
3. 약관/방침 시행일(EFFECTIVE_DATE 2026-06-19)을 출시일로 변경
4. 관리자 비번 변경
5. 오너 승계 실테스트
6. 이메일 인증메일 수신 확인 (SMTP 한도 — Resend 교체 검토)
7. admin@ 수신 테스트, 테스트 계정 정리
→ 전체 목록은 위 "출시 준비" 섹션 체크리스트 참조

**보류**
- ~~애플 앱스토어~~ → **진행 중**(Capacitor A1~A3 완료, Phase B 빌드 예정 — 위 참조). PWA 홈화면 추가도 여전히 동작.
- **지도 공유 링크 붙여넣기 → 장소 자동 추출** — 정식 URL→장소 API 없음, best-effort만 가능. 검색 선택 시 place_url 저장으로 핵심 가치 확보됨
- **보류한 사소 개선**(종합 점검 발굴): updateRecipe 재료 재삽입 부분실패 무롤백(진짜 해결=트랜잭션 RPC), leaveSpace 후 ratingsMap/wishlistInterestsMap 키 잔류(순수 메모리), console.log DEV 게이트(★ iOS Phase C 실기기 디버깅에 [FCM]/[OAuth-native] 로그 필요 → 출시 직전 정리)

**장기**
- **Claude Design으로 전체 UI 개선** — 전반적인 디자인 리뉴얼

---

## 출시 후 개선 숙제

- **삼성 인터넷 "맨 위로" 버튼이 하단 네비바 가운데(달력 탭)와 겹침**
  - 삼성 인터넷 브라우저의 기본 "맨 위로" 버튼이 하단 네비바 가운데(달력 탭)와 겹침.
    우리 DOM이 아니라 브라우저 크롬 영역이라 CSS/JS로 직접 제거 불가. 근본 해결책은
    body 스크롤 → 내부 컨테이너 스크롤(height:100svh; overflow-y:auto) 리팩터링이나,
    Modal body-lock(window.scrollY 기반)·sticky 헤더·safe-area·무한스크롤 전부 재검증
    필요해 리스크가 큼. 출시 후 여유 있을 때 진행. 삼성 인터넷 사용자에게만 영향.
  - 가벼운 억제법 조사 완료(2026-06-25) — 웹/메타(overscroll-behavior 등)/매니페스트(display
    fullscreen·minimal-ui)/TWA(Chrome 강제·WebView 폴백)로는 불가하거나 효과 불확실+재패키징·부작용 큼.
    배포 가능한 유일 해법은 #7 내부 스크롤 리팩터링뿐임을 확인. (다음엔 재조사 불필요)
  - **부분 적용됨(de2f2b5)**: iOS 네이티브에서 홈 하단 네비바가 긴 관성 스크롤 중 밀려 "뜨던" 문제
    (홈만 발생 — 유일하게 길고 이미지 많은 body 스크롤 페이지)를 위해 **HomePage만** 내부 스크롤
    컨테이너(`h-[100svh]` + 내부 `overflow-y-auto overscroll-contain`, MapPage 패턴)로 전환.
    네이티브 `bounces=false`(a04f7de)로도 안 잡히던 컴포지팅 드리프트를 body 스크롤 제거로 원천 차단.
    나머지 탭의 전면 리팩터링(삼성 인터넷 억제 포함)은 여전히 출시 후 숙제.
