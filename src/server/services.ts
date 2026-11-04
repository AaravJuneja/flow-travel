import {
  and,
  asc,
  desc,
  eq,
} from 'drizzle-orm'
import {
  deleteCookie,
  getCookie,
  getRequestProtocol,
  setCookie,
} from '@tanstack/react-start/server'
import { getDatabase } from './db'
import {
  itinerarySegments,
  journeyEvents,
  paymentRecords,
  routeOptions,
  sessions,
  trips,
  users,
  walletItems,
} from './schema'
import {
  formatClockTime,
  getLocationName,
  getRouteEstimates,
} from './route-catalog'
import type {
  addDelaySchema,
  createTripSchema,
  registerAccountSchema,
  selectRouteSchema,
  signInSchema,
  updatePlanSchema,
} from './validation'
import type { z } from 'zod'

const SESSION_COOKIE = 'flow_session'
const SESSION_DAYS = 30

type RegisterInput = z.infer<typeof registerAccountSchema>
type SignInInput = z.infer<typeof signInSchema>
type CreateTripInput = z.infer<typeof createTripSchema>
type SelectRouteInput = z.infer<typeof selectRouteSchema>
type UpdatePlanInput = z.infer<typeof updatePlanSchema>
type AddDelayInput = z.infer<typeof addDelaySchema>

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

async function hashSessionToken(token: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function createSession(userId: string) {
  const db = getDatabase()
  const token = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)))
  const now = Date.now()
  const expiresAt = now + SESSION_DAYS * 24 * 60 * 60 * 1000

  await db.insert(sessions).values({
    tokenHash: await hashSessionToken(token),
    userId,
    expiresAt,
    createdAt: now,
  })

  setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: getRequestProtocol() === 'https',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  })
}

async function authenticatedUser() {
  const token = getCookie(SESSION_COOKIE)
  if (!token) return null

  const db = getDatabase()
  const [session] = await db
    .select({ userId: sessions.userId, expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(eq(sessions.tokenHash, await hashSessionToken(token)))
    .limit(1)

  if (!session) return null
  if (session.expiresAt <= Date.now()) {
    await db.delete(sessions).where(eq(sessions.tokenHash, await hashSessionToken(token)))
    return null
  }

  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1)

  return user ?? null
}

async function requireUser() {
  const user = await authenticatedUser()
  if (!user) throw new Error('Sign in to continue.')
  return user
}

function validateDepartureDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error('Choose a valid departure date.')
  }
  if (date < new Date().toISOString().slice(0, 10)) {
    throw new Error('Choose today or a future date.')
  }
}

async function getOwnedTrip(userId: string, tripId: string) {
  const db = getDatabase()
  const [trip] = await db
    .select()
    .from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.userId, userId)))
    .limit(1)
  if (!trip) throw new Error('Trip not found.')
  return trip
}

export async function registerAccount(input: RegisterInput) {
  const db = getDatabase()
  const email = input.email.toLowerCase()
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (existing) throw new Error('An account already uses this email address.')

  const userId = crypto.randomUUID()
  const now = Date.now()
  await db.insert(users).values({
    id: userId,
    name: input.name.trim(),
    email,
    createdAt: now,
  })
  await createSession(userId)
  return { user: { id: userId, name: input.name.trim(), email } }
}

export async function signIn(input: SignInInput) {
  const db = getDatabase()
  const email = input.email.toLowerCase()
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)

  if (!user) throw new Error('No account uses this email address yet.')

  await createSession(user.id)
  return { user: { id: user.id, name: user.name, email: user.email } }
}

export async function signOut() {
  const token = getCookie(SESSION_COOKIE)
  if (token) {
    await getDatabase().delete(sessions).where(eq(sessions.tokenHash, await hashSessionToken(token)))
  }
  deleteCookie(SESSION_COOKIE, { path: '/', secure: getRequestProtocol() === 'https', sameSite: 'lax' })
  return { signedOut: true }
}

export async function getCurrentUser() {
  return authenticatedUser()
}

export async function getHomeData() {
  const user = await requireUser()
  const db = getDatabase()
  const recentTrips = await db
    .select()
    .from(trips)
    .where(eq(trips.userId, user.id))
    .orderBy(desc(trips.updatedAt))
    .limit(6)

  return { user, trips: recentTrips }
}

