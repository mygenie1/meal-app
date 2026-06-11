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
| 지도 | Leaflet 1.9 + react-leaflet 5 |
| 지오코딩 | Nominatim (OpenStreetMap 무료 API, countrycodes=kr) |
| 식당 자동완성 | Kakao Local API (`https://dapi.kakao.com/v2/local/search/keyword.json`) |
| 지도 타일 | CartoDB Light — `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png` |
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
│   ├── index.css                        Tailwind 지시어, 전역 스타일, Safe Area, Leaflet 오버라이드
│   │
│   ├── lib/
│   │   ├── supabase.js                  Supabase 클라이언트 초기화 (15초 타임아웃 fetch 래퍼)
│   │   └── uploadPhoto.js               사진 업로드 + 썸네일 헬퍼
│   │                                    uploadPhotoWithThumbnail() — 400px thumb + 1200px original 병렬 업로드
│   │                                    parsePhoto() / getThumbUrl() / getOriginalUrl() — DB 항목 파싱
│   │                                    uploadPhotoToStorage() — 레거시 단일 업로드 (하위 호환)
│   │                                    Storage 전용 클라이언트 (타임아웃 없음, 업로드가 15초 초과 가능)
│   │
│   ├── context/
│   │   └── AppContext.jsx               전체 상태 관리 + Supabase CRUD + Realtime 구독
│   │                                    boot() → spaces만 빠르게 로드 후 앱 오픈
│   │                                    loadAllSpaceData() → MEAL_LIST_SELECT로 photo/photos 제외 조회
│   │                                    loadMealPhotos(mealId) → 개별 meal 사진 lazy 로드
│   │                                    photosLoaded flag: false=미로드, true=로드완료(빈 배열 포함)
│   │                                    최대 3회 자동 재시도 (1.5s → 3s → 5s)
│   │
│   ├── components/
│   │   ├── common/
│   │   │   ├── BottomNav.jsx            하단 탭 네비게이션 5탭 (홈/달력/지도/재료/스페이스)
│   │   │   ├── Header.jsx               상단 헤더
│   │   │   ├── LazyImage.jsx            IntersectionObserver 기반 lazy 이미지 로드
│   │   │   │                            뷰포트 150px 이내 진입 시 로드, 이전엔 bg-cream-100 플레이스홀더
│   │   │   │                            로드 완료 후 opacity fade-in transition
│   │   │   ├── Modal.jsx                바텀시트 모달 (iOS body-lock, z-[60], 90dvh)
│   │   │   ├── PhotoGallery.jsx         터치 스와이프 사진 갤러리 (LazyImage + 도트 인디케이터 + n/total 뱃지)
│   │   │   │                            호출 측에서 URL 해석 완료된 문자열 배열을 받음
│   │   │   └── StarRating.jsx           별점 입력/표시 (1~5, 클릭 토글)
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
│   │   │   │                            식당 자동완성: VITE_KAKAO_API_KEY 있으면 카카오 API,
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
│   │   │   └── DayDetail.jsx            날짜별 식사 목록 (아침→점심→저녁 순 정렬)
│   │   │                                수정 버튼 클릭 시 loadMealPhotos() 호출 후 MealForm 진입
│   │   │
│   │   ├── Map/
│   │   │   └── MealMap.jsx              Leaflet 지도 + 태그 필터 + 핀 + 팝업
│   │   │
│   │   ├── Ingredients/
│   │   │   └── IngredientList.jsx       살 것 목록 / 남은 재료 (체크박스)
│   │   │
│   │   └── Space/
│   │       ├── SpaceManager.jsx         스페이스 생성·전환·코드 참가 + 사진 일괄 등록 버튼
│   │       └── BulkPhotoUpload.jsx      사진 일괄 등록
│   │                                    EXIF 바이너리 스캔으로 날짜 추출 (외부 라이브러리 없음)
│   │                                    Canvas로 로컬 압축 후 uploadPhotoWithThumbnail() 호출
│   │                                    날짜별 자동 묶음 → 태그/끼니 선택 후 일괄 저장
│   │
│   └── pages/
│       ├── HomePage.jsx                 홈 피드 (통계 카드 + 최근 기록 피드)
│       │                                마운트 시 requestedPhotosRef로 중복 없이 전체 loadMealPhotos
│       │                                FeedCard: photos → getThumbUrl() 변환 후 PhotoGallery에 전달
│       │                                날짜+끼니 기준 정렬 (아침→점심→저녁)
│       ├── CalendarPage.jsx             달력 (월간 그리드)
│       ├── MapPage.jsx                  맛집 지도 전체화면
│       ├── IngredientsPage.jsx          재료 목록
│       └── SpacesPage.jsx               스페이스 관리
│
├── .env                                 환경변수 (gitignore, Vercel에 별도 설정)
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
              rating, review, memo, tag,
              photo(TEXT, 레거시 base64 단일),
              photos(TEXT[], Storage URL 또는 JSON photo 객체 문자열 배열),
              meal_time(아침|점심|저녁), created_at
