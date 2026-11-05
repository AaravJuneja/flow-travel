import { useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { isNavigationPending, pendingActionLabel, pendingDelayMs } from './pending'
import styles from './FlowLoader.module.css'

export default function FlowLoader() {
  return <span className={styles.loader} aria-hidden="true" />
}

export function PendingFeedback() {
  const navigating = useRouterState({ select: isNavigationPending })
  const action = usePendingAction()
  const active = navigating || action !== ''
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (!active) {
      setShown(false)
      return
    }
    const timer = window.setTimeout(() => setShown(true), pendingDelayMs)
    return () => window.clearTimeout(timer)
  }, [active])

  const showPage = shown && navigating && action === ''
  const message = shown ? action || (navigating ? 'Loading page' : '') : ''

  return (
    <>
      <div className={styles.pagePending} hidden={!showPage} aria-hidden="true">
        {showPage && <FlowLoader />}
      </div>
      <p className="sr-only" role="status">{message}</p>
    </>
  )
}

function usePendingAction() {
  const [label, setLabel] = useState('')

  useEffect(() => {
    const read = () => setLabel(pendingActionLabel(document.body))
    read()
    const observer = new MutationObserver(read)
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-pending'] })
    return () => observer.disconnect()
  }, [])

  return label
}
