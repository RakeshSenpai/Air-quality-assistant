import { pollutants } from './air'

const endpoint = 'https://air-quality-api.open-meteo.com/v1/air-quality'
const displayDay = new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const displayTime = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })

function displayStamp(stamp) {
  const time = new Date(stamp + 'Z')
  return `${displayDay.format(time)} · ${displayTime.format(time)}`
}

export function parseAirQuality(city, data) {
  const current = data.current ?? {}
  const hourly = data.hourly ?? {}
  const timestamp = current.time ?? data.hourly?.time?.[0]
  if (!timestamp) throw new Error('The provider returned no air quality times.')
  const day = timestamp.slice(0, 10)
  const rows = (hourly.time ?? []).map((stamp, i) => ({
    stamp, hour: Number(stamp.slice(11, 13)), aqi: hourly.us_aqi?.[i] ?? null,
  }))
  const currentHour = current.time ? Number(current.time.slice(11, 13)) : -1
  const hours = rows.filter(({ stamp }) => stamp.startsWith(day)).map(({ stamp, hour, aqi }) => ({
    time: stamp.slice(11, 16), hour, aqi: hour === currentHour && Number.isFinite(current.us_aqi) ? current.us_aqi : aqi,
    type: currentHour < 0 || hour > currentHour ? 'Forecast' : hour < currentHour ? 'Past model estimate' : 'Current model estimate',
  }))
  const daily = new Map()
  for (const { stamp, aqi } of rows) {
    const date = stamp.slice(0, 10)
    if (date <= day || !Number.isFinite(aqi)) continue
    daily.set(date, Math.max(daily.get(date) ?? 0, aqi))
  }
  return {
    ...city, standard: 'us', modeled: true, aqi: Number.isFinite(current.us_aqi) ? current.us_aqi : null,
    values: pollutants.map(({ key }) => Number.isFinite(current[key]) ? current[key] : null),
    timestamp: current.time ? `${displayStamp(current.time)} ${data.timezone_abbreviation ?? 'local time'}` : null,
    currentLabel: currentHour < 0 ? null : current.time.slice(11, 13) + ':00',
    timeZoneLabel: data.timezone_abbreviation ?? 'local time', hours,
    daily: Array.from(daily, ([date, aqi]) => ({
      time: displayDay.format(new Date(date + 'T00:00Z')), aqi, type: 'Daily forecast peak',
    })),
  }
}

export async function fetchAirQuality(city, signal) {
  const [latitude, longitude] = city.coordinates
  const query = new URLSearchParams({
    latitude, longitude, timezone: 'auto',
    current: ['us_aqi', ...pollutants.map(({ key }) => key)].join(','),
    hourly: 'us_aqi', forecast_days: '4',
  })
  const response = await fetch(`${endpoint}?${query}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]) })
  if (!response.ok) throw new Error(`Provider response ${response.status}`)
  return parseAirQuality(city, await response.json())
}
