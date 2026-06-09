import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import BottomNav from './components/common/BottomNav'
import CalendarPage from './pages/CalendarPage'
import MapPage from './pages/MapPage'
import IngredientsPage from './pages/IngredientsPage'
import SpacesPage from './pages/SpacesPage'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <div className="min-h-svh max-w-lg mx-auto flex flex-col bg-cream-50">
          <main className="flex-1 flex flex-col">
            <Routes>
              <Route path="/" element={<CalendarPage />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/ingredients" element={<IngredientsPage />} />
              <Route path="/spaces" element={<SpacesPage />} />
            </Routes>
          </main>
          <BottomNav />
        </div>
      </BrowserRouter>
    </AppProvider>
  )
}
