import { describe, expect, test } from 'bun:test'
import { distanceKm, generateVeloPlan, type AiRunner } from './velo'
import { findCity, matchesCityName, searchCities } from './cities'

const origin = findCity('IN-1275339')!
const destination = findCity('IN-1259229')!
const input = { origin, destination, departureDate: '2026-12-10', departureTime: '09:00', travelers: 3, tripDays: 2, prompt: 'A quiet two-day trip.' }
const days = [{ activities: 'Travel to Pune.' }, { activities: 'Explore and return.' }]
const route = {
  title: 'Cab and walk', summary: 'A car for your group.', priceRupees: 4000, priceBasis: 'perVehicle',
  legs: [{ mode: 'Cab', fromName: 'Mumbai', toName: 'Pune station', durationMinutes: 210 }, { mode: 'Walk', fromName: 'Pune station', toName: 'Pune', durationMinutes: 10 }],
}
const runner = (routes: unknown[], notes = 'Allow 2\u20133 hours, then take a break.'): AiRunner => ({ run: async () => ({ response: JSON.stringify({ notes, routes, days }) }) })

describe('Velo', () => {
  test('uses 8B FP8 Fast and includes fixed trip facts', async () => {
    let model = ''
    let request = ''
    await generateVeloPlan({ run: async (name, payload) => {
      model = name
      request = JSON.stringify(payload)
      return { response: JSON.stringify({ notes: 'Take a cab.', routes: [route], days }) }
    } }, input)
    expect(model).toBe('@cf/meta/llama-3.1-8b-instruct-fp8-fast')
    expect(request).toContain('Travelers: 3')
    expect(request).toContain('Straight-line distance')
  })

  test('keeps cab plus walk fares per vehicle and fixes dash ranges', async () => {
    const plan = await generateVeloPlan(runner([route]), input)
    expect(plan.routes[0].priceBasis).toBe('perVehicle')
    expect(plan.routes[0].priceCents).toBe(400000)
    expect(plan.routes[0].durationMinutes).toBe(220)
    expect(plan.notes).toContain('2 to 3')
    expect(plan.notes).not.toMatch(/[\u2013\u2014]/u)
  })

  test('rejects invalid output and unavailable providers without fallback', async () => {
    await expect(generateVeloPlan({ run: async () => ({ response: 'Here is a plan.' }) }, input)).rejects.toThrow('incomplete plan')
    await expect(generateVeloPlan({ run: async () => { throw new Error('quota') } }, input)).rejects.toThrow('free daily allowance')
    await expect(generateVeloPlan(runner([], 'No plausible route meets these preferences.'), input)).rejects.toThrow('No plausible route')
  })

  test('rejects implausible fares and durations', async () => {
    await expect(generateVeloPlan(runner([{ ...route, priceRupees: 1 }]), input)).rejects.toThrow('practical route')
    await expect(generateVeloPlan(runner([{ ...route, legs: [{ ...route.legs[0], durationMinutes: 1 }] }]), input)).rejects.toThrow('practical route')
  })

  test('does not allow a road-only route to an island', async () => {
    const portBlair = searchCities('Port Blair')[0]
    expect(portBlair).toBeDefined()
    await expect(generateVeloPlan(runner([{ ...route, priceRupees: 50000, legs: [{ ...route.legs[0], toName: portBlair.name, durationMinutes: 6000 }] }]), { ...input, destination: portBlair })).rejects.toThrow('practical route')
  })

  test('does not accept a round trip as a one-way route', async () => {
    const roundTrip = { ...route, legs: [...route.legs, { mode: 'Cab', fromName: 'Pune', toName: 'Mumbai', durationMinutes: 210 }] }
    await expect(generateVeloPlan(runner([roundTrip]), input)).rejects.toThrow('practical route')
  })

  test('repairs a rejected first draft within the same request', async () => {
    let calls = 0
    let repair = ''
    const plan = await generateVeloPlan({ run: async (_, payload) => {
      calls++
      repair = JSON.stringify(payload)
      const draft = calls === 1 ? { ...route, legs: [{ ...route.legs[0], toName: 'Mumbai' }] } : route
      return { response: { notes: 'Take a cab. Allow time for traffic.', days, routes: [draft] } }
    } }, input)
    expect(calls).toBe(2)
    expect(repair).toContain('last leg must end in Pune')
    expect(repair).toContain('same fixed trip facts and preferences')
    expect(plan.routes[0].legs.at(-1)?.toName).toBe('Pune')
  })

  test('repairs malformed JSON without requiring another button click', async () => {
    let calls = 0
    const plan = await generateVeloPlan({ run: async () => {
      calls++
      return { response: calls === 1 ? 'Here is a plan.' : { notes: 'Take a cab.', days, routes: [route] } }
    } }, input)
    expect(calls).toBe(2)
    expect(plan.routes).toHaveLength(1)
  })

  test('does not rerun a valid draft or an honest refusal', async () => {
    let calls = 0
    await generateVeloPlan({ run: async () => {
      calls++
      return { response: { notes: 'Take a cab.', days, routes: [route] } }
    } }, input)
    expect(calls).toBe(1)
    calls = 0
    await expect(generateVeloPlan({ run: async () => {
      calls++
      return { response: { notes: 'No plausible route meets these preferences.', days, routes: [] } }
    } }, input)).rejects.toThrow('No plausible route')
    expect(calls).toBe(1)
  })

  test('bounds repair attempts and never accepts an invalid repaired route', async () => {
    let calls = 0
    await expect(generateVeloPlan({ run: async () => {
      calls++
      return { response: { notes: 'Take a cab.', days, routes: [{ ...route, priceRupees: 1 }] } }
    } }, input)).rejects.toThrow('practical route')
    expect(calls).toBe(2)
  })

  test('does not retry provider failures or quota errors', async () => {
    let calls = 0
    await expect(generateVeloPlan({ run: async () => {
      calls++
      throw new Error('quota')
    } }, input)).rejects.toThrow('free daily allowance')
    expect(calls).toBe(1)
  })

  test('asks for a complete repair when just one alternative is invalid', async () => {
    let calls = 0
    const plan = await generateVeloPlan({ run: async () => {
      calls++
      return { response: { notes: 'Take the valid cab.', days, routes: calls === 1 ? [route, { ...route, title: 'Too cheap', priceRupees: 1 }] : [route] } }
    } }, input)
    expect(calls).toBe(2)
    expect(plan.routes.map((item) => item.title)).toEqual(['Cab and walk'])
  })

  test('includes confirmed pickup and drop-off facts and enforces both route endpoints', async () => {
    const pickupLocation = { label: 'Gate 2', latitude: origin.latitude, longitude: origin.longitude, details: 'Meet beside the main road', source: 'pin' as const }
    const dropoffLocation = { label: 'North entrance hotel', source: 'manual' as const }
    const preciseRoute = { ...route, legs: [{ ...route.legs[0], fromName: 'Gate 2, Mumbai' }, { ...route.legs[1], toName: 'North entrance hotel, Pune' }] }
    let request = ''
    const plan = await generateVeloPlan({ run: async (_, payload) => {
      request = JSON.stringify(payload)
      return { response: { notes: 'Travel to the chosen hotel.', days, routes: [preciseRoute] } }
    } }, { ...input, pickupLocation, dropoffLocation })
    expect(request).toContain('Gate 2')
    expect(request).toContain('Meet beside the main road')
    expect(request).toContain('manual')
    expect(plan.routes[0].legs[0].fromName).toBe('Gate 2, Mumbai')
    expect(plan.routes[0].legs.at(-1)?.toName).toBe('North entrance hotel, Pune')
    await expect(generateVeloPlan(runner([route]), { ...input, pickupLocation })).rejects.toThrow('practical route')
    await expect(generateVeloPlan(runner([route]), { ...input, dropoffLocation })).rejects.toThrow('practical route')
  })

  test('searches Indian cities and aliases beyond the old catalog', () => {
    for (const name of ['Mumbai', 'Pune', 'Kochi', 'Bangalore', 'Varanasi', 'Gangtok', 'Port Blair', 'Leh']) expect(searchCities(name).length).toBeGreaterThan(0)
    expect(searchCities('London')).toEqual([])
    expect(distanceKm(origin, destination)).toBeGreaterThan(100)
    expect(findCity('IN-999999999')).toBeUndefined()
    expect(matchesCityName(findCity('GGM')!, 'Gurgaon bus stand')).toBe(true)
    expect(matchesCityName(origin, 'New Delhi Railway Station')).toBe(false)
    expect(matchesCityName(searchCities('Leh')[0], 'Leh town')).toBe(true)
  })
})
