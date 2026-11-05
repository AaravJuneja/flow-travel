import { describe, expect, test } from 'bun:test'
import { describePlace, placeFromFeature, searchPlaces } from './places'
import { findCity } from './cities'
import { distanceBetween, endpointLabel, hasCoordinates } from '../lib/locations'
import { createTripSchema, tripLocationSchema } from './validation'

const city = findCity('GGM')!
const feature = { geometry: { type: 'Point', coordinates: [77.0704879, 28.47919] }, properties: { name: 'IFFCO Chowk', street: 'Delhi-Gurugram Expressway', city: 'Gurgaon', state: 'Haryana', countrycode: 'IN' } }

describe('pickup and drop-off locations', () => {
  test('formats real places and rejects invalid, foreign or distant coordinates', () => {
    const location = placeFromFeature(feature, city)
    expect(location?.label).toContain('IFFCO Chowk')
    expect(location?.latitude).toBe(28.47919)
    expect(location?.longitude).toBe(77.0704879)
    expect(placeFromFeature({}, city)).toBeNull()
    expect(placeFromFeature({ ...feature, properties: { ...feature.properties, countrycode: 'DE' } }, city)).toBeNull()
    expect(placeFromFeature({ ...feature, geometry: { type: 'Point', coordinates: [13, 52] } }, city)).toBeNull()
    expect(placeFromFeature({ ...feature, geometry: { type: 'Point', coordinates: [77, 100] } }, city)).toBeNull()
  })

  test('biases and bounds searches around the selected Indian city', async () => {
    let requested = ''
    const fetcher = async (url: string) => {
      requested = String(url)
      return new Response(JSON.stringify({ features: [feature, feature, { ...feature, geometry: { type: 'Point', coordinates: [13, 52] } }] }))
    }
    const results = await searchPlaces(city, 'IFFCO Chowk', fetcher)
    const url = new URL(requested)
    expect(url.searchParams.get('countrycode')).toBe('IN')
    expect(url.searchParams.get('q')).toContain('Gurugram')
    expect(url.searchParams.get('bbox')).toBeTruthy()
    expect(results).toHaveLength(1)
  })

  test('reverse lookup preserves the actual pin rather than snapping it to a nearby building', async () => {
    const point = { latitude: 28.479, longitude: 77.07 }
    const fetcher = async () => new Response(JSON.stringify({ features: [feature] }))
    const result = await describePlace(city, point, fetcher)
    expect(result?.label).toStartWith('Near ')
    expect(result?.latitude).toBe(point.latitude)
    expect(result?.longitude).toBe(point.longitude)
    await expect(describePlace(city, { latitude: 19, longitude: 72 }, fetcher)).rejects.toThrow('within 60 km')
  })

  test('does not retry a throttled search and lets the UI offer manual entry', async () => {
    let requests = 0
    const fetcher = async () => { requests++; return new Response('', { status: 429 }) }
    await expect(searchPlaces(city, 'Sector 65', fetcher)).rejects.toThrow('choose a point on the map')
    expect(requests).toBe(1)
  })

  test('accepts manual addresses, validates paired coordinates and keeps locations optional', () => {
    const manual = tripLocationSchema.parse({ label: ' Gate 2 ', details: ' Main road ', source: 'manual' })
    expect(manual.label).toBe('Gate 2')
    expect(manual.details).toBe('Main road')
    expect(hasCoordinates(manual)).toBe(false)
    expect(endpointLabel(manual, city.name)).toBe('Gate 2, Gurugram')
    expect(endpointLabel({ ...manual, label: 'Gate 2, Gurugram' }, city.name)).toBe('Gate 2, Gurugram')
    expect(tripLocationSchema.safeParse({ label: 'Pin', latitude: 28, source: 'pin' }).success).toBe(false)
    expect(tripLocationSchema.safeParse({ label: 'Pin', source: 'pin' }).success).toBe(false)
    expect(tripLocationSchema.safeParse({ label: 'Pin', latitude: 100, longitude: 77, source: 'pin' }).success).toBe(false)
    expect(createTripSchema.safeParse({ originCode: city.code, destinationCode: 'JAI', departureDate: '2026-12-10', departureTime: '09:00', travelers: 1 }).success).toBe(true)
    expect(distanceBetween(city, city)).toBe(0)
  })
})
