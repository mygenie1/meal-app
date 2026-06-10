# 식탁 일기 — CLAUDE.md

함께 먹는 사람들의 식사 추억 기록 + 우리만의 맛집 지도 웹앱.
Supabase 백엔드 연결 완료. Vercel 배포 완료. PWA 설치 가능.

---

## 배포 정보

| 항목 | 내용 |
|---|---|
| 서비스 URL | https://meal-app-nine-snowy.vercel.app |
| GitHub | https://github.com/mygenie1/meal-app |
| Vercel 계정 | mygenie1 |
| Supabase 프로젝트 | jsesigubkqnddcjqusjv (mygenie1 개인 계정) |
| Supabase URL | https://jsesigubkqnddcjqusjv.supabase.co |

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
| 지도 | Leaflet 1.9 + react-leaflet 5 |
| 지오코딩 | Nominatim (OpenStreetMap 무료 API, countrycodes=kr) |
| 지도 타일 | CartoDB Light — `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png` |
| 고유ID | uuid 14 |
| 데이터 저장 | Supabase (PostgreSQL) |
| PWA | vite-plugin-pwa + Workbox |

---

## 디자인 시스템

### 색상 (tailwind.config.js에 커스텀 정의)

```
cream-50  #fdfcf9   앱 전체 배경
cream-100 #faf7f0   카드 내부, 입력 필드 배경
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
│   ├── App.jsx                          라우팅 루트, AppProvider 래핑, 오프라인/에러 처리
│   ├── main.jsx                         React 진입점
│   ├── index.css                        Tailwind 지시어, 전역 스타일, Safe Area, Leaflet 오버라이드
│   │
│   ├── lib/
│   │   └── supabase.js                  Supabase 클라이언트 초기화
│   │
│   ├── context/
│   │   └── AppContext.jsx               전체 상태 관리 + Supabase CRUD
│   │
│   ├── components/
│   │   ├── common/
│   │   │   ├── BottomNav.jsx            하단 탭 네비게이션 5탭 (홈/달력/지도/재료/스페이스)
│   │   │   ├── Header.jsx               상단 헤더
│   │   │   ├── Modal.jsx                바텀시트 모달 (iOS body-lock, z-[60], 90dvh)
│   │   │   └── StarRating.jsx           별점 입력/표시 (1~5, 클릭 토글)
│   │   │
│   │   ├── Calendar/
│   │   │   └── CalendarGrid.jsx         월간 달력 그리드, 날짜별 식사 썸네일 표시
│   │   │
│   │   ├── MealRecord/
│   │   │   ├── MealForm.jsx             태그 우선 입력 폼 (Step1: 태그선택 → Step2: 태그별 필드)
│   │   │   ├── MealCard.jsx             식사 기록 카드 (사진 + 정보 표시)
│   │   │   ├── MealDetailModal.jsx      식사 상세 보기 모달 (수정/삭제 포함)
│   │   │   └── DayDetail.jsx            날짜 클릭 시 모달 내용
│   │   │
│   │   ├── Map/
│   │   │   └── MealMap.jsx              Leaflet 지도 + 태그 필터 + 핀 + 팝업
│   │   │
│   │   ├── Ingredients/
│   │   │   └── IngredientList.jsx       살 것 목록 / 남은 재료 (체크박스)
│   │   │
│   │   └── Space/
│   │       └── SpaceManager.jsx         스페이스 생성·전환·코드 참가
│   │
│   └── pages/
│       ├── HomePage.jsx                 홈 피드 (통계 카드 + 최근 기록 피드 + 오늘 기록 버튼)
│       ├── CalendarPage.jsx             달력 (월간 그리드)
│       ├── MapPage.jsx                  맛집 지도 전체화면
│       ├── IngredientsPage.jsx          재료 목록
│       └── SpacesPage.jsx               스페이스 관리
│
├── .env                                 Supabase 환경변수 (gitignore, Vercel에 별도 설정)
├── tailwind.config.js                   커스텀 색상(cream, warm) + 폰트 정의
├── postcss.config.js
├── vite.config.js                       PWA 플러그인 포함
└── package.json
```

---

## Supabase DB 구조

데이터는 localStorage 대신 Supabase PostgreSQL에 저장됨.
`currentSpaceId`만 localStorage에 저장 (UI 상태값).

### 테이블

```
spaces        id, name, emoji, code(6자리 unique), created_at
meals         id, space_id(FK), date, title, restaurant_name, location, lat, lng,
              rating, review, memo, tag, photo(base64), created_at
ingredients   id, space_id(FK), type(toBuy|remaining), text, done, created_at
meal_photos   id, meal_id(FK), storage_path, created_at  ← 향후 Storage 연동용
```

### RLS 정책
- 모든 테이블: anon 전체 허용 (인증 없는 MVP)

