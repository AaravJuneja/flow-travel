import { useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap } from 'leaflet'
import { MapPin } from 'lucide-react'
import { loadLeaflet } from './TripMap'
import type { Coordinates } from '../lib/locations'
import styles from './TripLocationField.module.css'

export default function LocationPickerMap({ center, onMove }: { center: Coordinates; onMove: (point: Coordinates) => void }) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const latest = useRef({ center, onMove })
  const programmatic = useRef(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => { latest.current = { center, onMove } }, [center, onMove])
  useEffect(() => {
    let disposed = false
    let observer: ResizeObserver | undefined
    let map: LeafletMap | undefined
    loadLeaflet().then((leaflet) => {
      if (disposed || !container.current) return
      const point = latest.current.center
      map = leaflet.map(container.current, { center: [point.latitude, point.longitude], zoom: 15, minZoom: 9, maxZoom: 19, attributionControl: false })
      mapRef.current = map
      leaflet.control.attribution({ prefix: false, position: 'bottomleft' }).addTo(map)
      const tiles = leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' }).addTo(map)
      tiles.on('tileerror', () => { if (!disposed) setFailed(true) })
      tiles.on('tileload', () => { if (!disposed) setFailed(false) })
      map.on('moveend', () => {
        if (!map || disposed || programmatic.current) return
        const next = map.getCenter()
        const current = latest.current.center
        if (Math.abs(next.lat - current.latitude) + Math.abs(next.lng - current.longitude) > 0.000001) latest.current.onMove({ latitude: Number(next.lat.toFixed(6)), longitude: Number(next.lng.toFixed(6)) })
      })
      map.on('click', (event) => map?.panTo(event.latlng, { animate: false }))
      observer = new ResizeObserver(() => {
        if (!map) return
        programmatic.current = true
        const point = latest.current.center
        map.invalidateSize({ pan: false })
        map.setView([point.latitude, point.longitude], map.getZoom(), { animate: false })
        programmatic.current = false
      })
      observer.observe(container.current)
    }).catch(() => { if (!disposed) setFailed(true) })
    return () => { disposed = true; observer?.disconnect(); mapRef.current = null; map?.remove() }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (map) {
      programmatic.current = true
      map.setView([center.latitude, center.longitude], map.getZoom(), { animate: false })
      programmatic.current = false
    }
  }, [center.latitude, center.longitude])

  return <div className={styles.mapWrap}>
    <div className={styles.mapCanvas} ref={container} tabIndex={0} role="region" aria-label="Location map. Move with arrow keys or drag the map to position the pin." />
    <MapPin className={styles.centerPin} size={40} strokeWidth={2} aria-hidden="true" />
    {failed && <p className={styles.tileError} role="status">Map tiles unavailable. Search or enter the address instead.</p>}
    <span className={styles.mapHint}>Move the map to adjust the pin</span>
  </div>
}
