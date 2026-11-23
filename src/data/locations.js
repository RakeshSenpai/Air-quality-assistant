export function locationLabel({ name, region, country }) {
  return [...new Set([name, region, country].filter(Boolean))].join(', ')
}

export async function searchLocations(query, signal) {
  const params = new URLSearchParams({ name: query, count: '8', language: 'en', format: 'json' })
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
  })
  if (!response.ok) throw new Error('Location search failed')
  const { results = [] } = await response.json()
  return results.filter(({ name, latitude, longitude }) =>
    name && Number.isFinite(latitude) && Number.isFinite(longitude)
  ).map(({ id, name, admin1, country, latitude, longitude }) => ({
    id: `geo:${id}`, name, region: admin1, country, coordinates: [latitude, longitude],
  }))
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
