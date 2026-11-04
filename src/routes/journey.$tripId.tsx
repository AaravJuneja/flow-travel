import { createFileRoute, Link, redirect, useRouter, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import AppLayout from '../components/AppLayout'
import {
  addJourneyDelay,
  completeNextLeg,
  getCurrentUser,
  getTripDetails,
  startJourney,
} from '../server/functions'
import app from '../styles/app.module.css'
import styles from './journey.module.css'

export const Route = createFileRoute('/journey/$tripId')({
  beforeLoad: async () => {
    if (!(await getCurrentUser())) throw redirect({ to: '/login' })
  },
  loader: async ({ params }) => {
    const data = await getTripDetails({ data: { tripId: params.tripId } })
    if (!data.selectedOption) throw redirect({ to: '/trip/$tripId/options', params: { tripId: params.tripId } })
    return data
  },
  head: () => ({ meta: [{ title: 'Your journey | Flow' }] }),
  component: JourneyPage,
})

function JourneyPage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [delayFormOpen, setDelayFormOpen] = useState(false)
  const completedCount = data.segments.filter((segment) => segment.status === 'completed').length
  const currentSegment = data.segments.find((segment) => segment.status === 'current')
  const nextSegment = data.segments.find((segment) => segment.status === 'upcoming')
  const progress = data.segments.length ? Math.round((completedCount / data.segments.length) * 100) : 0

  async function updateJourney(action: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await action()
      await router.invalidate()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your journey could not be updated.')
    } finally {
      setBusy(false)
    }
  }

  async function submitDelay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      await addJourneyDelay({
        data: {
          tripId: data.trip.id,
          delayMinutes: Number(form.get('delayMinutes')),
          message: String(form.get('message') ?? ''),
        },
      })
      await navigate({ to: '/journey/$tripId/delayed', params: { tripId: data.trip.id } })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The delay could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppLayout active="home">
      <div className={app.contentWrap}>
        <div className={styles.topline}>
          <Link className={app.buttonLink} to="/home">‹ My trips</Link>
          <Link className={app.buttonLink} to="/wallet">Wallet details</Link>
        </div>

        <section className={`${app.panel} ${styles.journeyHero}`}>
          <div className={styles.journeyIntro}>
            <p className={app.eyebrow}>Your journey</p>
            <h1 className={app.pageHeading}>{data.trip.destinationName}, here you come.</h1>
            <p className={app.pageIntro}>{data.trip.originName} to {data.trip.destinationName} on {formatDate(data.trip.departureDate)}.</p>
            <span className={`${app.statusPill} ${data.trip.status === 'delayed' ? app.statusDelayed : data.trip.status === 'completed' ? app.statusCompleted : ''}`}>
              <span className={app.statusDot} />{statusLabel(data.trip.status)}
            </span>
          </div>
          <div className={styles.progressVisual} aria-label={`${progress}% of journey complete`} role="img">
            <div className={styles.routeArtwork} aria-hidden="true">
              <span className={styles.routeStart} />
              <span className={styles.routeMiddle} />
              <span className={styles.routeEnd} />
              <span className={styles.routePath} />
            </div>
            <p>{completedCount} of {data.segments.length} steps complete</p>
          </div>
        </section>

        <div className={styles.journeyGrid}>
          <section className={`${app.panel} ${styles.timelinePanel}`}>
            <div className={styles.panelHeading}>
              <div><h2 className={app.sectionHeading}>Your route</h2><p className={app.sectionIntro}>{data.selectedOption?.title} · {formatDuration(data.selectedOption?.durationMinutes ?? 0)}</p></div>
              {data.trip.status === 'planned' && <Link className={app.buttonLink} to="/trip/$tripId/edit" params={{ tripId: data.trip.id }}>Edit plan</Link>}
            </div>

            <div className={styles.timeline}>
              {data.segments.map((segment, index) => (
                <article className={`${styles.timelineStep} ${segment.status === 'current' ? styles.currentStep : ''}`} key={segment.id}>
                  <div className={styles.timelineMarker} aria-hidden="true">
                    {segment.status === 'completed' ? '✓' : index + 1}
                  </div>
                  <div className={styles.timelineContent}>
                    <div className={styles.timelineTop}>
                      <div><p>{segment.mode}</p><h3>{segment.fromName} to {segment.toName}</h3></div>
                      <span>{segment.departureTime} to {segment.arrivalTime}</span>
                    </div>
                    {segment.note && <p className={styles.segmentNote}>{segment.note}</p>}
                    {segment.status === 'current' && <span className={styles.stepStatus}>Current step</span>}
                    {segment.status === 'completed' && <span className={styles.stepStatus}>Completed</span>}
                  </div>
                </article>
              ))}
            </div>

            {error && <p className={app.errorNotice} role="alert">{error}</p>}
            <div className={styles.journeyActions}>
              {data.trip.status === 'planned' && (
                <button className={app.buttonPrimary} type="button" disabled={busy} onClick={() => void updateJourney(() => startJourney({ data: { tripId: data.trip.id } }))}>
                  {busy ? 'Starting journey' : 'Start my journey'}
                </button>
              )}
              {data.trip.status === 'active' && currentSegment && (
                <button className={app.buttonPrimary} type="button" disabled={busy} onClick={() => void updateJourney(() => completeNextLeg({ data: { tripId: data.trip.id } }))}>
                  {busy ? 'Saving progress' : `Mark ${currentSegment.toName} reached`}
                </button>
              )}
              {data.trip.status === 'active' && nextSegment && !currentSegment && (
                <p className={app.notice}>All route steps are complete. Your journey is ready to close.</p>
              )}
              {data.trip.status === 'active' && (
                <button className={app.buttonSecondary} type="button" onClick={() => setDelayFormOpen((open) => !open)}>
                  {delayFormOpen ? 'Close delay form' : 'Log a delay'}
                </button>
              )}
              {data.trip.status === 'delayed' && (
                <Link className={app.buttonPrimary} to="/journey/$tripId/delayed" params={{ tripId: data.trip.id }}>View delay update</Link>
              )}
              {data.trip.status === 'completed' && <p className={app.notice}>You have completed this journey.</p>}
            </div>

            {delayFormOpen && data.trip.status === 'active' && (
              <form className={styles.delayForm} onSubmit={submitDelay}>
                <h3>Log the change</h3>
                <div className={styles.delayFields}>
                  <label className={app.field}>
                    <span className={app.fieldLabel}>Delay in minutes</span>
                    <input className={app.fieldControl} type="number" name="delayMinutes" min="1" max="1440" defaultValue="15" required />
                  </label>
                  <label className={app.field}>
                    <span className={app.fieldLabel}>What changed?</span>
                    <input className={app.fieldControl} name="message" minLength={3} maxLength={240} required aria-label="Describe the travel delay" />
                  </label>
                </div>
                <button className={app.buttonSecondary} type="submit" disabled={busy}>{busy ? 'Saving update' : 'Save delay update'}</button>
              </form>
            )}
          </section>

          <aside className={styles.sideColumn}>
            <section className={`${app.panel} ${styles.nextCard}`}>
              <p className={app.eyebrow}>Next step</p>
              {currentSegment ? (
                <><h2>{currentSegment.toName}</h2><p>Continue by {currentSegment.mode.toLowerCase()} from {currentSegment.fromName}.</p></>
              ) : nextSegment ? (
                <><h2>{nextSegment.fromName}</h2><p>Your first step is {nextSegment.mode.toLowerCase()} to {nextSegment.toName}.</p></>
              ) : (
                <><h2>Journey complete</h2><p>Your route steps have been marked complete.</p></>
              )}
            </section>
            <section className={`${app.panel} ${styles.updatesCard}`}>
              <h2 className={app.sectionHeading}>Your updates</h2>
              <p className={styles.manualNote}>Status changes are based on the updates you log. Flow does not receive operator alerts.</p>
              {data.events.length ? (
                <ol className={styles.eventList}>
                  {data.events.slice(0, 4).map((event) => (
                    <li key={event.id}>
                      <span>{event.type === 'delay' ? `${event.delayMinutes} minute delay` : event.message}</span>
                      <time dateTime={new Date(event.createdAt).toISOString()}>{formatTime(event.createdAt)}</time>
                    </li>
                  ))}
                </ol>
              ) : <p className={styles.emptyUpdates}>Journey updates appear here as you log them.</p>}
            </section>
          </aside>
        </div>
      </div>
    </AppLayout>
  )
}

function statusLabel(status: string) {
  const labels: Record<string, string> = { planned: 'Ready to start', active: 'In progress', delayed: 'Delayed', completed: 'Completed' }
  return labels[status] ?? 'Planning'
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`
}

function formatTime(value: number) {
  return new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
