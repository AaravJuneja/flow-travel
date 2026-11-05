import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import AppLayout from '../components/AppLayout'
import TripStatusIcon from '../components/TripStatusIcon'
import DeleteTripButton from '../components/DeleteTripButton'
import { Clock3 } from 'lucide-react'
import { getCurrentUser, getHomeData } from '../server/functions'
import styles from './home.module.css'
import app from '../styles/app.module.css'

export const Route = createFileRoute('/home')({
  beforeLoad: async () => {
    if (!(await getCurrentUser())) throw redirect({ to: '/login' })
  },
  loader: () => getHomeData(),
  head: () => ({ meta: [{ title: 'My trips | Flow' }] }),
  component: HomePage,
})

function HomePage() {
  const { user, trips } = Route.useLoaderData()
  const firstName = user.name.trim().split(/\s+/u)[0] || 'traveler'

  return (
    <AppLayout name={user.name} active="home" mobileHeader="location" location={trips[0]?.originName}>
      <div className={app.contentWrap}>
        <section className={styles.welcome}>
          <div className={styles.welcomeCopy}>
            <p className={styles.greeting}>Hello,</p>
            <h1 className={app.pageHeading}>{firstName}</h1>
            <Link className={styles.searchLink} to="/trip/search">
              <span className={styles.searchIcon}><img src="/assets/home-search.svg" alt="" /></span>Where to?
            </Link>
          </div>
          <div className={styles.routeSketch} aria-hidden="true">
            <img src="/assets/home-route-artwork.svg" alt="" />
          </div>
        </section>

        <section className={styles.tripsSection} id="trips">
          <div className={styles.sectionTop}>
            <div>
              <h2 className={app.sectionHeading}>Upcoming journeys</h2>
            </div>
          </div>

          {trips.length === 0 ? (
            <div className={`${app.panel} ${styles.emptyState}`}>
              <span className={styles.emptyIcon} aria-hidden="true">⌁</span>
              <h3>Your next trip starts here.</h3>
              <p>Choose two places and Flow will compare the available ways between them.</p>
              <Link className={app.buttonSecondary} to="/trip/search">Find a route</Link>
            </div>
          ) : (
            <div className={styles.tripList}>
              {trips.map((trip) => (
                <article className={`${app.panel} ${styles.tripRow}`} key={trip.id}>
                  <div className={styles.tripInformation}>
                    <h3>{trip.originName} <span aria-hidden="true">→</span> {trip.destinationName}</h3>
                    <p><img src="/assets/home-calendar.svg" alt="" />{formatDate(trip.departureDate)} <Clock3 size={14} aria-hidden="true" />{trip.departureTime}<span className={styles.tripFare}>{trip.route ? <><span>{Math.floor(trip.route.durationMinutes / 60)}h {trip.route.durationMinutes % 60}m</span><span>{formatMoney(trip.route.totalCents)}</span></> : `${trip.travelers} ${trip.travelers === 1 ? 'traveler' : 'travelers'}`}</span></p>
                  </div>
                  {trip.route && <div className={styles.transportRoute} aria-label={trip.route.modes.join(' then ')}>{trip.route.modes.map((mode, index) => <span className={styles.transportStop} key={`${mode}-${index}`}><img src={`/assets/transport-${mode === 'Train' ? 'train' : mode === 'Bus' ? 'bus' : 'taxi'}.svg`} alt={mode} /></span>)}</div>}
                  <div className={styles.tripFooter}>
                  <span className={`${app.statusPill} ${trip.status === 'delayed' ? app.statusDelayed : trip.status === 'completed' ? app.statusCompleted : ''}`}>
                    <TripStatusIcon status={trip.status} />{statusLabel(trip.status)}
                  </span>
                   <div className={styles.tripActions}><TripAction tripId={trip.id} status={trip.status} /><DeleteTripButton tripId={trip.id} origin={trip.originName} destination={trip.destinationName} /></div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <Link className={`${app.panel} ${styles.inspiration}`} to="/trip/search"><img src="/assets/home-sparkle.svg" alt="" /><div><h2>What kind of trip do you have in mind?</h2><p>Choose a city in India and tell Velo your budget, pace and interests.</p></div><span aria-hidden="true">›</span></Link>
      </div>
    </AppLayout>
  )
}

function TripAction({ tripId, status }: { tripId: string; status: string }) {
  if (status === 'planning') {
    return <Link className={app.buttonSecondary} to="/trip/$tripId/options" params={{ tripId }}>Compare routes</Link>
  }
  if (status === 'planned') {
    return <Link className={app.buttonSecondary} to="/trip/$tripId/edit" params={{ tripId }}>Edit plan</Link>
  }
  if (status === 'active' || status === 'delayed' || status === 'completed') {
    return <Link className={app.buttonSecondary} to="/journey/$tripId" params={{ tripId }}>Open journey</Link>
  }
  return <Link className={app.buttonSecondary} to="/wallet">Open wallet</Link>
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    planning: 'Choose a route',
    planned: 'Planned',
    active: 'In progress',
    delayed: 'Delayed',
    completed: 'Completed',
  }
  return labels[status] ?? 'Saved'
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-IN', {
    timeZone: 'UTC',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  })
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(cents / 100)
}
