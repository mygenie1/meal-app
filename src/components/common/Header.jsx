import { useApp } from '../../context/AppContext'

export default function Header({ title, right }) {
  const { currentSpace } = useApp()

  return (
    <header className="sticky top-0 z-40 bg-cream-50/90 backdrop-blur-sm border-b border-cream-200 px-4 py-3">
      <div className="flex items-center justify-between max-w-lg mx-auto">
        <div className="flex items-center gap-2">
          {currentSpace && (
            <span className="text-lg">{currentSpace.emoji}</span>
          )}
          <h1 className="text-base font-semibold text-warm-dark">{title}</h1>
        </div>
        {right && <div>{right}</div>}
      </div>
    </header>
  )
}
