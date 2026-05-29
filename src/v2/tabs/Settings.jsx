import { useState } from 'react'
import { version as APP_VERSION } from '../../../package.json'

export default function Settings({ settings, stopNames, onUpdate, onRemoveStop, onReorderStops, onNavigateExplore }) {
  const [dragIdx, setDragIdx] = useState(null)
  const [confirmReset, setConfirmReset] = useState(false)

  function handleDragStart(i) { setDragIdx(i) }
  function handleDragOver(e, i) {
    e.preventDefault()
    if (dragIdx === null || dragIdx === i) return
    const newOrder = [...settings.stops]
    const [moved] = newOrder.splice(dragIdx, 1)
    newOrder.splice(i, 0, moved)
    onReorderStops(newOrder)
    setDragIdx(i)
  }
  function handleDragEnd() { setDragIdx(null) }

  function toggleDarkMode() {
    const modes = ['auto', 'dark', 'light']
    const current = modes.indexOf(settings.darkMode)
    onUpdate({ darkMode: modes[(current + 1) % modes.length] })
  }

  function handleReset() {
    if (!confirmReset) { setConfirmReset(true); return }
    onUpdate({ stops: [], showWeather: true, showTunnels: true, darkMode: 'auto' })
    setConfirmReset(false)
  }

  return (
    <div className="v2-settings">
      {/* My Stops */}
      <section className="v2-settings-section">
        <h3 className="v2-settings-label">My Stops</h3>
        {settings.stops.map((stopKey, i) => (
          <div
            key={stopKey}
            className={`v2-settings-item ${dragIdx === i ? 'dragging' : ''}`}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragOver={(e) => handleDragOver(e, i)}
            onDragEnd={handleDragEnd}
          >
            <span className="v2-settings-grip">⋮⋮</span>
            <span className="v2-settings-name">{stopNames[stopKey] || stopKey}</span>
            <button className="v2-settings-remove" onClick={() => onRemoveStop(stopKey)}>✕</button>
          </div>
        ))}
        <button className="v2-settings-add" onClick={onNavigateExplore}>+ Add Stop</button>
      </section>

      {/* Display */}
      <section className="v2-settings-section">
        <h3 className="v2-settings-label">Display</h3>
        <div className="v2-settings-toggle">
          <span>Dark Mode</span>
          <button className="v2-toggle-btn" onClick={toggleDarkMode}>
            {settings.darkMode === 'auto' ? '🌓 Auto' : settings.darkMode === 'dark' ? '🌙 Dark' : '☀️ Light'}
          </button>
        </div>
        <div className="v2-settings-toggle">
          <span>Show Weather</span>
          <button
            className={`v2-switch ${settings.showWeather ? 'on' : ''}`}
            onClick={() => onUpdate({ showWeather: !settings.showWeather })}
          ></button>
        </div>
        <div className="v2-settings-toggle">
          <span>Show Tunnels</span>
          <button
            className={`v2-switch ${settings.showTunnels ? 'on' : ''}`}
            onClick={() => onUpdate({ showTunnels: !settings.showTunnels })}
          ></button>
        </div>
      </section>

      {/* About */}
      <section className="v2-settings-section">
        <h3 className="v2-settings-label">About</h3>
        <p className="v2-settings-about">My Stop Now · v{APP_VERSION}</p>
        <p className="v2-settings-about">Made with ❤️ for public transit</p>
        <button className="v2-settings-reset" onClick={handleReset}>
          {confirmReset ? 'Are you sure? Click again to confirm.' : 'Reset to Defaults'}
        </button>
        {confirmReset && <button className="v2-settings-cancel" onClick={() => setConfirmReset(false)}>Cancel</button>}
      </section>
    </div>
  )
}
