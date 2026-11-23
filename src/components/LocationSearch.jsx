import { useEffect, useId, useRef, useState } from 'react'
import { LocateFixed, MapPin, Search, X } from 'lucide-react'
import { cities } from '../data/air'
import { describeCurrentLocation, locationLabel, searchLocations } from '../data/locations'

export default function LocationSearch({ city, selectLocation }) {
  const id = useId()
  const area = useRef(null)
  const input = useRef(null)
  const trigger = useRef(null)
  const locationRequest = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [active, setActive] = useState(-1)
  const [locating, setLocating] = useState(false)
  const [notice, setNotice] = useState('')
  const [attempt, setAttempt] = useState(0)
  const term = query.trim()
  const matches = result?.term === term && result.attempt === attempt ? result : null
  const options = term === '' ? cities : matches?.items ?? []
  const loading = open && term.length >= 2 && !matches

  useEffect(() => {
    if (!open || term.length < 2) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const items = await searchLocations(term, controller.signal)
        if (!controller.signal.aborted) setResult({ term, attempt, items })
      } catch {
        if (!controller.signal.aborted) setResult({ term, attempt, error: true })
      }
    }, 300)
    return () => { clearTimeout(timer); controller.abort() }
  }, [open, term, attempt])
  useEffect(() => {
    function outside(event) {
      if (!area.current?.contains(event.target)) {
        setOpen(false)
        setActive(-1)
      }
    }
    document.addEventListener('pointerdown', outside)
    return () => {
      document.removeEventListener('pointerdown', outside)
      locationRequest.current?.abort()
    }
  }, [])
  useEffect(() => {
    if (active >= 0) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [id, active])

  function stopDetection() {
    locationRequest.current?.abort()
    setLocating(false)
  }

  function close(restoreFocus = true) {
    stopDetection()
    setOpen(false)
    setActive(-1)
    if (restoreFocus && trigger.current?.offsetWidth) trigger.current.focus()
  }

  function choose(location, keepDetection = false) {
    if (!keepDetection) stopDetection()
    selectLocation(location)
    setOpen(false)
    setQuery('')
    setNotice('')
    setActive(-1)
    if (trigger.current?.offsetWidth) trigger.current.focus()
  }

  function detectLocation() {
    if (!navigator.geolocation) {
      setNotice('Device location is unavailable. Search for a place instead.')
      return
    }
    stopDetection()
    const controller = new AbortController()
    locationRequest.current = controller
    setNotice('')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      if (controller.signal.aborted) return
      const { latitude, longitude } = coords
      const location = { id: 'device-location', name: 'Current location', coordinates: [latitude, longitude], device: true }
      choose(location, true)
      try {
        const label = await describeCurrentLocation(location.coordinates, controller.signal)
        if (!controller.signal.aborted) selectLocation({ ...location, ...label }, { rename: true })
      } catch {
        // Coordinates remain usable when the locality name cannot be resolved.
      } finally {
        if (!controller.signal.aborted) setLocating(false)
      }
    }, (error) => {
      if (controller.signal.aborted) return
      setLocating(false)
      setNotice(error.code === 1
        ? 'Location permission denied. You can still search for a place.'
        : 'Couldn’t get your location. Try again or search for a place.')
    }, { timeout: 10000, maximumAge: 0 })
  }

  function onKeyDown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      if (options.length) setActive((index) => index < 0 ? (event.key === 'ArrowDown' ? 0 : options.length - 1)
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length)
    }
    if (event.key === 'Enter' && open && options.length) {
      event.preventDefault()
      choose(options[active] ?? options[0])
    }
  }

  return <div className={`nav-location ${open ? 'search-open' : ''}`} ref={area}
    onBlur={(event) => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) close(false) }}
    onKeyDown={(event) => {
      if (event.key === 'Escape' && open) {
        event.stopPropagation()
        close()
      }
    }}>
    <button className="mobile-location-trigger icon-button" ref={trigger} aria-label="Open location search"
      aria-expanded={open} onClick={() => { setOpen(true); requestAnimationFrame(() => input.current?.focus()) }}>
      <Search size={19} />
    </button>
    <span className="mobile-selected-location" title={locationLabel(city)}>{city.name}</span>
    <div className="location-search-panel">
      <div className="location-search-bar">
        <Search size={17} aria-hidden="true" />
        <input ref={input} role="combobox" aria-label="Search locations" aria-autocomplete="list" aria-expanded={open && options.length > 0}
          aria-controls={open && options.length > 0 ? `${id}-list` : undefined}
          aria-activedescendant={open && active >= 0 && active < options.length ? `${id}-option-${active}` : undefined}
          placeholder="Search city, town or location..." value={query} autoComplete="off" maxLength={120}
          onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
          onChange={(event) => { stopDetection(); setOpen(true); setQuery(event.target.value); setResult(null); setActive(-1); setNotice('') }}
          onKeyDown={onKeyDown} />
        <button className="location-detect icon-button" aria-label="Detect my location" disabled={locating}
          title="Use device location with Open-Meteo and BigDataCloud" onClick={() => { setOpen(true); detectLocation() }}><LocateFixed size={17} /></button>
        <button className="mobile-location-close icon-button" aria-label="Close location search" onClick={() => close()}><X size={19} /></button>
      </div>
      <div className="selected-location" title={locationLabel(city)}><MapPin size={11} aria-hidden="true" /><span>{locationLabel(city)}</span></div>
      {open && <div className="location-results">
        {term === '' && <p className="location-result-note">Preset locations</p>}
        {locating && <p className="location-result-note" role="status">Detecting your location…</p>}
        {notice && <p className="location-result-note" role="status">{notice}</p>}
        {term.length === 1 && <p className="location-result-note" role="status">Enter at least two characters.</p>}
        {loading && <p className="location-result-note" role="status">Searching locations…</p>}
        {matches?.error && <p className="location-result-note" role="status">Location search is unavailable. <button onClick={() => setAttempt((value) => value + 1)}>Retry</button></p>}
        {matches?.items?.length === 0 && <p className="location-result-note" role="status">No matching locations.</p>}
        {options.length > 0 && <ul id={`${id}-list`} role="listbox" aria-label="Location suggestions">
          {options.map((location, index) => <li key={location.id} id={`${id}-option-${index}`} role="option"
            aria-selected={index === active} onPointerDown={(event) => event.preventDefault()} onClick={() => choose(location)}>
            <MapPin size={15} aria-hidden="true" /><span><strong>{location.name}</strong><small>{locationLabel({ region: location.region === location.name ? '' : location.region, country: location.country })}</small></span>
          </li>)}
        </ul>}
        <p className="location-result-note">Device location uses Open-Meteo and BigDataCloud after you allow access.</p>
      </div>}
    </div>
  </div>
}
