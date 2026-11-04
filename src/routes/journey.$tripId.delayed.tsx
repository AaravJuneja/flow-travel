import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import AppLayout from '../components/AppLayout'
import { getCurrentUser, getTripDetails, resolveJourneyDelay } from '../server/functions'
import app from '../styles/app.module.css'
import styles from './journey-delayed.module.css'

export const Route = createFileRoute('/journey/$tripId/delayed')({
  beforeLoad: async () => {
    if (!(await getCurrentUser())) throw redirect({ to: '/login' })
  },
  loader: async ({ params }) => {
    const data = await getTripDetails({ data: { tripId: params.tripId } })
    if (data.trip.status !== 'delayed') {
      throw redirect({ to: '/journey/$tripId', params: { tripId: params.tripId } })
    }
    return data
  },
  head: () => ({ meta: [{ title: 'Journey update | Flow' }] }),
  component: DelayPage,
})

function DelayPage() {
  const data = Route.useLoaderData()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const latestDelay = data.events.find((event) => event.type === 'delay')

  async function resolve() {
    setBusy(true)
    setError('')
    try {
      await resolveJourneyDelay({ data: { tripId: data.trip.id } })
      await navigate({ to: '/journey/$tripId', params: { tripId: data.trip.id } })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The update could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppLayout active="home">
      <div className={app.narrowWrap}>
        <Link className={app.buttonLink} to="/journey/$tripId" params={{ tripId: data.trip.id }}>‹ Back to journey</Link>
        <section className={`${app.panel} ${styles.delayCard}`}>
          <div className={styles.signal} aria-hidden="true">!</div>
          <p className={styles.delayEyebrow}>Journey update</p>
          <h1 className={styles.delayTitle}>Your plans have shifted.</h1>
          <p className={styles.delayIntro}>{data.trip.originName} to {data.trip.destinationName}</p>

          <div className={styles.delayDetail}>
            <span className={styles.delayDuration}>{latestDelay?.delayMinutes ?? 0}<small>min</small></span>
            <div>
              <h2>{latestDelay?.message ?? 'Delay reported'}</h2>
              <p>Added by you at {latestDelay ? formatTime(latestDelay.createdAt) : 'the latest update'}.</p>
            </div>
          </div>

          <div className={app.notice}>
            Flow uses the updates you log. It does not receive live operator alerts for this route.
          </div>

          {error && <p className={app.errorNotice} role="alert">{error}</p>}
          <div className={styles.actions}>
            <button className={app.buttonPrimary} type="button" disabled={busy} onClick={() => void resolve()}>
              {busy ? 'Saving update' : 'Mark as resolved'}
            </button>
            <Link className={app.buttonSecondary} to="/journey/$tripId" params={{ tripId: data.trip.id }}>Keep tracking</Link>
          </div>
        </section>
      </div>
    </AppLayout>
  )
}

function formatTime(value: number) {
  return new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
