export class AppError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function invalidUpstream() {
  return new AppError(
    502,
    'INVALID_UPSTREAM',
    'The provider returned invalid data.',
  )
}

export function replyError(res, error) {
  res.locals.errorCode = error.code
  if (error.retryAfter) res.set('Retry-After', String(error.retryAfter))
  return res.status(error.status).json({
    success: false,
    error: { code: error.code, message: error.message },
  })
}

export function handleError(error, _req, res, next) {
  if (res.headersSent) return next(error)
  if (error instanceof AppError) return replyError(res, error)
  if (error.type === 'entity.parse.failed')
    return replyError(
      res,
      new AppError(400, 'INVALID_JSON', 'Provide a valid JSON body.'),
    )
  if (error.type === 'entity.too.large')
    return replyError(
      res,
      new AppError(413, 'BODY_TOO_LARGE', 'The request body is too large.'),
    )
  console.error('Unexpected API error.')
  return replyError(
    res,
    new AppError(
      500,
      'INTERNAL_ERROR',
      'The server could not complete the request.',
    ),
  )
}
