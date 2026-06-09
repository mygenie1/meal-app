import { NavLink } from 'react-router-dom'

const tabs = [
  {
    to: '/',
    label: '달력',
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="3" />
        <path strokeLinecap="round" d="M3 9h18M8 2v4M16 2v4" />
        <path strokeLinecap="round" d="M7 13h2M11 13h2M15 13h2M7 17h2M11 17h2" />
      </svg>
    ),
  },
  {
    to: '/map',
    label: '지도',
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.686 2 6 4.686 6 8c0 4.5 6 12 6 12s6-7.5 6-12c0-3.314-2.686-6-6-6z" />
        <circle cx="12" cy="8" r="2" />
      </svg>
    ),
  },
  {
    to: '/ingredients',
    label: '재료',
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path strokeLinecap="round" d="M9 12l2 2 4-4" />
        <path strokeLinecap="round" d="M9 16h4" />
      </svg>
    ),
  },
  {
    to: '/spaces',
    label: '스페이스',
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
        <circle cx="9" cy="7" r="3" />
        <path strokeLinecap="round" d="M3 20c0-3.314 2.686-5 6-5s6 1.686 6 5" />
        <circle cx="17" cy="7" r="2.5" />
        <path strokeLinecap="round" d="M21 20c0-2.761-1.79-4.5-4.5-4.5" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-cream-50/95 backdrop-blur-sm border-t border-cream-200 z-50 max-w-lg mx-auto">
      <div className="flex pb-safe">
        {tabs.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-3 gap-1 transition-colors ${
                isActive ? 'text-warm-brown' : 'text-cream-400 hover:text-warm-light'
              }`
            }
          >
            {tab.icon}
            <span className="text-[10px] font-medium">{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
