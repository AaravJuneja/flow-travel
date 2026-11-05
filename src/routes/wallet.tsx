import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import AppLayout from '../components/AppLayout'
import TripStatusIcon from '../components/TripStatusIcon'
import { CalendarDays, Check, Clock3 } from 'lucide-react'
import { createCheckoutSession, getCurrentUser, getWalletData } from '../server/functions'
import app from '../styles/app.module.css'
import FlowLoader from '../components/FlowLoader'
import styles from './wallet.module.css'

export const Route = createFileRoute('/wallet')({
  beforeLoad: async () => {
    if (!(await getCurrentUser())) throw redirect({ to: '/login' })
  },
  loader: () => getWalletData(),
  head: () => ({ meta: [{ title: 'Wallet | Flow' }] }),
  component: WalletPage,
})

function WalletPage() {
  const { user, items } = Route.useLoaderData()
  const [view, setView] = useState<'plans' | 'payments'>('plans')
  const [checkoutTripId, setCheckoutTripId] = useState('')
  const [checkoutError, setCheckoutError] = useState('')
  const [selectedTripId, setSelectedTripId] = useState(items[0]?.trip.id ?? '')
  const selected = items.find(({ trip }) => trip.id === selectedTripId) ?? items[0]
  const visibleItems = selected ? [selected] : []
  const firstTrip = selected?.trip
  const selectedRoute = selected?.option
  const selectedTotal = selected?.payment?.amountCents ?? (selected?.option
    ? estimatedTotal(selected.option.priceCents, selectedRoute?.priceBasis ?? 'perTraveler', selected.trip.travelers)
    : 0)

  useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) setCheckoutTripId('')
    }
    window.addEventListener('pageshow', reset)
    return () => window.removeEventListener('pageshow', reset)
  }, [])

  async function openCheckout(tripId: string) {
    setCheckoutTripId(tripId)
    setCheckoutError('')
    try {
      const { url } = await createCheckoutSession({ data: { tripId } })
      window.location.assign(url)
    } catch (cause) {
      setCheckoutError(cause instanceof Error ? cause.message : 'Checkout could not be opened.')
      setCheckoutTripId('')
    }
  }

  return (
    <AppLayout name={user.name} active="wallet" mobileNavigation={false}>
      <div className={`${app.contentWrap} ${styles.walletWrap}`}>
        <header className={styles.heading}>
          <Link className={styles.backLink} to="/home" aria-label="Back to my trips">‹</Link>
          <div>
            <h1 className={app.pageHeading}>Journey wallet</h1>
            <p className={app.pageIntro}>
              {firstTrip
                ? <><span>{firstTrip.originName} to {firstTrip.destinationName}</span><span className={styles.dateMeta}><CalendarDays size={14} aria-hidden="true" />{formatDate(firstTrip.departureDate)}</span></>
                : 'Your saved route plans and test payments'}
            </p>
          </div>
          <Link className={styles.flowMark} to="/home" aria-label="Flow home"><img src="/assets/flow-mark-header.svg" alt="" /></Link>
        </header>

        {checkoutError && <p className={app.errorNotice} role="alert">{checkoutError}</p>}
        {items.length > 1 && <label className={styles.planPicker}><span>Saved journey</span><select value={selected?.trip.id ?? ''} onChange={(event) => setSelectedTripId(event.currentTarget.value)} aria-label="Saved journey">{items.map(({ trip }) => <option value={trip.id} key={trip.id}>{trip.destinationName}, {formatDate(trip.departureDate)} at {trip.departureTime}</option>)}</select></label>}

        {items.length === 0 ? (
          <section className={`${app.panel} ${styles.emptyState}`}>
            <h2>No saved plans yet.</h2>
            <p>Choose a route estimate and save it here to keep your trip details together.</p>
            <Link className={app.buttonPrimary} to="/trip/search">Plan a trip</Link>
          </section>
        ) : (
          <section className={`${app.panel} ${styles.walletPanel}`} aria-label="Journey wallet">
            <div className={styles.walletTabs} aria-label="Wallet views">
              <button
                className={view === 'plans' ? styles.walletTabActive : ''}
                type="button"
                aria-pressed={view === 'plans'}
                onClick={() => setView('plans')}
              >
                <img src="/assets/nav-route.svg" alt="" />
                Saved plans
              </button>
              <button
                className={view === 'payments' ? styles.walletTabActive : ''}
                type="button"
                aria-pressed={view === 'payments'}
                onClick={() => setView('payments')}
              >
                <span className={styles.rupeeIcon} aria-hidden="true">₹</span>
                Payments
              </button>
            </div>

            {view === 'plans' ? (
              <div className={styles.walletList} aria-label="Saved trip plans">
                {visibleItems.map(({ item, trip, option, payment }) => {
                  const routeDetails = option
                  return (
                    <article className={styles.walletCard} key={item.id}>
                      <div className={styles.walletCardTop}>
                        <div className={styles.referenceBlock}>
                          <p className={styles.referenceLabel}>FLOW PLAN REFERENCE</p>
                          <p className={styles.referenceCode}>{item.referenceCode}</p>
                        </div>
                        <span className={app.statusPill}>
                          <TripStatusIcon status={trip.status} />{tripStatus(trip.status)}
                        </span>
                      </div>

                      {option ? (
                        <div className={styles.legList}>{(routeDetails?.legs ?? [{ mode: option.mode, fromName: trip.originName, toName: trip.destinationName, durationMinutes: option.durationMinutes }]).map((leg, index) => <div className={styles.routeEstimate} key={index}>
                          <span className={styles.transportBadge} aria-hidden="true">
                            <img src={modeIcon(leg.mode)} alt="" />
                          </span>
                          <div className={styles.routeCopy}>
                            <strong>{leg.mode}</strong>
                            <span>{leg.fromName} to {leg.toName}</span>
                            <span>{formatDuration(leg.durationMinutes)}</span>
                          </div>
                          <Link className={styles.viewLeg} to={trip.status === 'planned' ? '/trip/$tripId/edit' : '/journey/$tripId'} params={{ tripId: trip.id }}>View</Link>
                        </div>)}</div>
                      ) : (
                        <p className={styles.noRoute}>Choose a route estimate to add route details to this plan.</p>
                      )}

                      <div className={styles.cardActions}>
                        {trip.status === 'planning' && <Link className={app.buttonSecondary} to="/trip/$tripId/options" params={{ tripId: trip.id }}>Compare routes</Link>}
                        {trip.status === 'planned' && <Link className={app.buttonSecondary} to="/trip/$tripId/edit" params={{ tripId: trip.id }}>View plan</Link>}
                        {(trip.status === 'active' || trip.status === 'delayed' || trip.status === 'completed') && <Link className={app.buttonSecondary} to="/journey/$tripId" params={{ tripId: trip.id }}>Open journey</Link>}
                        {payment?.status === 'test_succeeded' && (
                          <span className={styles.checkoutComplete}>Test payment complete</span>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className={styles.paymentList} aria-label="Payments for saved plans">
                {visibleItems.map(({ item, trip, option, payment }) => {
                  const routeDetails = option
                  const amount = payment?.amountCents ?? (option
                    ? estimatedTotal(option.priceCents, routeDetails?.priceBasis ?? 'perTraveler', trip.travelers)
                    : null)
                  return (
                    <article className={styles.paymentCard} key={item.id}>
                      <div className={styles.paymentCardTop}>
                        <div>
                          <p className={styles.referenceLabel}>TEST PAYMENT</p>
                          <h2>{trip.originName} to {trip.destinationName}</h2>
                          <p>{formatDate(trip.departureDate)}<br />{option?.title ?? 'Route not selected'}</p>
                        </div>
                        <strong className={styles.paymentAmount}>
                          {amount === null || !option ? 'Not available' : formatMoney(amount, option.currency)}
                        </strong>
                      </div>
                      <div className={styles.paymentStatus}>
                        <span className={`${styles.statusMark} ${payment?.status === 'test_succeeded' ? styles.statusComplete : ''}`} aria-hidden="true">
                          {payment?.status === 'test_succeeded' ? <Check size={14} aria-hidden="true" /> : <Clock3 size={14} aria-hidden="true" />}
                        </span>
                        <span>{paymentStatus(payment?.status)}</span>
                        <span className={styles.testMode}>Stripe test mode</span>
                      </div>
                      {trip.status === 'planned' && payment && payment.status !== 'test_succeeded' && (
                        <button
                          className={app.buttonPrimary}
                          type="button"
                          disabled={checkoutTripId !== ''}
                          data-pending={checkoutTripId === trip.id || undefined}
                          onClick={() => void openCheckout(trip.id)}
                        >
                          {checkoutTripId === trip.id && <FlowLoader />}
                          {checkoutTripId === trip.id ? 'Opening test checkout' : 'Continue to test payment'}
                        </button>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        )}
        {view === 'plans' && selected?.option && <>
          <section className={`${app.panel} ${styles.fareSummary}`} aria-label="Estimate total"><p><span>Route estimate</span><span>{formatMoney(selectedTotal, selected.option.currency)}</span></p><p><span>{selectedRoute?.priceBasis === 'perVehicle' ? 'Price basis' : 'Travelers'}</span><span>{selectedRoute?.priceBasis === 'perVehicle' ? 'Per vehicle' : selected.trip.travelers}</span></p><p className={styles.fareTotal}><span>Total estimate</span><strong>{formatMoney(selectedTotal, selected.option.currency)}</strong></p></section>
          {selected.trip.status === 'planned' && selected.payment && selected.payment.status !== 'test_succeeded' && <button className={`${app.buttonPrimary} ${styles.checkoutButton}`} type="button" disabled={checkoutTripId !== ''} data-pending={checkoutTripId === selected.trip.id || undefined} onClick={() => void openCheckout(selected.trip.id)}>{checkoutTripId === selected.trip.id && <FlowLoader />}{checkoutTripId === selected.trip.id ? 'Opening test checkout' : 'Continue to test payment'}</button>}
        </>}
      </div>
    </AppLayout>
  )
}

function estimatedTotal(priceCents: number, priceBasis: 'perTraveler' | 'perVehicle', travelers: number) {
  return priceBasis === 'perVehicle' ? priceCents : priceCents * travelers
}

function tripStatus(status: string) {
  const labels: Record<string, string> = {
    planning: 'Planning', planned: 'Plan saved', active: 'In progress', delayed: 'Delayed', completed: 'Completed',
  }
  return labels[status] ?? 'Planning'
}

function paymentStatus(status?: string | null) {
  if (status === 'test_succeeded') return 'Test payment complete'
  if (status === 'pending') return 'Test checkout in progress'
  if (status === 'not_started') return 'Not started'
  return 'No payment record'
}

function modeIcon(mode: string) {
  const normalized = mode.toLowerCase()
  if (normalized.includes('train') || normalized.includes('metro')) return '/assets/transport-train.svg'
  if (normalized.includes('bus') || normalized.includes('coach')) return '/assets/transport-bus.svg'
  return '/assets/transport-taxi.svg'
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
