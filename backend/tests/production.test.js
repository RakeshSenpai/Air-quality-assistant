import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'

const origin = 'https://urban.example'
const chatBody = { latitude: 12.97, longitude: 77.59, message: 'What is AQI?' }
const config = {
  NODE_ENV: 'production',
  TRUST_PROXY_HOPS: 1,
  FRONTEND_ORIGIN: [origin],
  GROQ_MODEL: 'openai/gpt-oss-120b',
}
const providers = { airQuality: async () => null, weather: async () => null }
const response = {
  choices: [{ finish_reason: 'stop', message: { content: 'Mock reply' } }],
}

function setup(overrides = {}, create = vi.fn(async () => response)) {
  const app = createApp(
    { ...config, ...overrides },
    {
      providers,
      groqSdk: { chat: { completions: { create } } },
    },
  )
  const api = request(app)
  const post = (
    path,
    { ip = '203.0.113.22', front = origin, ssl = 'https', token } = {},
  ) => {
    const req = api
      .post('/api/v1' + path)
      .set('Origin', front)
      .set('X-Forwarded-Proto', ssl)
      .set('X-Forwarded-For', ip)
    return token ? req.set('X-AI-Session', token) : req
  }
  async function issue(options) {
    const { body } = await post('/assistant/session', options)
      .send({})
      .expect(200)
    return body.data.token
  }
  return { api, post, issue, create, app }
}

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('production ingress and AI protections', () => {
  it('requires HTTPS, one proxy and the exact frontend origin, with HTTP health available for probes', async () => {
    const { api, app, post, create } = setup()
    expect(app.get('trust proxy')).toBe(1)
    await api.get('/api/v1/health').expect(200)
    await post('/assistant/session', { ssl: 'http' }).send({}).expect(403)
    await post('/assistant/session', { front: 'https://other.example' })
      .send({})
      .expect(403)
    await api
      .post('/api/v1/assistant/session')
      .set('X-Forwarded-Proto', 'https')
      .set('X-Forwarded-For', '203.0.113.22')
      .send({})
      .expect(403)
    await api
      .options('/api/v1/assistant/chat')
      .set('X-Forwarded-Proto', 'https')
      .set('X-Forwarded-For', '203.0.113.22')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,x-ai-session')
      .expect('Access-Control-Allow-Origin', origin)
      .expect(204)
    expect(create).not.toHaveBeenCalled()
  })

  it('protects chat and planner with a signed session bound to the nearest forwarded IP', async () => {
    const { post, issue, create } = setup()
    const token = await issue({ ip: '192.0.2.1, 203.0.113.22' })
    await post('/assistant/chat').send(chatBody).expect(401)
    await post('/planner/generate').send(chatBody).expect(401)
    await post('/assistant/chat', { token, ip: '203.0.113.23' })
      .send(chatBody)
      .expect(401)
    await post('/assistant/chat', {
      token: token.slice(0, -43) + 'A'.repeat(43),
    })
      .send(chatBody)
      .expect(401)
    await post('/assistant/chat', { token, ip: '192.0.2.99, 203.0.113.22' })
      .send(chatBody)
      .expect('Cache-Control', 'no-store')
      .expect(200)
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('limits a session separately from its IP and blocks IP quota rotation', async () => {
    const { post, issue, create } = setup()
    const first = await issue()
    for (let i = 0; i < 3; i++)
      await post('/assistant/chat', { token: first }).send(chatBody).expect(200)
    await post('/assistant/chat', { token: first })
      .send(chatBody)
      .expect('Retry-After', /^\d+$/)
      .expect(429)
    const second = await issue()
    await post('/assistant/chat', { token: second }).send(chatBody).expect(429)
    expect(create).toHaveBeenCalledTimes(3)
  })

  it('shares an upstream completion budget across identifiers and routes', async () => {
    const { post, issue, create } = setup({ AI_GLOBAL_PER_MINUTE: 1 })
    await post('/assistant/chat', { token: await issue() })
      .send(chatBody)
      .expect(200)
    const ip = '203.0.113.45'
    const { body } = await post('/planner/generate', {
      ip,
      token: await issue({ ip }),
    })
      .send(chatBody)
      .expect('Retry-After', /^\d+$/)
      .expect(429)
    expect(body.error.code).toBe('AI_RATE_LIMIT')
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('counts a tool follow-up against the same completion budget', async () => {
    const create = vi.fn(async () => ({
      choices: [
        {
          finish_reason: 'tool_calls',
          message: {
            tool_calls: [
              {
                id: 'tool-aqi',
                type: 'function',
                function: { name: 'getAirQuality', arguments: '{}' },
              },
            ],
          },
        },
      ],
    }))
    const { issue, post } = setup({ AI_GLOBAL_PER_MINUTE: 1 }, create)
    await post('/assistant/chat', { token: await issue() })
      .send(chatBody)
      .expect(429)
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('rejects oversized and invalid AI input before any completion', async () => {
    const { post, issue, create } = setup()
    const token = await issue()
    await post('/assistant/chat', { token })
      .send({ ...chatBody, message: 'x'.repeat(34000) })
      .expect(413)
    await post('/assistant/chat', { token })
      .send({ ...chatBody, message: 'x'.repeat(501) })
      .expect(400)
    expect(create).not.toHaveBeenCalled()
    expect(JSON.stringify(console.info.mock.calls)).not.toContain(token)
  })
})
