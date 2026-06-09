# 식탁 일기 — CLAUDE.md

함께 먹는 사람들의 식사 추억 기록 + 우리만의 맛집 지도 웹앱.
로컬에서 동작하는 MVP. 백엔드 없음, localStorage에 모든 데이터 저장.

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
| 지오코딩 | Nominatim (OpenStreetMap 무료 API) |
| 지도 타일 | CartoDB Light — `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png` |
| 고유ID | uuid 14 |
| 데이터 저장 | localStorage (`mealapp_data` 키) |

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

---

## 폴더 구조

```
meal-app/
├── public/
├── src/
│   ├── App.jsx                          라우팅 루트, AppProvider 래핑
│   ├── main.jsx                         React 진입점
│   ├── index.css                        Tailwind 지시어, 전역 스타일, Leaflet 팝업 오버라이드
│   │
│   ├── context/
│   │   └── AppContext.jsx               전체 상태 관리 + localStorage 동기화
│   │
│   ├── components/
│   │   ├── common/
│   │   │   ├── BottomNav.jsx            하단 탭 네비게이션 (SVG 아이콘)
│   │   │   ├── Header.jsx               상단 헤더 (현재 거의 미사용, 각 페이지가 직접 작성)
│   │   │   ├── Modal.jsx                바텀시트 모달 (모바일: 하단 슬라이드, 데스크톱: 중앙)
│   │   │   └── StarRating.jsx           별점 입력/표시 (1~5, 클릭 토글)
│   │   │
│   │   ├── Calendar/
│   │   │   └── CalendarGrid.jsx         월간 달력 그리드, 날짜별 식사 썸네일 표시
│   │   │
│   │   ├── MealRecord/
│   │   │   ├── MealForm.jsx             식사 기록 입력 폼 (사진 → 식당명 → 위치 → 별점 → 한줄평 → 메모 → 태그)
│   │   │   ├── MealCard.jsx             식사 기록 카드 (사진 + 정보 표시)
│   │   │   └── DayDetail.jsx            날짜 클릭 시 모달 내용 (기록 없으면 폼, 있으면 목록)
│   │   │
│   │   ├── Map/
│   │   │   └── MealMap.jsx              Leaflet 지도 + 핀 + 팝업 미리보기
│   │   │
│   │   ├── Ingredients/
│   │   │   └── IngredientList.jsx       살 것 목록 / 남은 재료 (체크박스)
│   │   │
│   │   └── Space/
│   │       └── SpaceManager.jsx         스페이스 생성·전환·코드 참가
│   │
│   └── pages/
│       ├── CalendarPage.jsx             홈, 월간 통계 배너 + 달력
│       ├── MapPage.jsx                  맛집 지도 전체화면
│       ├── IngredientsPage.jsx          재료 목록
│       └── SpacesPage.jsx               스페이스 관리
│
├── tailwind.config.js                   커스텀 색상(cream, warm) + 폰트 정의
├── postcss.config.js
├── vite.config.js
└── package.json
```

---

## 데이터 구조

localStorage 키 `mealapp_data`에 아래 형태로 저장:

```js
{
  currentSpaceId: string | null,
  spaces: [
    {
      id: string,           // uuid
      name: string,
      emoji: string,        // 스페이스 아이콘
      code: string,         // 6자리 대문자 코드 (참가용)
      createdAt: string,    // ISO 날짜
      meals: [
        {
          id: string,
          date: string,           // "yyyy-MM-dd"
          createdAt: string,
          photo: string,          // base64 DataURL (선택)
          restaurantName: string, // 선택
          location: string,       // 주소 텍스트 (선택, 지오코딩에 사용)
          lat: number,            // 캐시된 위도 (선택)
          lng: number,            // 캐시된 경도 (선택)
          rating: number,         // 0~5
          review: string,         // 한줄평
          memo: string,
          tag: string,            // '집밥' | '외식' | '카페' | '배달' | ''
        }
      ],
      ingredients: {
        toBuy: [{ id, text, done }],
        remaining: [{ id, text, done }],
      }
    }
  ]
}
```

---

## 핵심 기능 상세

### 스페이스 시스템
- 하나의 앱에 스페이스 여러 개 생성 가능
- 각 스페이스는 이름 + 이모지 아이콘 + 6자리 랜덤 코드 보유
- 코드 공유 → 같은 기기에서 해당 스페이스로 전환 (MVP 한계: 기기 간 공유 불가)
- 스페이스 삭제 시 다음 스페이스로 자동 전환

### 달력
- `date-fns`로 월간 그리드 생성 (일요일 시작)
- 식사 기록 있는 날: 사진 있으면 썸네일 배경 + 어두운 오버레이, 없으면 베이지 배경
- 날짜 클릭 → Modal 열림 → DayDetail 렌더
  - 기록 없는 날: 바로 MealForm 표시
  - 기록 있는 날: 목록 표시 + "추가" 버튼

### 식사 기록 폼 (MealForm)
- 모든 필드 선택사항 (사진만 올려도 저장 가능)
- 사진: FileReader로 base64 변환하여 저장
- 필드 순서: 사진 → 식당이름 → 위치 → 별점 → 한줄평 → 메모 → 태그
- 위치 입력 시 지도에 핀 자동 생성 (Nominatim 지오코딩)

### 맛집 지도 (MealMap)
- 스페이스 없어도 지도 표시 (서울 기본 좌표)
- **모든 스페이스**의 위치 있는 식사를 한 지도에 표시
- Nominatim API로 주소 → 좌표 변환 (비동기, 로딩 오버레이 표시)
- 핀 색상은 태그별로 구분 (집밥: 초록, 외식: 노랑, 카페: 핑크, 배달: 파랑)
- 핀 클릭 → Leaflet Popup에 사진 + 식당명 + 별점 + 리뷰 + 날짜 표시
- 빈 상태: 지도 위 반투명 오버레이로 안내 문구

### 재료 목록
- 살 것(toBuy) / 남은 재료(remaining) 두 섹션
- 항목 추가 → 체크하면 취소선 + 완료 섹션으로 분리 표시
- 완료 항목 다시 클릭하면 미완료로 복귀

### 홈(달력) 통계 배너
- 현재 스페이스 이름 + 이번 달 식사 횟수 표시
- 횟수별 다른 메시지 (0회, 1회, 2~4회, 5~9회, 10회+)

---

## 라우팅

| 경로 | 페이지 | 설명 |
|---|---|---|
| `/` | CalendarPage | 홈, 달력 |
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

### 향후 추가할 기능
- 카카오 로그인 (현재는 로그인 없음)
- 실제 기기 간 스페이스 공유 (백엔드 필요)
- Vercel 배포 예정

### 디자인 원칙
- 심플하고 깔끔하되 다이어리 감성
- 사진이 잘 보이는 레이아웃 최우선
- 빈 화면에는 따뜻한 안내 문구
- 모바일 우선 (핸드폰에서 주로 사용)

---

## 현재 MVP 한계 및 향후 과제

- **스페이스 공유**: 현재는 같은 기기 내에서만 동작. 실제 공유는 백엔드(DB + 인증) 필요
- **사진 저장**: base64로 localStorage 저장 → 용량 한계 있음. 실서비스 시 S3 등 파일 스토리지 필요
- **지오코딩 캐싱**: 현재 좌표를 meal 객체에 저장하지 않아 매번 API 호출. `lat/lng` 필드에 캐싱하는 로직 추가 필요
- **오프라인**: Nominatim 지오코딩은 인터넷 필요. 오프라인 시 위치 없는 식사만 표시됨
