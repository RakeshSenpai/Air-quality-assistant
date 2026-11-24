import { cityRequest, coordinatesOf } from './api'

export async function fetchLocalWeather(city, signal) {
  try {
    return await cityRequest('/weather', city, signal)
  } catch (error) {
    if (signal.aborted || error.status !== 503 || error.code !== 'PROVIDER_ERROR') throw error
  }

  const params = new URLSearchParams({
    ...coordinatesOf(city),
    current: 'temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m',
    hourly: 'uv_index',
    forecast_days: '1',
    timezone: 'auto',
    temperature_unit: 'celsius',
    wind_speed_unit: 'kmh',
  })
  const response = await fetch('https://api.open-meteo.com/v1/forecast?' + params, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
    credentials: 'omit',
    redirect: 'error',
  })
  if (!response.ok) throw new Error('Weather unavailable')

  const { current, hourly } = await response.json()
  if (!current || !/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(current.time) ||
      ![current.temperature_2m, current.weather_code, current.relative_humidity_2m, current.wind_speed_10m].some(Number.isFinite)) {
    throw new Error('Weather unavailable')
  }
  const times = hourly?.time
  const uvIndex = Array.isArray(times) ? times.indexOf(current.time.slice(0, 13) + ':00') : -1
  const uv = uvIndex >= 0 && Array.isArray(hourly?.uv_index) ? hourly.uv_index[uvIndex] : null
  return { current, uv: Number.isFinite(uv) ? uv : null }
}
