import { useEffect, useId, useState } from 'react'
import { MapPin } from 'lucide-react'
import { getCityPhoto, searchIndianCities } from '../server/functions'
import type { City } from '../server/cities'
import styles from '../routes/trip-search.module.css'

export default function CitySearch({ label, value, onChange }: { label: string; value: City | null; onChange: (city: City | null) => void }) {
  const id = useId()
  const [query, setQuery] = useState(value?.name ?? '')
  const [results, setResults] = useState<City[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [photo, setPhoto] = useState<Awaited<ReturnType<typeof getCityPhoto>>>(null)
  const [photoError, setPhotoError] = useState(false)

  useEffect(() => {
    let active = true
    if (value || query.trim().length < 2) {
      setResults([])
      setBusy(false)
      return
    }
    setBusy(true)
    setError('')
    const timer = window.setTimeout(() => {
      searchIndianCities({ data: { query: query.trim() } }).then((cities) => {
        if (active) setResults(cities)
      }).catch(() => { if (active) setError('City search could not load. Try again.') })
        .finally(() => { if (active) setBusy(false) })
    }, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [query, value])

  useEffect(() => {
    let active = true
    setPhoto(null)
    setPhotoError(false)
    if (value) getCityPhoto({ data: { code: value.code } }).then((image) => {
      if (active) setPhoto(image)
    }).catch(() => { if (active) setPhotoError(true) })
    return () => { active = false }
  }, [value])

  return <div className={styles.citySearch} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
  }}>
    <label htmlFor={id}>{label}</label>
    <div className={styles.cityInput}>
      <MapPin size={18} aria-hidden="true" />
      <input id={id} type="search" autoComplete="off" value={query} placeholder="Search any Indian city" required
        role="combobox" aria-autocomplete="list" aria-expanded={open && !value} aria-controls={`${id}-results`}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
          if (event.key === 'ArrowDown') { event.preventDefault(); document.getElementById(`${id}-option-0`)?.focus() }
        }}
        onChange={(event) => { setQuery(event.currentTarget.value); onChange(null); setOpen(true) }} />
    </div>
    {open && !value && query.trim().length >= 2 && <div id={`${id}-results`} className={styles.cityResults} role="listbox" aria-label={`${label} cities`}>
      {busy ? <p role="status">Finding cities...</p> : error ? <p role="alert">{error}</p> : results.length ? results.map((city, index) => <button
        id={`${id}-option-${index}`} type="button" role="option" aria-selected={false} key={city.code}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            document.getElementById(`${id}-option-${(index + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length}`)?.focus()
          }
          if (event.key === 'Escape') { setOpen(false); document.getElementById(id)?.focus() }
        }}
        onClick={() => { onChange(city); setQuery(city.name); setOpen(false); document.getElementById(id)?.focus() }}>
        <strong>{city.name}</strong><small>{city.state}</small>
      </button>) : <p>No city found. Try another spelling.</p>}
    </div>}
    {value && <div className={styles.selectedCity}>
      {photo ? <img src={photo.url} alt={value.name} width="77" height="59" onError={() => { setPhoto(null); setPhotoError(true) }} /> : <MapPin size={24} aria-hidden="true" />}
      <div><strong>{value.name}</strong><small>{value.state}</small>{photo ? <a href={photo.source} target="_blank" rel="noreferrer" title={`${photo.title}, ${photo.author}, ${photo.license}`}>Photo credit</a> : photoError ? <small>Photo unavailable</small> : null}</div>
    </div>}
  </div>
}
