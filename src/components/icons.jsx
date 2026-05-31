/**
 * Shared SVG icon components — extracted from App.jsx for reuse across desktop and mobile.
 */
import { MTA_COLORS } from './transitColors'

export { MTA_COLORS }

export function SubwayBadge({ line, size = 18 }) {
  const bg = MTA_COLORS[line] || '#808183'
  const textColor = ['N', 'Q', 'R', 'W'].includes(line) ? '#000' : '#fff'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, borderRadius: '50%', backgroundColor: bg,
      color: textColor, fontSize: size * 0.55, fontWeight: 700, lineHeight: 1,
      flexShrink: 0,
    }}>{line}</span>
  )
}

export function MtaGlobeIcon({ size = 20 }) {
  return (
    <svg width={size} height={size * 1.6} viewBox="0 0 24 38" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id="mtaBeamGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE566" stopOpacity="0.5"/>
          <stop offset="100%" stopColor="#FFE566" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon points="3,10 21,10 24,22 0,22" fill="url(#mtaBeamGrad)" className="mta-globe-beam"/>
      <circle cx="12" cy="10" r="9" fill="#00933C" />
      <clipPath id="globeBottom">
        <rect x="0" y="10" width="24" height="10" />
      </clipPath>
      <circle cx="12" cy="10" r="9" fill="#fff" clipPath="url(#globeBottom)" className="mta-globe-white"/>
      <line x1="3" y1="10" x2="21" y2="10" stroke="#333" strokeWidth="0.5" />
      <rect x="9" y="19" width="6" height="2" rx="0.5" fill="#2a2a2a" />
      <rect x="10" y="21" width="4" height="12" rx="1" fill="#00933C" />
      <rect x="10.8" y="21" width="1.2" height="12" rx="0.5" fill="#00a844" opacity="0.5" />
      <path d="M7 33 L17 33 L18.5 37 L5.5 37 Z" fill="#00933C" />
      <path d="M7.5 33 L12 33 L12 37 L6 37 Z" fill="#00a844" opacity="0.3" />
    </svg>
  )
}

