import { useEffect, useState } from 'react'
import { CloudSun } from 'lucide-react'
import { fetchLocalWeather } from '../data/openMeteoWeather'

function conditionFor(code) {
  if (code === 0) return 'Clear sky'
  if (code === 1 || code === 2) return 'Partly cloudy'
  if (code === 3) return 'Overcast'
  if (code === 45 || code === 48) return 'Fog'
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle'
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow'
  if ([95, 96, 99].includes(code)) return 'Thunderstorms'
  return 'Condition unavailable'
}

const reading = (value, suffix = '') => Number.isFinite(value) ? `${value}${suffix}` : '—'

export default function HeroWeather({ city }) {
  const coordinates = city.coordinates.join(',')
  const [weather, setWeather] = useState(null)
  const [request, setRequest] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    fetchLocalWeather({ coordinates: coordinates.split(',').map(Number) }, controller.signal).then(
      (data) => { if (!controller.signal.aborted) setWeather({ coordinates, request, data }) },
      () => { if (!controller.signal.aborted) setWeather({ coordinates, request }) },
    )
    return () => controller.abort()
  }, [coordinates, request])

  const result = weather?.coordinates === coordinates && weather.request === request ? weather : null
  const current = result?.data?.current

  return <aside className="hero-weather" aria-labelledby="hero-weather-title">
    <h2 id="hero-weather-title"><CloudSun size={18} aria-hidden="true" /> Local weather</h2>
    {current ? <>
      <p className="weather-temperature">{reading(current.temperature_2m, '°C')}</p>
      <p className="weather-condition">{conditionFor(current.weather_code)}</p>
      <dl>
        <div><dt>Humidity</dt><dd>{reading(current.relative_humidity_2m, '%')}</dd></div>
        <div><dt>Wind speed</dt><dd>{reading(current.wind_speed_10m, ' km/h')}</dd></div>
        <div><dt>UV index</dt><dd>{reading(result.data.uv)}</dd></div>
      </dl>
    </> : <p className="weather-condition" role="status">{result ? 'Weather unavailable' : 'Loading weather…'}</p>}
    {result && !current && <button className="weather-retry" onClick={() => setRequest((value) => value + 1)}>Retry</button>}
    <a href="https://open-meteo.com/en/docs">Open-Meteo weather model</a>
  </aside>
}