ingredients   id, space_id(FK), type(toBuy|remaining), text, done, created_at
meal_photos   id, meal_id(FK), storage_path, created_at  ← 미사용 (향후 확장용)
```

### Storage 버킷 `meal-photos`
```
meal-photos/
  {spaceId}/{uuid}.jpg          원본 (최대 1200px, JPEG 0.82)
  {spaceId}/thumb_{uuid}.jpg    썸네일 (최대 400px, JPEG 0.65)
```
- public 버킷, RLS 없음 (anon 전체 허용)
- 버킷 생성 SQL:
  ```sql
  insert into storage.buckets (id, name, public) values ('meal-photos', 'meal-photos', true);
  ```

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
- 모든 테이블: anon 전체 허용 (인증 없는 MVP)

### 환경변수 (.env)
```
VITE_SUPABASE_URL=https://jsesigubkqnddcjqusjv.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_KAKAO_API_KEY=...   ← 카카오 식당 자동완성 (없으면 일반 텍스트 입력으로 폴백)
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
- 최근 기록 피드: 날짜 내림차순 → 같은 날은 아침/점심/저녁 순, 카드 클릭 시 MealDetailModal
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
  - 외식: 제목 → 식당 자동완성 → 위치(Nominatim geocoding) → 별점 → 한줄평 → 메모
  - 카페: 제목 → 카페 자동완성 → 위치 → 별점 → 한줄평
  - 배달: 제목 → 가게 자동완성(이름만, 위치 없음) → 별점 → 한줄평 → 메모
- **식당 자동완성 (RestaurantSearchField)**
  - `VITE_KAKAO_API_KEY` 있으면: 카카오 로컬 API, 350ms 디바운스
  - 없으면: 일반 텍스트 입력 (안내 문구 표시)
  - 선택 시 외식/카페는 이름+주소+좌표 자동 입력, 배달은 이름만
  - 인라인 드롭다운 (Modal overflow-y-auto 클리핑 방지)
- 저장 버튼: `sticky bottom-0`, safe-area 하단 패딩

### 끼니 자동 감지
```javascript
// MealForm.jsx — getAutoMealTime()
5~11시  → 아침
11~15시 → 점심
15시~   → 저녁
```
- 편집 모드에서는 `...initial` 스프레드가 덮어써서 기존 값 유지

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

업로드 실패 시 base64 그대로 폴백 저장 (데이터 유실 없음).
Storage 전용 클라이언트는 타임아웃 없음 (파일 업로드가 15초 초과 가능하므로).

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
| 홈 피드 FeedCard | getThumbUrl() | PhotoGallery |
| 달력 날짜 셀 | getThumbUrl() | LazyImage |
| MealCard 썸네일 | getThumbUrl() | LazyImage |
| MealDetailModal | getOriginalUrl() | PhotoGallery |

### LazyImage 컴포넌트
- `IntersectionObserver` — 뷰포트 150px 이내 진입 시 이미지 src 설정
- 진입 전: `bg-cream-100` 베이지 플레이스홀더
- 로드 완료 후: `opacity-0 → opacity-100` transition (300ms)
- src 변경 시 loaded 상태 리셋 (PhotoGallery 슬라이드 전환 시 fade 재생)

### 사진 일괄 등록 (BulkPhotoUpload)
- 스페이스 화면 "사진 일괄 등록" 버튼 → Modal
- 사진 다중 선택 → EXIF 바이너리 스캔(ArrayBuffer 첫 64KB, 외부 라이브러리 없음)으로 날짜 추출
- Canvas로 로컬 1200px 압축 후 `uploadPhotoWithThumbnail()` 호출 (Storage에 thumb+original 업로드)
- 날짜별 자동 묶음 미리보기 (날짜당 썸네일 스크롤)
- 태그 + 끼니 전체 적용 선택 → 일괄 저장
- 단계별 UX: 선택 → 로딩(진행%) → 미리보기 → 저장 중 → 완료

### 위치 geocoding (외식/카페만 해당)
- 식당 자동완성으로 선택 시 카카오 좌표 즉시 입력
- 직접 주소 입력 후 blur 시 Nominatim 자동 검색 (countrycodes=kr)
- 검색 성공: 초록색 안내 / 실패: 주황색 안내
- lat/lng를 meal에 저장 → 맛집 지도에 즉시 반영

