import { Link, createFileRoute } from '@tanstack/react-router'
import Brand from '../components/Brand'
import SlideToStart from '../components/SlideToStart'
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
            <img
              className={styles.traveler}
              src="/assets/traveler-illustration.png"
              width="298"
              height="434"
              alt="A traveler setting out with a suitcase"
            />
          </div>

          <div className={styles.story}>
            <h1 className={styles.title} id="welcome-title">Welcome to <span>Flow</span><img src="/assets/flow-mark.svg" alt="" /></h1>
            <p className={styles.description}>
              Get ready for a smarter, safer, futuristic and more flexible way to travel anywhere, anytime.
            </p>
            <div className={styles.actions}>
              <SlideToStart />
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
