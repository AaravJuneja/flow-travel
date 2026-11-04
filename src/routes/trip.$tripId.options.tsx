import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import AppLayout from '../components/AppLayout'
import { chooseTripOption, getCurrentUser, getTripOptions } from '../server/functions'
import app from '../styles/app.module.css'
import styles from './trip-options.module.css'

export const Route = createFileRoute('/trip/$tripId/options')({
  beforeLoad: async () => {
    if (!(await getCurrentUser())) throw redirect({ to: '/login' })
  },
  loader: ({ params }) => getTripOptions({ data: { tripId: params.tripId } }),
  head: () => ({ meta: [{ title: 'Compare routes | Flow' }] }),
  component: RouteOptionsPage,
})

function RouteOptionsPage() {
  const { trip, options } = Route.useLoaderData()
  const navigate = useNavigate()
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')

  async function select(optionId: string) {
    setBusyId(optionId)
    setError('')
    try {
      await chooseTripOption({ data: { tripId: trip.id, optionId } })
      await navigate({ to: '/trip/$tripId/edit', params: { tripId: trip.id } })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The route could not be saved.')
    } finally {
      setBusyId('')
    }
  }

  const selectedOptionId = trip.selectedOptionId

  return (
    <AppLayout active="home">
      <div className={app.contentWrap}>
        <div className={styles.topline}>
          <Link className={app.buttonLink} to="/trip/search">‹ Change places</Link>
          <span className={styles.step}>Route options</span>
        </div>
        <header className={styles.heading}>
          <p className={app.eyebrow}>{formatDate(trip.departureDate)} at {trip.departureTime} · {trip.travelers} {trip.travelers === 1 ? 'traveler' : 'travelers'}</p>
          <h1 className={app.pageHeading}>{trip.originName}<span className={styles.headingLine} />{trip.destinationName}</h1>
          <p className={app.pageIntro}>Compare the time, cost, and changes. Choose a route to save it to your plan.</p>
        </header>

        <div className={app.notice}>
          These are planning estimates from Flow’s route catalog. Schedules and prices are not live, and no ticket is reserved.
        </div>

        {error && <p className={app.errorNotice} role="alert">{error}</p>}

        <div className={styles.optionGrid}>
          {options.map((option, index) => {
            const isSelected = option.id === selectedOptionId
            const total = option.priceCents * trip.travelers
            return (
              <article className={`${app.panel} ${styles.optionCard} ${isSelected ? styles.optionSelected : ''}`} key={option.id}>
                <div className={styles.optionHeading}>
                  <span className={styles.modeIcon} aria-hidden="true">{modeMark(option.mode)}</span>
                  <div>
                    <p className={styles.optionMode}>{option.mode}</p>
                    <h2>{option.title}</h2>
                  </div>
                  {index === 0 && <span className={styles.fastest}>Fastest</span>}
                </div>
                <p className={styles.optionSummary}>{option.summary}</p>
                <div className={styles.optionStats}>
                  <p><span>Travel time</span><strong>{formatDuration(option.durationMinutes)}</strong></p>
                  <p><span>Changes</span><strong>{option.changes === 0 ? 'Direct' : option.changes}</strong></p>
                </div>
                <div className={styles.optionPrice}>
                  <div><strong>{formatMoney(total, option.currency)}</strong><span>estimated total for {trip.travelers}</span></div>
                  <button className={isSelected ? app.buttonSecondary : app.buttonPrimary} type="button" disabled={busyId !== ''} onClick={() => void select(option.id)}>
                    {busyId === option.id ? 'Saving route' : isSelected ? 'Keep this route' : 'Choose route'}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </AppLayout>
  )
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return hours ? `${hours}h ${remainder.toString().padStart(2, '0')}m` : `${remainder} min`
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100)
}

function modeMark(mode: string) {
  if (mode.toLowerCase().includes('train')) return '↗'
  if (mode.toLowerCase().includes('car')) return '⌁'
  if (mode.toLowerCase().includes('coach')) return '▰'
  return '·'
}
