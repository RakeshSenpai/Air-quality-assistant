import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const origin = z.url().refine((value) => {
  const url = new URL(value)
  return ['http:', 'https:'].includes(url.protocol) && url.origin === value
})
const schema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5001),
  FRONTEND_ORIGIN: z
    .string()
    .default(
      'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173',
    )
    .transform((value) => value.split(',').map((item) => item.trim()))
    .pipe(z.array(origin).min(1)),
  TRUST_PROXY_HOPS: z.enum(['0', '1']).default('0').transform(Number),
  AI_GLOBAL_PER_MINUTE: z.coerce.number().int().min(1).max(30).default(6),
  AI_GLOBAL_PER_DAY: z.coerce.number().int().min(1).max(1000).default(80),
  AI_PROVIDER: z.literal('groq').default('groq'),
  GROQ_API_KEY: z.string().trim().optional(),
  GROQ_MODEL: z
    .string()
    .trim()
    .regex(/^[\w.-]+(?:\/[\w.-]+)*$/)
    .default('openai/gpt-oss-120b'),
  CACHE_TTL_MS: z.coerce.number().int().min(1000).max(3600000).default(120000),
})

export function loadConfig() {
  // Render supplies its own runtime environment. Never read a local file there.
  if (process.env.RENDER === 'true') process.env.NODE_ENV = 'production'
  if (process.env.NODE_ENV !== 'production') {
    dotenv.config({
      path: fileURLToPath(new URL('../.env', import.meta.url)),
      override: false,
      quiet: true,
    })
  }
  if (process.env.NODE_ENV === 'production' && !process.env.PORT) {
    throw new Error(
      'PORT is required in production. Render supplies it automatically.',
    )
  }
  const result = schema.safeParse(process.env)
  if (!result.success)
    throw new Error(
      'Invalid backend configuration: ' +
        result.error.issues.map((issue) => issue.path.join('.')).join(', '),
    )
  if (result.data.NODE_ENV === 'production') {
    if (
      !process.env.FRONTEND_ORIGIN ||
      result.data.FRONTEND_ORIGIN.some(
        (origin) => !origin.startsWith('https://'),
      )
    )
      throw new Error(
        'FRONTEND_ORIGIN must list explicit HTTPS origins in production.',
      )
    if (result.data.TRUST_PROXY_HOPS !== 1)
      throw new Error(
        'Set TRUST_PROXY_HOPS=1 for the single Render ingress hop.',
      )
  }
  return result.data
}
