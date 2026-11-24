import { requestApi } from './api'

export function locationLabel({ name, region, country }) {
  return [...new Set([name, region, country].filter(Boolean))].join(', ')
}

export function searchLocations(query, signal) {
  return requestApi('/locations/search?' + new URLSearchParams({ q: query }), { signal })
}

export async function describeCurrentLocation([latitude, longitude], signal) {
  const params = new URLSearchParams({ latitude, longitude, localityLanguage: 'en' })
  const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(4500)]),
  })
  if (!response.ok) throw new Error('Reverse geocoding failed')
  const { locality, city, principalSubdivision, countryName } = await response.json()
  return { name: locality || city || 'Current location', region: principalSubdivision, country: countryName }
}
