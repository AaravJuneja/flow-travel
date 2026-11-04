import { Link, createFileRoute } from '@tanstack/react-router'
import Brand from '../components/Brand'
import styles from './welcome.module.css'

export const Route = createFileRoute('/')({
  head: () => ({ meta: [{ title: 'Flow | Travel in good flow' }] }),
  component: Welcome,
})

function Welcome() {
  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <header className={styles.header}>
          <Brand />
          <span className={styles.headerNote}>Travel, in good flow</span>
        </header>

        <section className={styles.content} aria-labelledby="welcome-title">
          <div className={styles.illustrationWrap}>
            <div className={styles.illustrationGlow} aria-hidden="true" />
            <img
              className={styles.traveler}
              src="/assets/figma/traveler-illustration.png"
              width="298"
              height="434"
              alt="A traveler setting out with a suitcase"
            />
          </div>

          <div className={styles.story}>
            <p className={styles.slideLabel}>A better way to get there</p>
            <h1 className={styles.title} id="welcome-title">Welcome to Flow</h1>
            <p className={styles.description}>
              Plan the full journey in one place, from your front door to the final stop.
            </p>
            <div className={styles.pagination} aria-label="Welcome screen">
              <span className={styles.activeDot} />
              <span />
              <span />
              <span />
            </div>
            <div className={styles.actions}>
              <Link to="/signup" className={styles.startButton}>
                Get started
                <span aria-hidden="true">↗</span>
              </Link>
              <p className={styles.signInPrompt}>
                Already have an account? <Link to="/login">Sign in</Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