export async function createTrip(input: CreateTripInput) {
  const user = await requireUser()
  validateDepartureDate(input.departureDate)

  const originName = getLocationName(input.originCode)
  const destinationName = getLocationName(input.destinationCode)
  const estimates = getRouteEstimates(input.originCode, input.destinationCode)
  if (!originName || !destinationName || estimates.length === 0) {
    throw new Error('Choose a route from the available city pairs.')
  }

  const db = getDatabase()
  const tripId = crypto.randomUUID()
  const now = Date.now()
  const optionRows = estimates.map((estimate) => ({
    id: crypto.randomUUID(),
    tripId,
    title: estimate.title,
    mode: estimate.mode,
    durationMinutes: estimate.durationMinutes,
    priceCents: estimate.priceCents,
    currency: estimate.currency,
    changes: estimate.changes,
    summary: estimate.summary,
    createdAt: now,
  }))

  await db.transaction(async (tx) => {
    await tx.insert(trips).values({
      id: tripId,
      userId: user.id,
      originCode: input.originCode,
      originName,
      destinationCode: input.destinationCode,
      destinationName,
      departureDate: input.departureDate,
      departureTime: input.departureTime,
      travelers: input.travelers,
      status: 'planning',
      createdAt: now,
      updatedAt: now,
    })
    await tx.insert(routeOptions).values(optionRows)
  })

  return { tripId }
}

export async function getTripOptions(tripId: string) {
  const user = await requireUser()
  const trip = await getOwnedTrip(user.id, tripId)
  const options = await getDatabase()
    .select()
    .from(routeOptions)
    .where(eq(routeOptions.tripId, tripId))
    .orderBy(asc(routeOptions.durationMinutes))

  return { trip, options }
}

export async function chooseTripOption(input: SelectRouteInput) {
  const user = await requireUser()
  const db = getDatabase()
  const trip = await getOwnedTrip(user.id, input.tripId)
  if (trip.status === 'active' || trip.status === 'delayed' || trip.status === 'completed') {
    throw new Error('This trip has already started.')
  }

  const [option] = await db
    .select()
    .from(routeOptions)
    .where(and(eq(routeOptions.id, input.optionId), eq(routeOptions.tripId, trip.id)))
    .limit(1)
  if (!option) throw new Error('That route option is no longer available.')

  const estimate = getRouteEstimates(trip.originCode, trip.destinationCode)
    .find((item) => item.title === option.title)
  if (!estimate) throw new Error('The route details could not be loaded.')

  const [startHour, startMinute] = trip.departureTime.split(':').map(Number)
  let time = startHour! * 60 + startMinute!
  const segments = estimate.legs.map((leg, position) => {
    const departureTime = formatClockTime(time)
    time += leg.durationMinutes
    const arrivalTime = formatClockTime(time)
    return {
      id: crypto.randomUUID(),
      tripId: trip.id,
      routeOptionId: option.id,
      position,
      mode: leg.mode,
      fromName: leg.fromName,
      toName: leg.toName,
      departureTime,
      arrivalTime,
      status: position === 0 && trip.status === 'active' ? 'current' : 'upcoming',
      note: '',
    }
  })
  const now = Date.now()
  const totalCents = option.priceCents * trip.travelers

  await db.transaction(async (tx) => {
    await tx.delete(itinerarySegments).where(eq(itinerarySegments.tripId, trip.id))
    await tx.insert(itinerarySegments).values(segments)
    await tx.update(trips).set({
      selectedOptionId: option.id,
      status: 'planned',
      updatedAt: now,
    }).where(eq(trips.id, trip.id))

    const [walletItem] = await tx
      .select({ id: walletItems.id })
      .from(walletItems)
      .where(eq(walletItems.tripId, trip.id))
      .limit(1)
    if (!walletItem) {
      const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()
      await tx.insert(walletItems).values({
        id: crypto.randomUUID(),
        userId: user.id,
        tripId: trip.id,
        referenceCode: `FLOW-${suffix}`,
        status: 'plan_saved',
        createdAt: now,
      })
    }

    const [payment] = await tx
      .select({ id: paymentRecords.id })
      .from(paymentRecords)
      .where(eq(paymentRecords.tripId, trip.id))
      .limit(1)
    if (!payment) {
      await tx.insert(paymentRecords).values({
        id: crypto.randomUUID(),
        userId: user.id,
        tripId: trip.id,
        providerReference: null,
        amountCents: totalCents,
        currency: option.currency,
        status: 'not_started',
        createdAt: now,
      })
    }
  })

  return { tripId: trip.id }
}

