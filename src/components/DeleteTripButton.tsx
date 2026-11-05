import { useId, useRef, useState } from 'react'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { Trash2, X } from 'lucide-react'
import { deleteTrip } from '../server/functions'
import FlowLoader from './FlowLoader'
import styles from '../styles/app.module.css'

export default function DeleteTripButton({ tripId, origin, destination, returnHome = false }: { tripId: string; origin: string; destination: string; returnHome?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const router = useRouter()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function remove() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await deleteTrip({ data: { tripId } })
      dialog.current?.close()
      if (returnHome) await navigate({ to: '/home' })
      await router.invalidate()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The trip could not be deleted.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className={styles.iconButton} aria-label={`Delete trip to ${destination}`} title="Delete trip" onClick={() => { setError(''); dialog.current?.showModal() }}><Trash2 size={18} aria-hidden="true" /></button>
      <dialog ref={dialog} className={`${styles.panel} ${styles.accountPanel}`} aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={(event) => { if (busy) event.preventDefault() }}>
        <button type="button" className={styles.accountClose} aria-label="Close delete confirmation" disabled={busy} onClick={() => dialog.current?.close()}><X size={20} aria-hidden="true" /></button>
        <h2 id={titleId}>Delete this trip?</h2>
        <p>{origin} to {destination}</p>
        <p id={descriptionId}>This removes the trip, its routes and wallet items. It cannot be undone. Deleting a trip does not cancel or refund a payment.</p>
        {error && <p className={styles.errorNotice} role="alert">{error}</p>}
        <div className={styles.dialogActions}>
          <button type="button" className={styles.buttonSecondary} autoFocus disabled={busy} onClick={() => dialog.current?.close()}>Keep trip</button>
          <button type="button" className={styles.buttonPrimary} disabled={busy} data-pending={busy || undefined} onClick={() => void remove()}>{busy ? <FlowLoader /> : <Trash2 size={18} aria-hidden="true" />}{busy ? 'Deleting trip' : 'Delete trip'}</button>
        </div>
      </dialog>
    </>
  )
}
