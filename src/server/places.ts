import { z } from 'zod'
import type { City } from './cities'
import { distanceBetween, locationRadiusKm, type Coordinates, type TripLocation } from '../lib/locations'

type PlaceFetcher = (url: string, init?: RequestInit) => Promise<Response>

const featureSchema = z.object({
  geometry: z.object({ type: z.literal('Point'), coordinates: z.tuple([z.number(), z.number()]) }),
  properties: z.object({ name: z.string().optional(), street: z.string().optional(), housenumber: z.string().optional(), district: z.string().optional(), city: z.string().optional(), state: z.string().optional(), postcode: z.string().optional(), countrycode: z.string().optional() }),
})

export function placeFromFeature(value: unknown, city: City): TripLocation | null {
  const parsed = featureSchema.safeParse(value)
  if (!parsed.success) return null
  const { geometry, properties: p } = parsed.data
  const [longitude, latitude] = geometry.coordinates
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || (p.countrycode && p.countrycode.toUpperCase() !== 'IN')) return null
  if (distanceBetween(city, { latitude, longitude }) > locationRadiusKm) return null
  const label = [...new Set([p.name, [p.housenumber, p.street].filter(Boolean).join(' '), p.district, p.city, p.state, p.postcode].filter(Boolean))].join(', ').slice(0, 180)
  return label ? { label, latitude, longitude, source: 'search' } : null
}

async function photonRequest(path: string, params: URLSearchParams, fetcher: PlaceFetcher) {
  const url = `https://photon.komoot.io/${path}?${params}`
  const cache = typeof caches !== 'undefined' ? await caches.open('flow-places-v1').catch(() => undefined) : undefined
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(url))), (byte) => byte.toString(16).padStart(2, '0')).join('')
  const key = new Request(`https://flow.squeakyfiddlepro.me/place-cache/${digest}`)
  const cached = await cache?.match(key).catch(() => undefined)
  if (cached) return await cached.json() as { features?: unknown[] }
  const response = await fetcher(url, { headers: { 'User-Agent': 'FlowTravel/1.0 (https://flow.squeakyfiddlepro.me)', 'Accept-Language': 'en' }, signal: AbortSignal.timeout(6000) })
  if (!response.ok) throw new Error('Address search is unavailable. Enter an address or choose a point on the map.')
  const result = await response.json() as { features?: unknown[] }
  if (!Array.isArray(result.features)) throw new Error('Address search returned no usable results. Choose a point on the map.')
  await cache?.put(key, new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600' } })).catch(() => undefined)
  return result
}

export async function searchPlaces(city: City, query: string, fetcher: PlaceFetcher = fetch) {
  const latRadius = locationRadiusKm / 111
  const lonRadius = latRadius / Math.cos(city.latitude * Math.PI / 180)
  const params = new URLSearchParams({ q: `${query} ${city.name}`, lat: String(city.latitude), lon: String(city.longitude), bbox: [city.longitude - lonRadius, city.latitude - latRadius, city.longitude + lonRadius, city.latitude + latRadius].join(','), countrycode: 'IN', limit: '6', lang: 'en' })
  const result = await photonRequest('api/', params, fetcher)
  const unique = new Map<string, TripLocation>()
  for (const feature of result.features ?? []) {
    const location = placeFromFeature(feature, city)
    if (location) unique.set(`${location.latitude},${location.longitude},${location.label}`, location)
  }
  return [...unique.values()].slice(0, 6)
}

export async function describePlace(city: City, point: Coordinates, fetcher: PlaceFetcher = fetch): Promise<TripLocation | null> {
  if (distanceBetween(city, point) > locationRadiusKm) throw new Error(`Choose a point within ${locationRadiusKm} km of ${city.name}, or change the city.`)
  const result = await photonRequest('reverse', new URLSearchParams({ lat: String(point.latitude), lon: String(point.longitude), radius: '1', limit: '1', lang: 'en' }), fetcher)
  const nearby = placeFromFeature(result.features?.[0], city)
  if (!nearby) return null
  return { label: `Near ${nearby.label}`.slice(0, 180), latitude: point.latitude, longitude: point.longitude, source: 'pin' }
}
