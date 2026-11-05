import { useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import styles from './SlideToStart.module.css'

export default function SlideToStart() {
  const navigate = useNavigate()
  const thumb = useRef<HTMLSpanElement>(null)
  const gesture = useRef<{ id: number; start: number; distance: number; maximum: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const opening = useRef(false)
  const [distance, setDistance] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)

  async function openSignup() {
    if (opening.current) return
    opening.current = true
    setBusy(true)
    try {
      await navigate({ to: '/signup' })
    } finally {
      opening.current = false
      setBusy(false)
    }
  }

  function start(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || opening.current || gesture.current) return
    suppressClick.current = false
    gesture.current = {
      id: event.pointerId,
      start: event.clientX,
      distance: 0,
      maximum: Math.max(1, event.currentTarget.clientWidth - (thumb.current?.offsetWidth ?? 74)),
      moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
  }

  function move(event: PointerEvent<HTMLButtonElement>) {
    const current = gesture.current
    if (!current || current.id !== event.pointerId) return
    const delta = event.clientX - current.start
    if (Math.abs(delta) > 5) current.moved = true
    current.distance = Math.max(0, Math.min(current.maximum, delta))
    setDistance(current.distance)
  }

  function finish(event: PointerEvent<HTMLButtonElement>) {
    const current = gesture.current
    if (!current || current.id !== event.pointerId) return
    gesture.current = null
    suppressClick.current = current.moved
    setDragging(false)
    if (current.distance >= current.maximum * 0.85) void openSignup()
    else setDistance(0)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  function cancel() {
    if (!gesture.current) return
    gesture.current = null
    suppressClick.current = false
    setDragging(false)
    setDistance(0)
  }

  return (
    <button
      type="button"
      className={`${styles.track} ${dragging ? styles.dragging : ''}`}
      style={{ '--slide-distance': `${distance}px` } as CSSProperties}
      aria-label="Get started"
      aria-describedby="slide-start-hint"
      disabled={busy}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={finish}
      onPointerCancel={cancel}
      onLostPointerCapture={cancel}
      onClick={() => {
        if (suppressClick.current) suppressClick.current = false
        else void openSignup()
      }}
    >
      <span className={styles.label}>{busy ? 'Opening' : 'Get started'}</span>
      <span className={styles.thumb} ref={thumb} aria-hidden="true"><ChevronRight size={36} strokeWidth={1.8} /></span>
      <span id="slide-start-hint" className="sr-only">Slide the arrow to the right, or click or press Enter to continue.</span>
    </button>
  )
}
