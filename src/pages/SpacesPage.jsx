import SpaceManager from '../components/Space/SpaceManager'

export default function SpacesPage() {
  return (
    <>
      <header className="sticky top-0 z-40 bg-cream-50/90 backdrop-blur-sm border-b border-cream-200 px-4 py-3">
        <h1 className="text-base font-semibold text-warm-dark">스페이스</h1>
      </header>
      <div className="px-4 pb-28 pt-4">
        <SpaceManager />
      </div>
    </>
  )
}
