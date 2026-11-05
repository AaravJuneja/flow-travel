import { useEffect, useRef, useState } from 'react'
import { createClientOnlyFn } from '@tanstack/react-start'
import type { LatLngTuple, Map as LeafletMap, MapOptions, Marker } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-gesture-handling/dist/leaflet-gesture-handling.css'
import styles from './TripMap.module.css'
import type { City } from '../server/cities'

const loadLeaflet = createClientOnlyFn(async () => {
  const leaflet = await import('leaflet')
  await import('leaflet-gesture-handling')
  return leaflet
})
const defaultPickup: LatLngTuple = [28.405, 77.064]
const destinations: Record<string, { name: string; coordinates: LatLngTuple }> = {
  JAI: { name: 'Jaipur', coordinates: [26.9124, 75.7873] },
  MAY: { name: 'Mayapur', coordinates: [23.424, 88.388] },
}

function markerButton(className: string, label: string) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = className
  button.setAttribute('aria-label', label)
  return button
}

export default function TripMap({ destinationCode, originCity, destinationCity }: { destinationCode?: string; originCity?: City; destinationCity?: City }) {
  const pickup: LatLngTuple = originCity ? [originCity.latitude, originCity.longitude] : defaultPickup
  const pickupName = originCity?.name ?? (destinationCode ? 'Sector 65, Gurugram' : 'India')
  const destination = destinationCity ? { name: destinationCity.name, coordinates: [destinationCity.latitude, destinationCity.longitude] as LatLngTuple } : destinationCode ? destinations[destinationCode] : undefined
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const destinationMarker = useRef<Marker | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [overview, setOverview] = useState(false)

  useEffect(() => {
    let disposed = false
    let map: LeafletMap | undefined
    let observer: ResizeObserver | undefined
    let loadedTiles = 0
    setReady(false)
    setFailed(false)
    const timeout = window.setTimeout(() => {
      if (!disposed && !loadedTiles) setFailed(true)
    }, 15000)

    loadLeaflet().then((leaflet) => {
      if (disposed || !container.current) return
      const options: MapOptions & { gestureHandling: boolean } = {
        center: originCity || destinationCode ? pickup : [22.5, 79],
        zoom: originCity || destinationCode ? 12 : 5,
        minZoom: 3,
        maxZoom: 19,
        zoomControl: false,
        attributionControl: false,
        gestureHandling: true,
      }
      map = leaflet.map(container.current, options)
      mapRef.current = map
      leaflet.control.zoom({ position: 'bottomright' }).addTo(map)
      leaflet.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map)
      const tiles = leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
      })
      tiles.on('tileload', () => {
        if (disposed) return
        loadedTiles++
        window.clearTimeout(timeout)
        setReady(true)
        setFailed(false)
      })
      tiles.on('load', () => {
        if (!disposed && !loadedTiles) setFailed(true)
      })
      tiles.addTo(map)
      const icon = leaflet.divIcon({
        className: styles.markerWrapper,
        html: markerButton(styles.pickupMarker, `Pickup: ${pickupName}`),
        iconSize: [23, 23],
        iconAnchor: [11.5, 11.5],
      })
      if (originCity || destinationCode) leaflet.marker(pickup, { icon, keyboard: false }).bindPopup(`Pickup: ${pickupName}`).addTo(map)
      observer = new ResizeObserver(() => map?.invalidateSize({ pan: false }))
      observer.observe(container.current)
    }).catch(() => { if (!disposed) setFailed(true) })

    return () => {
      disposed = true
      window.clearTimeout(timeout)
      observer?.disconnect()
      destinationMarker.current = null
      mapRef.current = null
      map?.remove()
    }
  }, [attempt, originCity?.code, destinationCode])

  useEffect(() => {
    const map = mapRef.current
    let disposed = false
    destinationMarker.current?.remove()
    destinationMarker.current = null
    if (!map || !ready) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (overview && destination) {
      loadLeaflet().then((leaflet) => {
        if (disposed) return
        const icon = leaflet.divIcon({
          className: styles.markerWrapper,
          html: markerButton(styles.destinationMarker, `Destination: ${destination.name}`),
          iconSize: [23, 23],
          iconAnchor: [11.5, 11.5],
        })
        destinationMarker.current = leaflet.marker(destination.coordinates, { icon, keyboard: false }).bindPopup(destination.name).addTo(map)
        map.fitBounds(leaflet.latLngBounds([pickup, destination.coordinates]), {
          paddingTopLeft: [45, 65],
          paddingBottomRight: [45, 90],
          animate: !reducedMotion,
          maxZoom: 8,
        })
      })
    } else {
      map.setView(originCity || destinationCode ? pickup : [22.5, 79], originCity || destinationCode ? 12 : 5, { animate: !reducedMotion })
    }
    return () => { disposed = true }
  }, [destinationCode, destinationCity?.code, originCity?.code, overview, ready])

  return (
    <div className={styles.map} role="region" aria-label="Interactive journey map">
      <div className={styles.canvas} ref={container} />
      {!ready && !failed && <p className={styles.loading} role="status">Loading map</p>}
      {ready && <div className={styles.mapTools}>
        <button type="button" onClick={() => setOverview(false)} aria-pressed={!overview}>Pickup area</button>
        {destination && originCity && <button type="button" onClick={() => setOverview(true)} aria-pressed={overview}>Show cities</button>}
      </div>}
      {failed && <div className={styles.mapError} role="status"><p>The map couldn’t load.</p><button type="button" onClick={() => setAttempt(attempt + 1)}>Retry map</button></div>}
      <p className={styles.mapCaption}>{overview && destination ? `${pickupName} to ${destination.name}` : pickupName}</p>
    </div>
  )
}
