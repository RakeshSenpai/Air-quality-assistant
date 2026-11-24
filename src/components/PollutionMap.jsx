import { useEffect, useRef, useState } from 'react'
import { MapPin, Search } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { cities, getCategory, indexLabel } from '../data/air'
import { Card, Heading } from './Dashboard'

export default function PollutionMap({ city, setCity }) {
  const target = useRef(null)
  const map = useRef(null)
  const layer = useRef(null)
  const select = useRef(setCity)
  const locations = cities.some(({ id }) => id === city.id) ? cities : [city, ...cities]
  const [query, setQuery] = useState('')
  const [tileError, setTileError] = useState(false)
  useEffect(() => { select.current = setCity }, [setCity])
  useEffect(() => {
    const instance = L.map(target.current, { scrollWheelZoom: false }).setView(city.coordinates, city.demo ? 5 : 7)
    map.current = instance
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(instance)
    tiles.on('tileerror', () => setTileError(true))
    layer.current = L.layerGroup().addTo(instance)
    const observer = new ResizeObserver(() => instance.invalidateSize({ pan: false }))
    observer.observe(target.current)
    return () => { observer.disconnect(); instance.remove() }
  }, [])
  useEffect(() => {
    layer.current.clearLayers()
    for (const sample of locations) {
      const point = sample.id === city.id ? city : sample
      const category = getCategory(point.aqi, point.standard)
      const badge = document.createElement('span')
      badge.className = 'map-pin'
      badge.style.setProperty('--pin', category.color)
      badge.textContent = Number.isFinite(point.aqi) ? String(point.aqi) : '—'
      const icon = L.divIcon({ className: 'map-pin-shell', iconSize: [34, 34], iconAnchor: [17, 17], html: badge })
      const popup = document.createElement('div')
      popup.className = 'map-popup'
      const title = document.createElement('strong')
      title.textContent = point.name
      const detail = document.createElement('p')
      detail.textContent = `${point.aqi ?? 'AQI unavailable'} · ${category.label} · ${indexLabel(point.standard)}`
      const source = document.createElement('small')
      source.textContent = point.sourceDemo ? 'Demo data' : 'Open-Meteo · CAMS'
      const button = document.createElement('button')
      button.textContent = 'View this city'
      button.addEventListener('click', () => select.current(point.id))
      button.disabled = point.id === city.id
      popup.append(title, detail, source, button)
      L.marker(point.coordinates, { icon, title: `${point.name}, ${indexLabel(point.standard)} ${point.aqi ?? 'unavailable'}`, alt: point.name })
        .bindPopup(popup).addTo(layer.current)
    }
    if (!map.current.getBounds().contains(city.coordinates)) map.current.panTo(city.coordinates, { animate: false })
  }, [city])
  const matching = locations.filter(({ name }) => name.toLowerCase().includes(query.trim().toLowerCase()))
  function choose(id) {
    const match = locations.find((item) => item.id === id)
    if (id !== city.id) setCity(id)
    map.current.setView(match.coordinates, 7, { animate: false })
    setQuery('')
  }
  return <Card className="map-panel">
    <Heading icon={MapPin} detail="Explore the selected location and demo cities. Each marker identifies its data source.">Pollution Map</Heading>
    <div className="map-layout">
      <div className="map-side">
        <label className="map-search"><Search size={17} /><input aria-label="Search map cities" placeholder="Search cities" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <div className="map-city-list">
          {matching.map((sample) => {
            const point = sample.id === city.id ? city : sample
            return <button key={point.id} aria-pressed={point.id === city.id} onClick={() => choose(point.id)}>
              <span><strong>{point.name}</strong><small>{point.sourceDemo ? 'Demo Indian AQI' : 'Modeled US AQI'}</small></span>
              <b style={{ color: getCategory(point.aqi, point.standard).color }}>{point.aqi ?? '—'}</b>
            </button>
          })}
          {matching.length === 0 && <p className="metadata" role="status">No matching cities.</p>}
        </div>
        <button className="outline-control" onClick={() => map.current.fitBounds(locations.map(({ coordinates }) => coordinates), { padding: [20, 20], animate: false })}>Show all cities</button>
      </div>
      <div className="map-stage" ref={target} role="region" aria-label="Interactive air quality map" />
    </div>
    {tileError && <p className="metadata" role="status">Some OpenStreetMap tiles are unavailable. City markers and search still work.</p>}
  </Card>
}
