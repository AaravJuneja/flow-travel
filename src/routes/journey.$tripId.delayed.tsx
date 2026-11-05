import { createFileRoute, Link, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import AppLayout from '../components/AppLayout'
import { TriangleAlert } from 'lucide-react'
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
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const latestDelay = data.events.find((event) => event.type === 'delay')
  const delayMinutes = latestDelay?.delayMinutes ?? 0

  async function resolve() {
    setBusy(true)
    setError('')
    try {
      await resolveJourneyDelay({ data: { tripId: data.trip.id } })
      await navigate({ to: '/journey/$tripId', params: { tripId: data.trip.id } })
      await router.invalidate()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The update could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppLayout active="home" mobileNavigation={false}>
      <div className={styles.screen}>
        <div className={styles.content}>
          <header className={styles.pageHeader}>
            <Link className={styles.backLink} to="/journey/$tripId" params={{ tripId: data.trip.id }} aria-label="Back to journey">
              <img src="/assets/figma/journey-delay/back-arrow.svg" alt="" />
            </Link>
            <div className={styles.heading}>
              <h1>View Journey</h1>
              <p>{data.trip.originName} to {data.trip.destinationName} on {formatDate(data.trip.departureDate)}</p>
            </div>
            <Link className={styles.flowMark} to="/home" aria-label="Flow home"><img src="/assets/flow-mark-header.svg" alt="" /></Link>
          </header>

          <section className={styles.delayNotice} aria-labelledby="delay-title">
            <div className={styles.delayHeading}>
              <span className={styles.warningIcon} aria-hidden="true">
                <TriangleAlert size={24} strokeWidth={1.6} />
              </span>
              <div>
                <h2 id="delay-title">You reported a delay of <strong>{delayMinutes} minutes</strong></h2>
                <p>{latestDelay?.message ?? 'Your journey update has been recorded.'}</p>
                <p className={styles.delayLogged}>Logged by you at {latestDelay ? formatTime(latestDelay.createdAt) : 'the latest update'}.</p>
              </div>
            </div>
            <p className={styles.delayCopy}>Your journey update is saved.</p>
          </section>

          <div className={styles.sectionLabel}>Updated journey</div>
          <section className={`${app.panel} ${styles.timelinePanel}`} aria-label="Updated journey steps">
            {data.segments.map((segment) => (
              <DelayStep key={segment.id} segment={segment} />
            ))}
            {!data.segments.length && <p className={styles.emptyTimeline}>No journey steps have been added yet.</p>}
            {error && <p className={app.errorNotice} role="alert">{error}</p>}
            <div className={styles.actions}>
              <button className={app.buttonPrimary} type="button" disabled={busy} onClick={() => void resolve()}>
                {busy ? 'Saving update' : 'Mark as resolved'}
              </button>
              <Link className={app.buttonSecondary} to="/journey/$tripId" params={{ tripId: data.trip.id }}>View updated journey</Link>
            </div>
          </section>

          <p className={styles.reassurance}>Mark the delay resolved when you’re ready to continue.</p>
        </div>
        <div className={styles.routeArtwork} aria-hidden="true">
          <img className={styles.routeCurve} src="/assets/figma/journey-delay/route-curve.svg" alt="" />
        </div>
      </div>
    </AppLayout>
  )
}

type DelaySegment = { id: string; mode: string; fromName: string; toName: string; departureTime: string; arrivalTime: string; departureDay: number; arrivalDay: number; status: string; note: string | null }

function DelayStep({ segment }: { segment: DelaySegment }) {
  const isCurrent = segment.status === 'current'
  const isCompleted = segment.status === 'completed'
  const icon = getModeIcon(segment.mode)
  const dayLabels = segment.departureDay > 0 || segment.arrivalDay > 0
  const departure = dayLabels ? `${segment.departureTime} (Day ${segment.departureDay + 1})` : segment.departureTime
  const arrival = dayLabels ? `${segment.arrivalTime} (Day ${segment.arrivalDay + 1})` : segment.arrivalTime
  const rolloverDays = Math.max(0, segment.arrivalDay - segment.departureDay)

  return (
    <article className={styles.timelineStep}>
      <div className={styles.modeBadge} aria-hidden="true">
        <img className={styles.badgeArtwork} src={isCurrent ? '/assets/figma/journey-delay/train-badge.svg' : '/assets/figma/journey-delay/cab-badge.svg'} alt="" />
        {icon ? <img className={styles.modeGlyph} src={icon} alt="" /> : <span className={styles.modeInitial}>{segment.mode.slice(0, 1)}</span>}
      </div>
      <div className={styles.segmentContent}>
        <div className={styles.segmentHeading}>
          <h3>{segment.mode}</h3>
          <span className={isCompleted ? styles.completed : isCurrent ? styles.ongoing : styles.upcoming}>
            {isCompleted ? 'Completed' : isCurrent ? 'Current step' : 'Upcoming'}
          </span>
        </div>
        <p className={styles.segmentRoute}>{segment.fromName} to {segment.toName}</p>
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
  if (normalized.includes('train') || normalized.includes('metro') || normalized.includes('rail')) return '/assets/figma/journey-delay/train.svg'
  if (normalized.includes('cab') || normalized.includes('taxi') || normalized.includes('car')) return '/assets/figma/journey-delay/taxi.svg'
  if (normalized.includes('bus') || normalized.includes('coach')) return '/assets/transport-bus.svg'
  return null
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function formatTime(value: number) {
  return new Date(value).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })
}