export function NjtBusIcon({ className, size = 20 }) {
  return (
    <svg width={size} height={size * 1.6} viewBox="0 0 24 38" className={className} style={{ flexShrink: 0 }}>
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

export function NjtRailIcon({ className, size = 20 }) {
  return (
    <svg width={size} height={size * 1.6} viewBox="0 0 24 38" className={className} style={{ flexShrink: 0 }}>
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

export function PathIcon({ className, size = 20 }) {
  return (
    <svg width={size} height={size * 1.6} viewBox="0 0 24 38" className={className} style={{ flexShrink: 0 }}>
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
      <line x1="9" y1="0.5" x2="9" y2="3" stroke="#C0D8F0" strokeWidth="0.9"/>
      <circle cx="9" cy="0.5" r="0.7" fill="#FF3333" className="wtc-blink"/>
      <line x1="13" y1="14" x2="13" y2="28" stroke="#999" strokeWidth="2.4" strokeLinecap="round"/>
      <path d="M13 17 Q8 20 4 27" fill="none" stroke="#999" strokeWidth="2.0" strokeLinecap="round"/>
      <path d="M13 19 Q9 22 6 28" fill="none" stroke="#999" strokeWidth="1.7" strokeLinecap="round"/>
      <path d="M13 21 Q10 23 8 28" fill="none" stroke="#999" strokeWidth="1.45" strokeLinecap="round"/>
      <path d="M13 17 Q18 20 22 27" fill="none" stroke="#999" strokeWidth="2.0" strokeLinecap="round"/>
      <path d="M13 19 Q17 22 20 28" fill="none" stroke="#999" strokeWidth="1.7" strokeLinecap="round"/>
      <path d="M13 21 Q16 23 18 28" fill="none" stroke="#999" strokeWidth="1.45" strokeLinecap="round"/>
      <line x1="13" y1="14" x2="13" y2="28" stroke="#F0F0F0" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M13 17 Q8 20 4 27" fill="none" stroke="#F0F0F0" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M13 19 Q9 22 6 28" fill="none" stroke="#F0F0F0" strokeWidth="0.9" strokeLinecap="round"/>
      <path d="M13 21 Q10 23 8 28" fill="none" stroke="#F0F0F0" strokeWidth="0.65" strokeLinecap="round"/>
      <path d="M13 17 Q18 20 22 27" fill="none" stroke="#F0F0F0" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M13 19 Q17 22 20 28" fill="none" stroke="#F0F0F0" strokeWidth="0.9" strokeLinecap="round"/>
      <path d="M13 21 Q16 23 18 28" fill="none" stroke="#F0F0F0" strokeWidth="0.65" strokeLinecap="round"/>
      <rect x="2" y="28" width="20" height="2" rx="0.5" fill="#888"/>
      <rect x="0" y="35" width="24" height="1.5" rx="0.5" fill="#777"/>
    </svg>
  )
}

export function LightRailIcon({ className, size = 20 }) {
  return (
    <svg width={size} height={size * 1.6} viewBox="0 0 24 38" className={className} style={{ flexShrink: 0 }}>
      <rect x="2" y="27" width="20" height="11" fill="#8B3A2A"/>
      <line x1="2" y1="30.5" x2="22" y2="30.5" stroke="#6B2A1A" strokeWidth="0.4"/>
      <line x1="2" y1="34" x2="22" y2="34" stroke="#6B2A1A" strokeWidth="0.4"/>
      <line x1="7" y1="27" x2="7" y2="30.5" stroke="#6B2A1A" strokeWidth="0.4"/>
      <line x1="12" y1="30.5" x2="12" y2="34" stroke="#6B2A1A" strokeWidth="0.4"/>
      <line x1="17" y1="27" x2="17" y2="30.5" stroke="#6B2A1A" strokeWidth="0.4"/>
      <path d="M4.5 28.5 Q5.5 27.5 6.5 28.5 L6.5 30.5 L4.5 30.5 Z" fill="#5A1A0A" opacity="0.6"/>
      <path d="M9 28.5 Q10 27.5 11 28.5 L11 30.5 L9 30.5 Z" fill="#5A1A0A" opacity="0.6"/>
      <path d="M13.5 28.5 Q14.5 27.5 15.5 28.5 L15.5 30.5 L13.5 30.5 Z" fill="#5A1A0A" opacity="0.6"/>
      <rect x="8.5" y="13" width="7" height="14" fill="#4A7C6F"/>
      <rect x="9" y="13.5" width="2.5" height="13" fill="#5A9080" opacity="0.35"/>
      <rect x="7.5" y="9.5" width="9" height="4" rx="0.5" fill="#3D6B5E"/>
      <path d="M9 9.5 Q10.5 7.8 12 9.5" fill="#2A4A40"/>
      <path d="M12 9.5 Q13.5 7.8 15 9.5" fill="#2A4A40"/>
      <path d="M6.5 9.5 L12 3.5 L17.5 9.5 Z" fill="#5A9080"/>
      <path d="M6.5 9.5 L12 3.5 L9.5 9.5 Z" fill="#4A7C6F" opacity="0.45"/>
      <line x1="12" y1="3.5" x2="12" y2="1.2" stroke="#4A7C6F" strokeWidth="1.2"/>
      <circle cx="12" cy="1.2" r="0.9" fill="#5A9080"/>
      <circle cx="12" cy="17" r="3" fill="#E8F4F0" className="hblr-clock-face"/>
      <circle cx="12" cy="17" r="3" fill="none" stroke="#3D6B5E" strokeWidth="0.5"/>
      <line x1="12" y1="17" x2="12" y2="14.5" stroke="#2A4A40" strokeWidth="0.7" strokeLinecap="round"/>
      <line x1="12" y1="17" x2="14" y2="17.8" stroke="#2A4A40" strokeWidth="0.5" strokeLinecap="round"/>
      <circle cx="12" cy="17" r="0.4" fill="#4A7C6F"/>
    </svg>
  )
}

export function HeavyRailIcon({ className, size = 20 }) {
  return (
    <svg width={size} height={size * 1.6} viewBox="0 0 24 38" className={className} style={{ flexShrink: 0 }}>
      <rect x="1.5" y="10" width="21" height="13" rx="1.5" fill="#C8CDD4"/>
      <rect x="2" y="10.5" width="7" height="12" fill="#D8DDE4" opacity="0.5"/>
      <rect x="1.5" y="10" width="5.5" height="13" rx="1.5" fill="#003DA5"/>
      <rect x="5" y="10" width="2" height="13" fill="#003DA5"/>
      <rect x="6.8" y="10" width="1.5" height="13" fill="#F7C300"/>
      <rect x="2" y="11.5" width="4" height="4" rx="0.5" fill="#1A1A2E" opacity="0.85"/>
      <rect x="9.5" y="11.5" width="3" height="3.5" rx="0.4" fill="#B8D4E8" opacity="0.9"/>
      <rect x="13.5" y="11.5" width="3" height="3.5" rx="0.4" fill="#B8D4E8" opacity="0.9"/>
      <rect x="17.5" y="11.5" width="2.5" height="3.5" rx="0.4" fill="#B8D4E8" opacity="0.9"/>
      <line x1="9" y1="10" x2="9" y2="23" stroke="#A0A8B0" strokeWidth="0.5"/>
      <rect x="1.5" y="23" width="21" height="2" fill="#6B7280"/>
      <rect x="2.5" y="25" width="5.5" height="2" rx="0.5" fill="#4B5563"/>
      <rect x="16" y="25" width="5.5" height="2" rx="0.5" fill="#4B5563"/>
      <circle cx="4" cy="28.5" r="2" fill="#374151"/><circle cx="4" cy="28.5" r="0.8" fill="#6B7280"/>
      <circle cx="7" cy="28.5" r="2" fill="#374151"/><circle cx="7" cy="28.5" r="0.8" fill="#6B7280"/>
      <circle cx="17" cy="28.5" r="2" fill="#374151"/><circle cx="17" cy="28.5" r="0.8" fill="#6B7280"/>
      <circle cx="20" cy="28.5" r="2" fill="#374151"/><circle cx="20" cy="28.5" r="0.8" fill="#6B7280"/>
      <rect x="0.5" y="30.5" width="23" height="1.2" rx="0.5" fill="#9CA3AF"/>
      <circle cx="3" cy="20" r="1.2" fill="#FFFDE0" className="lirr-headlight"/>
      <circle cx="3" cy="20" r="0.6" fill="#FFFFFF" className="lirr-headlight"/>
    </svg>
  )
}

export function NywFerryIcon({ className, size = 20 }) {
  return (
    <svg width={size} height={size * 1.6} viewBox="0 0 24 38" className={className} style={{ flexShrink: 0 }}>
      <path d="M1 22 L1 17.5 L22 17.5 L23 22 Z" fill="#E8E8E8" stroke="#AAAAAA" strokeWidth="0.6"/>
      <path d="M1 20 L22 20 L23 22 L1 22 Z" fill="#CC0000"/>
      <rect x="3" y="12.5" width="17" height="5" rx="0.5" fill="#DCDCDC" stroke="#AAAAAA" strokeWidth="0.4"/>
      <rect x="6" y="8.5" width="10" height="4.2" rx="0.5" fill="#D4D4D4" stroke="#AAAAAA" strokeWidth="0.4"/>
      <rect x="7" y="9" width="2" height="2.5" rx="0.3" fill="#7AB8D8" opacity="0.95"/>
      <rect x="10" y="9" width="2" height="2.5" rx="0.3" fill="#7AB8D8" opacity="0.95"/>
      <rect x="13" y="9" width="2" height="2.5" rx="0.3" fill="#7AB8D8" opacity="0.95"/>
      <rect x="10.5" y="5.5" width="3" height="3.5" rx="0.5" fill="#CC0000"/>
      <path d="M0 22 Q4 24.5 8 22 Q12 19.5 16 22 Q20 24.5 24 22 L24 27 L0 27 Z" fill="#2A70C0" opacity="0.45"/>
    </svg>
  )
}

export function NycFerryIcon({ className, size = 20 }) {
  return (
    <svg width={size} height={size * 1.6} viewBox="0 0 24 38" className={className} style={{ flexShrink: 0 }}>
      <path d="M1 22 L1 17.5 L22 17.5 L23 22 Z" fill="#F5F5F5" stroke="#BBBBBB" strokeWidth="0.5"/>
      <path d="M1 20 L22 20 L23 22 L1 22 Z" fill="#00A3A3"/>
      <rect x="3" y="12.5" width="17" height="5" rx="0.5" fill="#EBEBEB" stroke="#BBBBBB" strokeWidth="0.4"/>
      <rect x="6" y="8.5" width="10" height="4.2" rx="0.5" fill="#E2E2E2" stroke="#BBBBBB" strokeWidth="0.4"/>
      <rect x="7" y="9" width="2" height="2.5" rx="0.3" fill="#7ECFCF" opacity="0.9"/>
      <rect x="10" y="9" width="2" height="2.5" rx="0.3" fill="#7ECFCF" opacity="0.9"/>
      <rect x="13" y="9" width="2" height="2.5" rx="0.3" fill="#7ECFCF" opacity="0.9"/>
      <rect x="10.5" y="5.5" width="3" height="3.5" rx="0.5" fill="#00A3A3"/>
      <path d="M0 22 Q4 24.5 8 22 Q12 19.5 16 22 Q20 24.5 24 22 L24 27 L0 27 Z" fill="#2A70C0" opacity="0.4"/>
    </svg>
  )
}

export function MtaBusIcon({ className, size = 20 }) {
  return (
    <svg width={size} height={size * 1.6} viewBox="0 0 24 38" className={className} style={{ flexShrink: 0 }}>
      <rect x="1" y="8" width="22" height="16" rx="2" fill="#F5F5F5"/>
      <clipPath id="mab-clip"><rect x="1" y="8" width="22" height="16" rx="2"/></clipPath>
      <rect x="1" y="8" width="22" height="3" fill="#0039A6" clipPath="url(#mab-clip)"/>
      <rect x="1" y="19" width="22" height="5" fill="#0039A6" clipPath="url(#mab-clip)"/>
      <rect x="2" y="11.5" width="4.5" height="5" rx="0.5" fill="#1A1A2E" opacity="0.85"/>
      <rect x="9" y="11.5" width="3.5" height="3.5" rx="0.4" fill="#B8D4E8" opacity="0.9"/>
      <rect x="13.5" y="11.5" width="3.5" height="3.5" rx="0.4" fill="#B8D4E8" opacity="0.9"/>
      <rect x="18" y="11.5" width="3.5" height="3.5" rx="0.4" fill="#B8D4E8" opacity="0.9"/>
      <rect x="1" y="24" width="22" height="2" fill="#777"/>
      <circle cx="5.5" cy="28.5" r="3" fill="#2a2a2a"/><circle cx="5.5" cy="28.5" r="1.2" fill="#555"/>
      <circle cx="18.5" cy="28.5" r="3" fill="#2a2a2a"/><circle cx="18.5" cy="28.5" r="1.2" fill="#555"/>
      <rect x="0" y="31.5" width="24" height="1" rx="0.5" fill="#aaa"/>
    </svg>
  )
}

export function GrandCentralClock({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <rect x="6.5" y="21.5" width="11" height="1.8" rx="0.6" fill="#B8860B"/>
      <rect x="10.5" y="18" width="3" height="3.5" rx="0.3" fill="#C5A55A"/>
      <path d="M9 18 L15 18 L13.8 19.2 L10.2 19.2 Z" fill="#D4AF37"/>
      <circle cx="12" cy="11" r="6.5" fill="#B8860B"/>
      <circle cx="12" cy="11" r="5.5" fill="#F5F0E8" className="mnr-clock-face"/>
      <circle cx="12" cy="11" r="6" fill="none" stroke="#D4AF37" strokeWidth="0.6"/>
      <line x1="12" y1="5.8" x2="12" y2="7" stroke="#5C4A1E" strokeWidth="0.8"/>
      <line x1="17.2" y1="11" x2="16" y2="11" stroke="#5C4A1E" strokeWidth="0.8"/>
      <line x1="12" y1="16.2" x2="12" y2="15" stroke="#5C4A1E" strokeWidth="0.8"/>
      <line x1="6.8" y1="11" x2="8" y2="11" stroke="#5C4A1E" strokeWidth="0.8"/>
      <line x1="12" y1="11" x2="12" y2="8" stroke="#3B2F0E" strokeWidth="1" strokeLinecap="round" transform="rotate(300 12 11)"/>
      <line x1="12" y1="11" x2="12" y2="7.2" stroke="#3B2F0E" strokeWidth="0.7" strokeLinecap="round" transform="rotate(60 12 11)"/>
      <circle cx="12" cy="11" r="0.6" fill="#D4AF37"/>
    </svg>
  )
}
