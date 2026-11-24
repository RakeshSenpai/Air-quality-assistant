import { cityRequest } from './api'

export function fetchAirQuality(city, signal) {
  return cityRequest('/air-quality', city, signal)
}
