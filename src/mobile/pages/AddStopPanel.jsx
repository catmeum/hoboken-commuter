import { useState, useEffect, useRef } from 'react'
import { SubwayBadge, MtaGlobeIcon, NjtBusIcon, PathIcon, LightRailIcon, HeavyRailIcon, NjtRailIcon, NywFerryIcon, NycFerryIcon, MtaBusIcon, GrandCentralClock } from '../../components/icons'

// NJT Bus route color palette
const NJT_ROUTE_COLORS = {
  '119': '#0e7c47', '125': '#6b21a8', '126': '#1e40af',
  '22': '#b45309', '64': '#0f766e', '68': '#7c2d12',
  '85': '#4338ca', '87': '#be123c', '89': '#7c3aed',
}
const NJT_COLOR_PALETTE = ['#1e40af', '#7c3aed', '#0e7c47', '#b45309', '#be123c', '#0f766e', '#4338ca', '#6b21a8', '#7c2d12', '#0369a1']
function njtRouteColor(route) {
  if (NJT_ROUTE_COLORS[route]) return NJT_ROUTE_COLORS[route]
  let hash = 0
  for (let i = 0; i < route.length; i++) hash = route.charCodeAt(i) + ((hash << 5) - hash)
  return NJT_COLOR_PALETTE[Math.abs(hash) % NJT_COLOR_PALETTE.length]
}

const MODES = [
  { id: 'subway', label: 'MTA Subway', icon: <MtaGlobeIcon size={16} />, placeholder: 'Search for a subway station…', enabled: true },
  { id: 'bus', label: 'NJT Bus', icon: <NjtBusIcon size={16} />, placeholder: 'Search for a bus stop…', enabled: true },
  { id: 'path', label: 'PATH', icon: <PathIcon size={16} />, placeholder: 'Search for a PATH station…', enabled: true },
  { id: 'rail', label: 'NJT Rail', icon: <NjtRailIcon size={16} />, placeholder: 'Search for a rail station…', enabled: true },
  { id: 'ferry', label: 'NY Waterway', icon: <NywFerryIcon size={16} />, placeholder: 'Search for a ferry terminal…', enabled: false },
  { id: 'hblr', label: 'HBLR Light Rail', icon: <LightRailIcon size={16} />, placeholder: 'Search for a light rail stop…', enabled: false },
  { id: 'lirr', label: 'LIRR', icon: <HeavyRailIcon size={16} />, placeholder: 'Search for a LIRR station…', enabled: false },
  { id: 'mnr', label: 'Metro-North', icon: <GrandCentralClock size={16} />, placeholder: 'Search for a Metro-North station…', enabled: false },
  { id: 'mtabus', label: 'MTA Bus', icon: <MtaBusIcon size={16} />, placeholder: 'Search for a bus route…', enabled: false },
  { id: 'nycferry', label: 'NYC Ferry', icon: <NycFerryIcon size={16} />, placeholder: 'Search for a ferry stop…', enabled: false },
]