### 환경변수 (.env)
```
VITE_SUPABASE_URL=https://jsesigubkqnddcjqusjv.supabase.co
VITE_SUPABASE_ANON_KEY=...
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
- 상단: 스페이스 전환 버튼
- "오늘 식사 기록하기" 버튼 → Modal + DayDetail 열림
- 통계 카드 (가로 스크롤): 함께한 식사 횟수, 이번 달 횟수, 자주 찾은 곳 Top3, 즐겨 먹는 것, 최애 맛집(별점 5점)
- 최근 기록 피드: 날짜 내림차순, 카드 클릭 시 MealDetailModal 표시
- 스페이스 없을 때: 스페이스 만들기 안내 화면

### 달력 (CalendarPage)
- `date-fns`로 월간 그리드 생성 (일요일 시작)
- 식사 기록 있는 날: 사진 있으면 썸네일 배경 + 어두운 오버레이, 없으면 베이지 배경
- 날짜 클릭 → Modal 열림 → DayDetail 렌더
  - 기록 없는 날: 바로 MealForm 표시
  - 기록 있는 날: 목록 표시 + "추가" 버튼

### 식사 기록 폼 (MealForm) — 태그 우선 플로우
- **Step 1 — 태그 선택**: 집밥/외식/카페/배달 2×2 그리드, 각 태그별 SVG 아이콘 + 색상
- **Step 2 — 태그별 필드**: 상단에 선택 태그 배지 + "변경" 버튼
  - 집밥: 사진 → 제목 → 메모 → "재료 사용하기" 접이식 섹션
  - 외식: 사진 → 제목 → 식당이름 → 위치(geocoding) → 별점 → 한줄평 → 메모
  - 카페: 사진 → 제목 → 카페이름 → 위치(geocoding) → 별점 → 한줄평
  - 배달: 사진 → 제목 → 가게이름 → 별점 → 한줄평 → 메모
- 편집 모드(initial에 tag 있음)는 Step 1 건너뜀
- 저장 버튼: `sticky bottom-0`, safe-area 하단 패딩

### 집밥 재료 연동
- "재료 사용하기" 섹션에서 `currentSpace.ingredients.remaining` 목록 표시
- 체크한 항목은 저장 시 `deleteIngredient('remaining', id)` 호출로 자동 제거
- 체크 개수 배지로 표시

### 위치 geocoding (외식/카페만 해당)
- 위치 입력 후 blur 시 Nominatim 자동 검색 (countrycodes=kr)
- 검색 성공: 초록색 안내 / 실패: 주황색 안내
- lat/lng를 meal에 저장 → 지도에 즉시 반영

### 맛집 지도 (MealMap)
- 스페이스 없어도 지도 표시 (서울 기본 좌표)
- **모든 스페이스**의 위치 있는 식사를 한 지도에 표시
- 상단 가로 스크롤 태그 필터 (전체/집밥/외식/카페/배달) — 색상 도트 + warm-brown 활성 스타일
- 핀 색상은 태그별로 구분 (집밥: 초록, 외식: 노랑, 카페: 핑크, 배달: 파랑)
- 핀 클릭 → Leaflet Popup에 사진 + 식당명 + 별점 + 리뷰 + 날짜 표시
- 빈 상태: 지도 위 반투명 오버레이로 안내 문구

### 재료 목록
- 살 것(toBuy) / 남은 재료(remaining) 두 섹션
- 항목 추가 → 체크하면 취소선 + 완료 섹션으로 분리 표시
- 완료 항목 다시 클릭하면 미완료로 복귀
- 집밥 폼에서 남은 재료를 사용하면 자동 제거

### PWA
- 홈화면 설치 가능 (Android Chrome / iOS Safari)
- 앱 이름: 식탁일기 / 테마 컬러: #6b4f3a
- 오프라인 감지 시 OfflineBanner 표시 (App.jsx)
- Workbox로 앱 쉘 전체 프리캐시 → 오프라인에서도 앱 로드 가능

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
| Supabase 연결 | localStorage → Supabase DB 전환, 크로스 디바이스 스페이스 공유 가능 |
| PWA 설정 | vite-plugin-pwa, 아이콘 3종, 오프라인 페이지, Workbox 프리캐시 |
| 스페이스 코드 참가 버그 수정 | handleJoin async/await 누락 수정, 에러 피드백 추가 |
| 위치 검색 버그 수정 | blur 시 geocoding, countrycodes=kr 추가, lat/lng 저장 |
| Supabase 에러 피드백 | loadError 상태, 환경변수 누락 경고, 에러 화면 |
| Vercel 배포 | https://meal-app-nine-snowy.vercel.app |
| 식사 제목 필드 추가 | meals 테이블 title 컬럼 추가, MealForm/MealCard/CalendarGrid 반영 |
| 모바일 저장 버튼 수정 | Modal z-[60]으로 BottomNav(z-50) 위에 노출, sticky bottom-0 버튼 |
| 아이폰 safe area 대응 | viewport-fit=cover, header.sticky padding-top, .pb-safe, iOS body-lock |
| 홈 피드 페이지 추가 | HomePage 신설(/ 경로), CalendarPage → /calendar 이동, BottomNav 5탭 |
| 홈 피드 통계 카드 | 함께한 식사·이번달·자주 찾은 곳·즐겨 먹는 것·최애 맛집 가로 스크롤 카드 |
| 홈 피드 오늘 기록 버튼 | "오늘 식사 기록하기" 버튼 → Modal+DayDetail 열림 |
| 식사 상세 모달 | MealDetailModal.jsx 신설, 피드 카드 클릭 시 상세 보기 + 수정/삭제 |
| 맛집 지도 태그 필터 | 상단 가로 스크롤 필터 바 (전체/집밥/외식/카페/배달) |
| 태그별 식사 기록 폼 개편 | Step1 태그 선택(2×2 그리드) → Step2 태그별 맞춤 필드 |
| 집밥 재료 연동 | 집밥 폼에서 남은 재료 체크 → 저장 시 자동 삭제 |

---

## 다음 단계

### 우선순위 높음
- **카카오 로그인 연동** — 현재 인증 없음, RLS도 anon 전체 허용 상태
- **사진 여러 장 업로드** — 현재 사진 1장만 가능, meal_photos 테이블 이미 설계됨

### 향후 과제
- **사진 저장**: base64 → Supabase Storage (용량·성능 개선, meal_photos 테이블 활용)
- **식사 기록 수정/삭제**: MealDetailModal에 수정 폼 진입 + 삭제 확인 다이얼로그 (뼈대는 있음)
- **스페이스 권한**: 로그인 후 내 스페이스만 보이도록 RLS 정책 강화
- **오프라인 데이터**: Supabase 실패 시 로컬 캐시 fallback
