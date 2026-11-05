import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouter, useRouterState } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import AppLayout from '../components/AppLayout'
import TripMap from '../components/TripMap'
import TripEndpoints from '../components/TripEndpoints'
import {
  addJourneyDelay,
  completeNextLeg,
  getCurrentUser,
  getTripDetails,
  startJourney,
} from '../server/functions'
import app from '../styles/app.module.css'
import FlowLoader from '../components/FlowLoader'
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
  component: JourneyRoute,
})

function JourneyRoute() {
  const isDelayPage = useRouterState({ select: (state) => state.matches.some((match) => match.routeId === '/journey/$tripId/delayed') })
  return isDelayPage ? <Outlet /> : <JourneyPage />
}

function JourneyPage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()
  const [pending, setPending] = useState<'' | 'progress' | 'delay'>('')
  const busy = pending !== ''
  const [error, setError] = useState('')
  const [delayFormOpen, setDelayFormOpen] = useState(false)
  const completedCount = data.segments.filter((segment) => segment.status === 'completed').length
  const currentSegment = data.segments.find((segment) => segment.status === 'current')
  const nextSegment = data.segments.find((segment) => segment.status === 'upcoming')
  const nextStopName = currentSegment?.toName ?? nextSegment?.toName ?? data.trip.destinationName
  const nextLeg = currentSegment ?? nextSegment

  async function updateJourney(action: () => Promise<unknown>) {
    setPending('progress')
    setError('')
    try {
      await action()
      await router.invalidate()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your journey could not be updated.')
    } finally {
      setPending('')
    }
  }

  async function submitDelay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending('delay')
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
      setPending('')
    }
  }

  return (
    <AppLayout active="home" mobileNavigation={false}>
      <div className={styles.screen}>
        <section className={styles.mapScene} aria-label="Journey map">
          <div className={styles.mapCanvas}><TripMap destinationCode={data.trip.destinationCode} originCity={data.originCity ?? undefined} destinationCity={data.destinationCity ?? undefined} pickupLocation={data.trip.pickupLocation} dropoffLocation={data.trip.dropoffLocation} /></div>
          <header className={styles.pageHeader}>
            <Link className={styles.backLink} to="/home" aria-label="Back to my trips">
              <img src="/assets/figma/journey/back-arrow.svg" alt="" />
            </Link>
            <h1 className={styles.visuallyHidden}>Your journey</h1>
            <Link className={styles.flowMark} to="/home" aria-label="Flow home"><img src="/assets/flow-mark-header.svg" alt="" /></Link>
          </header>
        </section>

        <div className={styles.journeySheet}>
          <img className={styles.sheetHandle} src="/assets/figma/journey/sheet-handle.svg" alt="" />
          <div className={styles.sheetContent}>
            <TripEndpoints trip={data.trip} />
            <section className={`${app.panel} ${styles.nextCard}`}>
              <p className={styles.nextEyebrow}>{data.trip.status === 'completed' ? 'Destination' : 'Next stop'}</p>
              <h2>{nextStopName}</h2>
              <p className={styles.nextMeta}>
                {nextLeg ? `${nextLeg.mode} ${nextLeg.status === 'current' ? 'in progress' : 'up next'}` : 'Journey complete'}
              </p>
              <div className={styles.nextActions}>
                <a href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(nextStopName)}`} target="_blank" rel="noreferrer">
                  View on map <span aria-hidden="true">↗</span>
                </a>
                {data.trip.status === 'planned' && <Link to="/trip/$tripId/edit" params={{ tripId: data.trip.id }}>Edit trip</Link>}
              </div>
            </section>

            <div className={styles.journeyLabel}>
              <span>Your journey</span>
              <span className={styles.progressCount}>{completedCount} of {data.segments.length} complete</span>
            </div>

            <section className={`${app.panel} ${styles.timelinePanel}`} aria-label="Journey steps">
              <div className={styles.timeline}>
                {data.segments.map((segment) => (
                  <JourneyStep
                    key={segment.id}
                    segment={segment}
                  />
                ))}
                {!data.segments.length && <p className={styles.emptyTimeline}>No journey steps have been added yet.</p>}
              </div>
            </section>

            <p className={styles.manualNote}>Mark each step reached to update your journey.</p>

            {error && <p className={app.errorNotice} role="alert">{error}</p>}
            <section className={styles.actionPanel} aria-label="Journey actions">
              {data.trip.status === 'planned' && (
                <button className={app.buttonPrimary} type="button" disabled={busy} data-pending={pending === 'progress' || undefined} onClick={() => void updateJourney(() => startJourney({ data: { tripId: data.trip.id } }))}>
                  {pending === 'progress' && <FlowLoader />}
                  {pending === 'progress' ? 'Starting journey' : 'Start my journey'}
                </button>
              )}
              {data.trip.status === 'active' && currentSegment && (
                <button className={app.buttonPrimary} type="button" disabled={busy} data-pending={pending === 'progress' || undefined} onClick={() => void updateJourney(() => completeNextLeg({ data: { tripId: data.trip.id } }))}>
                  {pending === 'progress' && <FlowLoader />}
                  {pending === 'progress' ? 'Saving progress' : `Mark ${currentSegment.toName} reached`}
                </button>
              )}
              {data.trip.status === 'active' && !currentSegment && (
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
            </section>

            {delayFormOpen && data.trip.status === 'active' && (
              <form className={styles.delayForm} onSubmit={submitDelay}>
                <h2>Log a journey change</h2>
                <p>Add the details of your journey update.</p>
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
                <button className={app.buttonSecondary} type="submit" disabled={busy} data-pending={pending === 'delay' || undefined}>{pending === 'delay' && <FlowLoader />}{pending === 'delay' ? 'Saving update' : 'Save delay update'}</button>
              </form>
            )}

            <footer className={styles.footerLinks}>
              <Link to="/wallet">Wallet details</Link>
              {data.trip.status === 'planned' && <Link to="/trip/$tripId/edit" params={{ tripId: data.trip.id }}>Edit trip details</Link>}
            </footer>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

type JourneySegment = { id: string; mode: string; fromName: string; toName: string; departureTime: string; arrivalTime: string; departureDay: number; arrivalDay: number; status: string; note: string | null }

function JourneyStep({ segment }: { segment: JourneySegment }) {
  const status = segment.status === 'completed' ? 'completed' : segment.status === 'current' ? 'ongoing' : 'upcoming'
  const hasDayLabels = segment.departureDay > 0 || segment.arrivalDay > 0
  const departure = hasDayLabels ? `${segment.departureTime} (Day ${segment.departureDay + 1})` : segment.departureTime
  const arrival = hasDayLabels ? `${segment.arrivalTime} (Day ${segment.arrivalDay + 1})` : segment.arrivalTime
  const rolloverDays = Math.max(0, segment.arrivalDay - segment.departureDay)
  const statusIcon = status === 'completed'
    ? '/assets/figma/journey/check-completed.svg'
    : status === 'ongoing'
      ? '/assets/figma/journey/check-ongoing.svg'
      : '/assets/figma/journey/check-upcoming.svg'
  const modeIcon = getModeIcon(segment.mode)
  const isRasterIcon = modeIcon?.endsWith('.png') ?? false
  const isTrain = segment.mode.toLowerCase() === 'train'
  const badgeIcon = isTrain
    ? '/assets/figma/journey/train-badge.svg'
    : '/assets/figma/journey/icon-badge.svg'

  return (
    <article className={`${styles.timelineStep} ${status === 'ongoing' ? styles.currentStep : ''}`}>
      <div className={styles.modeBadge} aria-hidden="true">
        <img className={styles.badgeArtwork} src={badgeIcon} alt="" />
        {!isTrain && (modeIcon ? <img className={isRasterIcon ? styles.modeGlyphRaster : styles.modeGlyph} src={modeIcon} alt="" /> : <span className={styles.modeInitial}>{segment.mode.slice(0, 1)}</span>)}
      </div>
      <div className={styles.timelineContent}>
        <div className={styles.segmentHeading}>
          <div className={styles.segmentName}>
            <h3>{segment.mode}</h3>
            <p>{segment.fromName} to {segment.toName}</p>
          </div>
          <span className={`${styles.stepStatus} ${styles[status]}`}>
            <img src={statusIcon} alt="" />
            {status === 'ongoing' ? 'Ongoing' : status === 'completed' ? 'Completed' : 'Upcoming'}
          </span>
        </div>
        <p className={styles.segmentTime}>
          <span>{departure} to {arrival}</span>
          {rolloverDays > 0 && <span className={styles.dayRollover}>+{rolloverDays} day{rolloverDays === 1 ? '' : 's'}</span>}
        </p>
        {segment.note && <p className={styles.segmentNote}>{segment.note}</p>}
      </div>
    </article>
  )
}

function getModeIcon(mode: string) {
  const normalized = mode.toLowerCase()
  if (normalized.includes('train') || normalized.includes('metro') || normalized.includes('rail')) return '/assets/figma/journey/train.svg'
  if (normalized.includes('cab') || normalized.includes('taxi') || normalized.includes('car')) return '/assets/figma/journey/taxi.svg'
  if (normalized.includes('auto')) return '/assets/figma/journey/auto.png'
  if (normalized.includes('bus') || normalized.includes('coach')) return '/assets/transport-bus.svg'
  return null
}
