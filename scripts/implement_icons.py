"""
Implement the new transit icons into App.jsx and App.css.
Run: python implement_icons.py
"""
import re

# Read App.jsx
with open("src/App.jsx", "r", encoding="utf-8") as f:
    jsx = f.read()

# Read App.css
with open("src/App.css", "r", encoding="utf-8") as f:
    css = f.read()

print("[1] Replacing icon function definitions...")

# ── New icon components ──────────────────────────────────────────────────────

NEW_ICONS = '''
// ── NJT Bus Icon — XD60 Xcelsior with blue/magenta/orange arch livery ──
function NjtBusIcon({ className, size = 20 }) {
  const h = size * 1.6
  return (
    <svg width={size} height={h} viewBox="0 0 24 38" className={className} style={{ flexShrink: 0 }}>
      <rect x="1" y="8" width="22" height="16" rx="2" fill="#F2F2F2"/>
      <clipPath id="njb-clip"><rect x="1" y="8" width="22" height="16" rx="2"/></clipPath>
      <rect x="1" y="8" width="22" height="1.5" fill="#CCCCCC" clipPath="url(#njb-clip)"/>
      <rect x="1" y="22.5" width="22" height="1.5" fill="#CCCCCC" clipPath="url(#njb-clip)"/>
      <path d="M3 24 Q9 14 15 24" fill="none" stroke="#0039A6" strokeWidth="1.4" strokeLinecap="round" clipPath="url(#njb-clip)"/>
      <path d="M5 24 Q11 13 17 24" fill="none" stroke="#DA0080" strokeWidth="1.1" strokeLinecap="round" clipPath="url(#njb-clip)"/>
      <path d="M7 24 Q13 12 19 24" fill="none" stroke="#FF6600" strokeWidth="0.9" strokeLinecap="round" clipPath="url(#njb-clip)"/>
      <rect x="2" y="10.5" width="4.5" height="5" rx="0.5" fill="#1A1A2E" opacity="0.85"/>
      <rect x="9" y="8.4" width="13" height="2" rx="0.3" fill="#111" className="njt-bus-sign"/>
      <rect x="9" y="11.5" width="3.5" height="3.5" rx="0.4" fill="#B8D4E8" opacity="0.9"/>
      <rect x="13.5" y="11.5" width="3.5" height="3.5" rx="0.4" fill="#B8D4E8" opacity="0.9"/>
      <rect x="18" y="11.5" width="3.5" height="3.5" rx="0.4" fill="#B8D4E8" opacity="0.9"/>
      <line x1="8.5" y1="8" x2="8.5" y2="24" stroke="#ccc" strokeWidth="0.5"/>
      <rect x="1" y="24" width="22" height="2" fill="#777"/>
      <circle cx="5.5" cy="28.5" r="3" fill="#2a2a2a"/><circle cx="5.5" cy="28.5" r="1.2" fill="#555"/>
      <circle cx="18.5" cy="28.5" r="3" fill="#2a2a2a"/><circle cx="18.5" cy="28.5" r="1.2" fill="#555"/>
      <rect x="0" y="31.5" width="24" height="1" rx="0.5" fill="#aaa"/>
    </svg>
  )
}

// ── NJT Rail Icon — Comet V / Multilevel, blue nose, red bottom stripe ──
function NjtRailIcon({ className, size = 20 }) {
  const h = size * 1.6
  return (
    <svg width={size} height={h} viewBox="0 0 24 38" className={className} style={{ flexShrink: 0 }}>
      <rect x="1" y="9" width="22" height="14" rx="1.5" fill="#D0D5DC"/>
      <clipPath id="njr-clip"><rect x="1" y="9" width="22" height="14" rx="1.5"/></clipPath>
      <rect x="1" y="9" width="6.5" height="14" rx="1.5" fill="#003DA5"/>
      <rect x="5.5" y="9" width="2" height="14" fill="#003DA5"/>
      <rect x="1" y="20" width="22" height="3" fill="#E8001C" clipPath="url(#njr-clip)"/>
      <rect x="1.8" y="10.5" width="4" height="5" rx="0.5" fill="#1A1A2E" opacity="0.85"/>
      <circle cx="3" cy="19" r="1.3" fill="#FFFDE0" className="njt-rail-headlight"/>
      <circle cx="3" cy="19" r="0.6" fill="#fff" className="njt-rail-headlight"/>
      <rect x="9.5" y="10" width="3" height="3" rx="0.4" fill="#7AB8D8"/>
      <rect x="13.5" y="10" width="3" height="3" rx="0.4" fill="#7AB8D8"/>
      <rect x="17.5" y="10" width="3.5" height="3" rx="0.4" fill="#7AB8D8"/>
      <rect x="9.5" y="14.5" width="3" height="2.5" rx="0.4" fill="#7AB8D8" opacity="0.75"/>
      <rect x="13.5" y="14.5" width="3" height="2.5" rx="0.4" fill="#7AB8D8" opacity="0.75"/>
      <rect x="17.5" y="14.5" width="3.5" height="2.5" rx="0.4" fill="#7AB8D8" opacity="0.75"/>
      <rect x="1" y="23" width="22" height="2" fill="#6B7280"/>
      <rect x="2" y="25" width="6" height="1.8" rx="0.5" fill="#4B5563"/>
      <rect x="16" y="25" width="6" height="1.8" rx="0.5" fill="#4B5563"/>
      <circle cx="3.5" cy="28.5" r="2" fill="#374151"/><circle cx="3.5" cy="28.5" r="0.8" fill="#6B7280"/>
      <circle cx="6.5" cy="28.5" r="2" fill="#374151"/><circle cx="6.5" cy="28.5" r="0.8" fill="#6B7280"/>
      <circle cx="17.5" cy="28.5" r="2" fill="#374151"/><circle cx="17.5" cy="28.5" r="0.8" fill="#6B7280"/>
      <circle cx="20.5" cy="28.5" r="2" fill="#374151"/><circle cx="20.5" cy="28.5" r="0.8" fill="#6B7280"/>
      <rect x="0" y="30.5" width="24" height="1.2" rx="0.5" fill="#9CA3AF"/>
    </svg>
  )
}

// ── PATH Icon — WTC Oculus + One World Trade Center ──
function PathIcon({ className, size = 20 }) {
  const h = size * 1.6
  return (
    <svg width={size} height={h} viewBox="0 0 24 38" className={className} style={{ flexShrink: 0 }}>
      {/* One WTC — offset left, wide body with triangular facets */}
      <rect x="5" y="3" width="8" height="25" fill="#5B8DB8" opacity="0.6"/>
      <polygon points="9,3 5,3 5,28 9,28" fill="#4A7BA8" opacity="0.7"/>
      <polygon points="9,3 13,3 13,28 9,28" fill="#6A9EC8" opacity="0.55"/>
      <polygon points="5,28 13,28 11,15 7,15" fill="#7AAED8" opacity="0.5"/>
      <polygon points="5,3 13,3 11,15 7,15" fill="#8ABEE8" opacity="0.65"/>
      <polygon points="5,3 5,28 7,15" fill="#5A8DB8" opacity="0.4"/>
      <polygon points="13,3 13,28 11,15" fill="#7AAED8" opacity="0.4"/>
      <line x1="9" y1="3" x2="9" y2="28" stroke="#9ABEE8" strokeWidth="0.3" opacity="0.5"/>
      <line x1="5" y1="15" x2="13" y2="15" stroke="#9ABEE8" strokeWidth="0.3" opacity="0.4"/>
      <line x1="5" y1="9" x2="13" y2="9" stroke="#9ABEE8" strokeWidth="0.25" opacity="0.35"/>
      <line x1="5" y1="21" x2="13" y2="21" stroke="#9ABEE8" strokeWidth="0.25" opacity="0.35"/>
      {/* Spire + blinking red light */}
      <line x1="9" y1="0.5" x2="9" y2="3" stroke="#C0D8F0" strokeWidth="0.9"/>
      <circle cx="9" cy="0.5" r="0.7" fill="#FF3333" className="wtc-blink"/>
      {/* Oculus ribs — gray outlines first, then white on top */}
      <line x1="13" y1="14" x2="13" y2="28" stroke="#999" strokeWidth="2.4" strokeLinecap="round" className="oc-rib-outline"/>
      <path d="M13 17 Q8 20 4 27" fill="none" stroke="#999" strokeWidth="2.0" strokeLinecap="round" className="oc-rib-outline"/>
      <path d="M13 19 Q9 22 6 28" fill="none" stroke="#999" strokeWidth="1.7" strokeLinecap="round" className="oc-rib-outline"/>
      <path d="M13 21 Q10 23 8 28" fill="none" stroke="#999" strokeWidth="1.45" strokeLinecap="round" className="oc-rib-outline"/>
      <path d="M13 17 Q18 20 22 27" fill="none" stroke="#999" strokeWidth="2.0" strokeLinecap="round" className="oc-rib-outline"/>
      <path d="M13 19 Q17 22 20 28" fill="none" stroke="#999" strokeWidth="1.7" strokeLinecap="round" className="oc-rib-outline"/>
      <path d="M13 21 Q16 23 18 28" fill="none" stroke="#999" strokeWidth="1.45" strokeLinecap="round" className="oc-rib-outline"/>
      <line x1="13" y1="14" x2="13" y2="28" stroke="#F0F0F0" strokeWidth="1.6" strokeLinecap="round" className="oc-rib"/>
      <path d="M13 17 Q8 20 4 27" fill="none" stroke="#F0F0F0" strokeWidth="1.2" strokeLinecap="round" className="oc-rib"/>
      <path d="M13 19 Q9 22 6 28" fill="none" stroke="#F0F0F0" strokeWidth="0.9" strokeLinecap="round" className="oc-rib"/>
      <path d="M13 21 Q10 23 8 28" fill="none" stroke="#F0F0F0" strokeWidth="0.65" strokeLinecap="round" className="oc-rib"/>
      <path d="M13 17 Q18 20 22 27" fill="none" stroke="#F0F0F0" strokeWidth="1.2" strokeLinecap="round" className="oc-rib"/>
      <path d="M13 19 Q17 22 20 28" fill="none" stroke="#F0F0F0" strokeWidth="0.9" strokeLinecap="round" className="oc-rib"/>
      <path d="M13 21 Q16 23 18 28" fill="none" stroke="#F0F0F0" strokeWidth="0.65" strokeLinecap="round" className="oc-rib"/>
      {/* Ground */}
      <rect x="2" y="28" width="20" height="2" rx="0.5" fill="#888"/>
      <rect x="0" y="35" width="24" height="1.5" rx="0.5" fill="#777"/>
    </svg>
  )
}

// ── NYW Ferry Icon — white hull, red stripe, pilot house ──
function NywFerryIcon({ className, size = 20 }) {
  const h = size * 1.6
  return (
    <svg width={size} height={h} viewBox="0 0 24 38" className={className} style={{ flexShrink: 0 }}>
      <path d="M1 22 L1 17.5 L22 17.5 L23 22 Z" fill="#E8E8E8" stroke="#AAAAAA" strokeWidth="0.6"/>
      <path d="M1 20 L22 20 L23 22 L1 22 Z" fill="#CC0000"/>
      <rect x="3" y="12.5" width="17" height="5" rx="0.5" fill="#DCDCDC" stroke="#AAAAAA" strokeWidth="0.4"/>
      <rect x="6" y="8.5" width="10" height="4.2" rx="0.5" fill="#D4D4D4" stroke="#AAAAAA" strokeWidth="0.4"/>
      <rect x="7" y="9" width="2" height="2.5" rx="0.3" fill="#7AB8D8" opacity="0.95"/>
      <rect x="10" y="9" width="2" height="2.5" rx="0.3" fill="#7AB8D8" opacity="0.95"/>
      <rect x="13" y="9" width="2" height="2.5" rx="0.3" fill="#7AB8D8" opacity="0.95"/>
      <rect x="4" y="13" width="2.5" height="2.5" rx="0.3" fill="#7AB8D8" opacity="0.95"/>
      <rect x="7.5" y="13" width="2.5" height="2.5" rx="0.3" fill="#7AB8D8" opacity="0.95"/>
      <rect x="11" y="13" width="2.5" height="2.5" rx="0.3" fill="#7AB8D8" opacity="0.95"/>
      <rect x="14.5" y="13" width="2.5" height="2.5" rx="0.3" fill="#7AB8D8" opacity="0.95"/>
      <rect x="10.5" y="5.5" width="3" height="3.5" rx="0.5" fill="#CC0000"/>
      <rect x="11" y="4" width="2" height="2" rx="0.3" fill="#777"/>
      <circle cx="22.5" cy="18.5" r="0.9" fill="#FF4444" className="nyw-running-light"/>
      <circle cx="1.5" cy="18.5" r="0.9" fill="#44FF44" className="nyw-running-light"/>
      <path d="M0 22 Q4 24.5 8 22 Q12 19.5 16 22 Q20 24.5 24 22 L24 27 L0 27 Z" fill="#2A70C0" opacity="0.45"/>
      <path d="M0 25.5 Q6 28 12 25.5 Q18 23 24 25.5 L24 30 L0 30 Z" fill="#2A70C0" opacity="0.28"/>
    </svg>
  )
}

// ── NYC Ferry Icon — teal vessel + Statue of Liberty (chest-up) ──
function NycFerryIcon({ className, size = 20 }) {
  const h = size * 1.6
  return (
    <svg width={size} height={h} viewBox="0 0 24 38" className={className} style={{ flexShrink: 0 }}>
      {/* Ferry body */}
      <path d="M1 22 L1 17.5 L22 17.5 L23 22 Z" fill="#F5F5F5" stroke="#BBBBBB" strokeWidth="0.5"/>
      <path d="M1 20 L22 20 L23 22 L1 22 Z" fill="#00A3A3"/>
      <rect x="3" y="12.5" width="17" height="5" rx="0.5" fill="#EBEBEB" stroke="#BBBBBB" strokeWidth="0.4"/>
      <rect x="6" y="8.5" width="10" height="4.2" rx="0.5" fill="#E2E2E2" stroke="#BBBBBB" strokeWidth="0.4"/>
      <rect x="7" y="9" width="2" height="2.5" rx="0.3" fill="#7ECFCF" opacity="0.9"/>
      <rect x="10" y="9" width="2" height="2.5" rx="0.3" fill="#7ECFCF" opacity="0.9"/>
      <rect x="13" y="9" width="2" height="2.5" rx="0.3" fill="#7ECFCF" opacity="0.9"/>
      <rect x="4" y="13" width="2.5" height="2.5" rx="0.3" fill="#7ECFCF" opacity="0.9"/>
      <rect x="7.5" y="13" width="2.5" height="2.5" rx="0.3" fill="#7ECFCF" opacity="0.9"/>
      <rect x="11" y="13" width="2.5" height="2.5" rx="0.3" fill="#7ECFCF" opacity="0.9"/>
      <rect x="14.5" y="13" width="2.5" height="2.5" rx="0.3" fill="#7ECFCF" opacity="0.9"/>
      <rect x="10.5" y="5.5" width="3" height="3.5" rx="0.5" fill="#00A3A3"/>
      <rect x="11" y="4" width="2" height="2" rx="0.3" fill="#777"/>
      <circle cx="1.5" cy="18.5" r="0.9" fill="#FF4444" className="nycf-running-light"/>
      {/* Statue of Liberty — chest-up, right side */}
      <defs><filter id="sol-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="1.2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <rect x="15.1" y="15.1" width="1.5" height="3.4" rx="0.2" fill="#7A9070" opacity="0.85"/>
      <rect x="14.3" y="18.5" width="2.9" height="1.7" rx="0.3" fill="#7A9070" opacity="0.85"/>
      <polygon points="14,18.5 17.1,18.5 16.5,11.8 14.9,11.8" fill="#7A9070" opacity="0.85"/>
      <rect x="15.1" y="10.3" width="1.7" height="1.7" fill="#7A9070" opacity="0.85"/>
      <circle cx="15.9" cy="9.3" r="1.1" fill="#7A9070" opacity="0.85"/>
      <line x1="15.9" y1="8.2" x2="15.9" y2="5.9" stroke="#7A9070" strokeWidth="0.6" opacity="0.85" strokeLinecap="round"/>
      <line x1="15.9" y1="5.9" x2="14.5" y2="5.9" stroke="#7A9070" strokeWidth="0.6" opacity="0.85" strokeLinecap="round"/>
      <line x1="15.9" y1="5.9" x2="17.3" y2="5.9" stroke="#7A9070" strokeWidth="0.6" opacity="0.85" strokeLinecap="round"/>
      <line x1="15.9" y1="5.9" x2="15.9" y2="4.5" stroke="#7A9070" strokeWidth="0.5" opacity="0.85" strokeLinecap="round"/>
      <line x1="15.9" y1="4.5" x2="14.8" y2="4.5" stroke="#7A9070" strokeWidth="0.5" opacity="0.85" strokeLinecap="round"/>
      <line x1="15.9" y1="4.5" x2="17.0" y2="4.5" stroke="#7A9070" strokeWidth="0.5" opacity="0.85" strokeLinecap="round"/>
      <line x1="17.1" y1="11.8" x2="19.5" y2="7.5" stroke="#7A9070" strokeWidth="1.0" opacity="0.85" strokeLinecap="round"/>
      <rect x="19.1" y="5.8" width="0.7" height="1.7" rx="0.2" fill="#7A9070" opacity="0.85"/>
      <ellipse cx="19.5" cy="4.8" rx="0.9" ry="1.3" fill="#8AAE80" className="sol-flame-light"/>
      <ellipse cx="19.5" cy="4.8" rx="0.9" ry="1.3" fill="#FF7700" filter="url(#sol-glow)" className="sol-flame-dark"/>
      <ellipse cx="19.5" cy="5.2" rx="0.4" ry="0.7" fill="#FFCC00" className="sol-flame-dark"/>
      {/* Water */}
      <path d="M0 22 Q4 24.5 8 22 Q12 19.5 16 22 Q20 24.5 24 22 L24 27 L0 27 Z" fill="#2A70C0" opacity="0.4"/>
      <path d="M0 25.5 Q6 28 12 25.5 Q18 23 24 25.5 L24 30 L0 30 Z" fill="#2A70C0" opacity="0.25"/>
    </svg>
  )
}

// ── MTA Bus Icon — New Flyer XD40, MTA blue top + bottom bands ──
function MtaBusIcon({ className, size = 20 }) {
  const h = size * 1.6
  return (
    <svg width={size} height={h} viewBox="0 0 24 38" className={className} style={{ flexShrink: 0 }}>
      <rect x="1" y="8" width="22" height="16" rx="2" fill="#F5F5F5"/>
      <clipPath id="mab-clip"><rect x="1" y="8" width="22" height="16" rx="2"/></clipPath>
      <rect x="1" y="8" width="22" height="3" fill="#0039A6" clipPath="url(#mab-clip)"/>
      <rect x="1" y="19" width="22" height="5" fill="#0039A6" clipPath="url(#mab-clip)"/>
      <rect x="2" y="11.5" width="4.5" height="5" rx="0.5" fill="#1A1A2E" opacity="0.85"/>
      <rect x="9" y="8.4" width="13" height="2.2" rx="0.3" fill="#111" className="mta-bus-sign"/>
      <rect x="9" y="11.5" width="3.5" height="3.5" rx="0.4" fill="#B8D4E8" opacity="0.9"/>
      <rect x="13.5" y="11.5" width="3.5" height="3.5" rx="0.4" fill="#B8D4E8" opacity="0.9"/>
      <rect x="18" y="11.5" width="3.5" height="3.5" rx="0.4" fill="#B8D4E8" opacity="0.9"/>
      <line x1="8.5" y1="8" x2="8.5" y2="24" stroke="#ddd" strokeWidth="0.5"/>
      <rect x="1" y="24" width="22" height="2" fill="#777"/>
      <circle cx="5.5" cy="28.5" r="3" fill="#2a2a2a"/><circle cx="5.5" cy="28.5" r="1.2" fill="#555"/>
      <circle cx="18.5" cy="28.5" r="3" fill="#2a2a2a"/><circle cx="18.5" cy="28.5" r="1.2" fill="#555"/>
      <rect x="0" y="31.5" width="24" height="1" rx="0.5" fill="#aaa"/>
    </svg>
  )
}
'''

