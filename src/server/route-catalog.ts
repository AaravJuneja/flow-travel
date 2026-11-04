export type RouteLeg = {
  mode: string
  fromName: string
  toName: string
  durationMinutes: number
}

export type RouteEstimate = {
  title: string
  mode: string
  durationMinutes: number
  priceCents: number
  currency: string
  changes: number
  summary: string
  legs: RouteLeg[]
  priceBasis: 'perTraveler' | 'perVehicle'
  sourceLabel: string
  sourceUrl: string
}

export const locations = [
  { code: 'GGM', name: 'Gurugram' },
  { code: 'JAI', name: 'Jaipur' },
  { code: 'MAY', name: 'Mayapur' },
] as const

const routes: Record<string, RouteEstimate[]> = {
  'GGM:JAI': [
    {
      title: 'Direct train',
      mode: 'Train',
      durationMinutes: 265,
      priceCents: 19000,
      currency: 'INR',
      changes: 0,
      summary: 'Direct trains take about 4h 25m. Sleeper fares start at ₹190; class and date affect the fare.',
      legs: [{ mode: 'Train', fromName: 'Gurugram Railway Station', toName: 'Jaipur Junction', durationMinutes: 265 }],
      priceBasis: 'perTraveler',
      sourceLabel: 'MakeMyTrip route planner and eRail',
      sourceUrl: 'https://www.makemytrip.com/routeplanner/gurgaon-jaipur.html',
    },
    {
      title: 'Direct bus',
      mode: 'Bus',
      durationMinutes: 285,
      priceCents: 29900,
      currency: 'INR',
      changes: 0,
      summary: 'Direct buses take about 4h 45m. Starting fares vary by operator, seat and date.',
      legs: [{ mode: 'Bus', fromName: 'Gurugram', toName: 'Jaipur', durationMinutes: 285 }],
      priceBasis: 'perTraveler',
      sourceLabel: 'MakeMyTrip route planner',
      sourceUrl: 'https://www.makemytrip.com/routeplanner/gurgaon-jaipur.html',
    },
    {
      title: 'Direct cab',
      mode: 'Cab',
      durationMinutes: 287,
      priceCents: 274300,
      currency: 'INR',
      changes: 0,
      summary: 'Direct cab takes about 4h 47m. Starting fare is for the car, not each traveler.',
      legs: [{ mode: 'Cab', fromName: 'Gurugram', toName: 'Jaipur', durationMinutes: 287 }],
      priceBasis: 'perVehicle',
      sourceLabel: 'MakeMyTrip route planner',
      sourceUrl: 'https://www.makemytrip.com/routeplanner/gurgaon-jaipur.html',
    },
  ],
  'GGM:MAY': [
    {
      title: 'Train via Howrah',
      mode: 'Train + local train',
      durationMinutes: 1745,
      priceCents: 62000,
      currency: 'INR',
      changes: 1,
      summary: 'Gurugram to Howrah, then a local train to Mayapur. Approximate fare combines published starting fares and excludes connection wait time.',
      legs: [
        { mode: 'Train', fromName: 'Gurugram Railway Station', toName: 'Howrah Junction', durationMinutes: 1643 },
        { mode: 'Train', fromName: 'Howrah Junction', toName: 'Mayapur', durationMinutes: 102 },
      ],
      priceBasis: 'perTraveler',
      sourceLabel: 'Train PNR Status and eRail',
      sourceUrl: 'https://erail.in/trains-between-stations/howrah-jn-HWH/mayapur-MAYP',
    },
  ],
}

export function getRouteEstimates(originCode: string, destinationCode: string) {
  return routes[`${originCode}:${destinationCode}`] ?? []
}

export function getRouteEstimate(originCode: string, destinationCode: string, title: string) {
  return getRouteEstimates(originCode, destinationCode).find((estimate) => estimate.title === title)
}

export function getDestinationsFor(originCode: string) {
  return Object.keys(routes)
    .filter((pair) => pair.startsWith(`${originCode}:`))
    .map((pair) => pair.split(':')[1])
    .flatMap((code) => locations.filter((location) => location.code === code))
}

export function getLocationName(code: string) {
  return locations.find((location) => location.code === code)?.name
}

export function formatClockTime(minutesAfterMidnight: number) {
  const normalized = ((minutesAfterMidnight % 1440) + 1440) % 1440
  const hours = Math.floor(normalized / 60)
  const minutes = normalized % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}
