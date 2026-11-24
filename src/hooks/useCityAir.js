import { useEffect, useState } from 'react'
import { fetchAirQuality } from '../data/openMeteo'

const demoEnabled = __AQI_DEV_SERVER__ && import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_DATA === 'true'

export function useCityAir(location) {
  const [request, setRequest] = useState(0)
  const [result, setResult] = useState(null)
  const useDemo = demoEnabled && location.demo
  const coordinatesKey = location.coordinates.join(',')
  const locationId = location.id

  useEffect(() => {
    if (useDemo) return
    const controller = new AbortController()
    fetchAirQuality({ coordinates: coordinatesKey.split(',').map(Number) }, controller.signal).then(
      (data) => { if (!controller.signal.aborted) setResult({ locationId, coordinatesKey, request, data }) },
      () => { if (!controller.signal.aborted) setResult({ locationId, coordinatesKey, request, error: true }) },
    )
    return () => controller.abort()
  }, [locationId, coordinatesKey, useDemo, request])

  const active = !useDemo && result?.locationId === locationId &&
    result.coordinatesKey === coordinatesKey && result.request === request ? result : null
  function retry() { setRequest((previous) => previous + 1) }
  const empty = { aqi: null, values: [], hours: [], daily: [], standard: 'us', timestamp: null, currentLabel: null }
  const city = useDemo ? location : {
    ...location, ...empty, ...active?.data, coordinates: location.coordinates,
    pending: !active, failed: Boolean(active?.error), sourceDemo: false,
  }
  return { city, pending: city.pending, error: city.failed, retry }
}
