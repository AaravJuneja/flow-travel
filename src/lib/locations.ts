export type Coordinates = { latitude: number; longitude: number }
export type TripLocation = {
  label: string
  latitude?: number
  longitude?: number
  details?: string
  source: 'search' | 'pin' | 'device' | 'manual'
}

export function distanceBetween(a: Coordinates, b: Coordinates) {
  const radians = (degrees: number) => degrees * Math.PI / 180
  const h = Math.sin(radians(b.latitude - a.latitude) / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(radians(b.longitude - a.longitude) / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)))
}

export function hasCoordinates(location: TripLocation | null | undefined): location is TripLocation & Coordinates {
  return typeof location?.latitude === 'number' && typeof location.longitude === 'number' && Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
}

export function endpointLabel(location: TripLocation | null | undefined, city: string) {
  if (!location) return city
  return normalizeEndpoint(location.label).includes(normalizeEndpoint(city)) ? location.label : `${location.label}, ${city}`
}

export function normalizeEndpoint(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
}

export const locationRadiusKm = 60