export default function AddStopPanel({ open, onClose, onAdd }) {
  const [step, setStep] = useState('modes') // modes | search | subway-dir | bus-lines
  const [mode, setMode] = useState(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  // Subway step 2 state
  const [selectedStation, setSelectedStation] = useState(null)
  const [stationLines, setStationLines] = useState([])
  const [selectedLines, setSelectedLines] = useState(new Set())
  const [selectedDirection, setSelectedDirection] = useState('S')

  // Bus step 2 state
  const [selectedBusStop, setSelectedBusStop] = useState(null)
  const [busRoutes, setBusRoutes] = useState([])
  const [selectedBusRoutes, setSelectedBusRoutes] = useState(new Set())

  // Bus step 3 state (headsign variants for PABT-like stops)
  const [busVariants, setBusVariants] = useState([])

  // PATH step 2 state
  const [selectedPathStation, setSelectedPathStation] = useState(null)
  const [pathOptions, setPathOptions] = useState([])
  const [selectedPathOptions, setSelectedPathOptions] = useState(new Set())

  // NJT Rail step 2 state
  const [selectedRailStation, setSelectedRailStation] = useState(null)
  const [railLines, setRailLines] = useState([])
  const [railLinesLoaded, setRailLinesLoaded] = useState(false)
  const [selectedRailLines, setSelectedRailLines] = useState(new Set())

  const searchRef = useRef(null)
  const debounceRef = useRef(null)
  const prevOpenRef = useRef(false)

  function resetAll() {
    setStep('modes')
    setMode(null)
    setQuery('')
    setResults([])
    setSelectedStation(null)
    setStationLines([])
    setSelectedLines(new Set())
    setSelectedDirection('S')
    setSelectedBusStop(null)
    setBusRoutes([])
    setSelectedBusRoutes(new Set())
    setBusVariants([])
    setSelectedPathStation(null)
    setPathOptions([])
    setSelectedPathOptions(new Set())
    setSelectedRailStation(null)
    setRailLines([])
    setRailLinesLoaded(false)
    setSelectedRailLines(new Set())
  }

  // Reset on open
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      resetAll()
    }
    prevOpenRef.current = open
  }, [open])

  // Focus search on step change
  useEffect(() => {
    if (step === 'search' && searchRef.current) {
      searchRef.current.focus()
    }
  }, [step])

  function pickMode(m) {
    setMode(m)
    setStep('search')
    setQuery('')
    setResults([])
  }

  function goBack() {
    if (step === 'subway-dir') {
      setStep('search')
      setSelectedStation(null)
      setStationLines([])
      setSelectedLines(new Set())
    } else if (step === 'bus-variants') {
      setStep('bus-lines')
      setBusVariants([])
    } else if (step === 'bus-lines') {
      setStep('search')
      setSelectedBusStop(null)
      setBusRoutes([])
      setSelectedBusRoutes(new Set())
    } else if (step === 'path-dir') {
      setStep('search')
      setSelectedPathStation(null)
      setPathOptions([])
      setSelectedPathOptions(new Set())
    } else if (step === 'rail-lines') {
      setStep('search')
      setSelectedRailStation(null)
      setRailLines([])
      setRailLinesLoaded(false)
      setSelectedRailLines(new Set())
    } else if (step === 'search') {
      setStep('modes')
      setMode(null)
    }
  }

  // ── Search with debounce ──
  function handleSearch(q) {
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.length < 2) { setResults([]); return }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const encoded = encodeURIComponent(q)
        const modeId = mode?.id
        let url = '', mapFn = null

        switch (modeId) {
          case 'subway':
            url = `/api/mta/stations?q=${encoded}`
            mapFn = d => d.stations || []
            break
          case 'bus':
            url = `/api/bus/stop-search?q=${encoded}`
            mapFn = d => d.stops || []
            break
          case 'rail':
            url = `/api/rail/stations?q=${encoded}`
            mapFn = d => d.stations || []
            break
          case 'path':
            url = `/api/path/stations?q=${encoded}`
            mapFn = d => d.stations || []
            break
          case 'ferry':
            url = `/api/ferry/terminals?q=${encoded}`
            mapFn = d => d.terminals || d || []
            break
          case 'hblr':
            url = `/api/bus/stop-search?q=${encoded}&routes=HBLR`
            mapFn = d => d.stops || []
            break
          case 'lirr':
            url = `/api/lirr/stations?q=${encoded}`
            mapFn = d => d.stations || []
            break
          case 'mnr':
            url = `/api/mnr/stations?q=${encoded}`
            mapFn = d => d.stations || []
            break
          case 'mtabus':
            url = `/api/mtabus/routes?q=${encoded}`
            mapFn = d => d.routes || []
            break
          case 'nycferry':
            url = `/api/nycferry/stops?q=${encoded}`
            mapFn = d => d.stops || []
            break
        }

        if (url) {
          const res = await fetch(url)
          if (res.ok) {
            const data = await res.json()
            const mapped = mapFn ? mapFn(data) : []
            setResults(Array.isArray(mapped) ? mapped : [])
          }
        }
      } catch (e) {
        console.error('Search error:', e)
      } finally {
        setSearching(false)
      }
    }, 300)
  }

  // ── Result selection — mode-specific behavior ──
  function selectResult(result) {
    const modeId = mode?.id

    if (modeId === 'subway') {
      // Go to step 2: pick lines + direction
      setSelectedStation(result)
      setStep('subway-dir')
      // Fetch lines at this station
      const ids = (result.ids || [result.id]).join(',')
      fetch(`/api/mta/station-lines?ids=${ids}`)
        .then(r => r.ok ? r.json() : { lines: [] })
        .then(d => {
          setStationLines(d.lines || [])
          setSelectedLines(new Set(d.lines || []))
        })
      return
    }

    if (modeId === 'bus') {
      // Go to step 2: pick routes at this stop
      // result.id may be comma-separated IDs for multi-platform stops (e.g. PABT)
      setSelectedBusStop(result)
      setStep('bus-lines')
      fetch(`/api/bus/stop-routes?id=${result.id}`)
        .then(r => r.ok ? r.json() : { routes: [] })
        .then(d => {
          const routes = d.routes || []
          setBusRoutes(routes)
          setSelectedBusRoutes(new Set(routes))
        })
      return
    }

    if (modeId === 'path') {
      // Go to step 2: pick direction
      setSelectedPathStation(result)
      setStep('path-dir')
      fetch(`/api/path/station-routes?id=${result.id}`)
        .then(r => r.ok ? r.json() : { options: [] })
        .then(d => setPathOptions(d.options || []))
      return
    }

    if (modeId === 'rail') {
      // Go to step 2: pick lines
      setSelectedRailStation(result)
      setStep('rail-lines')
      setRailLines([])
      setRailLinesLoaded(false)
      fetch(`/api/rail/station-lines?code=${result.code || result.id}`)
        .then(r => r.ok ? r.json() : { lines: [] })
        .then(d => {
          const lines = d.lines || []
          setRailLines(lines)
          setRailLinesLoaded(true)
          setSelectedRailLines(new Set(lines.map(l => l.code)))
        })
      return
    }

    // All other modes: add directly
    const stopId = buildSimpleStopId(modeId, result)
    const displayName = result.name || result.label || result.id
    onAdd(stopId, displayName)
  }

  // ── Confirm subway ──
  function confirmSubway() {
    if (!selectedStation || selectedLines.size === 0) return
    const ids = (selectedStation.ids || [selectedStation.id]).join(',')
    const lines = [...selectedLines].join(',')
    const dir = selectedDirection === 'all' ? 'A' : selectedDirection
    const stopId = `mta:${ids}:${dir}:${lines}`
    const dirLabel = selectedDirection === 'N' ? 'Uptown' : selectedDirection === 'S' ? 'Downtown' : 'Both'
    const displayName = `${selectedStation.name} (${dirLabel})`
    onAdd(stopId, displayName)
  }

  // ── Confirm bus — check for headsign variants (PABT) ──
  function confirmBus() {
    if (!selectedBusStop || selectedBusRoutes.size === 0) return
    const routes = [...selectedBusRoutes].join(',')
    // Fetch headsign variants to check if we need a sub-picker
    fetch(`/api/bus/stop-headsigns?ids=${selectedBusStop.id}&routes=${routes}`)
      .then(r => r.ok ? r.json() : { variants: [] })
      .then(d => {
        const variants = d.variants || []

        // Check if variants have different gates — only show picker if gates differ
        const uniqueGates = new Set(variants.map(v => v.gate).filter(Boolean))
        const hasMultipleGates = uniqueGates.size > 1

        // Also check if a single route has multiple distinct variants
        const routeVariantCounts = {}
        for (const v of variants) {
          routeVariantCounts[v.route] = (routeVariantCounts[v.route] || 0) + 1
        }
        const hasMultipleVariantsPerRoute = Object.values(routeVariantCounts).some(c => c > 1)

        // Show variant picker only if gates differ (meaningful choice)
        if (hasMultipleGates && hasMultipleVariantsPerRoute && variants.length > 1) {
          setBusVariants(variants)
          setStep('bus-variants')
        } else {
          // No meaningful variant choice — add directly
          const stopId = `bus:${selectedBusStop.id}:${routes}`
          const displayName = `${selectedBusStop.name} (${routes})`
          onAdd(stopId, displayName)
        }
      })
  }

  // ── Add bus with headsign filter (from variant picker) ──
  function addBusVariant(variant) {
    const routes = variant.route
    const headsign = variant.keyword
    // Use variant-specific stop IDs if provided (e.g. PABT 126 Willow vs Washington)
    const stopIds = variant.stopIds || selectedBusStop.id
    const stopId = `bus:${stopIds}:${routes}:${headsign}`
    const displayName = `${selectedBusStop.name} · ${routes} ${variant.variant}`
    onAdd(stopId, displayName)
  }

  // ── Select PATH direction option ──
  function confirmPath() {
    if (!selectedPathStation || selectedPathOptions.size === 0) return
    const selected = pathOptions.filter((_, i) => selectedPathOptions.has(i))
    const allRouteIds = [...new Set(selected.flatMap(o => o.routeIds))]
    const allDirIds = [...new Set(selected.map(o => o.dirId))]
    const routeIds = allRouteIds.join(',')
    const dirId = allDirIds.length > 1 ? allDirIds.join(',') : allDirIds[0]
    const stopId = `path:${routeIds}:${dirId}:${selectedPathStation.id}`
    // Short display name: station + direction summary
    let dirLabel
    if (selected.length === pathOptions.length) {
      dirLabel = 'All directions'
    } else if (selected.length <= 2) {
      dirLabel = selected.map(o => o.label).join(' + ')
    } else {
      dirLabel = `${selected[0].label} +${selected.length - 1}`
    }
    const displayName = `${selectedPathStation.name} · ${dirLabel}`
    onAdd(stopId, displayName)
  }

  // ── Confirm NJT Rail ──
  function confirmRail() {
    if (!selectedRailStation || selectedRailLines.size === 0) return
    const code = selectedRailStation.code || selectedRailStation.id
    const lines = [...selectedRailLines].join(',')
    const stopId = `rail:${code}:${lines}`
    let lineLabel
    if (selectedRailLines.size === railLines.length) {
      lineLabel = 'All lines'
    } else if (selectedRailLines.size <= 2) {
      lineLabel = railLines.filter(l => selectedRailLines.has(l.code)).map(l => l.abbr).join(', ')
    } else {
      const first = railLines.find(l => selectedRailLines.has(l.code))
      lineLabel = `${first?.abbr} +${selectedRailLines.size - 1}`
    }
    const displayName = `${selectedRailStation.name} (${lineLabel})`
    onAdd(stopId, displayName)
  }

  // ── Simple stop ID builder for modes without step 2 ──
  function buildSimpleStopId(modeId, result) {
    switch (modeId) {
      case 'ferry': return `ferry:${result.tag || result.id}::`
      case 'hblr': return `hblr:${result.id}`
      case 'lirr': return `lirr:${result.id}`
      case 'mnr': return `mnr:${result.id}`
      case 'mtabus': return `mtabus:${result.stopId || result.id}:${result.route || result.id}`
      case 'nycferry': return `nycferry:${result.id}`
      default: return result.id
    }
  }

  // ── Title ──
  function getTitle() {
    if (step === 'modes') return 'Add a Stop'
    if (step === 'subway-dir') return `${selectedStation?.name} — Lines & Direction`
    if (step === 'bus-lines') return `${selectedBusStop?.name} — Select Routes`
    if (step === 'bus-variants') return `${selectedBusStop?.name} — Pick Variant`
    if (step === 'path-dir') return `${selectedPathStation?.name} — Select Direction`
    if (step === 'rail-lines') return `${selectedRailStation?.name} — Select Lines`
    return `${mode?.label || ''} — Search`
  }

  const modeConfig = mode ? MODES.find(m => m.id === mode.id) || mode : null

  return (
    <div className={`m-addstop-panel ${open ? 'open' : ''}`}>
      <div className="m-addstop-header">
        <button
          className={`m-addstop-back ${step === 'modes' ? 'hidden' : ''}`}
          onClick={goBack}
        >←</button>
        <span className="m-addstop-title">{getTitle()}</span>
        <button className="m-set-close" onClick={onClose}>✕</button>
      </div>

      {/* Step: Mode picker */}
      {step === 'modes' && (
        <div className="m-addstop-modes">
          {MODES.map(m => (
            <button
              key={m.id}
              className={`m-addstop-mode ${!m.enabled ? 'm-addstop-mode-disabled' : ''}`}
              onClick={() => m.enabled && pickMode(m)}
              disabled={!m.enabled}
            >
              <span className="m-addstop-mode-icon">{m.icon}</span>
              <span>{m.label}</span>
              {!m.enabled && <span className="m-addstop-coming-soon">Coming Soon</span>}
            </button>
          ))}
        </div>
      )}

      {/* Step: Search */}
      {step === 'search' && (
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
            {query.length < 2 && <div className="m-addstop-hint">Type at least 2 characters to search</div>}
            {searching && <div className="m-addstop-hint">Searching…</div>}
            {!searching && results.map((r, i) => (
              <button key={i} className="m-addstop-result" onClick={() => selectResult(r)}>
                <div className="m-addstop-result-name">{r.name || r.label}</div>
                {r.linesLabel && <div className="m-addstop-result-sub">{r.linesLabel}</div>}
                {r.desc && <div className="m-addstop-result-sub">{r.desc}</div>}
              </button>
            ))}
            {!searching && query.length >= 2 && results.length === 0 && (
              <div className="m-addstop-hint">No results found</div>
            )}
          </div>
        </div>
      )}

      {/* Step: Subway — pick lines + direction */}
      {step === 'subway-dir' && selectedStation && (
        <div className="m-addstop-step">
          <p className="m-addstop-section-label">Lines at this station</p>
          <div className="m-addstop-line-grid">
            {stationLines.length > 0 ? stationLines.map(line => (
              <button
                key={line}
                className={`m-addstop-line-btn ${selectedLines.has(line) ? 'active' : ''}`}
                onClick={() => setSelectedLines(prev => {
                  const next = new Set(prev)
                  next.has(line) ? next.delete(line) : next.add(line)
                  return next
                })}
              >
                <SubwayBadge line={line} size={32} />
              </button>
            )) : (
              <div className="m-addstop-hint">Loading lines…</div>
            )}
          </div>

          <p className="m-addstop-section-label" style={{ marginTop: 16 }}>Direction</p>
          <div className="m-addstop-dir-options">
            {[
              { value: 'S', label: 'Downtown / Brooklyn' },
              { value: 'N', label: 'Uptown / Bronx / Queens' },
              { value: 'all', label: 'Both directions' },
            ].map(opt => (
              <button
                key={opt.value}
                className={`m-addstop-dir-btn ${selectedDirection === opt.value ? 'active' : ''}`}
                onClick={() => setSelectedDirection(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            className="m-addstop-confirm"
            onClick={confirmSubway}
            disabled={selectedLines.size === 0}
          >
            Add to My Stops
          </button>
        </div>
      )}

      {/* Step: Bus — pick routes */}
      {step === 'bus-lines' && selectedBusStop && (
        <div className="m-addstop-step">
          <div className="m-addstop-section-header">
            <p className="m-addstop-section-label">Routes at this stop</p>
            <button className="m-addstop-select-all" onClick={() => {
              if (selectedBusRoutes.size === busRoutes.length) setSelectedBusRoutes(new Set())
              else setSelectedBusRoutes(new Set(busRoutes))
            }}>
              {selectedBusRoutes.size === busRoutes.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>
          <div className="m-addstop-route-list">
            {busRoutes.length > 0 ? busRoutes.map(route => (
              <button
                key={route}
                className={`m-addstop-route-btn ${selectedBusRoutes.has(route) ? 'active' : ''}`}
                onClick={() => setSelectedBusRoutes(prev => {
                  const next = new Set(prev)
                  next.has(route) ? next.delete(route) : next.add(route)
                  return next
                })}
              >
                <span className="m-addstop-route-badge" style={{ background: njtRouteColor(route) }}>{route}</span>
                <span>Route {route}</span>
              </button>
            )) : (
              <div className="m-addstop-hint">Loading routes…</div>
            )}
          </div>

          <button
            className="m-addstop-confirm"
            onClick={confirmBus}
            disabled={selectedBusRoutes.size === 0}
          >
            Add to My Stops
          </button>
        </div>
      )}

      {/* Step: Bus variants (PABT — pick headsign direction) */}
      {step === 'bus-variants' && (
        <div className="m-addstop-step">
          <p className="m-addstop-section-label">Which direction / variant?</p>
          <p className="m-addstop-hint" style={{ marginBottom: 12 }}>Each variant departs from a different gate</p>
          <div className="m-addstop-route-list">
            {busVariants.map((v, i) => (
              <button
                key={i}
                className="m-addstop-result"
                onClick={() => addBusVariant(v)}
              >
                <div className="m-addstop-result-name">{v.route} · {v.variant}</div>
                {v.gate && <div className="m-addstop-result-sub">Gate {v.gate}{v.gateSchedule ? ` (day: ${v.gateSchedule.day}, late: ${v.gateSchedule.late})` : ''}</div>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step: PATH — pick direction(s) */}
      {step === 'path-dir' && selectedPathStation && (
        <div className="m-addstop-step">
          <p className="m-addstop-section-label">Where are you going?</p>
          <p className="m-addstop-hint" style={{ marginBottom: 8 }}>Select one or more directions</p>
          <div className="m-addstop-route-list">
            {pathOptions.length > 0 ? pathOptions.map((opt, i) => (
              <button
                key={i}
                className={`m-addstop-route-btn ${selectedPathOptions.has(i) ? 'active' : ''}`}
                onClick={() => setSelectedPathOptions(prev => {
                  const next = new Set(prev)
                  next.has(i) ? next.delete(i) : next.add(i)
                  return next
                })}
              >
                <span className="m-addstop-route-badge" style={{ background: '#0369a1' }}>{opt.routeNames[0]?.split('-')[0] || '→'}</span>
                <span>{opt.label}</span>
              </button>
            )) : (
              <div className="m-addstop-hint">Loading directions…</div>
            )}
          </div>
          <button
            className="m-addstop-confirm"
            onClick={confirmPath}
            disabled={selectedPathOptions.size === 0}
          >
            Add to My Stops
          </button>
        </div>
      )}

      {/* Step: NJT Rail — pick lines */}
      {step === 'rail-lines' && selectedRailStation && (
        <div className="m-addstop-step">
          <div className="m-addstop-section-header">
            <p className="m-addstop-section-label">Lines at this station</p>
            <button className="m-addstop-select-all" onClick={() => {
              if (selectedRailLines.size === railLines.length) setSelectedRailLines(new Set())
              else setSelectedRailLines(new Set(railLines.map(l => l.code)))
            }}>
              {selectedRailLines.size === railLines.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>
          <div className="m-addstop-route-list">
            {railLines.length > 0 ? railLines.map(line => (
              <button
                key={line.code}
                className={`m-addstop-route-btn ${selectedRailLines.has(line.code) ? 'active' : ''}`}
                onClick={() => setSelectedRailLines(prev => {
                  const next = new Set(prev)
                  next.has(line.code) ? next.delete(line.code) : next.add(line.code)
                  return next
                })}
              >
                <span className="m-addstop-route-badge" style={{ background: line.color, fontSize: 9 }}>{line.abbr}</span>
                <span>{line.name}</span>
              </button>
            )) : railLinesLoaded ? (
              <div className="m-addstop-hint">No lines found at this station. Try a different station (e.g. Upper/Lower level).</div>
            ) : (
              <div className="m-addstop-hint">Loading lines…</div>
            )}
          </div>
          {railLines.length > 0 && (
            <button
              className="m-addstop-confirm"
              onClick={confirmRail}
              disabled={selectedRailLines.size === 0}
            >
              Add to My Stops
            </button>
          )}
        </div>
      )}
    </div>
  )
}
