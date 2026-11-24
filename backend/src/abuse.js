import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { ipKeyGenerator } from 'express-rate-limit'
import { AppError } from './errors.js'

const minute = 60_000
const day = 24 * 60 * minute
const sessionLifetime = 30 * minute

function limited(message, milliseconds, code = 'AI_RATE_LIMIT') {
  const error = new AppError(429, code, message)
  error.retryAfter = Math.max(1, Math.ceil(milliseconds / 1000))
  return error
}

// Fixed windows and a hard memory ceiling. New keys fail closed under pressure.
function counters() {
  const entries = new Map()
  return (key, limit, window, message) => {
    const now = Date.now()
    const entry = entries.get(key)
    if (entry && entry.expires > now) {
      if (entry.count >= limit) throw limited(message, entry.expires - now)
      entry.count++
      return
    }
    if (entries.size >= 4096) {
      for (const [id, value] of entries) {
        if (value.expires <= now) entries.delete(id)
      }
      if (entries.size >= 4096)
        throw limited('The assistant is busy. Try again shortly.', minute)
    }
    entries.set(key, { count: 1, expires: now + window })
  }
}

export function createAiProtection(config) {
  const count = counters()
  const secret = randomBytes(32)
  let active = 0
  const production = config.NODE_ENV === 'production'
  const sign = (value, ip, origin) =>
    createHmac('sha256', secret)
      .update(JSON.stringify([value, ip, origin]))
      .digest()
  const ipOf = (req) => ipKeyGenerator(req.ip)
  const originOf = (req) => {
    const origin = req.get('Origin')
    if (!origin || !config.FRONTEND_ORIGIN.includes(origin))
      throw new AppError(
        403,
        'ORIGIN_NOT_ALLOWED',
        'Open the assistant from the approved website.',
      )
    return origin
  }

  function issue(req, res) {
    const origin = originOf(req)
    const ip = ipOf(req)
    count(
      'issue:' + ip,
      6,
      minute,
      'Too many assistant sessions. Try again shortly.',
    )
    const value =
      randomBytes(18).toString('base64url') +
      '.' +
      (Date.now() + sessionLifetime)
    res.set('Cache-Control', 'no-store').json({
      success: true,
      data: {
        token: value + '.' + sign(value, ip, origin).toString('base64url'),
      },
    })
  }

  function authorize(req, res, next) {
    res.set('Cache-Control', 'no-store')
    if (!production) return next()
    const origin = originOf(req)
    const ip = ipOf(req)
    const token = req.get('X-AI-Session') ?? ''
    const parts = /^([\w-]{24})\.(\d{13})\.([\w-]{43})$/.exec(token)
    if (
      !parts ||
      Number(parts[2]) <= Date.now() ||
      !timingSafeEqual(
        Buffer.from(parts[3], 'base64url'),
        sign(parts[1] + '.' + parts[2], ip, origin),
      )
    )
      throw new AppError(
        401,
        'AI_SESSION_REQUIRED',
        'Your assistant session expired. Please try again.',
      )
    const message = 'Too many AI requests. Please wait before trying again.'
    count('ip-minute:' + ip, 4, minute, message)
    count('ip-day:' + ip, 30, day, message)
    count('session-minute:' + parts[1], 3, minute, message)
    next()
  }

  async function complete(task) {
    if (!production) return task()
    if (active >= 2)
      throw limited(
        'The assistant is busy. Try again shortly.',
        3000,
        'AI_CAPACITY',
      )
    const message =
      'The shared AI limit has been reached. Please try again later.'
    count('global-minute', config.AI_GLOBAL_PER_MINUTE ?? 6, minute, message)
    count('global-day', config.AI_GLOBAL_PER_DAY ?? 80, day, message)
    active++
    try {
      return await task()
    } finally {
      active--
    }
  }

  return { issue, authorize, complete }
}
