import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import AppLayout from '../components/AppLayout'
import { confirmCheckoutSession, getCurrentUser } from '../server/functions'
import app from '../styles/app.module.css'
import styles from './payment-success.module.css'

export const Route = createFileRoute('/payment/$tripId/success')({
  beforeLoad: async () => {
    if (!(await getCurrentUser())) throw redirect({ to: '/login' })
  },
  validateSearch: z.object({ session_id: z.string().min(1) }),
  loaderDeps: ({ search }) => ({ sessionId: search.session_id }),
  loader: ({ params, deps }) => confirmCheckoutSession({
    data: { tripId: params.tripId, sessionId: deps.sessionId },
  }),
  head: () => ({ meta: [{ title: 'Checkout complete | Flow' }] }),
  component: CheckoutSuccessPage,
})

function CheckoutSuccessPage() {
  const payment = Route.useLoaderData()

  return (
    <AppLayout active="wallet">
      <div className={app.narrowWrap}>
        <section className={`${app.panel} ${styles.successCard}`}>
          <span className={styles.successMark} aria-hidden="true">✓</span>
          <p className={app.eyebrow}>Payment confirmation</p>
          <h1 className={app.pageHeading}>Checkout complete</h1>
          <p className={app.pageIntro}>
            Your test payment of {formatMoney(payment.amountCents, payment.currency)} was confirmed for the {payment.destinationName} route estimate.
          </p>
          <div className={styles.actions}>
            <Link className={app.buttonPrimary} to="/wallet">Return to your wallet</Link>
            <Link className={app.buttonSecondary} to="/trip/$tripId/edit" params={{ tripId: payment.tripId }}>View trip plan</Link>
          </div>
        </section>
      </div>
    </AppLayout>
  )
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(cents / 100)
}
