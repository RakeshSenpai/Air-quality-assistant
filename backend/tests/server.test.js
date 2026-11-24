import { execFile } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const run = promisify(execFile)
const entry = fileURLToPath(new URL('../src/server.js', import.meta.url))

it('reports EADDRINUSE on startup without a success log or null address error', async () => {
  const occupied = createServer()
  occupied.listen(0, '0.0.0.0')
  await once(occupied, 'listening')
  const { port } = occupied.address()
  try {
    await expect(
      run(process.execPath, [entry], {
        timeout: 3000,
        env: {
          ...process.env,
          NODE_ENV: 'production',
          PORT: String(port),
          FRONTEND_ORIGIN: 'https://urban-air-quality-assistant-pi.vercel.app',
          TRUST_PROXY_HOPS: '1',
          GROQ_API_KEY: '',
        },
      }),
    ).rejects.toMatchObject({
      code: 1,
      stdout: '',
      stderr: expect.stringContaining('API listener failed: listen EADDRINUSE'),
    })
  } finally {
    await new Promise((resolve) => occupied.close(resolve))
  }
})
