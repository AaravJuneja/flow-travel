import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { signOut } from '../server/functions'
import styles from '../styles/app.module.css'
import Brand from './Brand'

type Props = {
  children: React.ReactNode
  name?: string
  active?: 'home' | 'wallet'
}

export default function AppLayout({ children, name, active = 'home' }: Props) {
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
      await navigate({ to: '/' })
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className={styles.appPage}>
      <div className={styles.appFrame}>
        <header className={styles.appHeader}>
          <Brand />
          <nav className={styles.desktopNav} aria-label="Main navigation">
            <Link to="/home" className={active === 'home' ? styles.navActive : ''}>My trips</Link>
            <Link to="/trip/search">Plan a journey</Link>
            <Link to="/wallet" className={active === 'wallet' ? styles.navActive : ''}>Wallet</Link>
          </nav>
          <div className={styles.accountArea}>
            {name && <span className={styles.accountName}>Hi, {name.trim().split(/\s+/u)[0]}</span>}
            <button type="button" className={styles.signOutButton} onClick={handleSignOut} disabled={signingOut}>
              {signingOut ? 'Signing out' : 'Sign out'}
            </button>
          </div>
          <nav className={styles.mobileNav} aria-label="Main navigation">
            <Link to="/home" className={active === 'home' ? styles.mobileNavActive : ''}>My trips</Link>
            <Link to="/trip/search">Plan a journey</Link>
            <Link to="/wallet" className={active === 'wallet' ? styles.mobileNavActive : ''}>Wallet</Link>
          </nav>
        </header>
        <main className={styles.appMain}>{children}</main>
      </div>
    </div>
  )
}
