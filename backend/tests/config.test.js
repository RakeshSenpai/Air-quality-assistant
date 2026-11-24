import { afterEach, expect, it, vi } from 'vitest'
import dotenv from 'dotenv'
import { loadConfig } from '../src/config.js'

vi.mock('dotenv', () => ({ default: { config: vi.fn() } }))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

function hosted() {
  vi.stubEnv('RENDER', 'true')
  vi.stubEnv('NODE_ENV', 'development')
  vi.stubEnv('PORT', '10000')
  vi.stubEnv('FRONTEND_ORIGIN', 'https://urban.example')
  vi.stubEnv('TRUST_PROXY_HOPS', '1')
}

it('enables production on Render and uses the host-provided port without dotenv', () => {
  hosted()
  expect(loadConfig()).toMatchObject({ NODE_ENV: 'production', PORT: 10000 })
  expect(dotenv.config).not.toHaveBeenCalled()
})

it('fails closed when production has no runtime port', () => {
  hosted()
  vi.stubEnv('PORT', undefined)
  expect(() => loadConfig()).toThrow('PORT is required in production')
  expect(dotenv.config).not.toHaveBeenCalled()
})

it('keeps a local fallback of 5001 and does not override supplied environment variables', () => {
  vi.stubEnv('RENDER', undefined)
  vi.stubEnv('NODE_ENV', 'development')
  vi.stubEnv('PORT', undefined)
  expect(loadConfig()).toMatchObject({ NODE_ENV: 'development', PORT: 5001 })
  expect(dotenv.config).toHaveBeenCalledWith(
    expect.objectContaining({ override: false }),
  )
  vi.stubEnv('PORT', '5500')
  expect(loadConfig().PORT).toBe(5500)
})
