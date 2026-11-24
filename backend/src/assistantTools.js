import { z } from 'zod'
import { AppError } from './errors.js'
import { getCategory } from '../../src/data/air.js'

export const cityName = z.string().trim().min(2).max(120)
const single = z.strictObject({ city: cityName })
const comparison = z.strictObject({ cities: z.array(cityName).min(2).max(3) })
const cityDescription =
  'City name, optionally followed by comma-separated region and country for disambiguation.'

const place = ({ name, region, country, timezone }) => ({
  name,
  region,
  country,
  timezone,
})
const unavailable = {
  status: 'unavailable',
  message: 'The requested Open-Meteo data is unavailable.',
}

function currentAir(data) {
  const { aqi, category, standard, pollutants, timestamp, provider } = data
  return {
    aqi,
    category,
    standard,
    pollutants,
    timestamp,
    provider,
    modeled: true,
  }
}

function forecast(data) {
  const { standard, provider, timezone, hours, daily, observedAt } = data
  const classify = (entry) => ({
    ...entry,
    category: getCategory(entry.aqi, standard).label,
  })
  return {
    standard,
    provider,
    timezone,
    hourlyScope: 'Current local day only',
    hourlyDate: observedAt?.slice(0, 10),
    modeled: true,
    hours: hours
      .filter(({ type, aqi }) => type === 'Forecast' && Number.isFinite(aqi))
      .slice(0, 24)
      .map(classify),
    daily: daily.slice(0, 4).map(classify),
  }
}

const confirmableTools = [
  'getAirQuality',
  'getWeather',
  'getAirQualityForecast',
]
export const locationConfirmation = z.strictObject({
  tool: z.enum(confirmableTools),
  city: cityName,
})
export const isLocationConfirmation = (message) =>
  /^(?:yes|yeah|yep|correct|that's right|that’s right|yes,? please)[.!]?$/i.test(
    message.trim(),
  )

export const locationName = ({ name, region, country }) =>
  [...new Set([name, region, country].filter(Boolean))].join(', ')

export function suggestLocation(tool, result) {
  if (!confirmableTools.includes(tool) || result.status !== 'ambiguous')
    return null
  const name = locationName(result.matches[0])
  const confirmation = locationConfirmation.safeParse({ tool, city: name })
  if (!confirmation.success) return null
  return {
    reply:
      'I found several matches. Do you mean ' +
      name +
      '? You can reply “yes” or give a different region or country.',
    confirmation: confirmation.data,
    source: 'open-meteo',
  }
}