# ── Replace the old icon block (MtaGlobeIcon through GrandCentralClock) ──────

old_start = "function MtaGlobeIcon({ size = 20 }) {"
old_end_marker = "const AVAILABLE_CITIES = ["

start_idx = jsx.index(old_start)
end_idx = jsx.index(old_end_marker)

# Keep existing icons (MtaGlobeIcon, LightRailIcon, HeavyRailIcon, GrandCentralClock)
# and ADD the new ones before AVAILABLE_CITIES
jsx = jsx[:end_idx] + NEW_ICONS + "\n" + jsx[end_idx:]

print(f"  Inserted new icon components at position {end_idx}")

# ── Update TRANSIT_MODES to use new icons ─────────────────────────────────────

print("[2] Updating TRANSIT_MODES...")
jsx = jsx.replace(
    "{ id: 'bus', name: 'NJ Transit Bus', icon: Bus, enabled: true }",
    "{ id: 'bus', name: 'NJ Transit Bus', icon: NjtBusIcon, enabled: true }")
jsx = jsx.replace(
    "{ id: 'njtrain', name: 'NJ Transit Rail', icon: TrainFront, enabled: true }",
    "{ id: 'njtrain', name: 'NJ Transit Rail', icon: NjtRailIcon, enabled: true }")
jsx = jsx.replace(
    "{ id: 'path', name: 'PATH Train', icon: TrainFront, enabled: true }",
    "{ id: 'path', name: 'PATH Train', icon: PathIcon, enabled: true }")
