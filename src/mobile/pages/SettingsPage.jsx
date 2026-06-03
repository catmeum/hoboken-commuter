import { useState, useEffect, useRef } from 'react'
import { Bus } from 'lucide-react'
import { MtaGlobeIcon, NjtBusIcon, NjtRailIcon, PathIcon, LightRailIcon, HeavyRailIcon, NywFerryIcon, NycFerryIcon, MtaBusIcon, GrandCentralClock, SubwayBadge } from '../../components/icons'

const TUNNEL_OPTIONS = [
  { id: 'lincoln', label: 'Lincoln Tunnel' },
  { id: 'holland', label: 'Holland Tunnel' },
  { id: 'gwb_upper', label: 'GW Bridge (Upper)' },
  { id: 'gwb_lower', label: 'GW Bridge (Lower)' },
  { id: 'goethals', label: 'Goethals Bridge' },
  { id: 'bayonne', label: 'Bayonne Bridge' },
]

const ALERT_SOURCE_LABELS = {
  tunnel: '🚗 Tunnels',
  bus: '🚌 NJT Bus',
  path: '🚇 PATH',
  mta: '🔵 MTA Subway',
  ferry: '⛴️ NY Waterway',
  nycferry: '⛴️ NYC Ferry',
  rail: '🚆 NJT Rail',
  hblr: '🚃 HBLR',
  lirr: '🚆 LIRR',
  mnr: '🚆 Metro-North',
  mtabus: '🚌 MTA Bus',
}

// Display names for individual source IDs
function getSourceLabel(sourceId) {
  // bus_126 → "126", mta_B → "B", tunnel_lincoln → "Lincoln", path_hob33 → "HOB–33rd"
  if (sourceId.startsWith('bus_')) return sourceId.replace('bus_', '')
  if (sourceId.startsWith('mta_')) return sourceId.replace('mta_', '')
  if (sourceId === 'path_hob33') return 'HOB–33rd'
  if (sourceId === 'path_jsq33') return 'JSQ–33rd'
  if (sourceId.startsWith('tunnel_')) {
    const name = sourceId.replace('tunnel_', '')
    return name.charAt(0).toUpperCase() + name.slice(1)
  }
  return sourceId
}

// MTA line colors for badge display
const MTA_LINE_COLORS = {
  '1': '#EE352E', '2': '#EE352E', '3': '#EE352E',
  '4': '#00933C', '5': '#00933C', '6': '#00933C',
  '7': '#B933AD',
  'A': '#0039A6', 'C': '#0039A6', 'E': '#0039A6',
  'B': '#FF6319', 'D': '#FF6319', 'F': '#FF6319', 'M': '#FF6319',
  'G': '#6CBE45', 'J': '#996633', 'Z': '#996633', 'L': '#A7A9AC',
  'N': '#FCCC0A', 'Q': '#FCCC0A', 'R': '#FCCC0A', 'W': '#FCCC0A',
  'S': '#808183',
}

// NJT Bus route colors (matches TransitCard palette)
const NJT_ROUTE_COLORS_SETTINGS = {
  '119': '#0e7c47', '125': '#6b21a8', '126': '#1e40af',
  '22': '#b45309', '64': '#0f766e', '68': '#7c2d12',
  '85': '#4338ca', '87': '#be123c', '89': '#7c3aed',
}

