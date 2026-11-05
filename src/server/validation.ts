import { z } from 'zod'

const tripId = z.string().uuid()
const password = z.string().min(1, 'Enter your password.')
const emailAddress = z.string().trim().min(5).max(254).refine((value) => {
  const separator = value.indexOf('@')
  return separator > 0 && separator === value.lastIndexOf('@') && value.slice(separator + 2).includes('.')
}, 'Enter an email address in the form name@example.com.')

export const registerAccountSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: emailAddress,
  password,
})

export const signInSchema = z.object({
  email: emailAddress,
  password,
})

export const setPasswordSchema = z.object({ password })
export const updateProfileSchema = z.object({ name: z.string().trim().min(1, 'Enter your name.').max(80) })

export const tripLocationSchema = z.object({
  label: z.string().trim().min(1).max(180),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
  details: z.string().trim().max(160).optional(),
  source: z.enum(['search', 'pin', 'device', 'manual']),
}).refine((value) => (value.latitude === undefined) === (value.longitude === undefined), 'Both map coordinates are required.')
  .refine((value) => value.source === 'manual' || value.latitude !== undefined, 'Choose a point on the map.')

export const createTripSchema = z.object({
  originCode: z.string().regex(/^(IN-\d+|[A-Z]{3})$/),
  destinationCode: z.string().regex(/^(IN-\d+|[A-Z]{3})$/),
  pickupLocation: tripLocationSchema.nullish(),
  dropoffLocation: tripLocationSchema.nullish(),
  prompt: z.string().trim().max(2000).default(''),
  tripDays: z.number().int().min(1).max(14).default(2),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  departureTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  travelers: z.number().int().min(1).max(8),
})

export const tripIdSchema = z.object({ tripId })

export const checkoutSchema = z.object({ tripId })

export const confirmCheckoutSchema = z.object({
  tripId,
  sessionId: z.string().trim().min(1).max(255),
})

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
