import { createServer } from 'node:http'
import { createApp } from './app.js'
import { loadConfig } from './config.js'

try {
  const config = loadConfig()
  const host = config.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'
  const server = createServer(
    { headersTimeout: 10000, requestTimeout: 15000, keepAliveTimeout: 5000 },
    createApp(config),
  )
  server.on('error', (error) => {
    console.error('API listener failed: ' + error.message)
    process.exitCode = 1
  })
  server.once('listening', () => {
    console.log(
      `Urban Air Quality API listening on ${host}:${config.PORT} (${config.NODE_ENV})`,
    )
  })
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      const timeout = setTimeout(() => server.closeAllConnections(), 5000)
      timeout.unref()
      server.close(() => clearTimeout(timeout))
    })
  }
  server.listen(config.PORT, host)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
