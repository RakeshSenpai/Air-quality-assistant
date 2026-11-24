import { describe, expect, it, vi } from 'vitest'
import { createAssistantTools } from '../src/assistantTools.js'

const place = (name, region, country, latitude) => ({
  name,
  region,
  country,
  latitude,
  longitude: 77,
  timezone: 'Example',
})
const cities = {
  bengaluru: [place('Bengaluru', 'Karnataka', 'India', 12)],
  mumbai: [place('Mumbai', 'Maharashtra', 'India', 19)],
  springfield: [
    place('Springfield', 'Illinois', 'United States', 39),
    place('Springfield', 'Massachusetts', 'United States', 42),
  ],
}

function setup() {
  const providers = {
    locations: vi.fn(async (city) => cities[city] ?? []),
    airQuality: vi.fn(async ({ latitude }) => ({
      aqi: latitude === 12 ? 72 : 140,
      standard: 'us',
      category: 'Moderate',
      hours: [
        { type: 'Forecast', aqi: 142 },
        { type: 'Historical', aqi: 55 },
      ],
      daily: [{ aqi: 151 }],
    })),
    weather: vi.fn(async () => ({
      current: { temperature_2m: 25 },
      units: { temperature_2m: '°C' },
    })),
  }
  const tools = createAssistantTools(providers)
  return {
    providers,
    run: (name, args) =>
      tools.execute({ name, arguments: JSON.stringify(args) }),
  }
}

describe('assistant location tools', () => {
  it('resolves candidate locations without returning coordinates to Groq', async () => {
    const { run } = setup()
    const result = await run('searchLocation', { city: 'Springfield' })
    expect(result.matches).toHaveLength(2)
    expect(result.matches[0]).toEqual({
      name: 'Springfield',
      region: 'Illinois',
      country: 'United States',
      timezone: 'Example',
    })
  })

  it('asks for clarification and resolves a qualified city for weather', async () => {
    const { providers, run } = setup()
    expect(await run('getWeather', { city: 'Springfield' })).toMatchObject({
      status: 'ambiguous',
    })
    expect(providers.weather).not.toHaveBeenCalled()
    expect(
      await run('getWeather', { city: 'Springfield, Massachusetts' }),
    ).toMatchObject({
      status: 'ok',
      data: {
        current: { temperature_2m: 25 },
        units: { temperature_2m: '°C' },
      },
    })
    expect(providers.weather).toHaveBeenCalledWith({
      latitude: 42,
      longitude: 77,
    })
  })

  it('reuses a confirmed region for the same city and respects explicit qualifiers', async () => {
    const { providers } = setup()
    const tools = createAssistantTools(providers)
    const reference = 'Springfield, Massachusetts, United States'
    const lookup = (city) =>
      tools.execute(
        { name: 'getWeather', arguments: JSON.stringify({ city }) },
        reference,
      )
    expect(await lookup('Springfield')).toMatchObject({
      location: { region: 'Massachusetts' },
    })
    expect(await lookup('Springfield, Illinois')).toMatchObject({
      location: { region: 'Illinois' },
    })
    expect(providers.weather).toHaveBeenNthCalledWith(1, {
      latitude: 42,
      longitude: 77,
    })
    expect(providers.weather).toHaveBeenNthCalledWith(2, {
      latitude: 39,
      longitude: 77,
    })
  })

  it('returns classified forecasts and omits past hours', async () => {
    const { run } = setup()
    const { data } = await run('getAirQualityForecast', { city: 'Bengaluru' })
    expect(data.hours).toEqual([
      {
        type: 'Forecast',
        aqi: 142,
        category: 'Unhealthy for Sensitive Groups',
      },
    ])
    expect(data.daily).toEqual([{ aqi: 151, category: 'Unhealthy' }])
  })

  it('compares multiple cities and preserves partial results if one lookup fails', async () => {
    const { providers, run } = setup()
    providers.airQuality.mockRejectedValueOnce(
      new Error('private upstream detail'),
    )
    const { results } = await run('compareCities', {
      cities: ['Bengaluru', 'Mumbai', 'Unknown town'],
    })
    expect(results.map(({ status }) => status)).toEqual([
      'unavailable',
      'ok',
      'not_found',
    ])
    expect(results[1]).toMatchObject({
      location: { name: 'Mumbai' },
      data: { aqi: 140, standard: 'us' },
    })
    expect(JSON.stringify(results)).not.toContain('private upstream detail')
  })
})
