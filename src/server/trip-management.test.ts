import { afterEach, describe, expect, test } from 'bun:test'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { deleteOwnedTrip } from './trip-management'
import { updateProfileSchema } from './validation'
import * as schema from './schema'

let client: Client | undefined
afterEach(() => { client?.close(); client = undefined })

async function fixture() {
  client = createClient({ url: 'file::memory:' })
  const db = drizzle(client, { schema })
  await migrate(db, { migrationsFolder: './drizzle' })
  await client.execute('PRAGMA foreign_keys = ON')
  await db.insert(schema.users).values({ id: 'owner', name: 'e', email: 'e@e.com', createdAt: 1 })
  for (const id of ['delete-me', 'keep-me']) {
    await db.insert(schema.trips).values({ id, userId: 'owner', originCode: 'GGM', originName: 'Gurugram', destinationCode: 'AGR', destinationName: 'Agra', departureDate: '2026-11-07', departureTime: '07:00', createdAt: 1, updatedAt: 1 })
    await db.insert(schema.routeOptions).values({ id: `route-${id}`, tripId: id, title: 'Train', mode: 'Train', durationMinutes: 260, priceCents: 110000, currency: 'INR', changes: 1, summary: 'Train route', createdAt: 1 })
    await db.insert(schema.itinerarySegments).values({ id: `leg-${id}`, tripId: id, routeOptionId: `route-${id}`, position: 0, mode: 'Train', fromName: 'Delhi', toName: 'Agra', departureTime: '07:00', arrivalTime: '09:00' })
    await db.insert(schema.walletItems).values({ id: `wallet-${id}`, userId: 'owner', tripId: id, referenceCode: `FLOW-${id}`, status: 'planned', createdAt: 1 })
    await db.insert(schema.journeyEvents).values({ id: `event-${id}`, userId: 'owner', tripId: id, type: 'planned', message: 'Saved', createdAt: 1 })
    await db.insert(schema.paymentRecords).values({ id: `payment-${id}`, userId: 'owner', tripId: id, amountCents: 110000, currency: 'INR', status: 'not_started', createdAt: 1 })
  }
  return db
}

describe('trip deletion', () => {
  test('keeps older trips compatible and persists precise locations as JSON', async () => {
    const db = await fixture()
    const [oldTrip] = await db.select().from(schema.trips)
    expect(oldTrip.pickupLocation).toBeNull()
    expect(oldTrip.dropoffLocation).toBeNull()
    const point = { label: 'Gate 2', latitude: 28.45, longitude: 77.07, source: 'pin' as const, details: 'Main road' }
    await db.update(schema.trips).set({ pickupLocation: point })
    expect((await db.select().from(schema.trips))[0].pickupLocation).toEqual(point)
  })

  test('removes only the owned trip and its related records', async () => {
    const db = await fixture()
    await expect(deleteOwnedTrip(db, 'owner', 'delete-me')).resolves.toEqual({ deleted: true })
    expect((await db.select().from(schema.trips)).map((trip) => trip.id)).toEqual(['keep-me'])
    for (const table of [schema.routeOptions, schema.itinerarySegments, schema.walletItems, schema.journeyEvents, schema.paymentRecords]) {
      expect((await db.select({ tripId: table.tripId }).from(table)).map((row) => row.tripId)).toEqual(['keep-me'])
    }
    expect((await client!.execute('PRAGMA foreign_key_check')).rows).toHaveLength(0)
    expect(await db.select().from(schema.users)).toHaveLength(1)
  })

  test('rejects another user and unknown trips without deleting anything', async () => {
    const db = await fixture()
    await expect(deleteOwnedTrip(db, 'not-the-owner', 'delete-me')).rejects.toThrow('Trip not found.')
    await expect(deleteOwnedTrip(db, 'owner', 'missing')).rejects.toThrow('Trip not found.')
    expect(await db.select().from(schema.trips)).toHaveLength(2)
    expect(await db.select().from(schema.itinerarySegments)).toHaveLength(2)
  })

  test('rolls back related deletions if the trip cannot be deleted', async () => {
    const db = await fixture()
    await client!.execute("CREATE TRIGGER prevent_delete BEFORE DELETE ON trips BEGIN SELECT RAISE(ABORT, 'blocked'); END")
    await expect(deleteOwnedTrip(db, 'owner', 'delete-me')).rejects.toThrow()
    expect(await db.select().from(schema.trips)).toHaveLength(2)
    expect(await db.select().from(schema.itinerarySegments)).toHaveLength(2)
    expect(await db.select().from(schema.walletItems)).toHaveLength(2)
  })
})

test('profile names allow one character and reject blank or oversized names', () => {
  expect(updateProfileSchema.parse({ name: ' e ' }).name).toBe('e')
  expect(updateProfileSchema.safeParse({ name: ' ' }).success).toBe(false)
  expect(updateProfileSchema.safeParse({ name: 'a'.repeat(81) }).success).toBe(false)
})
