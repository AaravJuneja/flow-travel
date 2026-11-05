import { and, eq } from 'drizzle-orm'
import type { getDatabase } from './db'
import { itinerarySegments, journeyEvents, paymentRecords, routeOptions, trips, walletItems } from './schema'

export async function deleteOwnedTrip(db: ReturnType<typeof getDatabase>, userId: string, tripId: string) {
  await db.transaction(async (tx) => {
    const trip = await tx.select({ id: trips.id }).from(trips).where(and(eq(trips.id, tripId), eq(trips.userId, userId))).get()
    if (!trip) throw new Error('Trip not found.')
    await tx.delete(itinerarySegments).where(eq(itinerarySegments.tripId, tripId))
    await tx.delete(journeyEvents).where(eq(journeyEvents.tripId, tripId))
    await tx.delete(paymentRecords).where(eq(paymentRecords.tripId, tripId))
    await tx.delete(walletItems).where(eq(walletItems.tripId, tripId))
    await tx.delete(routeOptions).where(eq(routeOptions.tripId, tripId))
    await tx.delete(trips).where(and(eq(trips.id, tripId), eq(trips.userId, userId)))
  })
  return { deleted: true }
}
