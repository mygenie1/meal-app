// 통합검색 결과용 — 가보고 싶은 곳 카드 (FeedCard는 meal 전용이라 별도, 홈/지도 공용)
export default function WishResultCard({ wish, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-cream-50 rounded-2xl shadow-sm border border-cream-200 p-4 flex items-start gap-3 hover:bg-cream-100 active:scale-[0.99] transition-colors"
    >
      <div className="w-10 h-10 rounded-xl bg-cream-200 flex items-center justify-center shrink-0">
        <svg className="w-5 h-5 text-warm-brown" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[10px] font-semibold text-white bg-warm-brown px-1.5 py-0.5 rounded-full leading-none">가보고 싶은 곳</span>
          {wish.category && <span className="text-[10px] text-warm-light">{wish.category}</span>}
        </div>
        <p className="text-sm font-semibold text-warm-dark truncate">{wish.name || '이름 없는 장소'}</p>
        {wish.location && <p className="text-xs text-warm-light truncate mt-0.5">{wish.location}</p>}
        {wish.memo && <p className="text-xs text-cream-400 truncate mt-0.5">{wish.memo}</p>}
      </div>
      <svg className="w-4 h-4 text-cream-300 shrink-0 mt-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}
