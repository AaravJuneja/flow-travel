import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import AppLayout from '../components/AppLayout'
import { getCurrentUser, getWalletData } from '../server/functions'
import app from '../styles/app.module.css'
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

  return (
    <AppLayout name={user.name} active="wallet">
      <div className={app.contentWrap}>
        <header className={styles.heading}>
          <p className={app.eyebrow}>Your travel wallet</p>
          <h1 className={app.pageHeading}>The details you need, together.</h1>
          <p className={app.pageIntro}>Saved route plans and their reference codes live here.</p>
        </header>

        <div className={app.notice}>
          Saved plans are not tickets. Flow has not reserved a seat or charged you. Payment stays off until a payment provider is connected.
        </div>

        {items.length === 0 ? (
          <section className={`${app.panel} ${styles.emptyState}`}>
            <h2>No saved plans yet.</h2>
            <p>Choose a route and save it to keep its details in your wallet.</p>
            <Link className={app.buttonPrimary} to="/trip/search">Plan a trip</Link>
          </section>
        ) : (
          <section className={styles.walletList} aria-label="Saved trip plans">
            {items.map(({ item, trip, option, payment }) => (
              <article className={`${app.panel} ${styles.walletCard}`} key={item.id}>
                <div className={styles.walletCardTop}>
                  <div>
                    <p className={styles.referenceLabel}>FLOW PLAN REFERENCE</p>
                    <p className={styles.referenceCode}>{item.referenceCode}</p>
                  </div>
                  <span className={app.statusPill}><span className={app.statusDot} />Plan saved</span>
                </div>

                <div className={styles.routeTitle}>
                  <h2>{trip.originName}</h2>
                  <span aria-hidden="true" />
                  <h2>{trip.destinationName}</h2>
                </div>

                <div className={styles.walletFacts}>
                  <p><span>Travel date</span><strong>{formatDate(trip.departureDate)} at {trip.departureTime}</strong></p>
                  <p><span>Travelers</span><strong>{trip.travelers}</strong></p>
                  <p><span>Route</span><strong>{option?.title ?? 'Route not selected'}</strong></p>
                  <p><span>Estimate</span><strong>{option && payment ? formatMoney(payment.amountCents, payment.currency) : 'Not available'}</strong></p>
                </div>

                <div className={styles.cardActions}>
                  {trip.status === 'planned' && <Link className={app.buttonSecondary} to="/trip/$tripId/edit" params={{ tripId: trip.id }}>Edit plan</Link>}
                  {(trip.status === 'active' || trip.status === 'delayed') && <Link className={app.buttonSecondary} to="/journey/$tripId" params={{ tripId: trip.id }}>Open journey</Link>}
                  {trip.status === 'planning' && <Link className={app.buttonSecondary} to="/trip/$tripId/options" params={{ tripId: trip.id }}>Choose a route</Link>}
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </AppLayout>
  )
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100)
}
