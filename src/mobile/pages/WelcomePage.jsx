import { useState } from 'react'

export default function WelcomePage({ onComplete, onManual }) {
  const [zip, setZip] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const cleaned = zip.replace(/\D/g, '')
    if (cleaned.length !== 5) {
      setError('Enter a 5-digit zip code')
      return
    }
    setError('')
    setLoading(true)

    try {
      // Convert zip to lat/lon via a simple geocoding approach
      // The server's /api/nearby-stops accepts lat/lon
      const geoRes = await fetch(`https://api.zippopotam.us/us/${cleaned}`)
      if (!geoRes.ok) {
        setError('Zip code not found. Try another or pick stops manually.')
        setLoading(false)
        return
      }
      const geoData = await geoRes.json()
      const lat = parseFloat(geoData.places[0].latitude)
      const lon = parseFloat(geoData.places[0].longitude)

      const res = await fetch(`/api/nearby-stops?lat=${lat}&lon=${lon}`)
      if (!res.ok) throw new Error('Failed to find nearby stops')
      const data = await res.json()

      if (data.stops && data.stops.length > 0) {
        const stopIds = data.stops.slice(0, 6).map(s => s.id)
        const names = {}
        data.stops.slice(0, 6).forEach(s => { names[s.id] = s.name })
        onComplete(stopIds, names)
      } else {
        setError('No transit stops found near that zip. Try another or pick manually.')
      }
    } catch {
      setError('Something went wrong. Try again or pick stops manually.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="m-welcome-page">
      <div className="m-welcome-logo">MY<span className="m-accent">STOP</span>NOW</div>
      <p className="m-welcome-tagline">Real-time transit at a glance.</p>

      <div className="m-welcome-card">
        <h2 className="m-welcome-heading">Where do you commute from?</h2>
        <p className="m-welcome-desc">
          Enter your zip code and we'll find the closest transit stops — subway, bus, rail, ferry, and more.
        </p>
        <form className="m-welcome-form" onSubmit={handleSubmit}>
          <input
            type="text"
            className="m-welcome-input"
            placeholder="Zip code"
            maxLength={5}
            inputMode="numeric"
            value={zip}
            onChange={e => setZip(e.target.value)}
          />
          <button type="submit" className="m-welcome-btn" disabled={loading}>
            {loading ? 'Finding stops…' : 'Find My Stops'}
          </button>
        </form>
        {error && <p className="m-welcome-error">{error}</p>}
      </div>

      <div className="m-welcome-divider"><span>or</span></div>
      <button className="m-welcome-manual-btn" onClick={onManual}>
        Pick stops manually
      </button>
    </div>
  )
}
