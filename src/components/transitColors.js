// MTA subway line brand colors — shared constant
export const MTA_COLORS = {
  '1': '#EE352E', '2': '#EE352E', '3': '#EE352E',
  '4': '#00933C', '5': '#00933C', '6': '#00933C', '6X': '#00933C',
  '7': '#B933AD', '7X': '#B933AD',
  'A': '#0039A6', 'C': '#0039A6', 'E': '#0039A6',
  'B': '#FF6319', 'D': '#FF6319', 'F': '#FF6319', 'FX': '#FF6319', 'M': '#FF6319',
  'G': '#6CBE45',
  'J': '#996633', 'Z': '#996633',
  'L': '#A7A9AC',
  'N': '#FCCC0A', 'Q': '#FCCC0A', 'R': '#FCCC0A', 'W': '#FCCC0A',
  'S': '#808183', 'GS': '#808183', 'FS': '#808183', 'H': '#808183',
  'SI': '#1D2D5C',
}

// NY Waterway ferry destination colors — distinct colors per destination
const FERRY_DEST_COLORS = {
  'midtown': '#1d4ed8',        // blue
  'w. midtown': '#1d4ed8',     // blue
  'w39': '#1d4ed8',            // blue
  'w 39': '#1d4ed8',           // blue
  '39th': '#1d4ed8',           // blue
  'pier 11': '#b45309',        // amber
  'wall st': '#b45309',        // amber
  'wall': '#b45309',           // amber
  'brookfield': '#0e7c47',     // green
  'brookfield place': '#0e7c47',
  'port imperial': '#7c3aed',  // purple
  'weehawken': '#7c3aed',
  'lincoln harbor': '#be123c', // rose
  'hoboken': '#0369a1',        // cyan
  'edgewater': '#4338ca',      // indigo
  'haverstraw': '#9333ea',     // violet
  'ossining': '#c026d3',       // fuchsia
  'paulus hook': '#059669',    // emerald
  'jersey city': '#059669',
  'liberty harbor': '#d97706', // orange
  'south amboy': '#dc2626',    // red
  'port liberté': '#0f766e',   // teal
}

const FERRY_COLOR_PALETTE = ['#1d4ed8', '#b45309', '#0e7c47', '#7c3aed', '#be123c', '#0369a1', '#4338ca', '#9333ea', '#d97706', '#059669']

export function ferryDestColor(destName) {
  if (!destName) return '#0e7490'
  const lower = destName.toLowerCase()
  // Check known destinations
  for (const [key, color] of Object.entries(FERRY_DEST_COLORS)) {
    if (lower.includes(key)) return color
  }
  // Hash-based fallback for unknown destinations
  let hash = 0
  for (let i = 0; i < lower.length; i++) hash = lower.charCodeAt(i) + ((hash << 5) - hash)
  return FERRY_COLOR_PALETTE[Math.abs(hash) % FERRY_COLOR_PALETTE.length]
}
