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
