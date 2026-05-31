import { useState, useEffect, useRef } from 'react'

const TUNNEL_OPTIONS = [
  { id: 'lincoln', label: 'Lincoln Tunnel' },
  { id: 'holland', label: 'Holland Tunnel' },
  { id: 'gwb_upper', label: 'GW Bridge (Upper)' },
  { id: 'gwb_lower', label: 'GW Bridge (Lower)' },
  { id: 'goethals', label: 'Goethals Bridge' },
  { id: 'bayonne', label: 'Bayonne Bridge' },
]

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
  showWeather, setShowWeather,
  showTunnels, setShowTunnels,
  tunnels, setTunnels,
  alertBadge, setAlertBadge,
  stops, stopNames,
  onRemoveStop,
  onOpenAddStop, onReset,
}) {
  const [confirmReset, setConfirmReset] = useState(false)
  const [showAllStops, setShowAllStops] = useState(false)
  const [showAllTunnels, setShowAllTunnels] = useState(false)
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

  function cycleTheme() {
    const idx = themeOrder.indexOf(theme)
    setTheme(themeOrder[(idx + 1) % themeOrder.length])
  }

  function cycleBadge() {
    const idx = badgeOrder.indexOf(alertBadge)
    setAlertBadge(badgeOrder[(idx + 1) % badgeOrder.length])
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
          <span>Alert Badge Style</span>
          <button className="m-set-mode-btn" onClick={cycleBadge}>{badgeLabels[alertBadge]}</button>
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
        <div className="m-set-toggle-row">
          <span>Show Tunnels</span>
          <button className={`m-set-switch ${showTunnels ? 'on' : ''}`} onClick={() => setShowTunnels(v => !v)} />
        </div>
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
          {visibleStops.map((stopId) => (
            <SwipeableStopItem key={stopId} stopId={stopId} name={stopNames[stopId] || stopId} onRemove={onRemoveStop} />
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

// Swipeable stop item — reveals disabled "Edit" button on swipe left
function SwipeableStopItem({ stopId, name, onRemove }) {
  const [offset, setOffset] = useState(0)
  const startX = useRef(0)

  function handleTouchStart(e) {
    startX.current = e.touches[0].clientX
  }

  function handleTouchMove(e) {
    const diff = e.touches[0].clientX - startX.current
    if (diff < 0) {
      setOffset(Math.max(diff, -70))
    }
  }

  function handleTouchEnd() {
    // Snap open or closed
    setOffset(offset < -35 ? -70 : 0)
  }

  return (
    <div className="m-set-stop-item-wrap">
      <div className="m-set-stop-edit-bg">Edit</div>
      <div
        className="m-set-stop-item"
        style={{ transform: `translateX(${offset}px)`, transition: offset === 0 || offset === -70 ? 'transform 0.2s ease' : 'none' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <span className="m-set-grip">⋮⋮</span>
        <span className="m-set-stop-name">{name}</span>
        <button className="m-set-remove" onClick={() => onRemove(stopId)}>✕</button>
      </div>
    </div>
  )
}
