import { z } from 'zod'
import { getCategory, pollutants } from '../../src/data/air.js'
import { AppError, invalidUpstream } from './errors.js'

const time = z.string().regex(/^\d{4}-\d\d-\d\dT\d\d:\d\d$/)
const number = z.number().nullable().optional()
const series = z.array(z.number().nullable()).optional()
const labels = {
  timezone: z.string().optional(),
  timezone_abbreviation: z.string().optional(),
}
const pollutantKeys = Object.fromEntries(
  pollutants.map(({ key }) => [key, number]),
)
const airPayload = z
  .object({
    ...labels,
    current: z.object({ time, us_aqi: number, ...pollutantKeys }).optional(),
    hourly: z.object({ time: z.array(time), us_aqi: series }).optional(),
    current_units: z.record(z.string(), z.string()).optional(),
  })
  .refine((value) => value.current || value.hourly?.time.length)
const weatherKeys = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'wind_speed_10m',
  'wind_direction_10m',
  'weather_code',
  'precipitation',
]
const weatherPayload = z.object({
  ...labels,
  current: z.object({
    time,
    ...Object.fromEntries(weatherKeys.map((key) => [key, number])),
  }),
  current_units: z.record(z.string(), z.string()).optional(),
  hourly: z
    .object({
      time: z.array(time),
      uv_index: series,
      temperature_2m: series,
      precipitation: series,
      weather_code: series,
    })
    .optional(),
})
const locationsPayload = z.object({
  results: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        admin1: z.string().optional(),
        country: z.string().optional(),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        timezone: z.string().optional(),
      }),
    )
    .default([]),
})

const displayDay = new Intl.DateTimeFormat('en-IN', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})
const displayTime = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
})
const finiteAqi = (value) =>
  Number.isFinite(value) && value >= 0 ? value : null

export function normalizeAirQuality({ latitude, longitude }, data) {
  const { current, hourly, current_units: units, timezone } = data
  const timeZoneLabel = data.timezone_abbreviation ?? timezone ?? 'local time'
  const day = (current?.time ?? hourly.time[0]).slice(0, 10)
  const currentHour = current?.time.slice(0, 13)
  const aqi = finiteAqi(current?.us_aqi)
  const hours = []
  const peaks = new Map()
  for (const [index, stamp] of (hourly?.time ?? []).entries()) {
    const date = stamp.slice(0, 10)
    const hourKey = stamp.slice(0, 13)
    const value = finiteAqi(hourly.us_aqi?.[index])
    if (date === day)
      hours.push({
        time: stamp.slice(11),
        hour: Number(stamp.slice(11, 13)),
        aqi: hourKey === currentHour ? (aqi ?? value) : value,
        type:
          !currentHour || hourKey > currentHour
            ? 'Forecast'
            : hourKey < currentHour
              ? 'Past model estimate'
              : 'Current model estimate',
      })
    if (date > day && value !== null)
      peaks.set(date, Math.max(peaks.get(date) ?? 0, value))
  }
  const timestamp = current ? new Date(current.time + 'Z') : null
  if (timestamp && !Number.isFinite(timestamp.valueOf()))
    throw invalidUpstream()
  return {
    coordinates: [latitude, longitude],
    standard: 'us',
    modeled: true,
    provider: 'Open-Meteo / Copernicus CAMS',
    aqi,
    category: getCategory(aqi, 'us').label,
    beyondScale: aqi > 500,
    values: pollutants.map(({ key }) => current?.[key] ?? null),
    pollutants: pollutants.map(({ key, name }) => ({
      key,
      name,
      value: current?.[key] ?? null,
      unit: units?.[key] ?? null,
    })),
    observedAt: current?.time ?? null,
    timezone,
    timeZoneLabel,
    timestamp: timestamp
      ? `${displayDay.format(timestamp)} · ${displayTime.format(timestamp)} ${timeZoneLabel}`
      : null,
    currentLabel: current ? current.time.slice(11, 13) + ':00' : null,
    hours,
    daily: [...peaks].map(([date, value]) => ({
      time: displayDay.format(new Date(date + 'T00:00Z')),
      date,
      aqi: value,
      type: 'Daily forecast peak',
    })),
  }
}

