import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import AppLayout from '../components/AppLayout'
import { CalendarDays } from 'lucide-react'
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
  const { trip, options, sources } = Route.useLoaderData()
  const navigate = useNavigate()
  const [activeOptionId, setActiveOptionId] = useState(() => trip.selectedOptionId ?? options[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const activeOption = options.find((option) => option.id === activeOptionId) ?? options[0]
  const activeRouteDetails = activeOption
  const shortestOptionId = options.reduce((shortest, option) =>
    option.durationMinutes < shortest.durationMinutes ? option : shortest,
  options[0])?.id
  const lowestOptionId = options.reduce((lowest, option) =>
    estimatedTotal(option.priceCents, option.priceBasis, trip.travelers) < estimatedTotal(lowest.priceCents, lowest.priceBasis, trip.travelers) ? option : lowest,
  options[0])?.id

  async function select() {
    if (!activeOption) return
    setBusy(true)
    setError('')
    try {
      await chooseTripOption({ data: { tripId: trip.id, optionId: activeOption.id } })
      await navigate({ to: '/trip/$tripId/edit', params: { tripId: trip.id } })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The route could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppLayout active="plan">
      <div className={app.contentWrap}>
        <header className={styles.heading}>
          <Link className={styles.backLink} to="/trip/search" aria-label="Back to destination search">
            <span aria-hidden="true">‹</span>
          </Link>
          <div className={styles.headingCopy}>
            <h1>Compare routes</h1>
            <p>
              <span>{trip.originName} to {trip.destinationName}</span>
              <CalendarDays size={14} aria-hidden="true" />
              <span>{formatDate(trip.departureDate)}</span>
            </p>
          </div>
          <Link className={styles.flowMark} to="/home" aria-label="Flow home"><img src="/assets/flow-mark-header.svg" alt="" /></Link>
        </header>

        {error && <p className={app.errorNotice} role="alert">{error}</p>}
        {trip.plannerNotes && <section className={`${app.panel} ${styles.veloPlan}`} aria-labelledby="velo-plan-heading"><h2 id="velo-plan-heading">Your plan from Velo</h2><p>{trip.plannerNotes}</p>{sources.length > 0 && <details className={styles.guideSources}><summary>Sources</summary><div>{sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>{source.title}{source.license ? ' (Wikivoyage contributors)' : ''}</a>)}{sources.some((source) => source.license === 'CC BY-SA 4.0') && <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">Guide-based text adapted under CC BY-SA 4.0</a>}</div></details>}</section>}

        {options.length ? (
          <>
            <section className={styles.optionGrid} aria-label="Available route estimates">
              {options.map((option) => {
                const isActive = option.id === activeOptionId
                const estimate = estimatedTotal(option.priceCents, option.priceBasis, trip.travelers)
                const routeDetails = option
                const legs = routeDetails?.legs ?? []
                const priceCaption = option.priceBasis === 'perVehicle'
                  ? 'per vehicle'
                  : `for ${trip.travelers} ${trip.travelers === 1 ? 'traveler' : 'travelers'}`

                return (
                  <article className={`${app.panel} ${styles.optionCard} ${isActive ? styles.optionSelected : ''}`} key={option.id}>
                    <button
                      className={styles.optionSelect}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setActiveOptionId(option.id)}
                    >
                      <span className={styles.cardBadges}>
                        {option.id === shortestOptionId && <span className={styles.fastest}>{option.id === lowestOptionId ? 'Shortest and lowest' : 'Shortest time'}</span>}
                        {option.id === lowestOptionId && option.id !== shortestOptionId && <span className={styles.lowest}>Lowest estimate</span>}
                      </span>
                      <span className={styles.optionTitle}>{option.title}</span>
                      <span className={styles.legIcons} role="img" aria-label={legs.map((leg) => leg.mode).join(' then ') || option.mode}>
                        {legs.map((leg, index) => (
                          <span className={styles.legIcon} key={`${leg.mode}-${index}`} title={leg.mode}>
                            <img src={modeIcon(leg.mode)} alt="" />
                          </span>
                        ))}
                      </span>
                      <span className={styles.optionDuration}>{formatDuration(option.durationMinutes)}</span>
                      <span className={styles.optionPrice}>
                        <strong>{formatMoney(estimate, option.currency)}</strong>
                        <span>{priceCaption}</span>
                      </span>
                      <span className={styles.optionChanges}>
                        {option.changes === 0 ? 'Direct' : `${option.changes} ${option.changes === 1 ? 'change' : 'changes'}`}
                      </span>
                    </button>
                    <details className={styles.details}>
                      <summary>About this estimate</summary>
                      <p>{option.summary}</p>
                      {routeDetails?.sourceUrl && (
                        <p className={styles.sourceNote}>
                          Source: <a href={routeDetails.sourceUrl} target="_blank" rel="noreferrer">{routeDetails.sourceLabel}</a>
                        </p>
                      )}
                      {!routeDetails.sourceUrl && <p>{option.sourceLabel}</p>}
                    </details>
                  </article>
                )
              })}
            </section>

            {activeOption && (
              <section className={`${app.panel} ${styles.estimateDetails}`} aria-labelledby="estimate-details-heading">
                <span className={styles.sparkleBadge} aria-hidden="true">
                  <img src="/assets/home-sparkle.svg" alt="" />
                  <img src="/assets/where-to/sparkle-small.svg" alt="" />
                </span>
                <div>
                  <h2 id="estimate-details-heading">About this estimate</h2>
                  <p>{activeOption.summary}</p>
                  <span className={styles.sourceLine}>
                    {activeRouteDetails?.sourceUrl
                      ? <>Source: <a href={activeRouteDetails.sourceUrl} target="_blank" rel="noreferrer">{activeRouteDetails.sourceLabel}</a></>
                       : activeOption.sourceLabel}
                  </span>
                </div>
              </section>
            )}

            <div className={styles.actionArea}>
              <button className={app.buttonPrimary} type="button" disabled={busy || !activeOption} onClick={() => void select()}>
                {busy ? 'Saving route' : trip.selectedOptionId === activeOption?.id ? 'Keep this route' : 'Choose this route'}
              </button>
              <p>Review the route before starting your journey.</p>
            </div>
          </>
        ) : (
          <p className={app.notice}>There are no route estimates available for this trip.</p>
        )}
      </div>
    </AppLayout>
  )
}

function estimatedTotal(priceCents: number, priceBasis: 'perTraveler' | 'perVehicle', travelers: number) {
  return priceBasis === 'perVehicle' ? priceCents : priceCents * travelers
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-GB', {
    day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC',
  })
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return hours ? `${hours}h ${remainder.toString().padStart(2, '0')}m` : `${remainder} min`
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(cents / 100)
}

function modeIcon(mode: string) {
  const normalized = mode.toLowerCase()
  if (normalized.includes('train') || normalized.includes('metro')) return '/assets/transport-train.svg'
  if (normalized.includes('bus') || normalized.includes('coach')) return '/assets/transport-bus.svg'
  return '/assets/transport-taxi.svg'
}
