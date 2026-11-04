import { createServerFn } from '@tanstack/react-start'
import {
  addDelaySchema,
  createTripSchema,
  registerAccountSchema,
  selectRouteSchema,
  signInSchema,
  tripIdSchema,
  updatePlanSchema,
} from './validation'

export const registerAccount = createServerFn({ method: 'POST' })
  .validator(registerAccountSchema)
  .handler(async ({ data }) => {
    const service = await import('./services')
    return service.registerAccount(data)
  })

export const signIn = createServerFn({ method: 'POST' })
  .validator(signInSchema)
  .handler(async ({ data }) => {
    const service = await import('./services')
    return service.signIn(data)
  })

export const signOut = createServerFn({ method: 'POST' }).handler(async () => {
  const service = await import('./services')
  return service.signOut()
})

export const getCurrentUser = createServerFn({ method: 'GET' }).handler(async () => {
  const service = await import('./services')
  return service.getCurrentUser()
})

export const getHomeData = createServerFn({ method: 'GET' }).handler(async () => {
  const service = await import('./services')
  return service.getHomeData()
})

export const createTrip = createServerFn({ method: 'POST' })
  .validator(createTripSchema)
  .handler(async ({ data }) => {
    const service = await import('./services')
    return service.createTrip(data)
  })

export const getTripOptions = createServerFn({ method: 'GET' })
  .validator(tripIdSchema)
  .handler(async ({ data }) => {
    const service = await import('./services')
    return service.getTripOptions(data.tripId)
  })

export const chooseTripOption = createServerFn({ method: 'POST' })
  .validator(selectRouteSchema)
  .handler(async ({ data }) => {
    const service = await import('./services')
    return service.chooseTripOption(data)
  })

export const getTripDetails = createServerFn({ method: 'GET' })
  .validator(tripIdSchema)
  .handler(async ({ data }) => {
    const service = await import('./services')
    return service.getTripDetails(data.tripId)
  })

export const updateTripPlan = createServerFn({ method: 'POST' })
  .validator(updatePlanSchema)
  .handler(async ({ data }) => {
    const service = await import('./services')
    return service.updateTripPlan(data)
  })

export const startJourney = createServerFn({ method: 'POST' })
  .validator(tripIdSchema)
  .handler(async ({ data }) => {
    const service = await import('./services')
    return service.startJourney(data.tripId)
  })

export const completeNextLeg = createServerFn({ method: 'POST' })
  .validator(tripIdSchema)
  .handler(async ({ data }) => {
    const service = await import('./services')
    return service.completeNextLeg(data.tripId)
  })

export const addJourneyDelay = createServerFn({ method: 'POST' })
  .validator(addDelaySchema)
  .handler(async ({ data }) => {
    const service = await import('./services')
    return service.addJourneyDelay(data)
  })

export const resolveJourneyDelay = createServerFn({ method: 'POST' })
  .validator(tripIdSchema)
  .handler(async ({ data }) => {
    const service = await import('./services')
    return service.resolveJourneyDelay(data.tripId)
  })

export const getWalletData = createServerFn({ method: 'GET' }).handler(async () => {
  const service = await import('./services')
  return service.getWalletData()
})
