import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'
import AppLayout from '../components/AppLayout'
import TripMap from '../components/TripMap'
import CitySearch from '../components/CitySearch'
import { createTrip, getCurrentUser } from '../server/functions'
import type { City } from '../server/cities'
import styles from './trip-search.module.css'
import app from '../styles/app.module.css'

export const Route = createFileRoute('/trip/search')({
  beforeLoad: async () => {
    if (!(await getCurrentUser())) throw redirect({ to: '/login' })
  },
  head: () => ({ meta: [{ title: 'Plan a trip | Flow' }] }),
  component: TripSearchPage,
})

function TripSearchPage() {
  const navigate = useNavigate()
  const [origin, setOrigin] = useState<City | null>(null)
  const [destination, setDestination] = useState<City | null>(null)
  const [prompt, setPrompt] = useState('')
  const [tripDays, setTripDays] = useState(2)
  const [today, setToday] = useState('')
  const [departureDate, setDepartureDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setToday(localDate(0))
    setDepartureDate(localDate(7))
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!origin || !destination) { setError('Select both cities from the search results.'); return }
    setError('')
    setBusy(true)
    const form = new FormData(event.currentTarget)
    try {
      const result = await createTrip({
        data: {
          originCode: origin.code,
          destinationCode: destination.code,
          prompt,
          tripDays,
          departureDate: String(form.get('departureDate') ?? ''),
          departureTime: String(form.get('departureTime') ?? ''),
          travelers: Number(form.get('travelers')),
        },
      })
      await navigate({ to: '/trip/$tripId/options', params: { tripId: result.tripId } })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The trip could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppLayout active="plan" mobileHeader="map" mobileNavigation={false} location={origin?.name}>
      <div className={app.wideWrap}>
        <div className={styles.destinationScreen}>
          <section className={styles.mapHero} aria-label="Journey map">
            <div className={styles.mapCanvas}>
              <TripMap originCity={origin ?? undefined} destinationCity={destination ?? undefined} />
            </div>
          </section>

          <form className={`${app.panel} ${styles.wherePanel}`} onSubmit={submit} onInvalidCapture={(event) => {
            const settings = (event.target as HTMLElement).closest('details')
            if (settings) settings.open = true
          }}>
            <header className={styles.panelHeading}>
              <h1>Where to?</h1>
              <p>Pick your cities. Tell Velo what matters to you.</p>
            </header>

            <CitySearch label="Leaving from" value={origin} onChange={setOrigin} />
            <CitySearch label="Going to" value={destination} onChange={setDestination} />
            <label className={styles.promptField}>
              <span><img src="/assets/home-sparkle.svg" width="22" height="22" alt="" /> Plan with Velo</span>
              <textarea value={prompt} onChange={(event) => setPrompt(event.currentTarget.value)} maxLength={2000} rows={4} placeholder="A relaxed 3-day trip under ₹8,000 each. Prefer trains, local food and places that aren't too crowded." />
            </label>
            <label className={styles.compactField}><span className={styles.controlLabel}>Days away</span><input aria-label="Days away" type="number" min="1" max="14" required value={tripDays} onChange={(event) => setTripDays(Number(event.currentTarget.value))} /></label>
            <p className={styles.dataCredit}>City data: <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></p>

            <div className={styles.submitRow}>
              <details className={styles.scheduleSettings}>
                <summary aria-label="Edit travel date, departure time and travelers"><img src="/assets/where-to/calendar.svg" alt="" /><span className={styles.srOnly}>Travel details</span></summary>
                <div className={styles.schedulePopover}>
                  <h2>Travel details</h2>
                  <div className={styles.tripFields}>
              <label className={styles.dateField}>
                <span className={styles.calendarBadge} aria-hidden="true">
                  <img src="/assets/where-to/calendar.svg" alt="" />
                </span>
                <span><span className={styles.controlLabel}>Travel date</span>
                  <input type="date" name="departureDate" min={today} value={departureDate} onChange={(event) => setDepartureDate(event.currentTarget.value)} required />
                </span>
              </label>
              <label className={styles.compactField}>
                <span className={styles.controlLabel}>Leave around</span>
                <input type="time" name="departureTime" defaultValue="09:00" required />
              </label>
              <label className={styles.compactField}>
                <span className={styles.controlLabel}>Travelers</span>
                <select name="travelers" defaultValue="1" aria-label="Travelers">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => <option value={count} key={count}>{count}</option>)}
                </select>
              </label>
                  </div>
                  <button type="button" onClick={(event) => { event.currentTarget.closest('details')!.open = false }}>Done</button>
                </div>
              </details>

            {error && <p className={app.errorNotice} role="alert">{error}</p>}
              <button type="submit" className={app.buttonPrimary} disabled={busy || !origin || !destination}>
                {busy ? 'Velo is planning...' : 'Plan my journey'} <span aria-hidden="true">↗</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  )
}

function localDate(offsetDays: number) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
