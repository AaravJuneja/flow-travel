import { createFileRoute, Link, redirect, useRouter } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'
import AppLayout from '../components/AppLayout'
import { chooseTripOption, getCurrentUser, getTripDetails, updateTripPlan } from '../server/functions'
import app from '../styles/app.module.css'
import styles from './trip-edit.module.css'

export const Route = createFileRoute('/trip/$tripId/edit')({
  beforeLoad: async () => {
    if (!(await getCurrentUser())) throw redirect({ to: '/login' })
  },
  loader: async ({ params }) => {
    const data = await getTripDetails({ data: { tripId: params.tripId } })
    if (!data.selectedOption) throw redirect({ to: '/trip/$tripId/options', params: { tripId: params.tripId } })
    if (data.trip.status !== 'planned' && data.trip.status !== 'planning') throw redirect({ to: '/journey/$tripId', params: { tripId: params.tripId } })
    return data
  },
  head: () => ({ meta: [{ title: 'Edit your trip | Flow' }] }),
  component: EditTripPage,
})

function EditTripPage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [today, setToday] = useState('')
  const [optionId, setOptionId] = useState(data.trip.selectedOptionId ?? '')

  useEffect(() => setToday(localDate(0)), [])
  useEffect(() => setOptionId(data.trip.selectedOptionId ?? ''), [data.trip.selectedOptionId])

  async function changeRoute() {
    setBusy(true)
    setError('')
    setSaved(false)
    try {
      await chooseTripOption({ data: { tripId: data.trip.id, optionId } })
      await router.invalidate()
      setSaved(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The route could not be changed.')
    } finally {
      setBusy(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setSaved(false)
    const form = new FormData(event.currentTarget)
    try {
      await updateTripPlan({
        data: {
          tripId: data.trip.id,
          departureDate: String(form.get('departureDate') ?? ''),
          departureTime: String(form.get('departureTime') ?? ''),
          travelers: Number(form.get('travelers')),
          notes: data.segments.map((segment) => ({
            segmentId: segment.id,
            note: String(form.get(`note-${segment.id}`) ?? ''),
          })),
        },
      })
      await router.invalidate()
      setSaved(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your changes could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  const option = data.selectedOption!
  const estimateCents = option.priceBasis === 'perVehicle'
    ? option.priceCents
    : option.priceCents * data.trip.travelers

  return (
    <AppLayout name={undefined} active="plan" mobileNavigation={false}>
      <div className={styles.screen}>
        <div className={styles.content}>
          <header className={styles.pageHeader}>
            <Link className={styles.backLink} to="/home" aria-label="Back to my trips">
              <img src="/assets/figma/trip-edit/back-arrow.svg" alt="" />
            </Link>
            <div className={styles.heading}>
              <h1>Make it yours</h1>
              <p>Change any part of your route</p>
            </div>
            <Link className={styles.flowMark} to="/home" aria-label="Flow home"><img src="/assets/flow-mark-header.svg" alt="" /></Link>
          </header>

          <section className={`${app.panel} ${styles.routeSummary}`} aria-label="Selected route">
            <span className={styles.routeModeBadge} aria-hidden="true">
              <img className={styles.routeModeIcon} src={getModeIcon(option.mode)} alt="" />
            </span>
            <div className={styles.routeSummaryText}>
              <h2>{option.mode}</h2>
              <p className={styles.routeStops}>{data.trip.originName} to {data.trip.destinationName}</p>
              <div className={styles.routeStats}>
                <span>{formatDuration(option.durationMinutes)}</span>
                <span>{formatMoney(estimateCents, option.currency)}</span>
                <span className={styles.estimateLabel}>estimate</span>
              </div>
            </div>
            <Link className={styles.changeRoute} to="/trip/$tripId/options" params={{ tripId: data.trip.id }}>
              Change
            </Link>
          </section>

          {data.options.length > 1 && <section className={`${app.panel} ${styles.routePicker}`} aria-labelledby="route-options-title">
            <h2 id="route-options-title">Choose a different option</h2>
            <div className={styles.modeTabs} aria-label="Route type">
              {data.options.map((choice) => <button type="button" key={choice.id} aria-pressed={choice.id === optionId} disabled={busy} onClick={() => { setOptionId(choice.id); setSaved(false) }}>{choice.mode}</button>)}
            </div>
            <div className={styles.routeChoices}>
              {data.options.map((choice) => (
                <button
                  className={`${styles.routeChoice} ${choice.id === optionId ? styles.routeChoiceSelected : ''}`}
                  type="button"
                  key={choice.id}
                  aria-pressed={choice.id === optionId}
                  disabled={busy}
                  onClick={() => { setOptionId(choice.id); setSaved(false) }}
                >
                  <span>
                    <strong>{choice.title}</strong>
                    <small>{formatDuration(choice.durationMinutes)}</small>
                    <small>{choice.priceBasis === 'perVehicle' ? 'Per vehicle' : `For ${data.trip.travelers} ${data.trip.travelers === 1 ? 'traveler' : 'travelers'}`}</small>
                  </span>
                  <strong>{formatMoney(choice.priceBasis === 'perVehicle' ? choice.priceCents : choice.priceCents * data.trip.travelers, choice.currency)}</strong>
                </button>
              ))}
            </div>
            {error && <p className={app.errorNotice} role="alert">{error}</p>}
            {saved && <p className={app.notice} role="status">Your route is saved.</p>}
            <button className={`${app.buttonPrimary} ${styles.saveButton}`} type="button" disabled={busy} onClick={() => void changeRoute()}>{busy ? 'Updating route' : 'Update route'}</button>
          </section>}

          <details className={styles.detailsDisclosure} open={data.options.length === 1}>
            <summary>Trip details and notes <span aria-hidden="true">⌄</span></summary>
          <form className={styles.editForm} onSubmit={submit}>
            <section className={`${app.panel} ${styles.tripSettings}`}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2>Trip details</h2>
                  <p>Set your date, departure time, and travelers.</p>
                </div>
              </div>
              <div className={`${app.formGrid} ${styles.tripFields}`}>
                <label className={app.field}>
                  <span className={app.fieldLabel}>Travel date</span>
                  <input className={app.fieldControl} type="date" name="departureDate" min={today} defaultValue={data.trip.departureDate} required />
                </label>
                <label className={app.field}>
                  <span className={app.fieldLabel}>Leave around</span>
                  <input className={app.fieldControl} type="time" name="departureTime" defaultValue={data.trip.departureTime} required />
                </label>
                <label className={`${app.field} ${app.fieldWide}`}>
                  <span className={app.fieldLabel}>Travelers</span>
                  <select className={app.fieldControl} name="travelers" defaultValue={data.trip.travelers}>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => <option key={count} value={count}>{count} {count === 1 ? 'traveler' : 'travelers'}</option>)}
                  </select>
                </label>
              </div>
            </section>

            <section className={`${app.panel} ${styles.itinerary}`}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2>Your itinerary</h2>
                  <p>{option.title}, {formatDuration(option.durationMinutes)}</p>
                </div>
              </div>
              <div className={styles.segmentList}>
                {data.segments.map((segment, index) => {
                  const times = formatSegmentTimes(segment)
                  const rolloverDays = segment.arrivalDay - segment.departureDay
                  return (
                    <article className={styles.segment} key={segment.id}>
                      <span className={styles.segmentMarker} aria-hidden="true">{index + 1}</span>
                      <div className={styles.segmentContent}>
                        <div className={styles.segmentTop}>
                          <div>
                            <p>{segment.mode}</p>
                            <h3>{segment.fromName} to {segment.toName}</h3>
                          </div>
                          <div className={styles.segmentSchedule}>
                            <span>{times.departure} to {times.arrival}</span>
                            {rolloverDays > 0 && <span className={styles.dayRollover}>+{rolloverDays} day{rolloverDays === 1 ? '' : 's'}</span>}
                          </div>
                        </div>
                        <label className={app.field}>
                          <span className={app.fieldLabel}>Note for this step</span>
                          <input className={app.fieldControl} name={`note-${segment.id}`} defaultValue={segment.note} maxLength={240} aria-label={`Note for ${segment.mode} from ${segment.fromName} to ${segment.toName}`} />
                        </label>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>

            {error && <p className={app.errorNotice} role="alert">{error}</p>}
            {saved && <p className={app.notice} role="status">Your trip details are saved.</p>}
            <button className={`${app.buttonPrimary} ${styles.saveButton}`} type="submit" disabled={busy}>
              {busy ? 'Saving changes' : 'Save trip details'}
            </button>
          </form>
          </details>

          <footer className={styles.journeyLink}>
            <span>Ready to go?</span>
            <Link to="/journey/$tripId" params={{ tripId: data.trip.id }}>Open journey <span aria-hidden="true">↗</span></Link>
          </footer>
        </div>
      </div>
    </AppLayout>
  )
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return hours ? `${hours}h ${remainder.toString().padStart(2, '0')}m` : `${remainder} min`
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100)
}

function formatSegmentTimes(segment: { departureTime: string; arrivalTime: string; departureDay: number; arrivalDay: number }) {
  const includesDay = segment.departureDay > 0 || segment.arrivalDay > 0
  return {
    departure: includesDay ? `${segment.departureTime} (Day ${segment.departureDay + 1})` : segment.departureTime,
    arrival: includesDay ? `${segment.arrivalTime} (Day ${segment.arrivalDay + 1})` : segment.arrivalTime,
  }
}

function getModeIcon(mode: string) {
  const normalized = mode.toLowerCase()
  if (normalized.includes('train') || normalized.includes('metro') || normalized.includes('rail')) return '/assets/transport-train.svg'
  if (normalized.includes('cab') || normalized.includes('taxi') || normalized.includes('car')) return '/assets/transport-taxi.svg'
  return '/assets/transport-bus.svg'
}

function localDate(offsetDays: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}
