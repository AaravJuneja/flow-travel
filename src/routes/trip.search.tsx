import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'
import AppLayout from '../components/AppLayout'
import { createTrip, getCurrentUser } from '../server/functions'
import { getDestinationsFor, getRouteEstimates, locations } from '../server/route-catalog'
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
  const [origin, setOrigin] = useState('GGM')
  const [destination, setDestination] = useState('JAI')
  const [today, setToday] = useState('')
  const [departureDate, setDepartureDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const destinations = getDestinationsFor(origin)
  const routeCount = getRouteEstimates(origin, destination).length

  useEffect(() => {
    setToday(localDate(0))
    setDepartureDate(localDate(7))
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setBusy(true)
    const form = new FormData(event.currentTarget)
    try {
      const result = await createTrip({
        data: {
          originCode: origin,
          destinationCode: destination,
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

  function changeOrigin(code: string) {
    const nextDestinations = getDestinationsFor(code)
    setOrigin(code)
    setDestination(nextDestinations[0]?.code ?? '')
  }

  return (
    <AppLayout active="home">
      <div className={app.contentWrap}>
        <div className={styles.pageHeadingRow}>
          <div className={styles.heading}>
            <p className={app.eyebrow}>From Sector 65, Gurugram</p>
            <h1 className={app.pageHeading}>Where to?</h1>
            <p className={app.pageIntro}>Choose your destination and travel date. We’ll bring the route options together.</p>
          </div>
          <img className={styles.routeArt} src="/assets/figma/home-route-artwork.svg" width="464" height="167" alt="" />
        </div>

        <div className={styles.searchLayout}>
          <form className={`${app.panel} ${styles.searchForm}`} onSubmit={submit}>
            <div className={styles.locationFields}>
              <label className={app.field}>
                <span className={app.fieldLabel}>Leaving from</span>
                <select className={app.fieldControl} value={origin} onChange={(event) => changeOrigin(event.currentTarget.value)}>
                  {locations.filter((location) => getDestinationsFor(location.code).length > 0).map((location) => (
                    <option value={location.code} key={location.code}>{location.name}</option>
                  ))}
                </select>
              </label>
              <span className={styles.locationConnector} aria-hidden="true" />
              <label className={app.field}>
                <span className={app.fieldLabel}>Going to</span>
                <select className={app.fieldControl} value={destination} onChange={(event) => setDestination(event.currentTarget.value)}>
                  {destinations.map((location) => <option value={location.code} key={location.code}>{location.name}</option>)}
                </select>
              </label>
            </div>

            <div className={styles.tripFields}>
              <label className={app.field}>
                <span className={app.fieldLabel}>Travel date</span>
                <input className={app.fieldControl} type="date" name="departureDate" min={today} value={departureDate} onChange={(event) => setDepartureDate(event.currentTarget.value)} required />
              </label>
              <label className={app.field}>
                <span className={app.fieldLabel}>Leave around</span>
                <input className={app.fieldControl} type="time" name="departureTime" defaultValue="09:00" required />
              </label>
              <label className={app.field}>
                <span className={app.fieldLabel}>Travelers</span>
                <select className={app.fieldControl} name="travelers" defaultValue="1">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => <option value={count} key={count}>{count} {count === 1 ? 'traveler' : 'travelers'}</option>)}
                </select>
              </label>
            </div>

            {routeCount === 0 && <p className={app.errorNotice}>There are no route estimates for this city pair yet.</p>}
            {error && <p className={app.errorNotice} role="alert">{error}</p>}
            <div className={styles.submitRow}>
              <p>Route prices are estimates. No ticket is booked or charged.</p>
              <button type="submit" className={app.buttonPrimary} disabled={busy || routeCount === 0}>
                {busy ? 'Saving trip' : 'Plan my journey'} <span aria-hidden="true">↗</span>
              </button>
            </div>
          </form>

          <aside className={styles.recentPanel}>
            <div className={styles.recentHeading}>
              <h2>Recent destinations</h2>
              <span>Choose one</span>
            </div>
            <div className={styles.destinationList}>
              <button className={styles.destinationCard} type="button" onClick={() => setDestination('JAI')}>
                <img src="/assets/figma/recent-destination-jaipur.png" width="77" height="59" alt="" />
                <span><strong>Jaipur</strong><small>{origin === 'GGM' ? 'Gurugram to Jaipur' : 'Select Jaipur'}</small></span>
              </button>
              <button className={styles.destinationCard} type="button" onClick={() => setDestination('MAY')}>
                <img src="/assets/figma/recent-destination-mayapur.png" width="77" height="59" alt="" />
                <span><strong>Mayapur</strong><small>{origin === 'GGM' ? 'Gurugram to Mayapur' : 'Select Mayapur'}</small></span>
              </button>
            </div>
            <p className={styles.catalogNote}>Flow’s route catalog has planning estimates, not live schedules.</p>
          </aside>
        </div>
      </div>
    </AppLayout>
  )
}

function localDate(offsetDays: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}
