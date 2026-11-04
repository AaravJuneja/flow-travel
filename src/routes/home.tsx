import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import AppLayout from '../components/AppLayout'
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
    <AppLayout name={user.name} active="home">
      <div className={app.contentWrap}>
        <section className={styles.welcome}>
          <div className={styles.welcomeCopy}>
            <p className={app.eyebrow}>Your travel, together</p>
            <h1 className={app.pageHeading}>Where to next, {firstName}?</h1>
            <p className={app.pageIntro}>Build a route that fits your time, budget, and the way you like to travel.</p>
            <Link className={app.buttonPrimary} to="/trip/search">
              Plan a trip <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <div className={styles.routeSketch} aria-hidden="true">
            <svg viewBox="0 0 420 220" fill="none">
              <path className={styles.sketchRoad} d="M36 172C98 172 90 87 166 87s70 88 142 35 32-79 78-79" />
              <path className={styles.sketchRoute} d="M36 172C98 172 90 87 166 87s70 88 142 35 32-79 78-79" />
              <circle cx="36" cy="172" r="8" />
              <circle cx="166" cy="87" r="8" />
              <circle cx="386" cy="43" r="8" />
            </svg>
            <span className={styles.sketchLabel}>Your next route</span>
          </div>
        </section>

        <section className={styles.tripsSection} id="trips">
          <div className={styles.sectionTop}>
            <div>
              <h2 className={app.sectionHeading}>Your trips</h2>
              <p className={app.sectionIntro}>Plans and journeys saved to your account.</p>
            </div>
            {trips.length > 0 && <Link className={app.buttonLink} to="/trip/search">Plan another trip <span aria-hidden="true">↗</span></Link>}
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
                  <div className={styles.tripRouteMark} aria-hidden="true"><span /><span /></div>
                  <div className={styles.tripInformation}>
                    <h3>{trip.originName} to {trip.destinationName}</h3>
                    <p>{formatDate(trip.departureDate)} at {trip.departureTime} · {trip.travelers} {trip.travelers === 1 ? 'traveler' : 'travelers'}</p>
                  </div>
                  <span className={`${app.statusPill} ${trip.status === 'delayed' ? app.statusDelayed : trip.status === 'completed' ? app.statusCompleted : ''}`}>
                    <span className={app.statusDot} />{statusLabel(trip.status)}
                  </span>
                  <TripAction tripId={trip.id} status={trip.status} />
                </article>
              ))}
            </div>
          )}
        </section>
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
  if (status === 'active' || status === 'delayed') {
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
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}
