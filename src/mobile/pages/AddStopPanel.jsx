import { useState, useEffect, useRef } from 'react'

const MODES = [
  { id: 'subway', label: 'MTA Subway', icon: '🚇', placeholder: 'Search for a subway station…' },
  { id: 'bus', label: 'NJT Bus', icon: '🚌', placeholder: 'Search for a bus stop…' },
  { id: 'rail', label: 'NJT Rail', icon: '🚂', placeholder: 'Search for a rail station…' },
  { id: 'path', label: 'PATH', icon: '🚂', placeholder: 'Search for a PATH station…' },
  { id: 'ferry', label: 'NY Waterway', icon: '⛴️', placeholder: 'Search for a ferry terminal…' },
  { id: 'hblr', label: 'HBLR Light Rail', icon: '🚈', placeholder: 'Search for a light rail stop…' },
  { id: 'lirr', label: 'LIRR', icon: '🚂', placeholder: 'Search for a LIRR station…' },
  { id: 'mnr', label: 'Metro-North', icon: '🚂', placeholder: 'Search for a Metro-North station…' },
  { id: 'mtabus', label: 'MTA Bus', icon: '🚌', placeholder: 'Search for a bus route…' },
  { id: 'nycferry', label: 'NYC Ferry', icon: '⛴️', placeholder: 'Search for a ferry stop…' },
]

export default function AddStopPanel({ open, onClose, onAdd }) {
  const [step, setStep] = useState(1)
  const [mode, setMode] = useState(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const searchRef = useRef(null)
  const debounceRef = useRef(null)
  const prevOpenRef = useRef(false)

  // Reset only when panel opens (transition from closed to open)
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setStep(1)
      setMode(null)
      setQuery('')
      setResults([])
    }
    prevOpenRef.current = open
  }, [open])

  // Focus search input on step 2
  useEffect(() => {
    if (step === 2 && searchRef.current) {
      searchRef.current.focus()
    }
  }, [step])

  function pickMode(m) {
    setMode(m)
    setStep(2)
    setQuery('')
    setResults([])
  }

  function goBack() {
    if (step === 3) {
      setStep(2)
    } else if (step === 2) {
      setStep(1)
      setMode(null)
    }
  }

  // Search with debounce
  function handleSearch(q) {
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.length < 2) {
      setResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const modeId = mode?.id
        let url = ''
        if (modeId === 'subway') url = `/api/mta/search?q=${encodeURIComponent(q)}`
        else if (modeId === 'bus') url = `/api/bus/search?q=${encodeURIComponent(q)}`
        else if (modeId === 'rail') url = `/api/rail/search?q=${encodeURIComponent(q)}`
        else if (modeId === 'path') url = `/api/path/search?q=${encodeURIComponent(q)}`
        else if (modeId === 'ferry') url = `/api/ferry/search?q=${encodeURIComponent(q)}`
        else if (modeId === 'hblr') url = `/api/bus/search?q=${encodeURIComponent(q)}&mode=hblr`
        else if (modeId === 'lirr') url = `/api/lirr/search?q=${encodeURIComponent(q)}`
        else if (modeId === 'mnr') url = `/api/mnr/search?q=${encodeURIComponent(q)}`
        else if (modeId === 'mtabus') url = `/api/mtabus/search?q=${encodeURIComponent(q)}`
        else if (modeId === 'nycferry') url = `/api/nycferry/search?q=${encodeURIComponent(q)}`

        if (url) {
          const res = await fetch(url)
          if (res.ok) {
            const data = await res.json()
            setResults(data.results || data.stations || data.stops || [])
          }
        }
      } catch (e) {
        console.error('Search error:', e)
      } finally {
        setSearching(false)
      }
    }, 300)
  }

  function selectResult(result) {
    // For simple modes, add directly
    const stopId = result.id || result.stopId
    const displayName = result.name || result.label
    onAdd(stopId, displayName)
  }

  const modeConfig = mode ? MODES.find(m => m.id === mode.id) || mode : null

  return (
    <div className={`m-addstop-panel ${open ? 'open' : ''}`}>
      <div className="m-addstop-header">
        <button
          className={`m-addstop-back ${step === 1 ? 'hidden' : ''}`}
          onClick={goBack}
        >
          ←
        </button>
        <span className="m-addstop-title">
          {step === 1 ? 'Add a Stop' : `${modeConfig?.label || ''} — Search`}
        </span>
        <button className="m-set-close" onClick={onClose}>✕</button>
      </div>

      {/* Step 1: Pick transit mode */}
      {step === 1 && (
        <div className="m-addstop-modes">
          {MODES.map(m => (
            <button key={m.id} className="m-addstop-mode" onClick={() => pickMode(m)}>
              <span className="m-addstop-mode-icon">{m.icon}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Step 2: Search */}
      {step === 2 && (
        <div className="m-addstop-step">
          <input
            ref={searchRef}
            type="text"
            className="m-addstop-search"
            placeholder={modeConfig?.placeholder || 'Search…'}
            value={query}
            onChange={e => handleSearch(e.target.value)}
          />
          <div className="m-addstop-results">
            {query.length < 2 && (
              <div className="m-addstop-hint">Type at least 2 characters to search</div>
            )}
            {searching && <div className="m-addstop-hint">Searching…</div>}
            {!searching && results.map((r, i) => (
              <button key={i} className="m-addstop-result" onClick={() => selectResult(r)}>
                <div className="m-addstop-result-name">{r.name || r.label}</div>
                {r.subtitle && <div className="m-addstop-result-sub">{r.subtitle}</div>}
              </button>
            ))}
            {!searching && query.length >= 2 && results.length === 0 && (
              <div className="m-addstop-hint">No results found</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