### Supabase Realtime
- `spaces`, `meals`, `ingredients` 테이블 Realtime 구독
- INSERT: `MEAL_LIST_SELECT` 기준으로 수신 → `photosLoaded: false`로 추가 (사진 제외)
  - 이미 로컬에 있는 ID는 중복 추가 방지
- DELETE: `old` 레코드에 id만 있어서 전체 스페이스/타입에서 필터링
- 다른 기기/사용자 변경사항 새로고침 없이 즉시 반영

### Supabase 연결 안정성
- `supabase.js`: 모든 DB 요청에 15초 타임아웃 (AbortController)
- `uploadPhoto.js`: Storage 전용 클라이언트 — 타임아웃 없음
- `AppContext.jsx` boot 시퀀스:
  1. Phase 1: `spaces` 테이블만 조회 (DB 웜업, 빠름) → 앱 즉시 오픈
  2. Phase 2: 각 space의 `meals`(MEAL_LIST_SELECT) + `ingredients` 순차 백그라운드 로드
  3. Phase 1 실패 시: 최대 3회 자동 재시도 (1.5s → 3s → 5s)
  4. 모든 재시도 실패 시: 빈 상태로 앱 오픈 + 상단 `ConnectErrorBanner`
- `ConnectErrorBanner`: 황색 배너, 재시도 / 닫기 버튼

### 맛집 지도 (MealMap)
- 스페이스 없어도 지도 표시 (서울 기본 좌표)
- 모든 스페이스의 위치 있는 식사를 한 지도에 표시
- 상단 가로 스크롤 태그 필터 (전체/집밥/외식/카페/배달)
- 핀 색상: 집밥=초록, 외식=노랑, 카페=핑크, 배달=파랑
- 핀 클릭 → Leaflet Popup: 사진 + 식당명 + 별점 + 리뷰 + 날짜

### 재료 목록
- 살 것(toBuy) / 남은 재료(remaining) 두 섹션
- 집밥 폼에서 사용한 재료 → 저장 시 자동 삭제

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
| 식당 자동완성 | Kakao Local API (VITE_KAKAO_API_KEY), 350ms 디바운스, 인라인 드롭다운, 폴백 |
| 사진 일괄 등록 | EXIF 날짜 추출 + Canvas 압축 + 날짜별 묶음 + 태그/끼니 일괄 저장 |
| Supabase 연결 안정성 | 15초 타임아웃, boot=spaces만, 백그라운드 순차 로드, 3회 재시도, ConnectErrorBanner |
| 디버깅 로그 추가 | addMeal에 INSERT 시작/성공/실패/state 변화 console.log |
| meals 타임아웃 해결 | MEAL_LIST_SELECT (photo/photos 제외), base64 대용량 컬럼 조회 제거 |
| 사진 lazy 로딩 | photosLoaded flag + loadMealPhotos(), 상세 모달/수정 시에만 사진 조회 |
| Realtime 사진 버그 수정 | INSERT 핸들러에 photosLoaded:false 설정 → 실시간 추가 기록 사진 유실 방지 |
| 사진 Storage 업로드 | base64 → Supabase Storage meal-photos 버킷, URL만 DB 저장 |
| 썸네일 최적화 | uploadPhotoWithThumbnail: 400px thumb + 1200px original 병렬 업로드 |
| LazyImage 컴포넌트 | IntersectionObserver lazy 로드 + bg-cream-100 플레이스홀더 + fade-in |
| 표시 계층 분리 | 피드/달력=getThumbUrl, 상세모달=getOriginalUrl, 레거시 URL 자동 호환 |

---

## 다음 단계

### 우선순위 높음
- **카카오 로그인 연동** — 현재 인증 없음, RLS도 anon 전체 허용 상태. 로그인 후 내 스페이스만 보이도록 RLS 정책 강화 필요
- **카카오 API 키 발급 및 연동** — `VITE_KAKAO_API_KEY` 미설정 시 식당 자동완성 비활성. Kakao Developers에서 REST API 키 발급 후 `.env`와 Vercel 환경변수에 추가 필요

### 향후 과제
- **스페이스 권한**: 로그인 후 내 스페이스만 보이도록 RLS 정책 강화
- **오프라인 데이터**: Supabase 실패 시 로컬 캐시 fallback
- **식사 기록 복사**: 자주 가는 맛집 재방문 시 이전 기록 복사
- **통계 강화**: 월별 식사 패턴, 태그별 비율 차트
- **맛집 지도 사진**: 지도 팝업에서도 사진 표시 (현재 photosLoaded:false 상태라 미표시)