export async function getTripDetails(tripId: string) {
  const user = await requireUser()
  const db = getDatabase()
  const trip = await getOwnedTrip(user.id, tripId)
  const options = await db.select().from(routeOptions).where(eq(routeOptions.tripId, tripId))
  const segments = await db
    .select()
    .from(itinerarySegments)
    .where(eq(itinerarySegments.tripId, tripId))
    .orderBy(asc(itinerarySegments.position))
  const events = await db
    .select()
    .from(journeyEvents)
    .where(eq(journeyEvents.tripId, tripId))
    .orderBy(desc(journeyEvents.createdAt))
    .limit(20)
  const [walletItem] = await db.select().from(walletItems).where(eq(walletItems.tripId, tripId)).limit(1)
  const [payment] = await db.select().from(paymentRecords).where(eq(paymentRecords.tripId, tripId)).limit(1)

  return {
    trip,
    options,
    selectedOption: options.find((option) => option.id === trip.selectedOptionId) ?? null,
    segments,
    events,
    walletItem: walletItem ?? null,
    payment: payment ?? null,
  }
}

export async function updateTripPlan(input: UpdatePlanInput) {
  const user = await requireUser()
  const db = getDatabase()
  const trip = await getOwnedTrip(user.id, input.tripId)
  if (trip.status !== 'planned' && trip.status !== 'planning') {
    throw new Error('A trip can only be edited before it starts.')
  }
  validateDepartureDate(input.departureDate)

  const segments = await db
    .select({ id: itinerarySegments.id })
    .from(itinerarySegments)
    .where(eq(itinerarySegments.tripId, trip.id))
  const allowedSegmentIds = new Set(segments.map((segment) => segment.id))
  if (input.notes.some((item) => !allowedSegmentIds.has(item.segmentId))) {
    throw new Error('One or more itinerary steps do not belong to this trip.')
  }

  const [hour, minute] = input.departureTime.split(':').map(Number)
  let time = hour! * 60 + minute!
  const currentSegments = await db
    .select()
    .from(itinerarySegments)
    .where(eq(itinerarySegments.tripId, trip.id))
    .orderBy(asc(itinerarySegments.position))

  await db.transaction(async (tx) => {
    await tx.update(trips).set({
      departureDate: input.departureDate,
      departureTime: input.departureTime,
      travelers: input.travelers,
      updatedAt: Date.now(),
    }).where(eq(trips.id, trip.id))

    for (const segment of currentSegments) {
      const departureTime = formatClockTime(time)
      const estimate = segment.arrivalTime.split(':').map(Number)
      const duration = ((estimate[0]! * 60 + estimate[1]!) -
        (Number(segment.departureTime.slice(0, 2)) * 60 + Number(segment.departureTime.slice(3, 5))) + 1440) % 1440
      time += duration
      const arrivalTime = formatClockTime(time)
      const note = input.notes.find((item) => item.segmentId === segment.id)?.note ?? segment.note
      await tx.update(itinerarySegments).set({ departureTime, arrivalTime, note }).where(eq(itinerarySegments.id, segment.id))
    }

    if (trip.selectedOptionId) {
      const [option] = await tx
        .select({ priceCents: routeOptions.priceCents, currency: routeOptions.currency })
        .from(routeOptions)
        .where(eq(routeOptions.id, trip.selectedOptionId))
        .limit(1)
      if (option) {
        await tx.update(paymentRecords).set({
          amountCents: option.priceCents * input.travelers,
          currency: option.currency,
        }).where(eq(paymentRecords.tripId, trip.id))
      }
    }
  })

  return { tripId: trip.id }
}

