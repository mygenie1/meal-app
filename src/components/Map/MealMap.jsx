import { useState, useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useApp } from '../../context/AppContext'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const TAG_COLORS = {
  '집밥': '#86efac',
  '외식': '#fcd34d',
  '카페': '#f9a8d4',
  '배달': '#93c5fd',
}

function makeIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:16px; height:16px;
      background:${color || '#a07850'};
      border:2.5px solid white;
      border-radius:50%;
      box-shadow:0 2px 6px rgba(0,0,0,0.25)
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

async function geocode(locationStr) {
  const params = new URLSearchParams({
    q: locationStr,
    format: 'json',
    limit: '1',
    countrycodes: 'kr',
    'accept-language': 'ko',
  })
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { headers: { 'Accept-Language': 'ko' } }
  )
  const data = await res.json()
  if (data[0]) return [parseFloat(data[0].lat), parseFloat(data[0].lon)]
  return null
}

export default function MealMap() {
  const { spaces, cacheGeocoords } = useApp()
  const [pins, setPins] = useState([])
  const [loading, setLoading] = useState(false)

  // 모든 스페이스의 위치 있는 식사 + 소속 spaceId 함께 수집
  const mealsWithLocation = useMemo(() =>
    spaces.flatMap(s =>
      (s.meals || [])
        .filter(m => m.location)
        .map(m => ({ meal: m, spaceId: s.id }))
    ),
    [spaces]
  )

  // 아직 좌표 캐싱이 안 된 meal만 추적해서 effect 재실행 최소화
  const uncachedKey = mealsWithLocation
    .filter(({ meal }) => !meal.lat || !meal.lng)
    .map(({ meal }) => meal.id)
    .join(',')

  useEffect(() => {
    if (mealsWithLocation.length === 0) {
      setPins([])
      return
    }

    async function loadPins() {
      setLoading(true)
      const results = await Promise.all(
        mealsWithLocation.map(async ({ meal, spaceId }) => {
          if (meal.lat && meal.lng) return { meal, coords: [meal.lat, meal.lng] }
          try {
            const coords = await geocode(meal.location)
            if (coords) {
              cacheGeocoords(spaceId, meal.id, coords[0], coords[1])
            }
            return { meal, coords }
          } catch {
            return { meal, coords: null }
          }
        })
      )
      setPins(results.filter(r => r.coords))
      setLoading(false)
    }

    loadPins()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealsWithLocation.length, uncachedKey])

  const center = pins.length > 0 ? pins[0].coords : [37.5665, 126.9780]

  return (
    <div className="relative">
      {/* 로딩 오버레이 */}
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-cream-50/80 rounded-2xl">
          <p className="text-sm text-warm-light">위치 찾는 중...</p>
        </div>
      )}

      {/* 지도 — 항상 표시 */}
      <div className="rounded-2xl overflow-hidden shadow-sm" style={{ height: '62vh' }}>
        <MapContainer
          center={center}
          zoom={pins.length > 0 ? 12 : 11}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          {pins.map(({ meal, coords }) => (
            <Marker
              key={meal.id}
              position={coords}
              icon={makeIcon(TAG_COLORS[meal.tag])}
            >
              <Popup maxWidth={240} className="meal-popup">
                <div style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                  {meal.photo && (
                    <img
                      src={meal.photo}
                      alt=""
                      style={{
                        width: '100%',
                        height: '130px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        marginBottom: '8px',
                        display: 'block',
                      }}
                    />
                  )}
                  <p style={{ fontWeight: 600, fontSize: '14px', margin: '0 0 2px', color: '#3d2b1f' }}>
                    {meal.restaurantName || meal.location}
                  </p>
                  {meal.location && meal.restaurantName && (
                    <p style={{ fontSize: '11px', color: '#a07850', margin: '0 0 4px' }}>
                      📍 {meal.location}
                    </p>
                  )}
                  {meal.rating > 0 && (
                    <div style={{ display: 'flex', gap: '2px', marginBottom: '4px' }}>
                      {Array.from({ length: 5 }, (_, i) => (
                        <span key={i} style={{ color: i < meal.rating ? '#c4a882' : '#e5ddd5', fontSize: '14px' }}>
                          ★
                        </span>
                      ))}
                    </div>
                  )}
                  {meal.review && (
                    <p style={{ fontSize: '12px', color: '#6b4f3a', margin: '0 0 4px' }}>{meal.review}</p>
                  )}
                  <p style={{ fontSize: '11px', color: '#c4a882', margin: 0 }}>{meal.date}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* 빈 상태 — 지도 위에 오버레이 */}
      {mealsWithLocation.length === 0 && !loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl px-6 py-5 text-center shadow-sm">
            <p className="text-2xl mb-2">📍</p>
            <p className="text-sm font-medium text-warm-dark mb-1">아직 등록된 맛집이 없어요</p>
            <p className="text-xs text-warm-light">달력에서 식사를 기록할 때<br />위치를 입력하면 여기에 나타나요</p>
          </div>
        </div>
      )}

      {/* 태그 범례 */}
      {pins.length > 0 && (
        <div className="flex gap-4 flex-wrap mt-3 px-1">
          {Object.entries(TAG_COLORS).map(([tag, color]) => (
            <div key={tag} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full border border-white shadow-sm" style={{ background: color }} />
              <span className="text-xs text-warm-light">{tag}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
