const base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
const protectedPaths = ['/assistant/chat', '/planner/generate']
let session
let pendingSession

async function send(path, { signal, body, token }) {
  const response = await fetch(`${base}/api/v1${path}`, {
    signal,
    ...(body && {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token && { 'X-AI-Session': token }) },
      body: JSON.stringify(body),
    }),
  }).catch((error) => {
    if (error instanceof TypeError) throw new Error('Could not connect to the backend. Try again.')
    throw error
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.success) {
    const retryAfter = Number(response.headers.get('Retry-After'))
    const wait = response.status === 429 && retryAfter > 0 && retryAfter <= 120
      ? ` Try again in about ${Math.ceil(retryAfter)} seconds.` : ''
    const message = payload?.error?.message ?? 'The API is unavailable. Try again.'
    const error = new Error(/seconds/.test(message) ? message : message + wait)
    error.code = payload?.error?.code
    error.status = response.status
    throw error
  }
  return payload.data
}

async function getSession() {
  if (session) return session
  pendingSession ??= send('/assistant/session', { body: {}, signal: AbortSignal.timeout(75000) })
    .then(({ token }) => { session = token; return token })
    .finally(() => { pendingSession = null })
  return pendingSession
}

export async function requestApi(path, { signal, body } = {}) {
  const needsSession = Boolean(base && import.meta.env.PROD && protectedPaths.includes(path))
  // Render Free can take roughly a minute to wake. The server still bounds the work after admission.
  const timeout = AbortSignal.timeout(base && import.meta.env.PROD ? 95000 : body ? 36000 : 12000)
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout
  if (!needsSession) return send(path, { signal: requestSignal, body })

  const token = await getSession()
  try {
    return await send(path, { signal: requestSignal, body, token })
  } catch (error) {
    // This response is returned before Groq can run. Other errors require a user retry.
    if (error.code !== 'AI_SESSION_REQUIRED') throw error
    if (session === token) session = null
    requestSignal.throwIfAborted()
    const refreshed = await getSession()
    return send(path, { signal: requestSignal, body, token: refreshed })
  }
}

export function coordinatesOf(city) {
  const [latitude, longitude] = city.coordinates
  return { latitude, longitude }
}

export function cityRequest(path, city, signal) {
  return requestApi(`${path}?${new URLSearchParams(coordinatesOf(city))}`, { signal })
}