export function createProviders({
  fetcher = fetch,
  ttl = 120000,
  timeout = 8000,
} = {}) {
  const cache = new Map()
  async function request(endpoint, params, schema, normalize) {
    const url = endpoint + '?' + new URLSearchParams(params)
    const existing = cache.get(url)
    if (existing && existing.expires > Date.now()) return existing.promise

    async function load() {
      try {
        const response = await fetcher(url, {
          signal: AbortSignal.timeout(timeout),
          redirect: 'error',
        })
        if (!response.ok)
          throw new AppError(
            response.status === 429 ? 503 : 502,
            'PROVIDER_ERROR',
            'The data provider is temporarily unavailable.',
          )
        const parsed = schema.safeParse(await response.json())
        if (!parsed.success) throw invalidUpstream()
        return normalize(parsed.data)
      } catch (error) {
        if (error instanceof AppError) throw error
        if (error.name === 'TimeoutError' || error.name === 'AbortError')
          throw new AppError(
            504,
            'PROVIDER_TIMEOUT',
            'The data provider timed out.',
          )
        if (error instanceof SyntaxError) throw invalidUpstream()
        throw new AppError(
          502,
          'PROVIDER_ERROR',
          'Could not reach the data provider.',
        )
      }
    }

    const entry = { expires: Date.now() + ttl, promise: load() }
    if (cache.size >= 256) cache.delete(cache.keys().next().value)
    cache.set(url, entry)
    try {
      return await entry.promise
    } catch (error) {
      if (cache.get(url) === entry) cache.delete(url)
      throw error
    }
  }

  function locations(q) {
    return request(
      'https://geocoding-api.open-meteo.com/v1/search',
      { name: q, count: 8, language: 'en', format: 'json' },
      locationsPayload,
      ({ results }) =>
        results
          .slice(0, 8)
          .map(
            ({ id, name, admin1, country, latitude, longitude, timezone }) => ({
              id: `geo:${id}`,
              name,
              region: admin1,
              country,
              latitude,
              longitude,
              timezone,
              coordinates: [latitude, longitude],
            }),
          ),
    )
  }
  function airQuality(location) {
    return request(
      'https://air-quality-api.open-meteo.com/v1/air-quality',
      {
        ...location,
        timezone: 'auto',
        current: ['us_aqi', ...pollutants.map(({ key }) => key)].join(','),
        hourly: 'us_aqi',
        forecast_days: 4,
      },
      airPayload,
      (data) => normalizeAirQuality(location, data),
    )
  }
  function weather(location) {
    return request(
      'https://api.open-meteo.com/v1/forecast',
      {
        ...location,
        timezone: 'auto',
        forecast_days: 1,
        current: weatherKeys.join(','),
        hourly: 'uv_index,temperature_2m,precipitation,weather_code',
        temperature_unit: 'celsius',
        wind_speed_unit: 'kmh',
        precipitation_unit: 'mm',
      },
      weatherPayload,
      ({
        current,
        current_units: units,
        hourly,
        timezone,
        timezone_abbreviation,
      }) => ({
        current,
        units: units ?? {},
        timestamp: current.time,
        timezone,
        timeZoneLabel: timezone_abbreviation ?? timezone,
        coordinates: [location.latitude, location.longitude],
        provider: 'Open-Meteo Forecast',
        uv:
          hourly?.uv_index?.[
            hourly.time.indexOf(current.time.slice(0, 13) + ':00')
          ] ?? null,
        hours: (hourly?.time ?? []).map((stamp, i) => ({
          time: stamp,
          temperature: hourly.temperature_2m?.[i] ?? null,
          precipitation: hourly.precipitation?.[i] ?? null,
          weatherCode: hourly.weather_code?.[i] ?? null,
        })),
      }),
    )
  }
  return { locations, airQuality, weather }
}