function AlertCategoryToggle({ category, sourceIds, alertToggles, setAlertToggles }) {
  const [expanded, setExpanded] = useState(false)
  const hasSubs = sourceIds.length > 1
  const allOn = sourceIds.every(id => alertToggles[id] !== false)
  const allOff = sourceIds.every(id => alertToggles[id] === false)
  const someOff = !allOn && !allOff

  function toggleAll() {
    const newVal = !allOn
    setAlertToggles(prev => {
      const next = { ...prev }
      for (const id of sourceIds) next[id] = newVal
      return next
    })
  }

  function toggleOne(id) {
    setAlertToggles(prev => ({ ...prev, [id]: prev[id] === false ? true : false }))
  }

  return (
    <div className="m-set-alert-category">
      <div className={`m-set-alert-toggle ${allOff ? 'off' : 'on'}${someOff ? ' partial' : ''}`}>
        {hasSubs && (
          <button className="m-set-alert-expand" onClick={() => setExpanded(v => !v)}>
            {expanded ? '▾' : '▸'}
          </button>
        )}
        <span className="m-set-alert-toggle-label" onClick={() => hasSubs && setExpanded(v => !v)}>
          {ALERT_SOURCE_LABELS[category] || category}
        </span>
        <span className={`m-set-switch-mini ${allOff ? '' : 'on'}`} onClick={toggleAll} />
      </div>
      {expanded && hasSubs && (
        <div className="m-set-alert-subs">
          {sourceIds.map(id => {
            const isOn = alertToggles[id] !== false
            const label = getSourceLabel(id)
            // Determine badge color for visual identity
            let badgeColor = null
            if (id.startsWith('mta_')) badgeColor = MTA_LINE_COLORS[label] || '#808183'
            if (id.startsWith('bus_')) badgeColor = NJT_ROUTE_COLORS_SETTINGS[label] || '#1e40af'
            return (
              <button
                key={id}
                className={`m-set-alert-sub ${isOn ? 'on' : 'off'}`}
                onClick={() => toggleOne(id)}
              >
                {badgeColor && <span className="m-set-alert-sub-badge" style={{ background: badgeColor }}>{label}</span>}
                {!badgeColor && <span className="m-set-alert-sub-label">{label}</span>}
                <span className={`m-set-switch-mini ${isOn ? 'on' : ''}`} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Sort tunnel options: selected first, then the rest in original order
function sortTunnelsForDisplay(selected) {
  return [...TUNNEL_OPTIONS].sort((a, b) => {
    const aS = selected.includes(a.id) ? 0 : 1
    const bS = selected.includes(b.id) ? 0 : 1
    return aS - bS
  })
}

export default function SettingsPage({
  open, onClose,
  theme, setTheme,
  tempUnit, setTempUnit,
  weatherZip, setWeatherZip,
  showWeather, setShowWeather,
  showTunnels, setShowTunnels,
  tunnels, setTunnels,
  alertBadge, setAlertBadge,
  alertStaleness, setAlertStaleness,
  alertToggles, setAlertToggles,
  alertSourceGroups,
  stops, stopNames, stopHiddenBadges,
  onRemoveStop, onEditStop,
  onOpenAddStop, onReset,
  onReorderStops,
}) {
  const [confirmReset, setConfirmReset] = useState(false)
  const [showAllStops, setShowAllStops] = useState(false)
  const [showAllTunnels, setShowAllTunnels] = useState(false)
  // Drag to reorder state
  const [dragIndex, setDragIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const dragStartY = useRef(0)
  const dragItemHeight = useRef(0)
  // Snapshot the tunnel order on open — selected float to top only on re-open
  const [tunnelOrder, setTunnelOrder] = useState(() => sortTunnelsForDisplay(tunnels))
  const prevOpen = useRef(false)
  useEffect(() => {
    if (open && !prevOpen.current) {
      setTunnelOrder(sortTunnelsForDisplay(tunnels))
      setShowAllTunnels(false)
    }
    prevOpen.current = open
  }, [open, tunnels])

  const themeLabels = { auto: '🌓 Auto', dark: '🌙 Dark', light: '☀️ Light' }
  const themeOrder = ['auto', 'dark', 'light']
  const badgeLabels = { count: '🔴 Count', dot: '● Dot', off: '○ Off' }
  const badgeOrder = ['count', 'dot', 'off']
  const stalenessLabels = { off: 'Off', '30': '30 min', '60': '1 hour', '180': '3 hours', '720': '12 hours' }
  const stalenessOrder = ['off', '30', '60', '180', '720']

  function cycleTheme() {
    const idx = themeOrder.indexOf(theme)
    setTheme(themeOrder[(idx + 1) % themeOrder.length])
  }

  function cycleBadge() {
    const idx = badgeOrder.indexOf(alertBadge)
    setAlertBadge(badgeOrder[(idx + 1) % badgeOrder.length])
  }

  function cycleStaleness() {
    const idx = stalenessOrder.indexOf(alertStaleness)
    setAlertStaleness(stalenessOrder[(idx + 1) % stalenessOrder.length])
  }

  function toggleTunnel(id) {
    setTunnels(prev => {
      if (prev.includes(id)) return prev.filter(t => t !== id)
      if (prev.length >= 2) return prev // max 2, do nothing
      return [...prev, id]
    })
  }

  function handleReset() {
    if (confirmReset) {
      onReset()
      setConfirmReset(false)
    } else {
      setConfirmReset(true)
      setTimeout(() => setConfirmReset(false), 4000)
    }
  }

  const visibleStops = showAllStops ? stops : stops.slice(0, 6)
  const hiddenCount = stops.length - 6

  return (
    <div className={`m-settings-page ${open ? 'active' : ''}`}>
      <div className="m-set-header">
        <span className="m-set-title">Settings</span>
        <button className="m-set-close" onClick={onClose}>✕</button>
      </div>

      {/* Display */}
      <section className="m-set-section">
        <h3 className="m-set-label">Display</h3>
        <div className="m-set-toggle-row">
          <span>Appearance</span>
          <button className="m-set-mode-btn" onClick={cycleTheme}>{themeLabels[theme]}</button>
        </div>
        <div className="m-set-toggle-row">
          <span>Show Weather</span>
          <button className={`m-set-switch ${showWeather ? 'on' : ''}`} onClick={() => setShowWeather(v => !v)} />
        </div>
        {showWeather && (
          <div className="m-set-toggle-row">
            <span>Temperature</span>
            <button className="m-set-mode-btn" onClick={() => setTempUnit(u => u === 'F' ? 'C' : 'F')}>
              °{tempUnit} {tempUnit === 'F' ? 'Fahrenheit' : 'Celsius'}
            </button>
          </div>
        )}
        {showWeather && (
          <ZipCodeInput weatherZip={weatherZip} setWeatherZip={setWeatherZip} />
        )}
        <div className="m-set-toggle-row">
          <span>Show Tunnels</span>
          <button className={`m-set-switch ${showTunnels ? 'on' : ''}`} onClick={() => setShowTunnels(v => !v)} />
        </div>
      </section>

      {/* Alerts — all alert-related settings in one place */}
      <section className="m-set-section">
        <h3 className="m-set-label">Alerts</h3>
        <div className="m-set-toggle-row">
          <span>Badge Style</span>
          <button className="m-set-mode-btn" onClick={cycleBadge}>{badgeLabels[alertBadge]}</button>
        </div>
        <div className="m-set-toggle-row">
          <span>Hide Old Alerts</span>
          <button className="m-set-mode-btn" onClick={cycleStaleness}>{stalenessLabels[alertStaleness]}</button>
        </div>
        {alertSourceGroups && Object.keys(alertSourceGroups).length > 0 && (
          <>
            <p className="m-set-hint" style={{ marginTop: 10 }}>Toggle which alert types appear in your feed</p>
            <div className="m-set-alert-toggles">
              {Object.entries(alertSourceGroups).map(([category, sourceIds]) => (
                <AlertCategoryToggle
                  key={category}
                  category={category}
                  sourceIds={[...sourceIds]}
                  alertToggles={alertToggles}
                  setAlertToggles={setAlertToggles}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Tunnel Configuration */}
      {showTunnels && (() => {
        // Use the snapshotted order (re-sorted only on panel open)
        const visible = showAllTunnels ? tunnelOrder : tunnelOrder.slice(0, Math.max(3, tunnels.length))
        const hiddenCount = tunnelOrder.length - visible.length
        return (
          <section className="m-set-section">
            <h3 className="m-set-label">Tunnels & Bridges</h3>
            <p className="m-set-hint">Select up to 2 to display on My Stops</p>
            <div className="m-set-tunnel-options">
              {visible.map(opt => {
                const isSelected = tunnels.includes(opt.id)
                const isDisabled = !isSelected && tunnels.length >= 2
                return (
                  <button
                    key={opt.id}
                    className={`m-set-tunnel-opt ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                    onClick={() => !isDisabled && toggleTunnel(opt.id)}
                    disabled={isDisabled}
                  >
                    <span>{opt.label}</span>
                  </button>
                )
              })}
            </div>
            {hiddenCount > 0 && (
              <button className="m-set-expand-btn" onClick={() => setShowAllTunnels(v => !v)}>
                {showAllTunnels ? 'Show less' : `Show ${hiddenCount} more`}
              </button>
            )}
          </section>
        )
      })()}

      {/* My Stops */}
      <section className="m-set-section">
        <h3 className="m-set-label">My Stops</h3>
        <div className="m-set-stop-list">
          {visibleStops.map((stopId, idx) => (
            <SwipeableStopItem
              key={stopId}
              stopId={stopId}
              index={idx}
              name={stopNames[stopId] || stopId}
              hideBadges={stopHiddenBadges?.[stopId]?.includes('__all__')}
              onRemove={onRemoveStop}
              onEdit={onEditStop}
              isDragging={dragIndex === idx}
              isDragOver={dragOverIndex === idx}
              onDragStart={(i, y, h) => { setDragIndex(i); dragStartY.current = y; dragItemHeight.current = h }}
              onDragMove={(y) => {
                if (dragIndex === null) return
                const diff = y - dragStartY.current
                const moveBy = Math.round(diff / (dragItemHeight.current + 6))
                const target = Math.max(0, Math.min(visibleStops.length - 1, dragIndex + moveBy))
                setDragOverIndex(target)
              }}
              onDragEnd={() => {
                if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
                  onReorderStops(dragIndex, dragOverIndex)
                }
                setDragIndex(null)
                setDragOverIndex(null)
              }}
            />
          ))}
        </div>
        {hiddenCount > 0 && (
          <button className="m-set-expand-btn" onClick={() => setShowAllStops(v => !v)}>
            {showAllStops ? 'Show less' : `Show ${hiddenCount} more stops`}
          </button>
        )}
        <button className="m-set-add-btn" onClick={onOpenAddStop}>+ Add Stop</button>
      </section>

      {/* Widgets */}
      <section className="m-set-section">
        <h3 className="m-set-label">Widgets</h3>
        <div className="m-set-coming-soon">
          <span className="m-set-cs-icon">📱</span>
          <span className="m-set-cs-text">Home screen widgets — coming soon</span>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="m-set-section m-set-danger">
        <h3 className="m-set-label" style={{ color: '#f87171' }}>Danger Zone</h3>
        <button
          className={`m-set-reset ${confirmReset ? 'confirm' : ''}`}
          onClick={handleReset}
        >
          {confirmReset ? 'Tap again to confirm reset' : 'Reset to Defaults'}
        </button>
      </section>

      {/* About */}
      <section className="m-set-section">
        <h3 className="m-set-label">About</h3>
        <p className="m-set-about">My Stop Now · v2.4.0</p>
        <p className="m-set-about">Made with ❤️ for public transit</p>
      </section>
    </div>
  )
}

// Zip code input with confirm button and reset-to-auto option
function ZipCodeInput({ weatherZip, setWeatherZip }) {
  const [draft, setDraft] = useState(weatherZip || '')
  const isValid = /^\d{5}$/.test(draft)
  const isDirty = draft !== (weatherZip || '')
  const hasManualZip = weatherZip && /^\d{5}$/.test(weatherZip)

  return (
    <div className="m-set-toggle-row" style={{ flexWrap: 'wrap', gap: 6 }}>
      <span>Weather Location</span>
      <div className="m-set-zip-wrap">
        <input
          type="text"
          className="m-set-zip-input"
          placeholder="Zip"
          maxLength={5}
          inputMode="numeric"
          value={draft}
          onFocus={() => setDraft('')}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
        />
        {isDirty && isValid && (
          <button
            className="m-set-zip-confirm"
            onClick={() => setWeatherZip(draft)}
          >✓</button>
        )}
      </div>
      {hasManualZip && (
        <button
          className="m-set-zip-reset"
          onClick={() => { setWeatherZip(''); setDraft('') }}
        >
          Use auto-location
        </button>
      )}
    </div>
  )
}

// Swipeable stop item — reveals "Edit" button on swipe left, drag grip for reordering
function getStopIcon(id) {
  if (id.startsWith('mta:')) return <MtaGlobeIcon size={14} />
  if (id.startsWith('bus:') || id.startsWith('pabt_') || ['clinton', 'willow', 'washington'].includes(id)) return <NjtBusIcon size={14} />
  if (id.startsWith('path:') || id.startsWith('path_')) return <PathIcon size={14} />
  if (id.startsWith('ferry:') || id.startsWith('ferry_')) return <NywFerryIcon size={14} />
  if (id.startsWith('hblr:')) return <LightRailIcon size={14} />
  if (id.startsWith('rail:')) return <NjtRailIcon size={14} />
  if (id.startsWith('lirr:')) return <HeavyRailIcon size={14} />
  if (id.startsWith('mnr:')) return <GrandCentralClock size={14} />
  if (id.startsWith('mtabus:')) return <MtaBusIcon size={14} />
  if (id.startsWith('nycferry:')) return <NycFerryIcon size={14} />
  return <Bus size={14} />
}

function getStopBadges(id) {
  if (id.startsWith('mta:')) {
    const lines = (id.split(':')[3] || '').split(',').filter(Boolean)
    return lines.map(l => <SubwayBadge key={l} line={l} size={14} />)
  }
  if (id.startsWith('bus:')) {
    const routes = (id.split(':')[2] || '').split(',').filter(Boolean)
    return routes.map(r => <span key={r} className="m-set-route-pill bus">{r}</span>)
  }
  if (id.startsWith('rail:')) {
    const lines = (id.split(':')[2] || '').split(',').filter(Boolean)
    return lines.map(l => <span key={l} className="m-set-route-pill rail">{l}</span>)
  }
  if (id.startsWith('mtabus:')) {
    const route = id.split(':')[2] || ''
    const shortRoute = route.replace(/^MTA\+NYCT_/, '').replace(/^MTABC_/, '')
    return shortRoute ? [<span key={shortRoute} className="m-set-route-pill mta-bus">{shortRoute}</span>] : []
  }
  return []
}

function SwipeableStopItem({ stopId, index, name, hideBadges, onRemove, onEdit, isDragging, isDragOver, onDragStart, onDragMove, onDragEnd }) {
  const [offset, setOffset] = useState(0)
  const startX = useRef(0)
  const dragging = useRef(false)
  const itemRef = useRef(null)

  function handleTouchStart(e) {
    startX.current = e.touches[0].clientX
  }

  function handleTouchMove(e) {
    if (dragging.current) return // don't swipe while dragging
    const diff = e.touches[0].clientX - startX.current
    // Allow swiping left to reveal edit, and swiping right to close
    if (diff < 0) {
      setOffset(Math.max(diff, -70))
    } else if (offset < 0) {
      // Swiping right while open — close it
      setOffset(Math.min(0, offset + diff))
    }
  }

  function handleTouchEnd() {
    if (dragging.current) return
    // Snap open or closed
    setOffset(offset < -35 ? -70 : 0)
  }

  function handleEdit() {
    setOffset(0)
    onEdit(stopId)
  }

  // Drag handlers on grip
  function handleGripTouchStart(e) {
    e.stopPropagation()
    dragging.current = true
    const rect = itemRef.current?.getBoundingClientRect()
    onDragStart(index, e.touches[0].clientY, rect?.height || 48)
  }

  function handleGripTouchMove(e) {
    e.stopPropagation()
    if (dragging.current) {
      onDragMove(e.touches[0].clientY)
    }
  }

  function handleGripTouchEnd(e) {
    e.stopPropagation()
    dragging.current = false
    onDragEnd()
  }

  return (
    <div
      ref={itemRef}
      className={`m-set-stop-item-wrap ${isDragging ? 'm-set-dragging' : ''} ${isDragOver ? 'm-set-drag-over' : ''}`}
    >
      <div className="m-set-stop-edit-bg" onClick={handleEdit}>Edit</div>
      <div
        className="m-set-stop-item"
        style={{ transform: `translateX(${offset}px)`, transition: offset === 0 || offset === -70 ? 'transform 0.2s ease' : 'none' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <span
          className="m-set-grip"
          onTouchStart={handleGripTouchStart}
          onTouchMove={handleGripTouchMove}
          onTouchEnd={handleGripTouchEnd}
        >⋮⋮</span>
        <span className="m-set-stop-icon">{getStopIcon(stopId)}</span>
        <span className="m-set-stop-name">{name}</span>
        {!hideBadges && (() => {
          const badges = getStopBadges(stopId)
          if (badges.length === 0) return null
          const visible = badges.slice(0, 2)
          const overflow = badges.length - 2
          return (
            <span className="m-set-stop-badges">
              {visible}
              {overflow > 0 && <span className="m-set-route-pill overflow">+{overflow}</span>}
            </span>
          )
        })()}
        <button className="m-set-remove" onClick={() => onRemove(stopId)}>✕</button>
      </div>
    </div>
  )
}
