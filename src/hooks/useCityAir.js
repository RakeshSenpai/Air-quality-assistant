import { useEffect, useState } from 'react'
import { fetchAirQuality } from '../data/openMeteo'

export function useCityAir(location) {
  const [preferredMode, setMode] = useState('demo')
  const [request, setRequest] = useState(0)
  const [result, setResult] = useState(null)
  const mode = location.demo ? preferredMode : 'modeled'
  const coordinatesKey = location.coordinates.join(',')
  const locationId = location.id

  useEffect(() => {
    if (mode === 'demo') return
    const controller = new AbortController()
    fetchAirQuality({ coordinates: coordinatesKey.split(',').map(Number) }, controller.signal).then(
      (data) => { if (!controller.signal.aborted) setResult({ locationId, coordinatesKey, request, data }) },
      () => { if (!controller.signal.aborted) setResult({ locationId, coordinatesKey, request, error: true }) },
    )
    return () => controller.abort()
  }, [locationId, coordinatesKey, mode, request])

  const active = mode === 'modeled' && result?.locationId === locationId &&
    result.coordinatesKey === coordinatesKey && result.request === request ? result : null
  function retry() { setRequest((previous) => previous + 1) }
  function chooseMode(value) {
    if (value === mode) return
    retry()
    setMode(value)
  }
  const empty = { aqi: null, values: [], hours: [], daily: [], standard: 'us' }
  const city = mode === 'demo' ? location : {
    ...location, ...empty, ...active?.data, coordinates: location.coordinates,
    pending: !active, failed: Boolean(active?.error), sourceDemo: false,
  }
  return { city, mode, chooseMode, pending: city.pending, error: city.failed, retry }
}