jsx = jsx.replace(
    "{ id: 'ferry', name: 'NYW Ferry', icon: Ship, enabled: true }",
    "{ id: 'ferry', name: 'NYW Ferry', icon: NywFerryIcon, enabled: true }")
jsx = jsx.replace(
    "{ id: 'nycferry', name: 'NYC Ferry', icon: Ship, enabled: true }",
    "{ id: 'nycferry', name: 'NYC Ferry', icon: NycFerryIcon, enabled: true }")
jsx = jsx.replace(
    "{ id: 'mta-bus', name: 'MTA Bus', icon: Bus, enabled: true }",
    "{ id: 'mta-bus', name: 'MTA Bus', icon: MtaBusIcon, enabled: true }")

# ── Update card headers ───────────────────────────────────────────────────────

print("[3] Updating card header icons...")

# BusStopCard (NJT Bus) — line 458
jsx = jsx.replace(
    '<Bus className="card-icon" />\n        <span className="card-title">Bus</span>',
    '<NjtBusIcon className="card-icon" />\n        <span className="card-title">Bus</span>')

# DynamicRailCard (NJT Rail) — line 669
jsx = jsx.replace(
    '<TrainFront className="card-icon" />\n        <span className="card-title">NJT Rail</span>',
    '<NjtRailIcon className="card-icon" />\n        <span className="card-title">NJT Rail</span>')

