import { useState } from 'react'

const TUNNEL_OPTIONS = [
  { id: 'lincoln', label: 'Lincoln Tunnel' },
  { id: 'holland', label: 'Holland Tunnel' },
  { id: 'gw_upper', label: 'GW Bridge (Upper)' },
  { id: 'gw_lower', label: 'GW Bridge (Lower)' },
  { id: 'goethals', label: 'Goethals Bridge' },
  { id: 'bayonne', label: 'Bayonne Bridge' },
]

const PRESETS = [
  { id: 'hoboken', label: '🚂 Hoboken' },
  { id: 'newport', label: '🌊 Newport / JC' },
  { id: 'midtown', label: '🗽 Midtown' },
  { id: 'downtown', label: '🏙️ Downtown' },
  { id: 'brooklyn', label: '🌉 Brooklyn' },
  { id: 'queens', label: '✈️ Queens' },
]

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
  const [confirmPreset, setConfirmPreset] = useState(null)
  const [showAllStops, setShowAllStops] = useState(false)

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
      if (prev.length >= 2) return prev // max 2
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
      {showTunnels && (
        <section className="m-set-section">
          <h3 className="m-set-label">Tunnel Configuration</h3>
          <p className="m-set-hint">Select up to 2 tunnels to display</p>
          <div className="m-set-tunnel-options">
            {TUNNEL_OPTIONS.map(opt => (
              <label
                key={opt.id}
                className={`m-set-tunnel-opt ${tunnels.includes(opt.id) ? 'selected' : ''}`}
                onClick={() => toggleTunnel(opt.id)}
              >
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </section>
      )}

      {/* My Stops */}
      <section className="m-set-section">
        <h3 className="m-set-label">My Stops</h3>
        <div className="m-set-stop-list">
          {visibleStops.map((stopId) => (
            <div key={stopId} className="m-set-stop-item">
              <span className="m-set-grip">⋮⋮</span>
              <span className="m-set-stop-name">{stopNames[stopId] || stopId}</span>
              <button className="m-set-remove" onClick={() => onRemoveStop(stopId)}>✕</button>
            </div>
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

      {/* Presets */}
      <section className="m-set-section">
        <h3 className="m-set-label">Quick Setup Presets</h3>
        <p className="m-set-hint">Replaces all current stops with a curated set</p>
        <div className="m-set-presets">
          {PRESETS.map(p => (
            <button
              key={p.id}
              className={`m-set-preset ${confirmPreset === p.id ? 'confirming' : ''}`}
              onClick={() => {
                if (confirmPreset === p.id) {
                  // Apply preset — for now just close
                  setConfirmPreset(null)
                } else {
                  setConfirmPreset(p.id)
                  setTimeout(() => setConfirmPreset(null), 4000)
                }
              }}
            >
              {confirmPreset === p.id ? `Apply ${p.label.split(' ')[1]}? Tap again` : p.label}
            </button>
          ))}
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
