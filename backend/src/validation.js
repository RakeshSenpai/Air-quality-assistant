import { z } from 'zod'
import { cityName, locationConfirmation } from './assistantTools.js'
import { AppError } from './errors.js'
import { profiles, actions } from '../../src/data/guidance.js'

const coordinate = (min, max) =>
  z
    .union([
      z.number(),
      z
        .string()
        .trim()
        .regex(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/)
        .transform(Number),
    ])
    .pipe(z.number().min(min).max(max))
export const coordinates = z.object({
  latitude: coordinate(-90, 90),
  longitude: coordinate(-180, 180),
})
export const search = z.object({ q: z.string().trim().min(2).max(120) })
const line = z.string().trim().min(1)
const context = coordinates.extend({
  location: line.max(160).optional(),
  profile: z.enum(profiles.map(({ id }) => id)).default('individual'),
  language: line.max(40).optional(),
  preferences: line.max(400).optional(),
})
export const planner = context
export const chat = context.extend({
  message: line.max(500),
  confirmation: locationConfirmation.optional(),
  referenceLocation: cityName.optional(),
  history: z
    .array(
      z.object({ role: z.enum(['user', 'assistant']), text: line.max(1600) }),
    )
    .max(8)
    .default([]),
})
export const recommendations = coordinates.extend({
  selected: z
    .array(z.enum(actions.map(({ id }) => id)))
    .max(actions.length)
    .default([]),
})

export function validate(schema, field) {
  return (req, res, next) => {
    const result = schema.safeParse(req[field])
    if (!result.success) {
      const fields = [
        ...new Set(
          result.error.issues.map(({ path }) => path.join('.') || field),
        ),
      ]
      return next(
        new AppError(
          400,
          'INVALID_INPUT',
          'Check these fields: ' + fields.join(', ') + '.',
        ),
      )
    }
    res.locals.input = result.data
    next()
  }
}