# DynamicPathCard (PATH) — line 957
jsx = jsx.replace(
    '<TrainFront className="card-icon" />\n        <span className="card-title">PATH</span>',
    '<PathIcon className="card-icon" />\n        <span className="card-title">PATH</span>')

# DynamicFerryCard (NYW Ferry) — line 921
jsx = jsx.replace(
    '<Ship className="card-icon" />\n        <span className="card-title">NYW Ferry</span>',
    '<NywFerryIcon className="card-icon" />\n        <span className="card-title">NYW Ferry</span>')

# DynamicNycFerryCard — line 890
jsx = jsx.replace(
    '<Ship className="card-icon" />\n        <span className="card-title">NYC Ferry</span>',
    '<NycFerryIcon className="card-icon" />\n        <span className="card-title">NYC Ferry</span>')

# DynamicMtaBusCard — line 847
jsx = jsx.replace(
    '<Bus className="card-icon" />\n        <span className="card-title">MTA Bus</span>',
    '<MtaBusIcon className="card-icon" />\n        <span className="card-title">MTA Bus</span>')

# ── Add CSS for new icon dark mode effects ────────────────────────────────────

print("[4] Adding CSS for new icons...")

new_css = """
/* ── New transit icon dark mode effects ── */

/* NJT Rail headlight — dark mode only */
.njt-rail-headlight { display: none; }
[data-theme="dark"] .njt-rail-headlight { display: block; }

/* NJT Bus destination sign — glows red in dark mode */
[data-theme="dark"] .njt-bus-sign { fill: #E8001C; filter: drop-shadow(0 0 2px #FF2040); }

/* MTA Bus destination sign — glows orange in dark mode */
[data-theme="dark"] .mta-bus-sign { fill: #FF6B00; filter: drop-shadow(0 0 2px #FF8C00); }

/* PATH — WTC spire blinks red in dark mode */
.wtc-blink { display: none; }
[data-theme="dark"] .wtc-blink { display: block; animation: spire-blink 2s step-start infinite; }
@keyframes spire-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }

/* PATH — Oculus ribs: white with gray outline in light, pure white in dark */
.oc-rib { stroke: #F0F0F0; }
.oc-rib-outline { stroke: #999; }
[data-theme="dark"] .oc-rib-outline { stroke: transparent; }

/* NYW Ferry running lights — dark mode only */
.nyw-running-light { display: none; }
[data-theme="dark"] .nyw-running-light { display: block; }

/* NYC Ferry running lights — dark mode only */
.nycf-running-light { display: none; }
[data-theme="dark"] .nycf-running-light { display: block; }

/* NYC Ferry — Statue of Liberty flame: green in light, orange glow in dark */
.sol-flame-light { fill: #8AAE80; }
.sol-flame-dark { display: none; }
[data-theme="dark"] .sol-flame-light { display: none; }
[data-theme="dark"] .sol-flame-dark { display: block; }
"""

css += new_css

# ── Write files ───────────────────────────────────────────────────────────────

print("[5] Writing files...")
with open("src/App.jsx", "w", encoding="utf-8") as f:
    f.write(jsx)
with open("src/App.css", "w", encoding="utf-8") as f:
    f.write(css)

print("Done! New icons implemented.")
print("\nTo deploy to GitHub:")
print("  git add src/App.jsx src/App.css")
print('  git commit -m "feat: custom transit icons for all modes"')
print("  git push")
