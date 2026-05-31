/**
 * Weather — NWS (National Weather Service) API
 *
 * Free, no API key. Requires User-Agent header.
 * Hoboken: OKX grid 32,43
 * NYC Midtown: OKX grid 34,44
 *
 * Hourly forecast: /gridpoints/{office}/{gridX},{gridY}/forecast/hourly
 * Each period includes isDaytime boolean.
 */

const LOCATIONS = {
  hoboken: {
    label: 'Hoboken',
    url: '/api/nws/gridpoints/OKX/32,43/forecast/hourly',
  },
  nyc: {
    label: 'NYC',
    url: '/api/nws/gridpoints/OKX/34,44/forecast/hourly',
  },
}

// ── Moon phase calculation ──
// Returns a moon phase emoji based on the date.
// Uses a simple synodic month approximation (29.53 days).
// Known new moon reference: Jan 6, 2000.
function getMoonPhaseEmoji(date) {
  const SYNODIC = 29.53058867
  const REF_NEW_MOON = new Date(2000, 0, 6, 18, 14) // Jan 6 2000 18:14 UTC
  const daysSince = (date.getTime() - REF_NEW_MOON.getTime()) / (1000 * 60 * 60 * 24)
  const phase = ((daysSince % SYNODIC) + SYNODIC) % SYNODIC
  const normalized = phase / SYNODIC // 0 to 1

  // 8 phases
  if (normalized < 0.0625) return '🌑'       // New moon
  if (normalized < 0.1875) return '🌒'       // Waxing crescent
  if (normalized < 0.3125) return '🌓'       // First quarter
  if (normalized < 0.4375) return '🌔'       // Waxing gibbous
  if (normalized < 0.5625) return '🌕'       // Full moon
  if (normalized < 0.6875) return '🌖'       // Waning gibbous
  if (normalized < 0.8125) return '🌗'       // Last quarter
  if (normalized < 0.9375) return '🌘'       // Waning crescent
  return '🌑'                                 // New moon
}

// ── Icon mapping ──
// Daytime icons
const DAY_ICON_MAP = [
  [/thunder/i, '⛈️'],
  [/rain.*snow|snow.*rain|wintry/i, '🌨️'],
  [/snow|flurr/i, '❄️'],
  [/freezing|sleet|ice/i, '🧊'],
  [/heavy rain|downpour/i, '🌧️'],
  [/rain|drizzle|shower/i, '🌦️'],
  [/fog|mist|haze/i, '🌫️'],
  [/cloud|overcast/i, '☁️'],
  [/partly|mostly sunny|mostly clear/i, '⛅'],
  [/sunny|clear/i, '☀️'],
  [/wind/i, '💨'],
]

// Night icons — weather conditions that look different at night
const NIGHT_ICON_MAP = [
  [/thunder/i, '⛈️'],
  [/rain.*snow|snow.*rain|wintry/i, '🌨️'],
  [/snow|flurr/i, '❄️'],
  [/freezing|sleet|ice/i, '🧊'],
  [/heavy rain|downpour/i, '🌧️'],
  [/rain|drizzle|shower/i, '🌧️'],
  [/fog|mist|haze/i, '🌫️'],
  [/cloud|overcast/i, '☁️'],
  [/partly|mostly cloudy/i, null],  // will use moon + clouds below
  [/partly|mostly clear/i, null],   // will use moon phase
  [/clear/i, null],                  // will use moon phase
  [/wind/i, '💨'],
]

function forecastIcon(shortForecast, isDaytime, date) {
  if (isDaytime) {
    for (const [pattern, icon] of DAY_ICON_MAP) {
      if (pattern.test(shortForecast)) return icon
    }
    return '🌤️'
  }

  // Nighttime
  const moon = getMoonPhaseEmoji(date)
  for (const [pattern, icon] of NIGHT_ICON_MAP) {
    if (pattern.test(shortForecast)) {
      if (icon === null) {
        // Use moon phase for clear/partly conditions
        if (/cloud/i.test(shortForecast)) return '☁️'  // mostly cloudy at night
        return moon  // clear or mostly clear → show moon phase
      }
      return icon
    }
  }
  return moon // default night = moon
}

/**
 * Pick 3 representative periods: Now, Midday (12 PM), Evening (6 PM).
 * After midday passes, shift to: Now, Evening, Tonight (9 PM).
 * After evening passes, shift to: Now, +3h, +6h.
 */
function pickPeriods(hourlyPeriods) {
  const now = new Date()
  const h = now.getHours()

  function getPeriodAt(hoursAhead) {
    return hourlyPeriods[Math.min(hoursAhead, hourlyPeriods.length - 1)]
  }

  function formatPeriod(period, label) {
    const periodDate = new Date(period.startTime)
    return {
      label,
      icon: forecastIcon(period.shortForecast, period.isDaytime, periodDate),
      temp: period.temperature,
      desc: period.shortForecast,
      wind: period.windSpeed,
      precip: `${period.probabilityOfPrecipitation?.value ?? 0}%`,
      humidity: `${period.relativeHumidity?.value ?? '--'}%`,
    }
  }

  const nowPeriod = formatPeriod(hourlyPeriods[0], 'Now')

  if (h < 12) {
    return [
      nowPeriod,
      formatPeriod(getPeriodAt(12 - h), 'Midday'),
      formatPeriod(getPeriodAt(18 - h), 'Evening'),
    ]
  } else if (h < 18) {
    return [
      nowPeriod,
      formatPeriod(getPeriodAt(18 - h), 'Evening'),
      formatPeriod(getPeriodAt(21 - h), 'Tonight'),
    ]
  } else {
    const t3 = (h + 3) % 24
    const t6 = (h + 6) % 24
    const fmt = (hr) => `${hr % 12 || 12}${hr < 12 ? 'a' : 'p'}`
    return [
      nowPeriod,
      formatPeriod(getPeriodAt(3), `+3 hr (${fmt(t3)})`),
      formatPeriod(getPeriodAt(6), `+6 hr (${fmt(t6)})`),
    ]
  }
}

/**
 * Fetch weather for a location.
 * @param {string | { label: string, url: string }} location — either a key ('hoboken', 'nyc') or a custom location object
 */
export async function fetchWeather(location = 'hoboken') {
  let label, url
  if (typeof location === 'string') {
    const loc = LOCATIONS[location]
    if (!loc) throw new Error(`Unknown location: ${location}`)
    label = loc.label
    url = loc.url
  } else {
    label = location.label || 'Custom'
    url = location.url
    if (!url) throw new Error('Location missing url')
  }

  const res = await fetch(url, {
    headers: { 'User-Agent': 'HobokenCommuter/1.0 (commuter-dashboard)' },
  })
  if (!res.ok) throw new Error(`NWS API returned ${res.status}`)

  const data = await res.json()
  const hourly = data.properties?.periods
  if (!hourly || hourly.length === 0) throw new Error('No forecast periods returned')

  return {
    label,
    periods: pickPeriods(hourly),
    // First 12 hourly periods for mobile expanded view (swipeable)
    hourly: hourly.slice(0, 12).map((p, i) => {
      const d = new Date(p.startTime)
      const hour = d.getHours()
      const label = hour === new Date().getHours() && i === 0 ? 'Now' : `${hour % 12 || 12}${hour < 12 ? 'AM' : 'PM'}`
      return {
        label,
        icon: forecastIcon(p.shortForecast, p.isDaytime, d),
        temp: p.temperature,
        hour, // raw hour for midnight divider detection
      }
    }),
  }
}

export { LOCATIONS }
