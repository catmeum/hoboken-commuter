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
  { id: 'ferry', label: 'NY Waterway', icon: <NywFerryIcon size={16} />, placeholder: 'Search for a ferry terminal…', enabled: true },
  { id: 'hblr', label: 'Hudson-Bergen Light Rail', icon: <LightRailIcon size={16} />, placeholder: 'Search for an HBLR stop…', enabled: true },
  { id: 'nlr', label: 'Newark Light Rail', icon: <LightRailIcon size={16} />, placeholder: 'Search for a Newark LR stop…', enabled: true },
  { id: 'lirr', label: 'LIRR', icon: <HeavyRailIcon size={16} />, placeholder: 'Search for a LIRR station…', enabled: true },
  { id: 'mnr', label: 'Metro-North', icon: <GrandCentralClock size={16} />, placeholder: 'Search for a Metro-North station…', enabled: true },
  { id: 'mtabus', label: 'MTA Bus', icon: <MtaBusIcon size={16} />, placeholder: 'Search for a bus route (M1, B63, Q32)…', enabled: true },
  { id: 'nycferry', label: 'NYC Ferry', icon: <NycFerryIcon size={16} />, placeholder: 'Search for a ferry stop…', enabled: true },
]

export default function AddStopPanel({ open, onClose, onAdd, editingStop, onUpdate }) {
  const [step, setStep] = useState('modes') // modes | search | subway-dir | bus-lines | edit-name
  const [mode, setMode] = useState(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  // Edit mode state
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editHiddenBadges, setEditHiddenBadges] = useState([])

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
  const [selectedBusVariants, setSelectedBusVariants] = useState(new Set())
  // Bus direction state (for stops with multiple physical IDs)
  const [busDirections, setBusDirections] = useState([])

  // PATH step 2 state
  const [selectedPathStation, setSelectedPathStation] = useState(null)
  const [pathOptions, setPathOptions] = useState([])
  const [selectedPathOptions, setSelectedPathOptions] = useState(new Set())

  // NJT Rail step 2 state
  const [selectedRailStation, setSelectedRailStation] = useState(null)
  const [railLines, setRailLines] = useState([])
  const [railLinesLoaded, setRailLinesLoaded] = useState(false)
  const [selectedRailLines, setSelectedRailLines] = useState(new Set())

  // LIRR step 2 state
  const [selectedLirrStation, setSelectedLirrStation] = useState(null)
  const [lirrRoutes, setLirrRoutes] = useState([])
  const [selectedLirrRoutes, setSelectedLirrRoutes] = useState(new Set())

  // MNR step 2 state
  const [selectedMnrStation, setSelectedMnrStation] = useState(null)
  const [mnrRoutes, setMnrRoutes] = useState([])
  const [selectedMnrRoutes, setSelectedMnrRoutes] = useState(new Set())

  // Ferry step 2 state
  const [selectedFerryTerminal, setSelectedFerryTerminal] = useState(null)
  const [ferryRoutes, setFerryRoutes] = useState([])
  const [selectedFerryDests, setSelectedFerryDests] = useState(new Set())

  // MTA Bus step 2 state
  const [selectedMtaBusRoute, setSelectedMtaBusRoute] = useState(null)
  const [mtaBusStops, setMtaBusStops] = useState([])

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
    setBusDirections([])
    setSelectedPathStation(null)
    setPathOptions([])
    setSelectedPathOptions(new Set())
    setSelectedRailStation(null)
    setRailLines([])
    setRailLinesLoaded(false)
    setSelectedRailLines(new Set())
    setSelectedLirrStation(null)
    setLirrRoutes([])
    setSelectedLirrRoutes(new Set())
    setSelectedMnrStation(null)
    setMnrRoutes([])
    setSelectedMnrRoutes(new Set())
    setSelectedFerryTerminal(null)
    setFerryRoutes([])
    setSelectedFerryDests(new Set())
    setSelectedMtaBusRoute(null)
    setMtaBusStops([])
  }

  // Reset on open
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      if (editingStop) {
        // Edit mode — show the edit-name step
        resetAll() // eslint-disable-line react-hooks/set-state-in-effect
        setStep('edit-name')
        setEditDisplayName(editingStop.displayName || '')
        setEditHiddenBadges(editingStop.hiddenBadges || [])
      } else {
        resetAll()
      }
    }
    prevOpenRef.current = open
  }, [open, editingStop])

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
    if (step === 'edit-name') {
      onClose()
    } else if (step === 'subway-dir') {
      setStep('search')
      setSelectedStation(null)
      setStationLines([])
      setSelectedLines(new Set())
    } else if (step === 'bus-variants') {
      setStep('bus-lines')
      setBusVariants([])
      setSelectedBusVariants(new Set())
    } else if (step === 'bus-direction') {
      setStep('bus-lines')
      setBusDirections([])
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
    } else if (step === 'ferry-dest') {
      setStep('search')
      setSelectedFerryTerminal(null)
      setFerryRoutes([])
      setSelectedFerryDests(new Set())
    } else if (step === 'mtabus-stops') {
      setStep('search')
      setSelectedMtaBusRoute(null)
      setMtaBusStops([])
    } else if (step === 'lirr-lines') {
      setStep('search')
      setSelectedLirrStation(null)
      setLirrRoutes([])
      setSelectedLirrRoutes(new Set())
    } else if (step === 'mnr-lines') {
      setStep('search')
      setSelectedMnrStation(null)
      setMnrRoutes([])
      setSelectedMnrRoutes(new Set())
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
          case 'nlr':
            url = `/api/bus/stop-search?q=${encoded}&routes=NLR`
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

    if (modeId === 'ferry') {
      // Go to step 2: pick destinations (multi-select)
      setSelectedFerryTerminal(result)
      setStep('ferry-dest')
      fetch(`/api/ferry/terminal-routes?tag=${result.tag || result.id}`)
        .then(r => r.ok ? r.json() : { routes: [] })
        .then(d => {
          const routes = d.routes || []
          setFerryRoutes(routes)
          // Pre-select all destinations
          const allDests = new Set()
          for (const r of routes) {
            for (const dest of r.destinations || []) allDests.add(`${r.no}:${dest}`)
            if ((r.destinations || []).length === 0) allDests.add(`${r.no}:`)
          }
          setSelectedFerryDests(allDests)
        })
      return
    }

    if (modeId === 'mtabus') {
      // Step 2: pick a stop on this route
      setSelectedMtaBusRoute(result)
      setStep('mtabus-stops')
      fetch(`/api/mtabus/route-stops?route=${encodeURIComponent(result.id)}`)
        .then(r => r.ok ? r.json() : { directions: [] })
        .then(d => {
          const allStops = (d.directions || []).flatMap(dir =>
            dir.stops.map(s => ({ ...s, direction: dir.direction }))
          )
          setMtaBusStops(allStops)
        })
      return
    }

    if (modeId === 'lirr') {
      setSelectedLirrStation(result)
      setStep('lirr-lines')
      fetch(`/api/lirr/station-routes?stop=${result.id}`)
        .then(r => r.ok ? r.json() : { routes: [] })
        .then(d => {
          const routes = d.routes || []
          setLirrRoutes(routes)
          setSelectedLirrRoutes(new Set(routes.map(r => r.id)))
        })
      return
    }

    if (modeId === 'mnr') {
      setSelectedMnrStation(result)
      setStep('mnr-lines')
      fetch(`/api/mnr/station-routes?stop=${result.id}`)
        .then(r => r.ok ? r.json() : { routes: [] })
        .then(d => {
          const routes = d.routes || []
          setMnrRoutes(routes)
          setSelectedMnrRoutes(new Set(routes.map(r => r.id)))
        })
      return
    }

    // All other modes: add directly
    const stopId = buildSimpleStopId(modeId, result)
    const displayName = result.name || result.label || result.id
    handleAdd(stopId, displayName)
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
    handleAdd(stopId, displayName)
  }

  // ── Confirm bus — check for headsign variants (PABT) ──
  function confirmBus() {
    if (!selectedBusStop || selectedBusRoutes.size === 0) return
    const routes = [...selectedBusRoutes].join(',')
    const ids = selectedBusStop.id

    // First check if this stop has multiple physical IDs (different directions)
    const idList = ids.split(',')
    if (idList.length > 1) {
      // Check if directions differ
      fetch(`/api/bus/stop-directions?ids=${ids}&routes=${routes}`)
        .then(r => r.ok ? r.json() : { needsPicker: false })
        .then(d => {
          if (d.needsPicker && d.directions.length > 1) {
            setBusDirections(d.directions)
            setStep('bus-direction')
          } else {
            // Single direction or can't determine — proceed to variant check
            checkBusVariants(ids, routes)
          }
        })
    } else {
      // Single stop ID — skip direction picker, go to variant check
      checkBusVariants(ids, routes)
    }
  }

  // Check for PABT headsign variants after direction is resolved
  function checkBusVariants(stopIds, routes) {
    fetch(`/api/bus/stop-headsigns?ids=${stopIds}&routes=${routes}`)
      .then(r => r.ok ? r.json() : { variants: [] })
      .then(d => {
        const variants = d.variants || []
        const uniqueGates = new Set(variants.map(v => v.gate).filter(Boolean))
        const hasMultipleGates = uniqueGates.size > 1
        const routeVariantCounts = {}
        for (const v of variants) {
          routeVariantCounts[v.route] = (routeVariantCounts[v.route] || 0) + 1
        }
        const hasMultipleVariantsPerRoute = Object.values(routeVariantCounts).some(c => c > 1)

        if (hasMultipleGates && hasMultipleVariantsPerRoute && variants.length > 1) {
          setBusVariants(variants)
          setStep('bus-variants')
        } else {
          const stopId = `bus:${stopIds}:${routes}`
          const displayName = selectedBusStop.name
          handleAdd(stopId, displayName)
        }
      })
  }

  // Select a bus direction — then check for variants
  function selectBusDirection(dir) {
    const routes = [...selectedBusRoutes].join(',')
    if (dir.dirId === 'all') {
      checkBusVariants(selectedBusStop.id, routes)
    } else {
      checkBusVariants(dir.stopIds, routes)
    }
  }

  // ── Add bus with headsign filter (from variant picker — multi-select) ──
  function addBusVariants() {
    const selected = busVariants.filter((_, i) => selectedBusVariants.has(i))
    if (selected.length === 0) return

    if (selected.length === 1) {
      // Single variant — same behavior as before
      const variant = selected[0]
      const routes = variant.route
      const headsign = variant.keyword
      const stopIds = variant.stopIds || selectedBusStop.id
      const stopId = `bus:${stopIds}:${routes}:${headsign}`
      const displayName = `${selectedBusStop.name} · ${routes} ${variant.variant}`
      handleAdd(stopId, displayName)
    } else {
      // Multiple variants — combine keywords with semicolons (commas are used within keywords)
      const routes = [...new Set(selected.map(v => v.route))].join(',')
      const keywords = selected.map(v => v.keyword).join(';')
      const stopIds = selected[0].stopIds || selectedBusStop.id
      const stopId = `bus:${stopIds}:${routes}:${keywords}`
      const variantNames = selected.map(v => v.variant).join(' + ')
      const displayName = `${selectedBusStop.name} · ${routes} ${variantNames}`
      handleAdd(stopId, displayName)
    }
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
    handleAdd(stopId, displayName)
  }

  // ── Confirm NJT Rail ──
  function confirmRail() {
    if (!selectedRailStation || selectedRailLines.size === 0) return
    const code = selectedRailStation.code || selectedRailStation.id
    const lines = [...selectedRailLines].join(',')
    const stopId = `rail:${code}:${lines}`
    const displayName = selectedRailStation.name
    handleAdd(stopId, displayName)
  }

  // ── Confirm LIRR ──
  function confirmLirr() {
    if (!selectedLirrStation || selectedLirrRoutes.size === 0) return
    const routes = [...selectedLirrRoutes].join(',')
    const stopId = `lirr:${selectedLirrStation.id}:${routes}`
    handleAdd(stopId, selectedLirrStation.name)
  }

  // ── Confirm MNR ──
  function confirmMnr() {
    if (!selectedMnrStation || selectedMnrRoutes.size === 0) return
    const routes = [...selectedMnrRoutes].join(',')
    const stopId = `mnr:${selectedMnrStation.id}:${routes}`
    handleAdd(stopId, selectedMnrStation.name)
  }

  // ── Simple stop ID builder for modes without step 2 ──
  function buildSimpleStopId(modeId, result) {
    switch (modeId) {
      case 'hblr': return `hblr:${result.id}`
      case 'nlr': return `hblr:${result.id}`
      case 'nycferry': return `nycferry:${result.id}`
      default: return result.id
    }
  }

  // ── Title ──
  function getTitle() {
    if (step === 'edit-name') return 'Edit Stop'
    if (step === 'modes') return 'Add a Stop'
    if (step === 'subway-dir') return `${selectedStation?.name} — Lines & Direction`
    if (step === 'bus-lines') return `${selectedBusStop?.name} — Select Routes`
    if (step === 'bus-direction') return `${selectedBusStop?.name} — Select Direction`
    if (step === 'bus-variants') return `${selectedBusStop?.name} — Select Variants`
    if (step === 'path-dir') return `${selectedPathStation?.name} — Select Direction`
    if (step === 'rail-lines') return `${selectedRailStation?.name} — Select Lines`
    if (step === 'lirr-lines') return `${selectedLirrStation?.name} — Select Branches`
    if (step === 'mnr-lines') return `${selectedMnrStation?.name} — Select Lines`
    if (step === 'ferry-dest') return `${selectedFerryTerminal?.name} — Select Destination`
    if (step === 'mtabus-stops') return `${selectedMtaBusRoute?.name} — Select Stop`
    return `${mode?.label || ''} — Search`
  }

  const modeConfig = mode ? MODES.find(m => m.id === mode.id) || mode : null

  // When in edit mode (reconfigure flow), wrap onAdd to call onUpdate with the old stop ID
  const handleAdd = editingStop
    ? (stopId, displayName) => onUpdate(editingStop.stopId, stopId, displayName)
    : onAdd

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

      {/* Step: Edit stop — rename + reconfigure */}
      {step === 'edit-name' && editingStop && (() => {
        return (
        <div className="m-addstop-step">
          <p className="m-addstop-section-label">Display Name</p>
          <input
            type="text"
            className="m-addstop-search"
            value={editDisplayName}
            onChange={e => setEditDisplayName(e.target.value)}
            placeholder="Custom display name…"
            autoFocus
          />

          <div className="m-addstop-toggle-row" style={{ marginTop: 12, marginBottom: 16 }}>
            <span style={{ fontSize: 13 }}>Show Line Badges</span>
            <button
              className={`m-set-switch ${!editHiddenBadges.includes('__all__') ? 'on' : ''}`}
              onClick={() => {
                setEditHiddenBadges(prev =>
                  prev.includes('__all__') ? [] : ['__all__']
                )
              }}
            />
          </div>

          <button
            className="m-addstop-confirm"
            onClick={() => {
              const name = editDisplayName.trim() || editingStop.displayName
              const badges = Array.isArray(editHiddenBadges) ? editHiddenBadges : []
              onUpdate(editingStop.stopId, editingStop.stopId, name, badges)
            }}
            disabled={!editDisplayName.trim()}
            style={{ position: 'relative', bottom: 'auto', boxShadow: 'none' }}
          >
            Save
          </button>
          <button
            className="m-addstop-mode"
            style={{ marginTop: 12, justifyContent: 'center' }}
            onClick={() => setStep('modes')}
          >
            <span>🔄</span>
            <span>Reconfigure Stop (Replace)</span>
          </button>
        </div>
        )
      })()}

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

      {/* Step: Bus direction (for stops with multiple physical IDs) */}
      {step === 'bus-direction' && (
        <div className="m-addstop-step">
          <p className="m-addstop-section-label">Which direction?</p>
          <div className="m-addstop-dir-options">
            {busDirections.map((dir, i) => (
              <button
                key={i}
                className="m-addstop-dir-btn"
                onClick={() => selectBusDirection(dir)}
              >
                {dir.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step: Bus variants (PABT — pick headsign variants, multi-select) */}
      {step === 'bus-variants' && (
        <div className="m-addstop-step">
          <div className="m-addstop-section-header">
            <p className="m-addstop-section-label">Which variant(s)?</p>
            <button className="m-addstop-select-all" onClick={() => {
              if (selectedBusVariants.size === busVariants.length) setSelectedBusVariants(new Set())
              else setSelectedBusVariants(new Set(busVariants.map((_, i) => i)))
            }}>
              {selectedBusVariants.size === busVariants.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>
          <p className="m-addstop-hint" style={{ marginBottom: 12 }}>Select one or more — each departs from a different gate</p>
          <div className="m-addstop-route-list">
            {busVariants.map((v, i) => (
              <button
                key={i}
                className={`m-addstop-route-btn ${selectedBusVariants.has(i) ? 'active' : ''}`}
                onClick={() => setSelectedBusVariants(prev => {
                  const next = new Set(prev)
                  next.has(i) ? next.delete(i) : next.add(i)
                  return next
                })}
              >
                <div className="m-addstop-result-name">{v.route} · {v.variant}</div>
                {v.gate && <div className="m-addstop-result-sub">Gate {v.gate}{v.gateSchedule ? ` (day: ${v.gateSchedule.day}, late: ${v.gateSchedule.late})` : ''}</div>}
              </button>
            ))}
          </div>
          <button
            className="m-addstop-confirm"
            onClick={addBusVariants}
            disabled={selectedBusVariants.size === 0}
          >
            Add to My Stops
          </button>
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

      {/* Step: Ferry — pick destinations (multi-select) */}
      {step === 'ferry-dest' && selectedFerryTerminal && (
        <div className="m-addstop-step">
          <div className="m-addstop-section-header">
            <p className="m-addstop-section-label">Select destinations</p>
            <button className="m-addstop-select-all" onClick={() => {
              const allDests = new Set()
              for (const r of ferryRoutes) {
                for (const d of r.destinations || []) allDests.add(`${r.no}:${d}`)
                if ((r.destinations || []).length === 0) allDests.add(`${r.no}:`)
              }
              setSelectedFerryDests(prev => prev.size === allDests.size ? new Set() : allDests)
            }}>
              {(() => {
                const allDests = new Set()
                for (const r of ferryRoutes) {
                  for (const d of r.destinations || []) allDests.add(`${r.no}:${d}`)
                  if ((r.destinations || []).length === 0) allDests.add(`${r.no}:`)
                }
                return selectedFerryDests.size === allDests.size ? 'Deselect all' : 'Select all'
              })()}
            </button>
          </div>
          <div className="m-addstop-route-list">
            {ferryRoutes.length > 0 ? ferryRoutes.flatMap(route =>
              route.destinations.length > 0
                ? route.destinations.map(dest => {
                    const key = `${route.no}:${dest}`
                    return (
                      <button
                        key={key}
                        className={`m-addstop-route-btn ${selectedFerryDests.has(key) ? 'active' : ''}`}
                        onClick={() => setSelectedFerryDests(prev => {
                          const next = new Set(prev)
                          next.has(key) ? next.delete(key) : next.add(key)
                          return next
                        })}
                      >
                        <div className="m-addstop-result-name">→ {dest}</div>
                        <div className="m-addstop-result-sub">{route.name}</div>
                      </button>
                    )
                  })
                : [{
                    key: `${route.no}:`,
                    el: (() => {
                      const key = `${route.no}:`
                      return (
                        <button
                          key={key}
                          className={`m-addstop-route-btn ${selectedFerryDests.has(key) ? 'active' : ''}`}
                          onClick={() => setSelectedFerryDests(prev => {
                            const next = new Set(prev)
                            next.has(key) ? next.delete(key) : next.add(key)
                            return next
                          })}
                        >
                          <div className="m-addstop-result-name">{route.name}</div>
                        </button>
                      )
                    })()
                  }].map(x => x.el)
            ) : (
              <div className="m-addstop-hint">Loading destinations…</div>
            )}
          </div>

          <button
            className="m-addstop-confirm"
            onClick={() => {
              const tag = selectedFerryTerminal.tag || selectedFerryTerminal.id
              const termName = selectedFerryTerminal.name
              // Build all possible destinations for comparison
              const allDests = new Set()
              for (const r of ferryRoutes) {
                for (const d of r.destinations || []) allDests.add(`${r.no}:${d}`)
                if ((r.destinations || []).length === 0) allDests.add(`${r.no}:`)
              }
              let stopId
              if (selectedFerryDests.size === allDests.size) {
                stopId = `ferry:${tag}:all`
              } else {
                const pairs = [...selectedFerryDests]
                stopId = `ferry:${tag}:${pairs.join(',')}`
              }
              // Display name is just the terminal name — badges show destinations
              handleAdd(stopId, termName)
            }}
            disabled={selectedFerryDests.size === 0}
          >
            Add to My Stops
          </button>
        </div>
      )}

      {/* Step: LIRR — pick branches */}
      {step === 'lirr-lines' && selectedLirrStation && (
        <div className="m-addstop-step">
          <div className="m-addstop-section-header">
            <p className="m-addstop-section-label">Branches at this station</p>
            <button className="m-addstop-select-all" onClick={() => {
              if (selectedLirrRoutes.size === lirrRoutes.length) setSelectedLirrRoutes(new Set())
              else setSelectedLirrRoutes(new Set(lirrRoutes.map(r => r.id)))
            }}>
              {selectedLirrRoutes.size === lirrRoutes.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>
          <div className="m-addstop-route-list">
            {lirrRoutes.length > 0 ? lirrRoutes.map(route => (
              <button
                key={route.id}
                className={`m-addstop-route-btn ${selectedLirrRoutes.has(route.id) ? 'active' : ''}`}
                onClick={() => setSelectedLirrRoutes(prev => {
                  const next = new Set(prev)
                  next.has(route.id) ? next.delete(route.id) : next.add(route.id)
                  return next
                })}
              >
                <span className="m-addstop-route-badge" style={{ background: route.color || '#0039A6', fontSize: 8 }}>{route.name.replace(' Branch', '').slice(0, 6)}</span>
                <span>{route.name}</span>
              </button>
            )) : (
              <div className="m-addstop-hint">Loading branches…</div>
            )}
          </div>
          {lirrRoutes.length > 0 && (
            <button className="m-addstop-confirm" onClick={confirmLirr} disabled={selectedLirrRoutes.size === 0}>
              Add to My Stops
            </button>
          )}
        </div>
      )}

      {/* Step: Metro-North — pick lines */}
      {step === 'mnr-lines' && selectedMnrStation && (
        <div className="m-addstop-step">
          <div className="m-addstop-section-header">
            <p className="m-addstop-section-label">Lines at this station</p>
            <button className="m-addstop-select-all" onClick={() => {
              if (selectedMnrRoutes.size === mnrRoutes.length) setSelectedMnrRoutes(new Set())
              else setSelectedMnrRoutes(new Set(mnrRoutes.map(r => r.id)))
            }}>
              {selectedMnrRoutes.size === mnrRoutes.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>
          <div className="m-addstop-route-list">
            {mnrRoutes.length > 0 ? mnrRoutes.map(route => (
              <button
                key={route.id}
                className={`m-addstop-route-btn ${selectedMnrRoutes.has(route.id) ? 'active' : ''}`}
                onClick={() => setSelectedMnrRoutes(prev => {
                  const next = new Set(prev)
                  next.has(route.id) ? next.delete(route.id) : next.add(route.id)
                  return next
                })}
              >
                <span className="m-addstop-route-badge" style={{ background: route.color || '#0039A6', fontSize: 9 }}>{route.name.slice(0, 5)}</span>
                <span>{route.name}</span>
              </button>
            )) : (
              <div className="m-addstop-hint">Loading lines…</div>
            )}
          </div>
          {mnrRoutes.length > 0 && (
            <button className="m-addstop-confirm" onClick={confirmMnr} disabled={selectedMnrRoutes.size === 0}>
              Add to My Stops
            </button>
          )}
        </div>
      )}

      {/* Step: MTA Bus — pick stop */}
      {step === 'mtabus-stops' && selectedMtaBusRoute && (
        <div className="m-addstop-step">
          <p className="m-addstop-section-label">Select a stop on {selectedMtaBusRoute.name}</p>
          {selectedMtaBusRoute.desc && <p className="m-addstop-hint" style={{ marginBottom: 8 }}>{selectedMtaBusRoute.desc}</p>}
          <div className="m-addstop-results" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {mtaBusStops.length > 0 ? mtaBusStops.map((s, i) => (
              <button
                key={`${s.id}-${i}`}
                className="m-addstop-result"
                onClick={() => {
                  const stopId = `mtabus:${s.id}:${selectedMtaBusRoute.id}`
                  const displayName = s.name
                  handleAdd(stopId, displayName)
                }}
              >
                <div className="m-addstop-result-name">{s.name}</div>
                {s.direction && <div className="m-addstop-result-sub">{s.direction}</div>}
              </button>
            )) : (
              <div className="m-addstop-hint">Loading stops…</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
