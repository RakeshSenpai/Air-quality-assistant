import { createApp } from './app.js'
import { loadConfig } from './config.js'

try {
  const config = loadConfig()
  const server = createApp(config).listen(
    config.PORT,
    config.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1',
    () => {
      const { address, port } = server.address()
      console.log(
        `Urban Air Quality API listening on ${address}:${port} (${config.NODE_ENV})`,
      )
    },
  )
  server.headersTimeout = 10000
  server.requestTimeout = 15000
  server.keepAliveTimeout = 5000
  server.on('error', (error) => {
    console.error('API listener failed: ' + (error.code ?? 'UNKNOWN'))
    process.exitCode = 1
  })
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      const timeout = setTimeout(() => server.closeAllConnections(), 5000)
      timeout.unref()
      server.close(() => clearTimeout(timeout))
    })
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
