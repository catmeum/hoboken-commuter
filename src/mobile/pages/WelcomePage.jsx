import { useState } from 'react'

const WELCOME_PRESETS = [
  {
    id: 'hoboken',
    label: '🚂 Hoboken',
    desc: 'Bus, PATH, Ferry & HBLR — both directions',
    stops: [
      // Outbound (Hoboken → NYC)
      'bus:7917:126',           // Clinton St & 11th — Route 126
      'bus:7940:126',           // Willow Ave & 15th — Route 126
      'bus:7931:126',           // Washington St & 11th — Route 126
      'path:862:1:26729',       // Hoboken → 33rd St (HOB-33)
      'ferry:9:18:Midtown',     // Hoboken 14th St → W 39th Midtown
      // Inbound (NYC → Hoboken)
      'path:862:0:26729',       // 33rd St → Hoboken (HOB-33)
      'ferry:10:19:Midtown',    // W 39th Midtown → Hoboken 14th St
    ],
    names: {
      'bus:7917:126': 'Clinton & 11th (126)',
      'bus:7940:126': 'Willow & 15th (126)',
      'bus:7931:126': 'Washington & 11th (126)',
      'path:862:1:26729': 'Hoboken → 33rd St',
      'ferry:9:18:Midtown': 'Hoboken → W 39th Midtown',
      'path:862:0:26729': '33rd St → Hoboken',
      'ferry:10:19:Midtown': 'W 39th → Hoboken 14th',
    },
  },
  {
    id: 'newport',
    label: '🌊 Newport / JC',
    desc: 'Bus 119, PATH, HBLR & Ferry — both directions',
    stops: [
      // Outbound (JC → NYC)
      'bus:15888:119',                    // JFK Blvd & Bayview — Route 119
      'path:861,1024:1:newport',          // Newport → 33rd St (JSQ-33)
      'path:861,1024:1:grove_street',     // Grove St → 33rd St (JSQ-33)
      'hblr:15497',                       // Newport HBLR
      'ferry:17:23:Brookfield Place',     // Paulus Hook → Brookfield Place
      // Inbound (NYC → JC)
      'path:861,1024:0:newport',          // 33rd St → Newport (JSQ-33)
      'path:861,1024:0:grove_street',     // 33rd St → Grove St (JSQ-33)
    ],
    names: {
      'bus:15888:119': 'JFK Blvd / Bayview (119)',
      'path:861,1024:1:newport': 'Newport · JSQ-33 To 33rd St',
      'path:861,1024:1:grove_street': 'Grove St · JSQ-33 To 33rd St',
      'hblr:15497': 'Newport HBLR',
      'ferry:17:23:Brookfield Place': 'Paulus Hook → Brookfield Pl',
      'path:861,1024:0:newport': 'Newport · JSQ-33 To Journal Sq',
      'path:861,1024:0:grove_street': 'Grove St · JSQ-33 To Hoboken',
    },
  },
  {
    id: 'midtown',
    label: '🗽 Midtown',
    desc: 'Times Sq, Grand Central, Penn Sta & more',
    stops: [
      // Downtown
      'mta:127,725,902,R16:S:1,2,3,7,7X,GS,N,Q,R,W',
      'mta:631,723,901:S:4,5,6,6X,7,7X,GS',
      'mta:120,A28:S:1,2,3,A,C,E,N,Q,R,W',
      'mta:D17,R17:S:B,D,F,FX,M,N,Q,R,W',
      'mta:D15:S:B,D,F,FX,M',
      'nycferry:17',
      // Uptown
      'mta:127,725,902,R16:N:1,2,3,7,7X,GS,N,Q,R,W',
      'mta:631,723,901:N:4,5,6,6X,7,7X,GS',
      'mta:120,A28:N:1,2,3,A,C,E,N,Q,R,W',
      'mta:D17,R17:N:B,D,F,FX,M,N,Q,R,W',
      'mta:D15:N:B,D,F,FX,M',
    ],
    names: {
      'mta:127,725,902,R16:S:1,2,3,7,7X,GS,N,Q,R,W': 'Times Sq-42 St (Downtown)',
      'mta:631,723,901:S:4,5,6,6X,7,7X,GS': 'Grand Central-42 St (Downtown)',
      'mta:120,A28:S:1,2,3,A,C,E,N,Q,R,W': '34 St-Penn Station (Downtown)',
      'mta:D17,R17:S:B,D,F,FX,M,N,Q,R,W': '34 St-Herald Sq (Downtown)',
      'mta:D15:S:B,D,F,FX,M': '47-50 Sts-Rockefeller Ctr (Downtown)',
      'nycferry:17': 'East 34th St Ferry',
      'mta:127,725,902,R16:N:1,2,3,7,7X,GS,N,Q,R,W': 'Times Sq-42 St (Uptown)',
      'mta:631,723,901:N:4,5,6,6X,7,7X,GS': 'Grand Central-42 St (Uptown)',
      'mta:120,A28:N:1,2,3,A,C,E,N,Q,R,W': '34 St-Penn Station (Uptown)',
      'mta:D17,R17:N:B,D,F,FX,M,N,Q,R,W': '34 St-Herald Sq (Uptown)',
      'mta:D15:N:B,D,F,FX,M': '47-50 Sts-Rockefeller Ctr (Uptown)',
    },
  },
  {
    id: 'downtown',
    label: '🏙️ Downtown',
    desc: 'Fulton St, Wall St, Chambers St & more',
    stops: [
      // Downtown
      'mta:229,418,A38,G36,M22:S:2,3,4,5,A,C,G,J,Z',
      'mta:230,419:S:2,3,4,5',
      'mta:137,A36,M21:S:1,2,3,A,C,J,Z',
      'mta:640:S:4,5,6,6X',
      'mta:420:S:4,5',
      'nycferry:87',
      // Uptown
      'mta:229,418,A38,G36,M22:N:2,3,4,5,A,C,G,J,Z',
      'mta:230,419:N:2,3,4,5',
      'mta:137,A36,M21:N:1,2,3,A,C,J,Z',
      'mta:640:N:4,5,6,6X',
      'mta:420:N:4,5',
    ],
    names: {
      'mta:229,418,A38,G36,M22:S:2,3,4,5,A,C,G,J,Z': 'Fulton St (Downtown)',
      'mta:230,419:S:2,3,4,5': 'Wall St (Downtown)',
      'mta:137,A36,M21:S:1,2,3,A,C,J,Z': 'Chambers St (Downtown)',
      'mta:640:S:4,5,6,6X': 'Brooklyn Bridge-City Hall (Downtown)',
      'mta:420:S:4,5': 'Bowling Green (Downtown)',
      'nycferry:87': 'Wall St/Pier 11 Ferry',
      'mta:229,418,A38,G36,M22:N:2,3,4,5,A,C,G,J,Z': 'Fulton St (Uptown)',
      'mta:230,419:N:2,3,4,5': 'Wall St (Uptown)',
      'mta:137,A36,M21:N:1,2,3,A,C,J,Z': 'Chambers St (Uptown)',
      'mta:640:N:4,5,6,6X': 'Brooklyn Bridge-City Hall (Uptown)',
      'mta:420:N:4,5': 'Bowling Green (Uptown)',
    },
  },
  {
    id: 'brooklyn',
    label: '🌉 Brooklyn',
    desc: 'Atlantic Av, Jay St, Borough Hall & more',
    stops: [
      // Downtown/Brooklyn-bound
      'mta:235,D24,R31:S:2,3,4,5,B,D,N,Q,R,W',
      'mta:A41,R29:S:A,C,F,FX,N,R,W',
      'mta:232,423:S:2,3,4,5',
      'mta:L16,R30:S:B,D,N,Q,R,W',
      'mta:A42:S:A,C,G',
      'mta:236,F20:S:2,3,4,F,G',
      // Uptown/Manhattan-bound
      'mta:235,D24,R31:N:2,3,4,5,B,D,N,Q,R,W',
      'mta:A41,R29:N:A,C,F,FX,N,R,W',
      'mta:232,423:N:2,3,4,5',
      'mta:L16,R30:N:B,D,N,Q,R,W',
      'mta:A42:N:A,C,G',
      'mta:236,F20:N:2,3,4,F,G',
    ],
    names: {
      'mta:235,D24,R31:S:2,3,4,5,B,D,N,Q,R,W': 'Atlantic Av-Barclays Ctr (Downtown)',
      'mta:A41,R29:S:A,C,F,FX,N,R,W': 'Jay St-MetroTech (Downtown)',
      'mta:232,423:S:2,3,4,5': 'Borough Hall (Downtown)',
      'mta:L16,R30:S:B,D,N,Q,R,W': 'DeKalb Av (Downtown)',
      'mta:A42:S:A,C,G': 'Hoyt-Schermerhorn Sts (Downtown)',
      'mta:236,F20:S:2,3,4,F,G': 'Bergen St (Downtown)',
      'mta:235,D24,R31:N:2,3,4,5,B,D,N,Q,R,W': 'Atlantic Av-Barclays Ctr (Uptown)',
      'mta:A41,R29:N:A,C,F,FX,N,R,W': 'Jay St-MetroTech (Uptown)',
      'mta:232,423:N:2,3,4,5': 'Borough Hall (Uptown)',
      'mta:L16,R30:N:B,D,N,Q,R,W': 'DeKalb Av (Uptown)',
      'mta:A42:N:A,C,G': 'Hoyt-Schermerhorn Sts (Uptown)',
      'mta:236,F20:N:2,3,4,F,G': 'Bergen St (Uptown)',
    },
  },
  {
    id: 'queens',
    label: '✈️ Queens',
    desc: 'Jackson Hts, Flushing, Jamaica & more',
    stops: [
      // Manhattan-bound
      'mta:G14:S:E,F,FX,M,R',
      'mta:701:S:7,7X',
      'mta:F01:S:F,FX',
      'mta:G08:S:E,F,FX,M,R',
      'mta:G11,J15:S:E,F,J,M,R,Z',
      'mta:G05:S:E,J,Z',
      // Queens-bound
      'mta:G14:N:E,F,FX,M,R',
      'mta:701:N:7,7X',
      'mta:F01:N:F,FX',
      'mta:G08:N:E,F,FX,M,R',
      'mta:G11,J15:N:E,F,J,M,R,Z',
      'mta:G05:N:E,J,Z',
    ],
    names: {
      'mta:G14:S:E,F,FX,M,R': 'Jackson Hts-Roosevelt Av (Manhattan)',
      'mta:701:S:7,7X': 'Flushing-Main St (Manhattan)',
      'mta:F01:S:F,FX': 'Jamaica-179 St (Manhattan)',
      'mta:G08:S:E,F,FX,M,R': 'Forest Hills-71 Av (Manhattan)',
      'mta:G11,J15:S:E,F,J,M,R,Z': 'Woodhaven Blvd (Manhattan)',
      'mta:G05:S:E,J,Z': 'Jamaica Center (Manhattan)',
      'mta:G14:N:E,F,FX,M,R': 'Jackson Hts-Roosevelt Av (Queens)',
      'mta:701:N:7,7X': 'Flushing-Main St (Queens)',
      'mta:F01:N:F,FX': 'Jamaica-179 St (Queens)',
      'mta:G08:N:E,F,FX,M,R': 'Forest Hills-71 Av (Queens)',
      'mta:G11,J15:N:E,F,J,M,R,Z': 'Woodhaven Blvd (Queens)',
      'mta:G05:N:E,J,Z': 'Jamaica Center (Queens)',
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
