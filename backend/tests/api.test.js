import { describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { createProviders } from '../src/providers.js'
import { createGroq } from '../src/groq.js'
import { getCategory } from '../../src/data/air.js'

const config = {
  FRONTEND_ORIGIN: ['http://localhost:5173'],
  GROQ_MODEL: 'openai/gpt-oss-120b',
}
const coordinates = { latitude: 28.61, longitude: 77.21 }
const path = '/api/v1'
const current = { time: '2026-11-24T12:00', us_aqi: 501, pm2_5: 12 }
const weather = {
  time: current.time,
  temperature_2m: 24,
  precipitation: 0,
  relative_humidity_2m: 60,
}
const json = (body) => ({ ok: true, json: async () => body })
function fixture(url) {
  if (url.includes('geocoding'))
    return json({
      results: [
        { id: 1, name: 'Delhi', ...coordinates, timezone: 'Asia/Kolkata' },
      ],
    })
  if (url.includes('air-quality'))
    return json({
      current,
      current_units: { pm2_5: 'μg/m³' },
      hourly: { time: [current.time, '2026-11-25T12:00'], us_aqi: [501, 75] },
    })
  return json({
    current: weather,
    current_units: { temperature_2m: '°C' },
    hourly: { time: [weather.time], uv_index: [4] },
  })
}
function setup({ fetcher = vi.fn(fixture), generateContent, timeout } = {}) {
  const providers = createProviders({ fetcher, timeout })
  const groq = createGroq(
    config,
    generateContent && {
      chat: {
        completions: {
          create: async (request) => {
            const {
              text,
              finish = 'stop',
              calls,
            } = await generateContent({
              ...request,
              messages: [...request.messages],
            })
            return {
              choices: [
                {
                  finish_reason: finish,
                  message: {
                    content: text,
                    reasoning: 'internal only',
                    tool_calls: calls,
                  },
                },
              ],
            }
          },
        },
      },
    },
  )
  return { api: request(createApp(config, { providers, groq })), fetcher }
}

describe('public endpoints', () => {
  it('reports health without invoking providers', async () => {
    const { api, fetcher } = setup()
    const result = await api.get(path + '/health').expect(200)
    expect(result.body.data.status).toBe('ok')
    expect(result.headers['x-content-type-options']).toBe('nosniff')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('validates search and serves normalized coordinates and timezone', async () => {
    const { api, fetcher } = setup()
    await api
      .get(path + '/locations/search')
      .query({ q: ' ' })
      .expect(400)
    expect(fetcher).not.toHaveBeenCalled()
    const result = await api
      .get(path + '/locations/search')
      .query({ q: ' Delhi ' })
      .expect(200)
    expect(result.body.data[0]).toMatchObject({
      name: 'Delhi',
      coordinates: [28.61, 77.21],
      timezone: 'Asia/Kolkata',
    })
  })
  it('handles empty search results', async () => {
    const { api } = setup({ fetcher: async () => json({}) })
    expect(
      (
        await api
          .get(path + '/locations/search')
          .query({ q: 'Unknown' })
          .expect(200)
      ).body.data,
    ).toEqual([])
  })
  it.each([
    { latitude: 91, longitude: 0 },
    { latitude: '', longitude: 1 },
    { latitude: 0, longitude: 'Infinity' },
    { latitude: 0, longitude: -181 },
  ])('rejects invalid coordinates %o', async (query) => {
    const { api, fetcher } = setup()
    await api
      .get(path + '/air-quality')
      .query(query)
      .expect(400)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('normalizes modeled air, retains high readings, nulls missing fields, and caches success', async () => {
    const { api, fetcher } = setup()
    const result = await api
      .get(path + '/air-quality')
      .query(coordinates)
      .expect(200)
    expect(result.body.data).toMatchObject({
      aqi: 501,
      beyondScale: true,
      category: 'Hazardous',
      values: [12, null, null, null, null, null],
      modeled: true,
    })
    expect(result.body.data.pollutants[0]).toMatchObject({
      unit: 'μg/m³',
      value: 12,
    })
    expect(result.body.data.daily[0].aqi).toBe(75)
    await api
      .get(path + '/air-quality')
      .query(coordinates)
      .expect(200)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('normalizes weather and retains zero precipitation', async () => {
    const { api } = setup()
    const result = await api
      .get(path + '/weather')
      .query(coordinates)
      .expect(200)
    expect(result.body.data).toMatchObject({
      current: weather,
      units: { temperature_2m: '°C' },
      uv: 4,
      timestamp: weather.time,
    })
  })
  it.each([
    [502, async () => ({ ok: false, status: 500 })],
    [502, async () => json({ current: { time: false } })],
    [
      504,
      async (_url, { signal }) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(signal.reason), {
            once: true,
          }),
        ),
    ],
  ])('converts provider failure to %s', async (status, fetcher) => {
    const { api } = setup({ fetcher, timeout: 10 })
    await api
      .get(path + '/air-quality')
      .query(coordinates)
      .expect(status)
  })
  it('enforces CORS and returns normalized route and JSON errors', async () => {
    const { api } = setup()
    await api
      .get(path + '/health')
      .set('Origin', 'https://other.example')
      .expect(403)
    await api.get(path + '/missing').expect(404)
    await api
      .post(path + '/assistant/chat')
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(400)
  })
  it('returns indoor and sustainability advice without Groq', async () => {
    const { api } = setup()
    const indoor = await api
      .post(path + '/recommendations/indoor-air')
      .send(coordinates)
      .expect(200)
    expect(indoor.body.data.tips.length).toBeGreaterThan(0)
    await api
      .post(path + '/recommendations/sustainability')
      .send({ ...coordinates, selected: ['energy'] })
      .expect(200)
  })
})

describe('AI endpoints', () => {
  it('rejects invalid messages and missing credentials without using providers', async () => {
    const { api, fetcher } = setup()
    await api
      .post(path + '/assistant/chat')
      .send({ ...coordinates, message: 'x'.repeat(501) })
      .expect(400)
    const response = await api
      .post(path + '/assistant/chat')
      .send({ ...coordinates, message: 'AQI?' })
      .expect(503)
    expect(response.body.error.code).toBe('AI_NOT_CONFIGURED')
    await api
      .post(path + '/planner/generate')
      .send(coordinates)
      .expect(503)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('passes only trusted environmental readings and separates instructions', async () => {
    const generateContent = vi.fn(async () => ({
      text: 'Choose an indoor option today.',
    }))
    const { api } = setup({ generateContent })
    await api
      .post(path + '/assistant/chat')
      .send({ ...coordinates, message: 'Hello', aqi: 1 })
      .expect(200)
    const sent = generateContent.mock.calls[0][0]
    const [contextPart, question] = sent.messages
      .at(-1)
      .content.split('\n\nLatest question: ')
    const input = JSON.parse(
      contextPart.replace('Current context (JSON): ', ''),
    )
    expect(question).toBe('Hello')
    expect(input.airQuality.aqi).toBe(501)
    expect(input.aqi).toBeUndefined()
    expect(input.latitude).toBeUndefined()
    expect(input.airQuality.coordinates).toBeUndefined()
    expect(input.weather.coordinates).toBeUndefined()
    expect(sent.messages[0].content).toContain('untrusted')
    expect(sent.include_reasoning).toBe(false)
  })
  it('sends the last four completed turns in order across a ten-question conversation', async () => {
    const messages = [
      'Hello, what can you help me with?',
      'What is PM2.5?',
      'How can I reduce pollution exposure?',
      'Can I do that without changing my daily routine?',
      'I travel to college by bike every day.',
      'What precautions should I take?',
      'Would wearing a mask help?',
      'Explain that in simpler language.',
      'What is the difference between PM2.5 and PM10?',
      'Can you summarize your recommendations in three points?',
    ]
    const history = []
    const generateContent = vi.fn(async () => ({
      text: 'Reply to turn ' + generateContent.mock.calls.length,
    }))
    for (const message of messages) {
      // Use a fresh limiter for each mocked request. History belongs to the caller.
      const { api } = setup({ generateContent })
      const { body } = await api
        .post(path + '/assistant/chat')
        .send({
          ...coordinates,
          location: 'Delhi',
          message,
          history: history.slice(-8),
        })
        .expect(200)
      const { messages: sentMessages } = generateContent.mock.lastCall[0]
      expect(sentMessages.slice(1, -1)).toEqual(
        history.slice(-8).map(({ role, text }) => ({
          role,
          content: text,
        })),
      )
      expect(sentMessages.at(-1)).toMatchObject({
        role: 'user',
        content: expect.stringContaining('Latest question: ' + message),
      })
      history.push(
        { role: 'user', text: message },
        { role: 'assistant', text: body.data.reply },
      )
    }
    expect(generateContent).toHaveBeenCalledTimes(10)
  })

  it('includes the validated US AQI category for 142 even after an Indian AQI discussion', async () => {
    const fetcher = (url) => {
      if (!url.includes('air-quality')) return fixture(url)
      return json({
        current: { ...current, us_aqi: 142 },
        current_units: { pm2_5: 'μg/m³' },
      })
    }
    const generateContent = vi.fn(async () => ({
      text: 'US AQI 142 is Unhealthy for Sensitive Groups.',
    }))
    const { api } = setup({ fetcher, generateContent })
    await api
      .post(path + '/assistant/chat')
      .send({
        ...coordinates,
        message: 'How is it here?',
        history: [{ role: 'user', text: 'Earlier we discussed Indian AQI.' }],
      })
      .expect(200)
    const contextPart = generateContent.mock.lastCall[0].messages
      .at(-1)
      .content.split('\n\nLatest question: ')[0]
    expect(
      JSON.parse(contextPart.replace('Current context (JSON): ', ''))
        .airQuality,
    ).toMatchObject({
      aqi: 142,
      standard: 'us',
      category: 'Unhealthy for Sensitive Groups',
      modeled: true,
    })
  })

  it('uses Bengaluru tool data while preserving Mumbai context and conversation history', async () => {
    const fetcher = vi.fn((url) => {
      if (url.includes('geocoding'))
        return json({
          results: [
            {
              id: 1,
              name: 'Bengaluru',
              latitude: 12.97,
              longitude: 77.59,
              admin1: 'Karnataka',
              country: 'India',
              timezone: 'Asia/Kolkata',
            },
          ],
        })
      if (url.includes('air-quality') && url.includes('latitude=12.97'))
        return json({ current: { ...current, us_aqi: 72 } })
      return fixture(url)
    })
    const tool = {
      id: 'call_aqi',
      type: 'function',
      function: {
        name: 'getAirQuality',
        arguments: '{"city":"Bengaluru, India"}',
      },
    }
    const generateContent = vi
      .fn()
      .mockResolvedValueOnce({ finish: 'tool_calls', calls: [tool] })
      .mockResolvedValueOnce({ text: 'Bengaluru’s modeled US AQI is 72.' })
    const { api } = setup({ fetcher, generateContent })
    const response = await api
      .post(path + '/assistant/chat')
      .send({
        latitude: 19.076,
        longitude: 72.8777,
        location: 'Mumbai',
        message: 'What is its current air quality?',
        history: [
          { role: 'user', text: 'Tell me about Bengaluru.' },
          { role: 'assistant', text: 'What would you like to know?' },
        ],
      })
      .expect(200)
    expect(response.body.data.reply).toContain('72')
    const first = generateContent.mock.calls[0][0]
    expect(first.tool_choice).toBe('auto')
    expect(first.tools.map(({ function: tool }) => tool.name)).toEqual([
      'searchLocation',
      'getAirQuality',
      'getWeather',
      'getAirQualityForecast',
      'compareCities',
    ])
    expect(first.messages[1].content).toContain('Bengaluru')
    expect(first.messages.at(-1).content).toContain('Mumbai')
    const messages = generateContent.mock.calls[1][0].messages
    expect(messages.at(-2)).toEqual({ role: 'assistant', tool_calls: [tool] })
    expect(messages.at(-1)).toMatchObject({
      role: 'tool',
      tool_call_id: 'call_aqi',
    })
    expect(JSON.parse(messages.at(-1).content)).toMatchObject({
      status: 'ok',
      location: { name: 'Bengaluru' },
      data: { aqi: 72, standard: 'us', category: 'Moderate', modeled: true },
    })
  })

  it('validates tool arguments and caps the loop at two tool executions', async () => {
    const generateContent = vi.fn()
    for (const [id, name, args] of [
      ['first', 'compareCities', '{"cities":["A","B","C","D"]}'],
      ['second', 'getWeather', '{"city":"Bengaluru","latitude":0}'],
    ]) {
      generateContent.mockResolvedValueOnce({
        finish: 'tool_calls',
        calls: [{ id, type: 'function', function: { name, arguments: args } }],
      })
    }
    generateContent.mockResolvedValueOnce({
      text: 'I could not retrieve that data.',
    })
    const { api, fetcher } = setup({ generateContent })
    await api
      .post(path + '/assistant/chat')
      .send({ ...coordinates, message: 'Compare cities.' })
      .expect(200)
    const final = generateContent.mock.calls[2][0]
    expect(final.tool_choice).toBe('none')
    expect(
      final.messages
        .filter(({ role }) => role === 'tool')
        .map(({ content }) => JSON.parse(content).status),
    ).toEqual(['invalid_arguments', 'invalid_arguments'])
    expect(fetcher).toHaveBeenCalledTimes(2) // Dashboard air and weather only.
    expect(generateContent).toHaveBeenCalledTimes(3)
  })

  it('resolves Delhi on yes through Open-Meteo even if Groq would rate-limit the second turn', async () => {
    const fetcher = vi.fn((url) => {
      if (url.includes('geocoding'))
        return json({
          results: [
            {
              id: 1,
              name: 'Delhi',
              admin1: 'National Capital Territory of Delhi',
              country: 'India',
              latitude: 28.65,
              longitude: 77.23,
            },
            {
              id: 2,
              name: 'Delhi',
              admin1: 'New York',
              country: 'United States',
              latitude: 42.28,
              longitude: -74.91,
            },
          ],
        })
      if (url.includes('air-quality') && url.includes('latitude=28.65'))
        return json({ current: { ...current, us_aqi: 155 } })
      return fixture(url)
    })
    const generateContent = vi
      .fn()
      .mockResolvedValueOnce({
        finish: 'tool_calls',
        calls: [
          {
            id: 'delhi',
            type: 'function',
            function: { name: 'getAirQuality', arguments: '{"city":"Delhi"}' },
          },
        ],
      })
      .mockRejectedValue(
        Object.assign(new Error('rate limit'), { status: 429 }),
      )
    const { api } = setup({ fetcher, generateContent })
    const first = await api
      .post(path + '/assistant/chat')
      .send({ ...coordinates, message: 'What is Delhi’s AQI?' })
      .expect(200)
    expect(first.body.data.confirmation).toEqual({
      tool: 'getAirQuality',
      city: 'Delhi, National Capital Territory of Delhi, India',
    })
    const second = await api
      .post(path + '/assistant/chat')
      .send({
        ...coordinates,
        message: 'yes',
        confirmation: first.body.data.confirmation,
        history: [
          { role: 'user', text: 'What is Delhi’s AQI?' },
          { role: 'assistant', text: first.body.data.reply },
        ],
      })
      .expect(200)
    expect(second.body.data).toMatchObject({
      source: 'open-meteo',
      reply: expect.stringContaining('155 (Unhealthy)'),
    })
    expect(second.body.data.confirmation).toBeUndefined()
    expect(generateContent).toHaveBeenCalledTimes(1)
    expect(
      fetcher.mock.calls.filter(([url]) => url.includes('geocoding')),
    ).toHaveLength(1)
  })

  it('resolves the original plain-text Delhi clarification from conversation history', async () => {
    const fetcher = vi.fn((url) =>
      url.includes('geocoding')
        ? json({
            results: [
              {
                id: 1,
                name: 'Delhi',
                admin1: 'National Capital Territory of Delhi',
                country: 'India',
                ...coordinates,
              },
            ],
          })
        : fixture(url),
    )
    const { api } = setup({ fetcher })
    const { body } = await api
      .post(path + '/assistant/chat')
      .send({
        ...coordinates,
        message: 'yes',
        history: [
          { role: 'user', text: 'What is Delhi’s current AQI?' },
          {
            role: 'assistant',
            text: 'I see several places named Delhi. Do you mean Delhi, India (National Capital Territory of Delhi)?',
          },
        ],
      })
      .expect(200)
    expect(body.data).toMatchObject({
      source: 'open-meteo',
      reply: expect.stringContaining(
        'Delhi, National Capital Territory of Delhi, India',
      ),
    })
  })

  it('returns a useful retryable error if the confirmed location is unavailable', async () => {
    const { api } = setup()
    const response = await api
      .post(path + '/assistant/chat')
      .send({
        ...coordinates,
        message: 'yes',
        confirmation: { tool: 'getWeather', city: 'Unknown, Ireland' },
      })
      .expect(502)
    expect(response.body.error).toMatchObject({
      code: 'LOCATION_DATA_UNAVAILABLE',
      message: expect.stringContaining('Unknown, Ireland'),
    })
  })

  it('reuses duplicate city lookups inside a turn', async () => {
    const call = (id, city) => ({
      id,
      type: 'function',
      function: { name: 'getWeather', arguments: JSON.stringify({ city }) },
    })
    const generateContent = vi
      .fn()
      .mockResolvedValueOnce({
        finish: 'tool_calls',
        calls: [call('first', 'Delhi')],
      })
      .mockResolvedValueOnce({
        finish: 'tool_calls',
        calls: [call('second', 'delhi')],
      })
      .mockResolvedValueOnce({ text: 'Here is the weather in Delhi.' })
    const { api, fetcher } = setup({ generateContent })
    await api
      .post(path + '/assistant/chat')
      .send({ ...coordinates, message: 'What is Delhi’s weather?' })
      .expect(200)
    const final = generateContent.mock.calls[2][0]
    expect(final.tool_choice).toBe('none')
    expect(
      final.messages
        .filter(({ role }) => role === 'tool')
        .map(({ tool_call_id }) => tool_call_id),
    ).toEqual(['first', 'second'])
    expect(
      fetcher.mock.calls.filter(([url]) => url.includes('geocoding')),
    ).toHaveLength(1)
  })

  it('returns a retryable error instead of a cut-off reply', async () => {
    const { api } = setup({
      generateContent: async () => ({
        text: 'When you',
        finish: 'length',
      }),
    })
    const { body } = await api
      .post(path + '/assistant/chat')
      .send({ ...coordinates, message: 'Tell me about pollution.' })
      .expect(502)
    expect(body.error.code).toBe('AI_INCOMPLETE')
    expect(body.data).toBeUndefined()
  })

  it.each([
    [429, 'AI_RATE_LIMIT', 429],
    [400, 'AI_REQUEST_REJECTED', 502],
    [404, 'AI_MODEL_UNAVAILABLE', 503],
    [401, 'AI_AUTH_FAILED', 503],
    [504, 'AI_TIMEOUT', 504],
    [500, 'AI_PROVIDER_ERROR', 502],
  ])('maps Groq %s', async (status, code, http) => {
    const generateContent = vi.fn(async () => {
      throw Object.assign(new Error('private details'), { status })
    })
    const { api } = setup({ generateContent })
    const response = await api
      .post(path + '/assistant/chat')
      .send({ ...coordinates, message: 'Hello' })
      .expect(http)
    expect(response.body.error.code).toBe(code)
    expect(JSON.stringify(response.body)).not.toContain('private details')
    expect(generateContent).toHaveBeenCalledTimes(1)
  })
  it('honors the provider Retry-After without making a second generation call', async () => {
    const generateContent = vi.fn(async () => {
      throw Object.assign(new Error('upstream detail'), {
        status: 429,
        headers: new Headers({ 'Retry-After': '60' }),
      })
    })
    const { api } = setup({ generateContent })
    const input = { ...coordinates, message: 'Hello' }
    await api
      .post(path + '/assistant/chat')
      .send(input)
      .expect(429)
      .expect('Retry-After', '60')
    await api
      .post(path + '/assistant/chat')
      .send(input)
      .expect(429)
      .expect('Retry-After', /^\d+$/)
    expect(generateContent).toHaveBeenCalledTimes(1)
  })

  it('rejects unusable chat and planner output', async () => {
    const { api } = setup({ generateContent: async () => ({ text: ' ' }) })
    await api
      .post(path + '/assistant/chat')
      .send({ ...coordinates, message: 'Hello' })
      .expect(502)
    await api
      .post(path + '/planner/generate')
      .send(coordinates)
      .expect(502)
  })
  it('validates and adapts structured planner output', async () => {
    const advice = {
      summary: 'Check local conditions',
      activities: ['Read indoors'],
      precautions: ['Recheck AQI'],
    }
    const generateContent = vi.fn(async () => ({
      text: JSON.stringify({
        morning: advice,
        afternoon: advice,
        evening: advice,
      }),
    }))
    const { api } = setup({ generateContent })
    const result = await api
      .post(path + '/planner/generate')
      .send({ ...coordinates, profile: 'children' })
      .expect(200)
    expect(result.body.data.periods).toHaveLength(3)
    expect(result.body.data.periods[0].tips).toContain('Read indoors')
    expect(generateContent.mock.calls[0][0].response_format).toMatchObject({
      type: 'json_schema',
      json_schema: { strict: true },
    })
  })
})

it.each([
  [0, 'Good'],
  [50, 'Good'],
  [51, 'Moderate'],
  [100, 'Moderate'],
  [101, 'Unhealthy for Sensitive Groups'],
  [150, 'Unhealthy for Sensitive Groups'],
  [151, 'Unhealthy'],
  [200, 'Unhealthy'],
  [201, 'Very Unhealthy'],
  [300, 'Very Unhealthy'],
  [301, 'Hazardous'],
  [500, 'Hazardous'],
  [501, 'Hazardous'],
])('classifies US AQI %s as %s', (value, label) =>
  expect(getCategory(value, 'us').label).toBe(label),
)
