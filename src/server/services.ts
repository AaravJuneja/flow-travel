import {
  and,
  asc,
  desc,
  eq,
  ne,
  sql,
} from 'drizzle-orm'
import {
  deleteCookie,
  getCookie,
  getRequestProtocol,
  getRequestUrl,
  setCookie,
} from '@tanstack/react-start/server'
import { env as workerEnv } from 'cloudflare:workers'
import { getDatabase } from './db'
import { hashPassword, verifyPassword } from './passwords'
import {
  itinerarySegments,
  journeyEvents,
  paymentRecords,
  routeOptions,
  sessions,
  trips,
  users,
  walletItems,
  aiUsage,
  routeResearch,
} from './schema'
import {
  formatClockTime,
  getRouteEstimate,
} from './route-catalog'
import type { RouteEstimate } from './route-catalog'
import { findCity } from './cities'
import { generateVeloPlan, type AiRunner } from './velo'
import { getTravelContext, type TravelSource } from './travel-context'
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

function savedEstimate(option: { title: string; details?: string | null }, originCode: string, destinationCode: string): RouteEstimate | undefined {
  if (option.details) return JSON.parse(option.details) as RouteEstimate
  return getRouteEstimate(originCode, destinationCode, option.title)
}

function withRouteMetadata<T extends { title: string; details?: string | null }>(
  option: T,
  originCode: string,
  destinationCode: string,
) {
  const estimate = savedEstimate(option, originCode, destinationCode)
  return {
    ...option,
    priceBasis: estimate?.priceBasis ?? 'perTraveler',
    sourceLabel: estimate?.sourceLabel ?? 'Flow route catalog',
    sourceUrl: estimate?.sourceUrl || null,
    legs: estimate?.legs ?? [],
  }
}

function estimatedTotalCents(
  priceCents: number,
  travelers: number,
  priceBasis: 'perTraveler' | 'perVehicle',
) {
  return priceBasis === 'perVehicle' ? priceCents : priceCents * travelers
}

type RegisterInput = z.infer<typeof registerAccountSchema>
type SignInInput = z.infer<typeof signInSchema>
type CreateTripInput = z.infer<typeof createTripSchema>
type SelectRouteInput = z.infer<typeof selectRouteSchema>
type UpdatePlanInput = z.infer<typeof updatePlanSchema>
type AddDelayInput = z.infer<typeof addDelaySchema>
type ConfirmCheckoutInput = z.infer<typeof import('./validation').confirmCheckoutSchema>

type StripeBindings = { STRIPE_SECRET_KEY?: string }

type StripeCheckoutSession = {
  id: string
  url?: string | null
  mode: string
  status: string
  payment_status: string
  currency: string
  amount_total: number | null
  client_reference_id: string | null
  metadata: Record<string, string>
}

function getStripeTestSecret() {
  const secret = (workerEnv as unknown as StripeBindings).STRIPE_SECRET_KEY
  if (!secret?.startsWith('sk_test_')) {
    throw new Error('Stripe test mode is not configured for this environment.')
  }
  return secret
}

async function stripeRequest(path: string, secret: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${secret}`)
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`https://api.stripe.com/v1/${path}`, { ...init, headers })
    const result = await response.json() as StripeCheckoutSession & {
      error?: { code?: string }
    }
    if (response.ok) return result
    if (result.error?.code === 'idempotency_key_in_use' && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)))
      continue
    }
    throw new Error('Stripe could not complete the checkout request.')
  }
  throw new Error('Stripe could not complete the checkout request.')
}

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
    passwordHash: await hashPassword(input.password),
    createdAt: now,
  })
  await createSession(userId)
  return { user: { id: userId, name: input.name.trim(), email } }
}

export async function signIn(input: SignInInput) {
  const db = getDatabase()
  const email = input.email.toLowerCase()
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)

  const valid = await verifyPassword(input.password, user?.passwordHash)
  if (!user || !valid) throw new Error('Email or password is incorrect.')

  await createSession(user.id)
  return { user: { id: user.id, name: user.name, email: user.email } }
}