export async function startJourney(tripId: string) {
  const user = await requireUser()
  const db = getDatabase()
  const trip = await getOwnedTrip(user.id, tripId)
  if (trip.status !== 'planned' || !trip.selectedOptionId) {
    throw new Error('Choose a route before starting this journey.')
  }

  const now = Date.now()
  const [firstSegment] = await db
    .select()
    .from(itinerarySegments)
    .where(eq(itinerarySegments.tripId, trip.id))
    .orderBy(asc(itinerarySegments.position))
    .limit(1)

  await db.transaction(async (tx) => {
    await tx.update(trips).set({ status: 'active', updatedAt: now }).where(eq(trips.id, trip.id))
    if (firstSegment) {
      await tx.update(itinerarySegments).set({ status: 'current' }).where(eq(itinerarySegments.id, firstSegment.id))
    }
    await tx.insert(journeyEvents).values({
      id: crypto.randomUUID(),
      userId: user.id,
      tripId: trip.id,
      type: 'started',
      message: 'Journey started.',
      delayMinutes: null,
      createdAt: now,
    })
  })
  return { tripId: trip.id }
}

export async function completeNextLeg(tripId: string) {
  const user = await requireUser()
  const db = getDatabase()
  const trip = await getOwnedTrip(user.id, tripId)
  if (trip.status !== 'active') throw new Error('Start the journey before updating its progress.')

  const segments = await db
    .select()
    .from(itinerarySegments)
    .where(eq(itinerarySegments.tripId, trip.id))
    .orderBy(asc(itinerarySegments.position))
  const currentIndex = segments.findIndex((segment) => segment.status === 'current')
  if (currentIndex < 0) throw new Error('There is no active step to complete.')

  const completed = segments[currentIndex]!
  const next = segments[currentIndex + 1]
  const now = Date.now()
  await db.transaction(async (tx) => {
    await tx.update(itinerarySegments).set({ status: 'completed' }).where(eq(itinerarySegments.id, completed.id))
    if (next) {
      await tx.update(itinerarySegments).set({ status: 'current' }).where(eq(itinerarySegments.id, next.id))
    } else {
      await tx.update(trips).set({ status: 'completed', updatedAt: now }).where(eq(trips.id, trip.id))
    }
    await tx.insert(journeyEvents).values({
      id: crypto.randomUUID(),
      userId: user.id,
      tripId: trip.id,
      type: next ? 'step_completed' : 'completed',
      message: next ? `${completed.toName} reached.` : 'Journey completed.',
      delayMinutes: null,
      createdAt: now,
    })
  })
  return { tripId: trip.id, completed: !next }
}

export async function addJourneyDelay(input: AddDelayInput) {
  const user = await requireUser()
  const db = getDatabase()
  const trip = await getOwnedTrip(user.id, input.tripId)
  if (trip.status !== 'active' && trip.status !== 'delayed') {
    throw new Error('Start the journey before logging a delay.')
  }

  const now = Date.now()
  await db.transaction(async (tx) => {
    await tx.update(trips).set({ status: 'delayed', updatedAt: now }).where(eq(trips.id, trip.id))
    await tx.insert(journeyEvents).values({
      id: crypto.randomUUID(),
      userId: user.id,
      tripId: trip.id,
      type: 'delay',
      message: input.message,
      delayMinutes: input.delayMinutes,
      createdAt: now,
    })
  })
  return { tripId: trip.id }
}

export async function resolveJourneyDelay(tripId: string) {
  const user = await requireUser()
  const db = getDatabase()
  const trip = await getOwnedTrip(user.id, tripId)
  if (trip.status !== 'delayed') throw new Error('This journey has no open delay to resolve.')

  const now = Date.now()
  await db.transaction(async (tx) => {
    await tx.update(trips).set({ status: 'active', updatedAt: now }).where(eq(trips.id, trip.id))
    await tx.insert(journeyEvents).values({
      id: crypto.randomUUID(),
      userId: user.id,
      tripId: trip.id,
      type: 'delay_resolved',
      message: 'Delay marked as resolved.',
      delayMinutes: null,
      createdAt: now,
    })
  })
  return { tripId: trip.id }
}

export async function getWalletData() {
  const user = await requireUser()
  const db = getDatabase()
  const rows = await db
    .select({ item: walletItems, trip: trips, option: routeOptions, payment: paymentRecords })
    .from(walletItems)
    .innerJoin(trips, eq(walletItems.tripId, trips.id))
    .leftJoin(routeOptions, eq(trips.selectedOptionId, routeOptions.id))
    .leftJoin(paymentRecords, eq(paymentRecords.tripId, trips.id))
    .where(eq(walletItems.userId, user.id))
    .orderBy(desc(walletItems.createdAt))

  return { user, items: rows }
}
