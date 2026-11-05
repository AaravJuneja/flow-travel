import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  addDelaySchema,
  checkoutSchema,
  confirmCheckoutSchema,
  createTripSchema,
  registerAccountSchema,
  selectRouteSchema,
  signInSchema,
  setPasswordSchema,
  tripIdSchema,
  updatePlanSchema,
  updateProfileSchema,
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

export const setAccountPassword = createServerFn({ method: 'POST' })
  .validator(setPasswordSchema)
  .handler(async ({ data }) => {
    const service = await import('./services')
    return service.setAccountPassword(data.password)
  })

export const getCurrentUser = createServerFn({ method: 'GET' }).handler(async () => {
  const service = await import('./services')
  return service.getCurrentUser()
})

export const updateProfile = createServerFn({ method: 'POST' })
  .validator(updateProfileSchema)
  .handler(async ({ data }) => {
    const service = await import('./services')
    return service.updateProfile(data.name)
  })

export const deleteTrip = createServerFn({ method: 'POST' })
  .validator(tripIdSchema)
  .handler(async ({ data }) => {
    const service = await import('./services')
    return service.deleteTrip(data.tripId)
  })

export const getHomeData = createServerFn({ method: 'GET' }).handler(async () => {
  const service = await import('./services')
  return service.getHomeData()
})

export const searchIndianCities = createServerFn({ method: 'GET' })
  .validator(z.object({ query: z.string().trim().min(2).max(100) }))
  .handler(async ({ data }) => {
    const { searchCities } = await import('./cities')
    return searchCities(data.query)
  })

export const getCityPhoto = createServerFn({ method: 'GET' })
  .validator(z.object({ code: z.string().regex(/^IN-\d+$/) }))
  .handler(async ({ data }) => {
    const { cityPhoto } = await import('./cities')
    return cityPhoto(data.code)
  })

export const searchNearbyPlaces = createServerFn({ method: 'POST' })
  .validator(z.object({ cityCode: z.string().regex(/^(IN-\d+|[A-Z]{3})$/), query: z.string().trim().min(3).max(180) }))
  .handler(async ({ data }) => {
    const service = await import('./services')
    if (!(await service.getCurrentUser())) throw new Error('Sign in to search for an address.')
    const { findCity } = await import('./cities')
    const city = findCity(data.cityCode)
    if (!city) throw new Error('Choose a city first.')
    const { searchPlaces } = await import('./places')
    return searchPlaces(city, data.query)
  })

export const describeNearbyPlace = createServerFn({ method: 'POST' })
  .validator(z.object({ cityCode: z.string().regex(/^(IN-\d+|[A-Z]{3})$/), latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180) }))
  .handler(async ({ data }) => {
    const service = await import('./services')
    if (!(await service.getCurrentUser())) throw new Error('Sign in to choose a location.')
    const { findCity } = await import('./cities')
    const city = findCity(data.cityCode)
    if (!city) throw new Error('Choose a city first.')
    const { describePlace } = await import('./places')
    return describePlace(city, data)
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

export const createCheckoutSession = createServerFn({ method: 'POST' })
  .validator(checkoutSchema)
  .handler(async ({ data }) => {
    const service = await import('./services')
    return service.createCheckoutSession(data.tripId)
  })

export const confirmCheckoutSession = createServerFn({ method: 'POST' })
  .validator(confirmCheckoutSchema)
  .handler(async ({ data }) => {
    const service = await import('./services')
    return service.confirmCheckoutSession(data)
  })