export async function setAccountPassword(password: string) {
  const user = await requireUser()
  const db = getDatabase()
  const token = getCookie(SESSION_COOKIE)!
  const currentSession = await hashSessionToken(token)
  const passwordHash = await hashPassword(password)
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, user.id))
    await tx.delete(sessions).where(and(eq(sessions.userId, user.id), ne(sessions.tokenHash, currentSession)))
  })
  return { saved: true }
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

  const savedTrips = await Promise.all(recentTrips.map(async (trip) => {
    const option = trip.selectedOptionId
      ? await db.select().from(routeOptions).where(eq(routeOptions.id, trip.selectedOptionId)).get()
      : null
    const estimate = option ? savedEstimate(option, trip.originCode, trip.destinationCode) : null
    return {
      ...trip,
      route: option ? {
        durationMinutes: option.durationMinutes,
        totalCents: estimatedTotalCents(option.priceCents, trip.travelers, estimate?.priceBasis ?? 'perTraveler'),
        modes: estimate?.legs.map((leg) => leg.mode) ?? [option.mode],
      } : null,
    }
  }))
  return { user, trips: savedTrips }
}

export async function createTrip(input: CreateTripInput) {
  const user = await requireUser()
  validateDepartureDate(input.departureDate)

  const origin = findCity(input.originCode)
  const destination = findCity(input.destinationCode)
  if (!origin || !destination) throw new Error('Choose an Indian origin and destination from the city search.')
  if (origin.code === destination.code) throw new Error('Choose two different cities.')
  const ai = (workerEnv as unknown as { AI?: AiRunner }).AI
  if (!ai) throw new Error('Connect the Workers AI binding to enable Velo. No trip was saved.')
  const db = getDatabase()
  const key = `${user.id}:${new Date().toISOString().slice(0, 10)}`
  const usage = await db.insert(aiUsage).values({ key, requests: 1 }).onConflictDoUpdate({
    target: aiUsage.key,
    set: { requests: sql`${aiUsage.requests} + 1` },
    setWhere: sql`${aiUsage.requests} < 5`,
  }).returning()
  if (!usage.length) throw new Error('You have used today’s five Velo plans. Try again tomorrow.')
  let plan: Awaited<ReturnType<typeof generateVeloPlan>>
  try {
    const context = (await Promise.all([getTravelContext(origin), getTravelContext(destination)])).filter((item) => item !== null)
    const research = await db.select().from(routeResearch).where(and(eq(routeResearch.originCode, origin.code), eq(routeResearch.destinationCode, destination.code))).limit(6)
    context.push(...research.map(({ title, url, publisher, text, checkedAt }) => ({ title, url, publisher, text, checkedAt })))
    plan = await generateVeloPlan(ai, { ...input, origin, destination, context })
  } catch (cause) {
    await db.update(aiUsage).set({ requests: sql`max(0, ${aiUsage.requests} - 1)` }).where(eq(aiUsage.key, key))
    throw cause
  }
  const estimates = plan.routes
  const originName = origin.name
  const destinationName = destination.name
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
    details: JSON.stringify(estimate),
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
      plannerNotes: plan.notes,
      plannerSources: JSON.stringify(plan.sources),
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

  return {
    trip,
    sources: JSON.parse(trip.plannerSources) as TravelSource[],
    options: options.map((option) => withRouteMetadata(option, trip.originCode, trip.destinationCode)),
  }
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

  if (trip.selectedOptionId === option.id && trip.status === 'planned') return { tripId: trip.id }
  const [existingPayment] = await db.select().from(paymentRecords).where(eq(paymentRecords.tripId, trip.id)).limit(1)
  if (existingPayment && existingPayment.status !== 'not_started') {
    throw new Error('This route has a checkout in progress or completed. Keep this route to preserve its payment record.')
  }

  const estimate = savedEstimate(option, trip.originCode, trip.destinationCode)
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
  const totalCents = estimatedTotalCents(option.priceCents, trip.travelers, estimate.priceBasis)

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
      .select({ id: paymentRecords.id, status: paymentRecords.status })
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
    } else {
      await tx.update(paymentRecords).set({
        amountCents: totalCents,
        currency: option.currency,
        status: 'not_started',
        providerReference: null,
      }).where(eq(paymentRecords.id, payment.id))
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

  const enrichedOptions = options.map((option) => withRouteMetadata(option, trip.originCode, trip.destinationCode))
  const selectedOption = enrichedOptions.find((option) => option.id === trip.selectedOptionId) ?? null
  const estimate = selectedOption ? savedEstimate(selectedOption, trip.originCode, trip.destinationCode) : null
  const [departureHour, departureMinute] = trip.departureTime.split(':').map(Number)
  let elapsed = departureHour! * 60 + departureMinute!
  const timedSegments = segments.map((segment, index) => {
    const departureDay = Math.floor(elapsed / 1440)
    elapsed += estimate?.legs[index]?.durationMinutes ?? 0
    const arrivalDay = Math.floor(elapsed / 1440)
    return { ...segment, departureDay, arrivalDay }
  })

  return {
    trip,
    options: enrichedOptions,
    selectedOption,
    originCity: findCity(trip.originCode) ?? null,
    destinationCity: findCity(trip.destinationCode) ?? null,
    segments: timedSegments,
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

  const [selectedOption] = trip.selectedOptionId
    ? await db.select().from(routeOptions).where(eq(routeOptions.id, trip.selectedOptionId)).limit(1)
    : []
  const routeEstimate = selectedOption ? savedEstimate(selectedOption, trip.originCode, trip.destinationCode) : null
  const [existingPayment] = await db.select().from(paymentRecords).where(eq(paymentRecords.tripId, trip.id)).limit(1)
  const newTotal = selectedOption && routeEstimate
    ? estimatedTotalCents(selectedOption.priceCents, input.travelers, routeEstimate.priceBasis)
    : null
  if (existingPayment && existingPayment.status !== 'not_started' && newTotal !== null && newTotal !== existingPayment.amountCents) {
    throw new Error('The traveler count cannot change the estimate while checkout is in progress or completed.')
  }

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
      const clockDuration = ((estimate[0]! * 60 + estimate[1]!) -
        (Number(segment.departureTime.slice(0, 2)) * 60 + Number(segment.departureTime.slice(3, 5))) + 1440) % 1440
      const duration = routeEstimate?.legs[segment.position]?.durationMinutes ?? clockDuration
      time += duration
      const arrivalTime = formatClockTime(time)
      const note = input.notes.find((item) => item.segmentId === segment.id)?.note ?? segment.note
      await tx.update(itinerarySegments).set({ departureTime, arrivalTime, note }).where(eq(itinerarySegments.id, segment.id))
    }

    if (trip.selectedOptionId && existingPayment?.status === 'not_started') {
      const [option] = await tx
        .select({
          title: routeOptions.title,
          details: routeOptions.details,
          priceCents: routeOptions.priceCents,
          currency: routeOptions.currency,
        })
        .from(routeOptions)
        .where(eq(routeOptions.id, trip.selectedOptionId))
        .limit(1)
      if (option) {
        const priceBasis = savedEstimate(option, trip.originCode, trip.destinationCode)?.priceBasis ?? 'perTraveler'
        await tx.update(paymentRecords).set({
          amountCents: estimatedTotalCents(option.priceCents, input.travelers, priceBasis),
          currency: option.currency,
          status: 'not_started',
          providerReference: null,
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

  const items = rows.map((row) => {
    if (!row.option) return { ...row, option: null }
    const option = withRouteMetadata(row.option, row.trip.originCode, row.trip.destinationCode)
    const payment = row.payment
      ? {
          ...row.payment,
          amountCents: estimatedTotalCents(option.priceCents, row.trip.travelers, option.priceBasis),
        }
      : null
    return { ...row, option, payment }
  })

  return { user, items }
}

export async function createCheckoutSession(tripId: string) {
  const user = await requireUser()
  const db = getDatabase()
  const trip = await getOwnedTrip(user.id, tripId)
  if (trip.status !== 'planned' || !trip.selectedOptionId) {
    throw new Error('Choose a route before opening checkout.')
  }

  const [option] = await db
    .select()
    .from(routeOptions)
    .where(eq(routeOptions.id, trip.selectedOptionId))
    .limit(1)
  if (!option) throw new Error('The selected route could not be loaded.')

  const estimate = savedEstimate(option, trip.originCode, trip.destinationCode)
  if (!estimate) throw new Error('This route estimate is no longer available.')

  const [payment] = await db
    .select()
    .from(paymentRecords)
    .where(eq(paymentRecords.tripId, trip.id))
    .limit(1)
  if (!payment) throw new Error('The estimate could not be prepared for checkout.')
  if (payment.status === 'test_succeeded') {
    throw new Error('Checkout is already complete for this estimate.')
  }

  if (payment.status === 'pending' && payment.providerReference) {
    const previous = await stripeRequest(`checkout/sessions/${encodeURIComponent(payment.providerReference)}`, getStripeTestSecret())
    if (previous.status === 'open' && previous.url) return { url: previous.url }
    if (previous.status === 'complete') {
      return { url: `${getRequestUrl().origin}/payment/${trip.id}/success?session_id=${encodeURIComponent(previous.id)}` }
    }
    if (previous.status !== 'expired') throw new Error('The existing checkout session could not be resumed.')
  }

  const amountCents = estimatedTotalCents(option.priceCents, trip.travelers, estimate.priceBasis)
  if (amountCents < 5000) throw new Error('This estimate is below Stripe’s minimum checkout amount.')

  const form = new URLSearchParams()
  form.set('mode', 'payment')
  form.set('success_url', `${getRequestUrl().origin}/payment/${trip.id}/success?session_id={CHECKOUT_SESSION_ID}`)
  form.set('cancel_url', `${getRequestUrl().origin}/wallet?checkout=cancelled`)
  form.set('client_reference_id', payment.id)
  form.set('customer_email', user.email)
  form.set('line_items[0][quantity]', '1')
  form.set('line_items[0][price_data][currency]', option.currency.toLowerCase())
  form.set('line_items[0][price_data][unit_amount]', String(amountCents))
  form.set('line_items[0][price_data][product_data][name]', 'Flow travel estimate')
  form.set('line_items[0][price_data][product_data][description]', `${trip.originName} to ${trip.destinationName} by ${option.mode}. No ticket reservation is included.`)
  form.set('metadata[trip_id]', trip.id)
  form.set('metadata[payment_id]', payment.id)
  form.set('metadata[user_id]', user.id)
  form.set('metadata[option_id]', option.id)

  const session = await stripeRequest('checkout/sessions', getStripeTestSecret(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': `flow:${payment.id}:${payment.providerReference ?? 'initial'}:${amountCents}`,
    },
    body: form,
  })
  if (!session.id || !session.url) throw new Error('Stripe did not return a checkout link.')

  await db.update(paymentRecords).set({
    providerReference: session.id,
    amountCents,
    currency: option.currency,
    status: 'pending',
  }).where(and(eq(paymentRecords.id, payment.id), ne(paymentRecords.status, 'test_succeeded')))

  return { url: session.url }
}

export async function confirmCheckoutSession(input: ConfirmCheckoutInput) {
  const user = await requireUser()
  const db = getDatabase()
  const trip = await getOwnedTrip(user.id, input.tripId)
  const [payment] = await db
    .select()
    .from(paymentRecords)
    .where(eq(paymentRecords.tripId, trip.id))
    .limit(1)
  if (!payment || payment.providerReference !== input.sessionId) {
    throw new Error('This checkout session does not match the saved trip estimate.')
  }

  const [option] = trip.selectedOptionId
    ? await db.select().from(routeOptions).where(eq(routeOptions.id, trip.selectedOptionId)).limit(1)
    : []
  if (!option) throw new Error('The selected route could not be loaded.')
  const estimate = savedEstimate(option, trip.originCode, trip.destinationCode)
  if (!estimate) throw new Error('This route estimate is no longer available.')
  const amountCents = estimatedTotalCents(option.priceCents, trip.travelers, estimate.priceBasis)

  const session = await stripeRequest(
    `checkout/sessions/${encodeURIComponent(input.sessionId)}`,
    getStripeTestSecret(),
  )
  if (
    session.id !== payment.providerReference ||
    session.mode !== 'payment' ||
    session.status !== 'complete' ||
    session.payment_status !== 'paid' ||
    session.client_reference_id !== payment.id ||
    session.metadata.trip_id !== trip.id ||
    session.metadata.payment_id !== payment.id ||
    session.metadata.user_id !== user.id ||
    session.metadata.option_id !== option.id ||
    session.amount_total !== amountCents ||
    session.currency !== option.currency.toLowerCase()
  ) {
    throw new Error('Stripe has not confirmed this checkout for the current estimate.')
  }

  await db.update(paymentRecords).set({ status: 'test_succeeded' }).where(eq(paymentRecords.id, payment.id))
  return {
    tripId: trip.id,
    destinationName: trip.destinationName,
    amountCents,
    currency: option.currency,
  }
}
