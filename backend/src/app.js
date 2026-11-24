import { isIP } from 'node:net'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import { createRoutes } from './routes.js'
import { createProviders } from './providers.js'
import { createGroq } from './groq.js'
import { createAiProtection } from './abuse.js'
import { requestLog } from './requestLog.js'
import { AppError, handleError, replyError } from './errors.js'

function limiter(limit, message, skip) {
  return rateLimit({
    windowMs: 60000,
    limit,
    skip,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) =>
      replyError(res, new AppError(429, 'RATE_LIMIT', message)),
  })
}

export function createApp(config, overrides = {}) {
  const app = express()
  const protection = createAiProtection(config)
  const production = config.NODE_ENV === 'production'
  app.set(
    'trust proxy',
    production && config.TRUST_PROXY_HOPS === 1 ? 1 : false,
  )
  app.disable('x-powered-by')
  if (production) {
    app.use(requestLog)
    app.use((req, _res, next) => {
      if (req.method === 'GET' && req.path === '/api/v1/health') return next()
      if (!req.secure || req.get('X-Forwarded-Proto') !== 'https')
        throw new AppError(403, 'HTTPS_REQUIRED', 'Use the HTTPS API address.')
      if (!req.get('X-Forwarded-For') || !isIP(req.ip))
        throw new AppError(
          503,
          'PROXY_UNAVAILABLE',
          'The service could not verify the connection. Try again later.',
        )
      next()
    })
  }
  app.use(helmet())
  app.use(
    cors({
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-AI-Session'],
      exposedHeaders: ['Retry-After', 'X-Request-Id'],
      maxAge: 600,
      origin(origin, answer) {
        if (!origin || config.FRONTEND_ORIGIN.includes(origin))
          return answer(null, true)
        answer(
          new AppError(
            403,
            'ORIGIN_NOT_ALLOWED',
            'This browser origin is not allowed.',
          ),
        )
      },
    }),
  )
  app.use(
    '/api/v1',
    limiter(
      120,
      'Too many requests. Try again in a minute.',
      (req) => req.method === 'GET' && req.path === '/health',
    ),
  )
  app.use(express.json({ limit: '32kb' }))
  app.use(
    '/api/v1',
    createRoutes({
      providers:
        overrides.providers ?? createProviders({ ttl: config.CACHE_TTL_MS }),
      groq:
        overrides.groq ??
        createGroq(config, overrides.groqSdk, protection.complete),
      issueAiSession: protection.issue,
      authorizeAi: protection.authorize,
      aiLimit: limiter(
        8,
        'Too many assistant or planner requests. Try again in a minute.',
      ),
    }),
  )
  app.use((_req, _res, next) =>
    next(new AppError(404, 'NOT_FOUND', 'This API endpoint does not exist.')),
  )
  app.use(handleError)
  return app
}
