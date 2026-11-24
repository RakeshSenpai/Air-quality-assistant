import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'

export function requestLog(req, res, next) {
  const start = performance.now()
  const id = randomUUID()
  res.set('X-Request-Id', id)
  res.once('finish', () => {
    if (req.path === '/api/v1/health' && res.statusCode === 200) return
    const entry = {
      event: 'api_request',
      id,
      method: req.method,
      route: req.route?.path ?? 'unmatched',
      status: res.statusCode,
      error: res.locals.errorCode,
      durationMs: Math.round(performance.now() - start),
    }
    const log =
      res.statusCode >= 500
        ? console.error
        : res.statusCode === 429
          ? console.warn
          : console.info
    log(JSON.stringify(entry))
  })
  next()
}
