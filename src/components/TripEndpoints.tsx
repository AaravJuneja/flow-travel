import { MapPin } from 'lucide-react'
import { endpointLabel, hasCoordinates, type TripLocation } from '../lib/locations'
import styles from './TripEndpoints.module.css'

export default function TripEndpoints({ trip }: { trip: { originName: string; destinationName: string; pickupLocation?: TripLocation | null; dropoffLocation?: TripLocation | null } }) {
  if (!trip.pickupLocation && !trip.dropoffLocation) return null
  return <dl className={styles.endpoints} aria-label="Pickup and drop-off">
    {([['Pickup', trip.pickupLocation, trip.originName], ['Drop-off', trip.dropoffLocation, trip.destinationName]] as const).map(([label, location, city]) => location && <div key={label}>
      <MapPin size={17} aria-hidden="true" /><div><dt>{label}</dt><dd><a href={hasCoordinates(location) ? `https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=17/${location.latitude}/${location.longitude}` : `https://www.openstreetmap.org/search?query=${encodeURIComponent(endpointLabel(location, city))}`} target="_blank" rel="noreferrer">{endpointLabel(location, city)}</a>{location.details && <span>{location.details}</span>}{!hasCoordinates(location) && <small>Address only</small>}</dd></div>
    </div>)}
  </dl>
}
