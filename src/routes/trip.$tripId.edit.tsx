import { createFileRoute, Link, redirect, useRouter } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'
import AppLayout from '../components/AppLayout'
import { getCurrentUser, getTripDetails, updateTripPlan } from '../server/functions'
import app from '../styles/app.module.css'
import styles from './trip-edit.module.css'

export const Route = createFileRoute('/trip/$tripId/edit')({
  beforeLoad: async () => {
    if (!(await getCurrentUser())) throw redirect({ to: '/login' })
  },
  loader: async ({ params }) => {
    const data = await getTripDetails({ data: { tripId: params.tripId } })
    if (!data.selectedOption) throw redirect({ to: '/trip/$tripId/options', params: { tripId: params.tripId } })
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

  useEffect(() => setToday(localDate(0)), [])

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

  return (
    <AppLayout name={undefined} active="home">
      <div className={app.narrowWrap}>
        <div className={styles.backLink}><Link className={app.buttonLink} to="/home">‹ My trips</Link></div>
        <header className={styles.heading}>
          <p className={app.eyebrow}>Your route is saved</p>
          <h1 className={app.pageHeading}>Make it fit your day.</h1>
          <p className={app.pageIntro}>{data.trip.originName} to {data.trip.destinationName} by {data.selectedOption?.mode.toLowerCase()}.</p>
        </header>

        <form className={styles.editForm} onSubmit={submit}>
          <section className={`${app.panel} ${styles.tripSettings}`}>
            <div className={styles.sectionHeader}>
              <div><h2 className={app.sectionHeading}>Trip details</h2><p className={app.sectionIntro}>Change the date, time, or traveler count.</p></div>
              <Link className={app.buttonLink} to="/trip/$tripId/options" params={{ tripId: data.trip.id }}>Change route</Link>
            </div>
            <div className={app.formGrid}>
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
              <div><h2 className={app.sectionHeading}>Your itinerary</h2><p className={app.sectionIntro}>{data.selectedOption?.title} · {formatDuration(data.selectedOption?.durationMinutes ?? 0)}</p></div>
            </div>
            <div className={styles.segmentList}>
              {data.segments.map((segment, index) => (
                <div className={styles.segment} key={segment.id}>
                  <div className={styles.segmentMarker} aria-hidden="true"><span>{index + 1}</span></div>
                  <div className={styles.segmentContent}>
                    <div className={styles.segmentTop}>
                      <div><p>{segment.mode}</p><h3>{segment.fromName} to {segment.toName}</h3></div>
                      <span>{segment.departureTime} to {segment.arrivalTime}</span>
                    </div>
                    <label className={app.field}>
                      <span className={app.fieldLabel}>Note for this step</span>
                      <input className={app.fieldControl} name={`note-${segment.id}`} defaultValue={segment.note} maxLength={240} aria-label={`Note for ${segment.mode} from ${segment.fromName} to ${segment.toName}`} />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className={styles.saveRow}>
            <div>
              {error && <p className={app.errorNotice} role="alert">{error}</p>}
              {saved && <p className={app.notice} role="status">Your trip details are saved.</p>}
            </div>
            <button className={app.buttonPrimary} type="submit" disabled={busy}>{busy ? 'Saving changes' : 'Save changes'}</button>
          </div>
        </form>

        <div className={styles.startRow}>
          <div><h2>Ready when you are.</h2><p>Start the journey when you are ready to go.</p></div>
          <Link className={app.buttonSecondary} to="/journey/$tripId" params={{ tripId: data.trip.id }}>Open journey <span aria-hidden="true">↗</span></Link>
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

function localDate(offsetDays: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}
