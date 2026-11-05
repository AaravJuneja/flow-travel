import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { getCurrentUser, setAccountPassword, signOut, updateProfile } from '../server/functions'
import { PencilLine, UserRound, X } from 'lucide-react'
import styles from '../styles/app.module.css'
import Brand from './Brand'
import FlowLoader from './FlowLoader'

type Props = {
  children: React.ReactNode
  name?: string
  active?: 'home' | 'plan' | 'wallet'
  mobileHeader?: 'location' | 'page' | 'map'
  mobileNavigation?: boolean
  location?: string
}

export default function AppLayout({ children, name, active = 'home', mobileHeader = 'page', mobileNavigation = true, location = 'India' }: Props) {
  const navigate = useNavigate()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const accountDialog = useRef<HTMLDialogElement>(null)
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [profileName, setProfileName] = useState(name ?? '')
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState('')
  const [nameSaved, setNameSaved] = useState(false)

  useEffect(() => {
    if (!accountOpen) { accountDialog.current?.close(); return }
    accountDialog.current?.showModal()
    let cancelled = false
    setLoadingProfile(true)
    setNameError('')
    setNameSaved(false)
    void getCurrentUser().then((user) => {
      if (!cancelled) {
        if (!user) throw new Error('Sign in to edit your profile.')
        setProfileName(user.name)
      }
    }).catch((cause) => {
      if (!cancelled) setNameError(cause instanceof Error ? cause.message : 'Your profile could not be loaded.')
    }).finally(() => { if (!cancelled) setLoadingProfile(false) })
    return () => { cancelled = true }
  }, [accountOpen])

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (savingName || loadingProfile) return
    setSavingName(true)
    setNameError('')
    setNameSaved(false)
    try {
      await updateProfile({ data: { name: profileName } })
      await router.invalidate()
      setNameSaved(true)
    } catch (cause) {
      setNameError(cause instanceof Error ? cause.message : 'Your name could not be saved.')
    } finally {
      setSavingName(false)
    }
  }

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
      await navigate({ to: '/' })
    } finally {
      setSigningOut(false)
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setSavingPassword(true)
    setPasswordError('')
    setPasswordSaved(false)
    try {
      await setAccountPassword({ data: { password: String(new FormData(form).get('password') ?? '') } })
      form.reset()
      setPasswordSaved(true)
    } catch (cause) {
      setPasswordError(cause instanceof Error ? cause.message : 'Your password could not be saved.')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className={styles.appPage}>
      <div className={`${styles.appFrame} ${mobileHeader === 'map' ? styles.mapFrame : ''} ${mobileHeader === 'page' ? styles.pageFrame : ''} ${!mobileNavigation ? styles.withoutMobileNav : ''}`}>
        <header className={`${styles.appHeader} ${mobileHeader === 'page' ? styles.pageHeader : ''} ${mobileHeader === 'map' ? styles.mapHeader : ''}`}>
          <div className={styles.desktopBrand}><Brand to="/home" /></div>
          <Link to="/trip/search" className={styles.mobileLocation}><img src="/assets/home-location.svg" alt="" /><span className={styles.locationLabel}>{location}</span><span aria-hidden="true">⌄</span></Link>
          <Link to="/home" className={styles.mobileMark} aria-label="Flow home"><img src="/assets/flow-mark-header.svg" alt="" /></Link>
          <nav className={styles.desktopNav} aria-label="Main navigation">
            <Link to="/home" aria-current={active === 'home' ? 'page' : undefined} className={active === 'home' ? styles.navActive : ''}>My trips</Link>
            <Link to="/trip/search" aria-current={active === 'plan' ? 'page' : undefined} className={active === 'plan' ? styles.navActive : ''}>Plan a journey</Link>
            <Link to="/wallet" aria-current={active === 'wallet' ? 'page' : undefined} className={active === 'wallet' ? styles.navActive : ''}>Wallet</Link>
          </nav>
          <div className={styles.accountArea}>
            <button type="button" className={styles.accountName} aria-label="Your account" aria-expanded={accountOpen} onClick={() => setAccountOpen(true)}><UserRound size={18} aria-hidden="true" />{name ? `Hi, ${name.trim().split(/\s+/u)[0]}` : 'Profile'}</button>
            <button type="button" className={styles.signOutButton} onClick={handleSignOut} disabled={signingOut} data-pending={signingOut || undefined}>
              {signingOut && <FlowLoader />}
              {signingOut ? 'Signing out' : 'Sign out'}
            </button>
          </div>
          {mobileNavigation && <nav className={styles.mobileNav} aria-label="Main navigation">
            <Link to="/home" aria-label="My trips" aria-current={active === 'home' ? 'page' : undefined} className={active === 'home' ? styles.mobileNavActive : ''}><img src="/assets/nav-home.svg" alt="" /><span>My trips</span></Link>
            <Link to="/trip/search" aria-label="Plan a journey" aria-current={active === 'plan' ? 'page' : undefined} className={active === 'plan' ? styles.mobileNavActive : ''}><img src="/assets/nav-route.svg" alt="" /><span>Route</span></Link>
            <Link to="/wallet" aria-label="Wallet" aria-current={active === 'wallet' ? 'page' : undefined} className={active === 'wallet' ? styles.mobileNavActive : ''}><img src="/assets/nav-wallet.svg" alt="" /><span>Wallet</span></Link>
            <button type="button" aria-label="Your account" aria-expanded={accountOpen} onClick={() => setAccountOpen(!accountOpen)}><img src="/assets/nav-user.svg" alt="" /></button>
          </nav>}
        </header>
        <dialog ref={accountDialog} className={`${styles.panel} ${styles.accountPanel}`} aria-labelledby="account-title" onClose={() => setAccountOpen(false)}>
          <button className={styles.accountClose} onClick={() => setAccountOpen(false)} aria-label="Close account"><X size={20} aria-hidden="true" /></button>
          <h2 id="account-title">Your account</h2>
          <form className={styles.accountPassword} onSubmit={saveName}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Your name</span>
              <input className={styles.fieldControl} name="name" autoComplete="name" required maxLength={80} value={profileName} disabled={loadingProfile || savingName} onChange={(event) => { setProfileName(event.currentTarget.value); setNameSaved(false) }} />
            </label>
            {loadingProfile && <p role="status">Loading your profile</p>}
            {nameError && <p className={styles.errorNotice} role="alert">{nameError}</p>}
            {nameSaved && <p className={styles.notice} role="status">Name saved.</p>}
            <button className={styles.buttonSecondary} type="submit" disabled={loadingProfile || savingName} data-pending={savingName || undefined}>{savingName ? <FlowLoader /> : <PencilLine size={18} aria-hidden="true" />}{savingName ? 'Saving name' : 'Save name'}</button>
          </form>
          <form className={styles.accountPassword} onSubmit={savePassword}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>New password</span>
              <input className={styles.fieldControl} type="password" name="password" autoComplete="new-password" required />
            </label>
            {passwordError && <p className={styles.errorNotice} role="alert">{passwordError}</p>}
            {passwordSaved && <p className={styles.notice} role="status">Password saved.</p>}
            <button className={styles.buttonPrimary} type="submit" disabled={savingPassword} data-pending={savingPassword || undefined}>{savingPassword && <FlowLoader />}{savingPassword ? 'Saving password' : 'Save password'}</button>
          </form>
          <button type="button" className={styles.buttonLink} onClick={handleSignOut} disabled={signingOut} data-pending={signingOut || undefined}>{signingOut && <FlowLoader />}{signingOut ? 'Signing out' : 'Sign out'}</button>
        </dialog>
        <main className={styles.appMain}>{children}</main>
      </div>
    </div>
  )
}
