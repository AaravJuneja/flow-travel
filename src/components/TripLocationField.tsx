import { useEffect, useId, useRef, useState } from 'react'
import { Check, LocateFixed, MapPin, PencilLine, X } from 'lucide-react'
import type { City } from '../server/cities'
import { describeNearbyPlace, searchNearbyPlaces } from '../server/functions'
import { distanceBetween, hasCoordinates, locationRadiusKm, type Coordinates, type TripLocation } from '../lib/locations'
import LocationPickerMap from './LocationPickerMap'
import styles from './TripLocationField.module.css'
import app from '../styles/app.module.css'

export default function TripLocationField({ kind, city, value, onChange }: { kind: 'pickup' | 'drop-off'; city: City; value: TripLocation | null; onChange: (location: TripLocation | null) => void }) {
  const id = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const generation = useRef(0)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<TripLocation | null>(null)
  const [details, setDetails] = useState('')
  const [results, setResults] = useState<TripLocation[]>([])
  const [suggestions, setSuggestions] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [locating, setLocating] = useState(false)
  const [lookup, setLookup] = useState(false)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [error, setError] = useState('')
  const candidate: TripLocation | null = draft ?? (query.trim() ? { label: query.trim(), source: 'manual' } : null)
  const tooFar = hasCoordinates(candidate) && distanceBetween(city, candidate) > locationRadiusKm

  useEffect(() => {
    if (!open || !suggestions || query.trim().length < 3) { setResults([]); setSearching(false); return }
    let active = true
    setSearching(true)
    setSearchError('')
    setResults([])
    const timer = window.setTimeout(() => {
      searchNearbyPlaces({ data: { cityCode: city.code, query: query.trim() } }).then((places) => {
        if (active) { setResults(places); setActiveIndex(0) }
      }).catch(() => { if (active) setSearchError('Address search is unavailable. You can still enter the address or set a pin.') })
        .finally(() => { if (active) setSearching(false) })
    }, 700)
    return () => { active = false; window.clearTimeout(timer) }
  }, [open, suggestions, query, city.code])

  useEffect(() => {
    if (!open || !hasCoordinates(draft) || draft.source === 'search' || tooFar) { setLookup(false); return }
    let active = true
    setLookup(true)
    const { latitude, longitude } = draft
    const timer = window.setTimeout(() => {
      describeNearbyPlace({ data: { cityCode: city.code, latitude, longitude } }).then((place) => {
        if (active && place) setDraft((current) => current?.latitude === latitude && current.longitude === longitude ? { ...current, label: place.label } : current)
      }).catch(() => {}).finally(() => { if (active) setLookup(false) })
    }, 800)
    return () => { active = false; window.clearTimeout(timer) }
  }, [open, draft?.latitude, draft?.longitude, draft?.source, city.code, tooFar])

  useEffect(() => () => { generation.current++ }, [])

  function show() {
    generation.current++
    setQuery(value?.source === 'manual' || value?.source === 'search' ? value.label : '')
    setDraft(value)
    setDetails(value?.details ?? '')
    setSuggestions(false)
    setError('')
    setSearchError('')
    setLocating(false)
    setAccuracy(null)
    setOpen(true)
    dialog.current?.showModal()
  }

  function choose(place: TripLocation) {
    generation.current++
    setLocating(false)
    setDraft(place)
    setQuery(place.label)
    setSuggestions(false)
    setError('')
    setAccuracy(null)
  }

  function move(point: Coordinates) {
    generation.current++
    setLocating(false)
    setDraft({ ...point, label: `Map pin in ${city.name}`, source: 'pin' })
    setQuery('')
    setSuggestions(false)
    setError('')
    setAccuracy(null)
  }

  function locate() {
    if (!navigator.geolocation) { setError('Location is unavailable in this browser. Search or set a pin instead.'); return }
    const current = ++generation.current
    setLocating(true)
    setError('')
    navigator.geolocation.getCurrentPosition((position) => {
      if (generation.current !== current || !dialog.current?.open) return
      setLocating(false)
      const point = { latitude: position.coords.latitude, longitude: position.coords.longitude }
      if (distanceBetween(city, point) > locationRadiusKm) { setError(`Your current location is outside the ${city.name} area. Change the city or choose a point here.`); return }
      setDraft({ ...point, label: `Current location in ${city.name}`, source: 'device' })
      setQuery('')
      setSuggestions(false)
      setAccuracy(Math.round(position.coords.accuracy))
    }, (cause) => {
      if (generation.current !== current || !dialog.current?.open) return
      setLocating(false)
      setError(cause.code === 1 ? 'Location permission was denied. Search or set a pin instead.' : 'Your current location could not be found. Search or set a pin instead.')
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })
  }

  function confirm() {
    if (!candidate || tooFar || candidate.label.length > 180) return
    onChange({ ...candidate, details: details.trim() || undefined })
    dialog.current?.close()
  }

  return <div className={styles.field}>
    <button type="button" className={styles.trigger} onClick={show} aria-label={`${value ? 'Edit' : 'Add'} ${kind} point`} aria-describedby={`${id}-summary`}>
      <MapPin size={18} aria-hidden="true" /><span id={`${id}-summary`}><strong>{value ? value.label : `Add ${kind} point`}</strong><small>{value ? hasCoordinates(value) ? 'Pinned location' : 'Address only' : `Address, landmark or map pin in ${city.name}`}</small></span><PencilLine size={16} aria-hidden="true" />
    </button>
    {value && <button type="button" className={styles.clear} aria-label={`Remove ${kind} point`} onClick={() => onChange(null)}><X size={16} aria-hidden="true" /></button>}
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={`${id}-title`} onClose={() => { generation.current++; setOpen(false) }}>
      <header className={styles.header}><div><h2 id={`${id}-title`}>Set {kind} point</h2><p>{city.name}</p></div><button type="button" className={app.iconButton} aria-label={`Close ${kind} picker`} onClick={() => dialog.current?.close()}><X size={20} aria-hidden="true" /></button></header>
      <div className={styles.body}>
        <div className={styles.search}>
          <label htmlFor={`${id}-query`}>Search address or landmark</label>
          <input id={`${id}-query`} type="search" maxLength={180} autoComplete="off" role="combobox" aria-expanded={suggestions && query.trim().length >= 3} aria-controls={`${id}-results`} aria-activedescendant={suggestions && results.length ? `${id}-option-${activeIndex}` : undefined} aria-autocomplete="list" placeholder={`Search within ${city.name}`} value={query}
            onChange={(event) => { generation.current++; setLocating(false); setQuery(event.currentTarget.value); setDraft(null); setSuggestions(true); setAccuracy(null); setError('') }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setSuggestions(true); if (results.length) setActiveIndex((index) => (index + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length) }
              if (event.key === 'Enter') { event.preventDefault(); if (suggestions && results.length) choose(results[activeIndex]); else setSuggestions(false) }
              if (event.key === 'Escape' && suggestions) { event.preventDefault(); event.stopPropagation(); setSuggestions(false) }
            }} />
          {suggestions && query.trim().length >= 3 && <div className={styles.results} id={`${id}-results`} role="listbox" aria-label={`Nearby ${kind} places`}>
            {searching ? <p role="status">Finding nearby places</p> : searchError ? <p role="status">{searchError}</p> : results.length ? results.map((place, index) => <button type="button" role="option" aria-selected={index === activeIndex} id={`${id}-option-${index}`} key={`${place.latitude}-${place.longitude}-${place.label}`} onClick={() => choose(place)}><MapPin size={16} aria-hidden="true" /><span>{place.label}</span></button>) : <p>No match found. Keep your address as typed or place the pin.</p>}
          </div>}
        </div>
        <div className={styles.tools}><button type="button" onClick={locate} disabled={locating}><LocateFixed size={17} aria-hidden="true" />{locating ? 'Finding your location' : 'Use current location'}</button><button type="button" onClick={() => move(city)}><MapPin size={17} aria-hidden="true" />Set a map pin</button></div>
        {open && <LocationPickerMap key={city.code} center={hasCoordinates(draft) ? draft : city} onMove={move} />}
        <section className={styles.selection} aria-live="polite"><strong>{candidate?.label ?? 'Choose a place or move the map'}</strong>{lookup && <small>Looking up nearby address</small>}{hasCoordinates(candidate) ? <small>{candidate.latitude.toFixed(5)}, {candidate.longitude.toFixed(5)}</small> : candidate ? <small>Address only. Add a pin to mark the precise spot.</small> : null}{accuracy !== null && <small>Device accuracy: about {accuracy} m. Adjust the pin if needed.</small>}</section>
        {error && <p className={app.errorNotice} role="alert">{error}</p>}
        {tooFar && <p className={app.errorNotice} role="alert">Choose a point within {locationRadiusKm} km of {city.name}, or change the city.</p>}
        <label className={styles.notes}>Entrance or landmark notes <span>(optional)</span><input maxLength={160} placeholder="e.g. Gate 2, beside the main road" value={details} onChange={(event) => setDetails(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault() }} /></label>
        <p className={styles.credit}>Address search: <a href="https://photon.komoot.io/" target="_blank" rel="noreferrer">Photon</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></p>
      </div>
      <footer className={styles.footer}><button type="button" className={app.buttonPrimary} disabled={!candidate || tooFar} onClick={confirm}><Check size={18} aria-hidden="true" />Confirm {kind}</button></footer>
    </dialog>
  </div>
}
