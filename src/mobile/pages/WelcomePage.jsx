import { useState } from 'react'

const WELCOME_PRESETS = [
  {
    id: 'hoboken',
    label: '🚂 Hoboken',
    desc: 'Bus, PATH, Ferry & HBLR',
    stops: [
      'bus:7917:126',           // Clinton St & 11th — Route 126
      'bus:7940:126',           // Willow Ave & 15th — Route 126
      'bus:7931:126',           // Washington St & 11th — Route 126
      'path:862:1:26729',       // Hoboken → 33rd St (HOB-33)
      'ferry:9:18:Midtown',     // Hoboken 14th St → W 39th Midtown
    ],
    names: {
      'bus:7917:126': 'Clinton & 11th (126)',
      'bus:7940:126': 'Willow & 15th (126)',
      'bus:7931:126': 'Washington & 11th (126)',
      'path:862:1:26729': 'Hoboken → 33rd St',
      'ferry:9:18:Midtown': 'Hoboken → W 39th Midtown',
    },
  },
  {
    id: 'newport',
    label: '🌊 Newport / JC',
    desc: 'Bus 119, PATH & HBLR',
    stops: [
      'bus:15888:119',          // JFK Blvd & Bayview — Route 119
      'path:861:1:26728',       // Newport → 33rd St (JSQ-33)
      'hblr:15497',             // Newport HBLR
    ],
    names: {
      'bus:15888:119': 'JFK Blvd / Bayview (119)',
      'path:861:1:26728': 'Newport → 33rd St',
      'hblr:15497': 'Newport HBLR',
    },
  },
  {
    id: 'midtown',
    label: '🗽 Midtown',
    desc: 'Times Sq, Grand Central, Herald Sq',
    stops: [
      'mta:127,725,902,R16:S:1,2,3,N,Q,R,W',
      'mta:631,723,901:S:4,5,6',
      'mta:D17,R17:S:B,D,F,M,N,Q,R,W',
    ],
    names: {
      'mta:127,725,902,R16:S:1,2,3,N,Q,R,W': 'Times Sq-42 St',
      'mta:631,723,901:S:4,5,6': 'Grand Central-42 St',
      'mta:D17,R17:S:B,D,F,M,N,Q,R,W': '34 St-Herald Sq',
    },
  },
  {
    id: 'downtown',
    label: '🏙️ Downtown',
    desc: 'Fulton St, W 4 St, WTC PATH',
    stops: [
      'mta:R23,635:S:N,R,W,4,5',
      'mta:A36,D20:S:A,C,E,B,D,F,M',
      'path:860:0:26730',       // WTC → Hoboken (HOB-WTC inbound)
    ],
    names: {
      'mta:R23,635:S:N,R,W,4,5': 'Fulton St',
      'mta:A36,D20:S:A,C,E,B,D,F,M': 'W 4 St-Washington Sq',
      'path:860:0:26730': 'WTC → Hoboken',
    },
  },
  {
    id: 'brooklyn',
    label: '🌉 Brooklyn',
    desc: 'Atlantic Av, Jay St, Bergen St',
    stops: [
      'mta:617,R31:S:2,3,4,5,B,D,N,Q,R,W',
      'mta:A41,636:S:A,C,F,R',
      'mta:D24:S:F,G',
    ],
    names: {
      'mta:617,R31:S:2,3,4,5,B,D,N,Q,R,W': 'Atlantic Av-Barclays',
      'mta:A41,636:S:A,C,F,R': 'Jay St-MetroTech',
      'mta:D24:S:F,G': 'Bergen St',
    },
  },
  {
    id: 'queens',
    label: '✈️ Queens',
    desc: 'Jackson Heights, Astoria, LIC',
    stops: [
      'mta:G14,R09:S:E,F,M,R,7',
      'mta:R01:S:N,W',
      'mta:G22:S:7',
    ],
    names: {
      'mta:G14,R09:S:E,F,M,R,7': 'Jackson Hts-Roosevelt',
      'mta:R01:S:N,W': 'Astoria-Ditmars Blvd',
      'mta:G22:S:7': 'Hunters Point Av',
    },
  },
]

export default function WelcomePage({ onComplete, onManual }) {
  const [zip, setZip] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPresets, setShowPresets] = useState(false)

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

  // ── Preset picker view ──
  if (showPresets) {
    return (
      <div className="m-welcome-page">
        <div className="m-welcome-logo">MY<span className="m-accent">STOP</span>NOW</div>
        <p className="m-welcome-tagline">Pick a neighborhood to get started.</p>

        <div className="m-welcome-presets-grid">
          {WELCOME_PRESETS.map(p => (
            <button
              key={p.id}
              className="m-welcome-preset-card"
              onClick={() => onComplete(p.stops, p.names)}
            >
              <span className="m-welcome-preset-label">{p.label}</span>
              <span className="m-welcome-preset-desc">{p.desc}</span>
            </button>
          ))}
        </div>

        <button className="m-welcome-manual-btn" onClick={onManual} style={{ marginTop: 20 }}>
          Start from scratch
        </button>
        <button className="m-welcome-back-btn" onClick={() => setShowPresets(false)}>
          ← Back
        </button>
      </div>
    )
  }

  // ── Main welcome view ──
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
      <button className="m-welcome-manual-btn" onClick={() => setShowPresets(true)}>
        Pick stops manually
      </button>
    </div>
  )
}
