import { afterEach, expect, it, vi } from 'vitest'
import { fetchLocalWeather } from '../../src/data/openMeteoWeather.js'
import { cityRequest } from '../../src/data/api.js'

vi.mock('../../src/data/api.js', () => ({
  cityRequest: vi.fn(),
  coordinatesOf: ({ coordinates: [latitude, longitude] }) => ({
    latitude,
    longitude,
  }),
}))

const city = { coordinates: [19.076, 72.8777] }
const throttle = () =>
  Object.assign(new Error('Provider throttled'), {
    status: 503,
    code: 'PROVIDER_ERROR',
  })

afterEach(() => {
  vi.resetAllMocks()
  vi.unstubAllGlobals()
})

it('uses the backend result without calling Open-Meteo directly when available', async () => {
  const data = { current: { temperature_2m: 25 }, uv: 0 }
  vi.mocked(cityRequest).mockResolvedValue(data)
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  expect(await fetchLocalWeather(city, new AbortController().signal)).toBe(data)
  expect(fetcher).not.toHaveBeenCalled()
})

it('fetches the selected coordinates and matches the UV index to the local hour after a provider throttle', async () => {
  vi.mocked(cityRequest).mockRejectedValue(throttle())
  const current = {
    time: '2026-11-24T17:30',
    temperature_2m: 25,
    weather_code: 0,
  }
  const fetcher = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      current,
      hourly: { time: ['2026-11-24T17:00'], uv_index: [0] },
    }),
  })
  vi.stubGlobal('fetch', fetcher)
  expect(await fetchLocalWeather(city, new AbortController().signal)).toEqual({
    current,
    uv: 0,
  })
  const [request, options] = fetcher.mock.calls[0]
  const url = new URL(request)
  expect(url.origin).toBe('https://api.open-meteo.com')
  expect(url.searchParams.get('latitude')).toBe('19.076')
  expect(url.searchParams.get('longitude')).toBe('72.8777')
  expect(options.credentials).toBe('omit')
})

it('honors application rate limits and aborts instead of starting a fallback', async () => {
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  const signal = new AbortController().signal
  const appLimit = Object.assign(new Error('Too many requests'), {
    status: 429,
    code: 'RATE_LIMIT',
  })
  vi.mocked(cityRequest)
    .mockRejectedValueOnce(appLimit)
    .mockRejectedValueOnce(throttle())
  await expect(fetchLocalWeather(city, signal)).rejects.toBe(appLimit)
  await expect(fetchLocalWeather(city, AbortSignal.abort())).rejects.toThrow(
    'Provider throttled',
  )
  expect(fetcher).not.toHaveBeenCalled()
})

it.each([
  { ok: false },
  {
    ok: true,
    json: async () => ({
      current: { time: '2026-11-24T17:30', temperature_2m: null },
    }),
  },
])(
  'keeps weather unavailable when the fallback has no usable reading',
  async (response) => {
    vi.mocked(cityRequest).mockRejectedValue(throttle())
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
    await expect(
      fetchLocalWeather(city, new AbortController().signal),
    ).rejects.toThrow('Weather unavailable')
  },
)
