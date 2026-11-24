import { Router } from 'express'
import {
  confirmationFromReply,
  createAssistantTools,
  isLocationConfirmation,
} from './assistantTools.js'
import { actions, dailyPlan, profiles, tips } from '../../src/data/guidance.js'
import {
  chat,
  coordinates,
  planner,
  recommendations,
  search,
  validate,
} from './validation.js'

const send = (res, data) => res.json({ success: true, data })
const point = ({ latitude, longitude }) => ({ latitude, longitude })
const omitCoordinates = (data) => {
  if (!data) return null
  return Object.fromEntries(
    Object.entries(data).filter(([key]) => key !== 'coordinates'),
  )
}
const aiInput = ({ location, language, preferences, history, message }) => ({
  location,
  language,
  preferences,
  history,
  message,
})

export function createRoutes({
  providers,
  groq,
  aiLimit,
  issueAiSession,
  authorizeAi,
}) {
  const router = Router()
  const assistantTools = createAssistantTools(providers)
  router.get('/health', (_req, res) =>
    send(res, { status: 'ok', service: 'urban-air-quality-assistant' }),
  )
  router.get(
    '/locations/search',
    validate(search, 'query'),
    async (_req, res) =>
      send(res, await providers.locations(res.locals.input.q)),
  )
  router.get(
    '/air-quality',
    validate(coordinates, 'query'),
    async (_req, res) =>
      send(res, await providers.airQuality(res.locals.input)),
  )
  router.get('/weather', validate(coordinates, 'query'), async (_req, res) =>
    send(res, await providers.weather(res.locals.input)),
  )

  async function context(input) {
    const location = point(input)
    const [air, weather] = await Promise.allSettled([
      providers.airQuality(location),
      providers.weather(location),
    ])
    const airQuality =
      air.status === 'fulfilled' ? omitCoordinates(air.value) : null
    const forecast =
      weather.status === 'fulfilled' ? omitCoordinates(weather.value) : null
    return {
      airQuality,
      weather: forecast,
      household: profiles.find(({ id }) => id === input.profile),
    }
  }

  router.post('/assistant/session', issueAiSession)

  router.post(
    '/assistant/chat',
    aiLimit,
    authorizeAi,
    validate(chat, 'body'),
    async (_req, res) => {
      const input = res.locals.input
      if (isLocationConfirmation(input.message)) {
        const [question, suggestion] = input.history.slice(-2)
        const previous =
          question?.role === 'user' && suggestion?.role === 'assistant'
            ? confirmationFromReply(suggestion.text, question.text)
            : null
        const confirmation = input.confirmation ?? previous
        if (confirmation)
          return send(res, await assistantTools.confirm(confirmation))
      }
      groq.ensureAvailable()
      const environmentalContext = await context(input)
      send(
        res,
        await groq.chat(
          {
            ...aiInput(input),
            ...environmentalContext,
            referenceLocation: input.referenceLocation,
          },
          assistantTools,
        ),
      )
    },
  )

  router.post(
    '/planner/generate',
    aiLimit,
    authorizeAi,
    validate(planner, 'body'),
    async (_req, res) => {
      groq.ensureAvailable()
      const input = res.locals.input
      const environmentalContext = await context(input)
      const { airQuality, household } = environmentalContext
      const baseline = dailyPlan(
        airQuality ?? { hours: [], standard: 'us' },
        household,
      )
      const plan = await groq.planner({
        ...aiInput(input),
        ...environmentalContext,
        baseline,
      })
      send(res, {
        standard: 'us',
        periods: baseline.map((period) => {
          const advice = plan[period.title.toLowerCase()]
          return {
            ...period,
            tips: [
              ...period.tips,
              advice.summary,
              ...advice.activities,
              ...advice.precautions,
            ],
          }
        }),
      })
    },
  )

  router.post(
    '/recommendations/indoor-air',
    validate(recommendations, 'body'),
    async (_req, res) => {
      const { airQuality, weather } = await context({
        ...res.locals.input,
        profile: 'individual',
      })
      const limited =
        airQuality?.aqi == null ||
        airQuality.aqi > 100 ||
        weather?.current?.precipitation > 0
      const note = limited
        ? 'Check outdoor AQI and weather before opening windows. Use cooking exhaust and reduce indoor smoke sources.'
        : 'Check outdoor conditions again before choosing a ventilation window. Use local cooking exhaust when available.'
      send(res, { tips, note })
    },
  )
  router.post(
    '/recommendations/sustainability',
    validate(recommendations, 'body'),
    (_req, res) => {
      const selected = new Set(res.locals.input.selected)
      const next = actions.find(({ id }) => !selected.has(id))
      send(res, {
        actions,
        note: next
          ? next.benefit
          : 'Repeat the actions that fit your routine and review how often they are practical.',
      })
    },
  )
  return router
}
