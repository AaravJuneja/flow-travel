import { Link, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { registerAccount, signIn } from '../server/functions'
import styles from '../styles/app.module.css'
import Brand from './Brand'

type Props = { mode: 'create' | 'signIn' }

export default function AuthForm({ mode }: Props) {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const isCreate = mode === 'create'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setBusy(true)
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '')

    try {
      if (isCreate) {
        await registerAccount({
          data: {
            name: String(form.get('name') ?? ''),
            email,
          },
        })
      } else {
        await signIn({ data: { email } })
      }
      await navigate({ to: '/home' })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your account could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className={styles.authPage}>
      <section className={styles.authCard}>
        <div className={styles.authBrand}><Brand /></div>
        <h1 className={styles.authTitle}>{isCreate ? 'Make room for the trip.' : 'Welcome back.'}</h1>
        <p className={styles.authCopy}>
          {isCreate
            ? 'Create an account to keep your plans and travel details together.'
            : 'Sign in to pick up where your travel plans left off.'}
        </p>

        <form className={styles.authForm} onSubmit={submit}>
          {isCreate && (
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Your name</span>
              <input className={styles.fieldControl} name="name" autoComplete="name" required minLength={2} maxLength={80} />
            </label>
          )}
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Email address</span>
            <input className={styles.fieldControl} type="email" name="email" autoComplete="email" required maxLength={254} />
          </label>

          {error && <p className={styles.errorNotice} role="alert">{error}</p>}

          <button className={`${styles.buttonPrimary} ${styles.authSubmit}`} type="submit" disabled={busy}>
            {busy ? 'Please wait' : isCreate ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className={styles.authSwitch}>
          {isCreate ? 'Already have an account?' : 'New to Flow?'}{' '}
          <Link to={isCreate ? '/login' : '/signup'}>
            {isCreate ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
      </section>
    </main>
  )
}
