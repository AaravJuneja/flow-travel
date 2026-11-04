import { z } from 'zod'

const tripId = z.string().uuid()
const emailAddress = z.string().trim().min(5).max(254).refine((value) => {
  const separator = value.indexOf('@')
  return separator > 0 && separator === value.lastIndexOf('@') && value.slice(separator + 2).includes('.')
}, 'Enter an email address in the form name@example.com.')

export const registerAccountSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: emailAddress,
})

export const signInSchema = z.object({
  email: emailAddress,
})

export const createTripSchema = z.object({
  originCode: z.string().length(3),
  destinationCode: z.string().length(3),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  departureTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  travelers: z.number().int().min(1).max(8),
})

export const tripIdSchema = z.object({ tripId })

export const selectRouteSchema = z.object({
  tripId,
  optionId: z.string().uuid(),
})

export const updatePlanSchema = z.object({
  tripId,
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  departureTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  travelers: z.number().int().min(1).max(8),
  notes: z.array(z.object({
    segmentId: z.string().uuid(),
    note: z.string().trim().max(240),
  })).max(12),
})

export const addDelaySchema = z.object({
  tripId,
  delayMinutes: z.number().int().min(1).max(1440),
  message: z.string().trim().min(3).max(240),
})