export function confirmationFromReply(reply, question) {
  if (
    !/\b(?:aqi|air quality|weather|temperature)\b/i.test(question) ||
    /\bcompar\w*/i.test(question)
  )
    return null
  // Older replies and occasional model replies ask for confirmation in plain text.
  const plain = reply.replace(/[*_`]/g, '').replace(/\s+/g, ' ')
  const match =
    /\b(?:do you mean|confirm (?:that )?you mean)\s+([^?]+)\?/i.exec(plain)
  if (!match?.[1].includes(',')) return null
  const name = match[1].replace(/\s*\(([^()]+)\)$/, ', $1').trim()
  const tool = /\b(?:aqi|air quality)\b/i.test(question)
    ? /\b(?:forecast|tomorrow)\b/i.test(question)
      ? 'getAirQualityForecast'
      : 'getAirQuality'
    : 'getWeather'
  const result = locationConfirmation.safeParse({ tool, city: name })
  return result.success ? result.data : null
}

function confirmedReading(confirmation, result) {
  if (result.status !== 'ok')
    throw new AppError(
      502,
      'LOCATION_DATA_UNAVAILABLE',
      'I couldn’t retrieve that reading for ' +
        confirmation.city +
        '. Retry or specify another location.',
    )
  const name = locationName(result.location)
  const data = result.data
  if (confirmation.tool === 'getAirQuality') {
    if (!Number.isFinite(data.aqi))
      return 'The current modeled AQI for ' + name + ' is unavailable.'
    return (
      name +
      ' has a modeled US AQI of **' +
      data.aqi +
      ' (' +
      data.category +
      ')**' +
      (data.timestamp ? ' at ' + data.timestamp : '') +
      '. Source: Open-Meteo / Copernicus CAMS.'
    )
  }
  if (confirmation.tool === 'getAirQualityForecast') {
    const readings = data.daily.length ? data.daily : data.hours.slice(0, 4)
    if (!readings.length)
      return 'The modeled AQI forecast for ' + name + ' is unavailable.'
    const readingsText = readings.map(
      ({ time, aqi, category }) =>
        '- ' + time + ': ' + aqi + ' (' + category + ')',
    )
    return (
      'Modeled US AQI forecast for ' +
      name +
      ' (' +
      (data.daily.length ? 'daily peaks' : 'upcoming hours') +
      '):\n\n' +
      readingsText.join('\n') +
      '\n\nSource: Open-Meteo / Copernicus CAMS.'
    )
  }
  const fields = [
    ['temperature_2m', 'Temperature'],
    ['relative_humidity_2m', 'Humidity'],
    ['wind_speed_10m', 'Wind speed'],
  ]
  const readings = fields.flatMap(([key, label]) =>
    Number.isFinite(data.current?.[key]) && data.units?.[key]
      ? [label + ': ' + data.current[key] + ' ' + data.units[key]]
      : [],
  )
  if (!readings.length)
    return 'The current modeled weather for ' + name + ' is unavailable.'
  return (
    'Modeled weather for ' +
    name +
    ': ' +
    readings.join(', ') +
    '. Source: Open-Meteo Forecast.'
  )
}

export function createAssistantTools(providers) {
  async function candidates(query) {
    const [name, ...qualifiers] = query
      .toLowerCase()
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
    if (!name || name.length < 2) return []
    return (await providers.locations(name)).filter(({ region, country }) =>
      qualifiers.every((part) =>
        [region, country].some((label) => label?.toLowerCase() === part),
      ),
    )
  }

  async function lookup(query, read) {
    try {
      const matches = await candidates(query)
      if (!matches.length) return { status: 'not_found', query }
      let [location] = matches
      if (matches.length > 1) {
        const name = query.split(',')[0].trim().toLowerCase()
        const exact = matches.filter(
          (match) => match.name.toLowerCase() === name,
        )
        const plausible = exact.length ? exact : matches
        if (plausible.length > 1)
          return {
            status: 'ambiguous',
            query,
            matches: plausible.slice(0, 5).map(place),
          }
        location = plausible[0]
      }
      const data = await read({
        latitude: location.latitude,
        longitude: location.longitude,
      })
      return {
        status: data ? 'ok' : 'unavailable',
        location: place(location),
        data,
      }
    } catch {
      return { ...unavailable, query }
    }
  }

  const air = async (coordinates) => {
    const data = await providers.airQuality(coordinates)
    return data && currentAir(data)
  }

  const handlers = {
    searchLocation: {
      description:
        'Find matching locations or clarify the spelling, region, or country of a place.',
      schema: single,
      run: async ({ city }) => ({
        status: 'ok',
        matches: (await candidates(city)).slice(0, 5).map(place),
      }),
    },
    getAirQuality: {
      description:
        'Get current modeled US AQI, category, pollutant values and units for a city. Resolves the name itself.',
      schema: single,
      run: ({ city }) => lookup(city, air),
    },
    getWeather: {
      description:
        'Get current modeled weather and units for a city. Resolves the name itself.',
      schema: single,
      run: ({ city }) =>
        lookup(city, async (coordinates) => {
          const { current, units, timestamp, timezone, provider } =
            await providers.weather(coordinates)
          return {
            current,
            units,
            timestamp,
            timezone,
            provider,
            modeled: true,
          }
        }),
    },
    getAirQualityForecast: {
      description:
        'Get upcoming hourly AQI and daily forecast peaks for a city. Resolves the name itself.',
      schema: single,
      run: ({ city }) =>
        lookup(city, async (coordinates) =>
          forecast(await providers.airQuality(coordinates)),
        ),
    },
    compareCities: {
      description:
        'Get comparable current modeled US AQI and pollutants for two or three cities in one call.',
      schema: comparison,
      run: async ({ cities }) => ({
        results: await Promise.all(cities.map((name) => lookup(name, air))),
      }),
    },
  }

  const definitions = Object.entries(handlers).map(
    ([name, { description, schema }]) => ({
      type: 'function',
      function: {
        name,
        description,
        parameters: {
          type: 'object',
          properties:
            schema === comparison
              ? {
                  cities: {
                    type: 'array',
                    minItems: 2,
                    maxItems: 3,
                    items: { type: 'string', description: cityDescription },
                  },
                }
              : { city: { type: 'string', description: cityDescription } },
          required: [schema === comparison ? 'cities' : 'city'],
          additionalProperties: false,
        },
      },
    }),
  )

  async function execute({ name, arguments: args }, referenceLocation) {
    const handler = Object.hasOwn(handlers, name) && handlers[name]
    if (!handler) return { status: 'invalid_tool' }
    if (typeof args !== 'string' || args.length > 2048)
      return { status: 'invalid_arguments' }
    let input
    try {
      input = handler.schema.safeParse(JSON.parse(args))
    } catch {
      return { status: 'invalid_arguments' }
    }
    if (!input.success) return { status: 'invalid_arguments' }
    try {
      const requested = input.data.city
      const referenceName = referenceLocation?.split(',')[0].trim()
      const resolved =
        requested && requested.toLowerCase() === referenceName?.toLowerCase()
          ? { city: referenceLocation }
          : input.data
      return await handler.run(resolved)
    } catch {
      return unavailable
    }
  }

  async function confirm(confirmation) {
    const result = await execute({
      name: confirmation.tool,
      arguments: JSON.stringify({ city: confirmation.city }),
    })
    return {
      reply: confirmedReading(confirmation, result),
      source: 'open-meteo',
      resolvedLocation: confirmation.city,
    }
  }

  return { definitions, execute, confirm }
}
