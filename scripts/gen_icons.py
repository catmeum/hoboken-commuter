"""
Generate public/icon-drafts-new.html  (v2)
Run:  python gen_icons.py
"""

# ── helpers ───────────────────────────────────────────────────────────────────

def icon_cell(svg_body, vw, vh, w, h, label):
    return (f'\n      <div class="icon-cell">'
            f'<svg width="{w}" height="{h}" viewBox="0 0 {vw} {vh}" style="flex-shrink:0">'
            f'{svg_body}</svg>'
            f'<span class="size-label">{label}</span></div>')

def option_block(title, svg, vw, vh, sizes):
    cells = "".join(icon_cell(svg, vw, vh, w, h, lbl) for w, h, lbl in sizes)
    return (f'\n  <div class="option">'
            f'<div class="option-title">{title}</div>'
            f'<div class="icon-row">{cells}\n      </div></div>')

def section(label, opts):
    inner = "".join(option_block(*o) for o in opts)
    return (f'\n<div class="transit-section">'
            f'<div class="transit-label">{label}</div>'
            f'<div class="options-row">{inner}\n</div></div>'
            f'\n<hr class="section-divider">')

TALL = [(16,25,"16"),(24,38,"24"),(40,64,"40")]

# ── CSS ───────────────────────────────────────────────────────────────────────

CSS = """
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;font-size:13px}
.page{display:flex;min-height:100vh}
.panel{flex:1;padding:28px 20px}
.panel.light{background:#f0f0f0;color:#111}
.panel.dark{background:#1a1a1a;color:#ddd}
h1{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;opacity:.4;margin-bottom:24px}
.transit-section{margin-bottom:28px}
.transit-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;opacity:.4;margin-bottom:10px}
.options-row{display:flex;gap:28px;flex-wrap:wrap}
.option{display:flex;flex-direction:column;gap:10px}
.option-title{font-size:10px;font-weight:600;opacity:.55;text-align:center;max-width:130px;line-height:1.4}
.icon-row{display:flex;align-items:flex-end;gap:14px}
.icon-cell{display:flex;flex-direction:column;align-items:center;gap:4px}
.size-label{font-size:9px;opacity:.35}
.section-divider{border:none;border-top:1px solid currentColor;opacity:.1;margin:20px 0}
.divider{width:1px;background:#888;opacity:.15}

/* NJT Rail headlight — dark only */
.rl-hl{display:none}
.dark .rl-hl{display:block}
/* NJT Rail windows — slightly brighter in dark */
.dark .rl-win{fill:#9ACCE8}
/* NJT Bus destination sign */
.bs-sign{fill:#111}
.dark .bs-sign{fill:#E8001C;filter:drop-shadow(0 0 2px #FF2040)}
.dark .bs-win{fill:#9ACCE8}
/* PATH */
.dark .pa-win{fill:#6AABCC}
/* NYW Ferry */
.nyw-rl{display:none}
.dark .nyw-rl{display:block}
/* NYC Ferry */
.nycf-rl{display:none}
.dark .nycf-rl{display:block}
.dark .nycf-win{fill:#7ECFCF}
/* MTA Bus */
.mb-sign{fill:#111}
.dark .mb-sign{fill:#FF6B00;filter:drop-shadow(0 0 2px #FF8C00)}
.dark .mb-win{fill:#6AABCC}

/* PATH — One WTC spire blink (dark only) */
.wtc-blink{display:none}
.dark .wtc-blink{display:block;animation:spire-blink 2s step-start infinite}
@keyframes spire-blink{0%,49%{opacity:1}50%,100%{opacity:0}}

/* PATH — Oculus ribs: white with gray outline in light, pure white in dark */
.oc-rib{stroke:#F0F0F0;paint-order:stroke fill}
.oc-rib-outline{stroke:#999;fill:none}
.dark .oc-rib{stroke:#F0F0F0}
.dark .oc-rib-outline{stroke:none}

/* NYC Ferry — SoL flame: static green in light, static orange glow in dark */
.sol-flame-light{fill:#8AAE80}
.sol-flame-dark{display:none}
.dark .sol-flame-light{display:none}
.dark .sol-flame-dark{display:block}
"""

# ═══════════════════════════════════════════════════════════════════════════════
# NJT BUS  (all new — XD60 arch livery)
# ═══════════════════════════════════════════════════════════════════════════════

# Option A: XD60 standard bus — white/gray body, blue+magenta+orange arch on side
NJT_BUS_A = """
<rect x="1" y="8" width="22" height="16" rx="2" fill="#F2F2F2"/>
<clipPath id="bAc"><rect x="1" y="8" width="22" height="16" rx="2"/></clipPath>
<rect x="1" y="8" width="22" height="1.5" fill="#CCCCCC" clip-path="url(#bAc)"/>
<rect x="1" y="22.5" width="22" height="1.5" fill="#CCCCCC" clip-path="url(#bAc)"/>
<path d="M3 24 Q9 14 15 24" fill="none" stroke="#0039A6" stroke-width="1.4" stroke-linecap="round" clip-path="url(#bAc)"/>
<path d="M5 24 Q11 13 17 24" fill="none" stroke="#DA0080" stroke-width="1.1" stroke-linecap="round" clip-path="url(#bAc)"/>
<path d="M7 24 Q13 12 19 24" fill="none" stroke="#FF6600" stroke-width="0.9" stroke-linecap="round" clip-path="url(#bAc)"/>
<rect x="2" y="10.5" width="4.5" height="5" rx="0.5" fill="#1A1A2E" opacity="0.85"/>
<rect x="9" y="8.4" width="13" height="2" rx="0.3" class="bs-sign"/>
<rect x="9" y="11.5" width="3.5" height="3.5" rx="0.4" fill="#B8D4E8" opacity="0.9" class="bs-win"/>
<rect x="13.5" y="11.5" width="3.5" height="3.5" rx="0.4" fill="#B8D4E8" opacity="0.9" class="bs-win"/>
<rect x="18" y="11.5" width="3.5" height="3.5" rx="0.4" fill="#B8D4E8" opacity="0.9" class="bs-win"/>
<line x1="8.5" y1="8" x2="8.5" y2="24" stroke="#ccc" stroke-width="0.5"/>
<rect x="1" y="24" width="22" height="2" fill="#777"/>
<circle cx="5.5" cy="28.5" r="3" fill="#2a2a2a"/><circle cx="5.5" cy="28.5" r="1.2" fill="#555"/>
<circle cx="18.5" cy="28.5" r="3" fill="#2a2a2a"/><circle cx="18.5" cy="28.5" r="1.2" fill="#555"/>
<rect x="0" y="31.5" width="24" height="1" rx="0.5" fill="#aaa"/>
"""

# Option B: XD60 articulated (accordion) bus — same arch livery, longer body with bellows joint
NJT_BUS_B = """
<rect x="0.5" y="8" width="23" height="16" rx="2" fill="#F2F2F2"/>
<clipPath id="bBc"><rect x="0.5" y="8" width="23" height="16" rx="2"/></clipPath>
<rect x="0.5" y="8" width="23" height="1.5" fill="#CCCCCC" clip-path="url(#bBc)"/>
<rect x="0.5" y="22.5" width="23" height="1.5" fill="#CCCCCC" clip-path="url(#bBc)"/>
<path d="M2 24 Q7 14 12 24" fill="none" stroke="#0039A6" stroke-width="1.3" stroke-linecap="round" clip-path="url(#bBc)"/>
<path d="M3.5 24 Q8.5 13 13.5 24" fill="none" stroke="#DA0080" stroke-width="1.0" stroke-linecap="round" clip-path="url(#bBc)"/>
<path d="M5 24 Q10 12 15 24" fill="none" stroke="#FF6600" stroke-width="0.8" stroke-linecap="round" clip-path="url(#bBc)"/>
<rect x="1" y="10.5" width="4.5" height="5" rx="0.5" fill="#1A1A2E" opacity="0.85"/>
<rect x="7.5" y="8.4" width="6" height="2" rx="0.3" class="bs-sign"/>
<rect x="7.5" y="11.5" width="3" height="3.5" rx="0.4" fill="#B8D4E8" opacity="0.9" class="bs-win"/>
<rect x="11" y="11.5" width="3" height="3.5" rx="0.4" fill="#B8D4E8" opacity="0.9" class="bs-win"/>
<line x1="7" y1="8" x2="7" y2="24" stroke="#ccc" stroke-width="0.5"/>
<rect x="14.5" y="9" width="0.8" height="14" rx="0.3" fill="#AAAAAA"/>
<line x1="14.5" y1="11" x2="15.3" y2="11" stroke="#999" stroke-width="0.4"/>
<line x1="14.5" y1="13" x2="15.3" y2="13" stroke="#999" stroke-width="0.4"/>
<line x1="14.5" y1="15" x2="15.3" y2="15" stroke="#999" stroke-width="0.4"/>
<line x1="14.5" y1="17" x2="15.3" y2="17" stroke="#999" stroke-width="0.4"/>
<line x1="14.5" y1="19" x2="15.3" y2="19" stroke="#999" stroke-width="0.4"/>
<line x1="14.5" y1="21" x2="15.3" y2="21" stroke="#999" stroke-width="0.4"/>
<rect x="16" y="11.5" width="3" height="3.5" rx="0.4" fill="#B8D4E8" opacity="0.9" class="bs-win"/>
<rect x="19.5" y="11.5" width="3" height="3.5" rx="0.4" fill="#B8D4E8" opacity="0.9" class="bs-win"/>
<rect x="0.5" y="24" width="23" height="2" fill="#777"/>
<circle cx="4" cy="28.5" r="3" fill="#2a2a2a"/><circle cx="4" cy="28.5" r="1.2" fill="#555"/>
<circle cx="12" cy="28.5" r="3" fill="#2a2a2a"/><circle cx="12" cy="28.5" r="1.2" fill="#555"/>
<circle cx="20" cy="28.5" r="3" fill="#2a2a2a"/><circle cx="20" cy="28.5" r="1.2" fill="#555"/>
<rect x="0" y="31.5" width="24" height="1" rx="0.5" fill="#aaa"/>
"""

# Option C: Hoboken Terminal bus bay arch — Beaux-Arts facade, NJT arch colors on signage
NJT_BUS_C = """
<rect x="1" y="10" width="22" height="20" rx="1" fill="#C8A96E"/>
<rect x="0" y="10" width="24" height="1.5" fill="#A07820"/>
<rect x="1" y="11.5" width="3.5" height="18.5" fill="#B89050"/>
<rect x="19.5" y="11.5" width="3.5" height="18.5" fill="#B89050"/>
<path d="M6 30 L6 20 Q12 12 18 20 L18 30 Z" fill="#5A3A0A"/>
<polygon points="10.5,12 13.5,12 13,14.5 11,14.5" fill="#A07820"/>
<path d="M6 20 Q12 12 18 20" fill="none" stroke="#A07820" stroke-width="0.8" stroke-dasharray="2,1.5"/>
<rect x="7.5" y="23" width="9" height="5.5" rx="1" fill="#F2F2F2"/>
<rect x="7.5" y="23" width="9" height="1.5" fill="#CCCCCC"/>
<path d="M8 28.5 Q11.5 24.5 15 28.5" fill="none" stroke="#0039A6" stroke-width="0.9" stroke-linecap="round"/>
<path d="M8.5 28.5 Q12 23.5 15.5 28.5" fill="none" stroke="#DA0080" stroke-width="0.7" stroke-linecap="round"/>
<path d="M9 28.5 Q12.5 22.5 16 28.5" fill="none" stroke="#FF6600" stroke-width="0.55" stroke-linecap="round"/>
<circle cx="9.5" cy="29.5" r="1.2" fill="#333"/>
<circle cx="14.5" cy="29.5" r="1.2" fill="#333"/>
<rect x="0" y="30" width="24" height="2" fill="#888"/>
<rect x="1" y="7" width="22" height="3.5" rx="0.5" fill="#E8001C"/>
<rect x="1" y="6.5" width="22" height="1" fill="#003DA5"/>
<rect x="1" y="4" width="22" height="3" rx="0.5" fill="#C8A96E"/>
<rect x="4" y="2" width="4" height="2.5" rx="0.3" fill="#C8A96E"/>
<rect x="10" y="1.5" width="4" height="3" rx="0.3" fill="#C8A96E"/>
<rect x="16" y="2" width="4" height="2.5" rx="0.3" fill="#C8A96E"/>
"""

# ═══════════════════════════════════════════════════════════════════════════════
# NJT RAIL  (Option A with more visible windows in light mode)
# ═══════════════════════════════════════════════════════════════════════════════

NJT_RAIL_A = """
<rect x="1" y="9" width="22" height="14" rx="1.5" fill="#D0D5DC"/>
<clipPath id="rAc"><rect x="1" y="9" width="22" height="14" rx="1.5"/></clipPath>
<rect x="1" y="9" width="6.5" height="14" rx="1.5" fill="#003DA5"/>
<rect x="5.5" y="9" width="2" height="14" fill="#003DA5"/>
<rect x="1" y="20" width="22" height="3" fill="#E8001C" clip-path="url(#rAc)"/>
<rect x="1.8" y="10.5" width="4" height="5" rx="0.5" fill="#1A1A2E" opacity="0.85"/>
<circle cx="3" cy="19" r="1.3" fill="#FFFDE0" class="rl-hl"/>
<circle cx="3" cy="19" r="0.6" fill="#fff" class="rl-hl"/>
<rect x="9.5" y="10" width="3" height="3" rx="0.4" fill="#7AB8D8" opacity="1" class="rl-win"/>
<rect x="13.5" y="10" width="3" height="3" rx="0.4" fill="#7AB8D8" opacity="1" class="rl-win"/>
<rect x="17.5" y="10" width="3.5" height="3" rx="0.4" fill="#7AB8D8" opacity="1" class="rl-win"/>
<rect x="9.5" y="14.5" width="3" height="2.5" rx="0.4" fill="#7AB8D8" opacity="0.75" class="rl-win"/>
<rect x="13.5" y="14.5" width="3" height="2.5" rx="0.4" fill="#7AB8D8" opacity="0.75" class="rl-win"/>
<rect x="17.5" y="14.5" width="3.5" height="2.5" rx="0.4" fill="#7AB8D8" opacity="0.75" class="rl-win"/>
<rect x="1" y="23" width="22" height="2" fill="#6B7280"/>
<rect x="2" y="25" width="6" height="1.8" rx="0.5" fill="#4B5563"/>
<rect x="16" y="25" width="6" height="1.8" rx="0.5" fill="#4B5563"/>
<circle cx="3.5" cy="28.5" r="2" fill="#374151"/><circle cx="3.5" cy="28.5" r="0.8" fill="#6B7280"/>
<circle cx="6.5" cy="28.5" r="2" fill="#374151"/><circle cx="6.5" cy="28.5" r="0.8" fill="#6B7280"/>
<circle cx="17.5" cy="28.5" r="2" fill="#374151"/><circle cx="17.5" cy="28.5" r="0.8" fill="#6B7280"/>
<circle cx="20.5" cy="28.5" r="2" fill="#374151"/><circle cx="20.5" cy="28.5" r="0.8" fill="#6B7280"/>
<rect x="0" y="30.5" width="24" height="1.2" rx="0.5" fill="#9CA3AF"/>
"""

# ═══════════════════════════════════════════════════════════════════════════════
# PATH  (Oculus + One WTC — proper triangular facets + blinking spire)
# ═══════════════════════════════════════════════════════════════════════════════
# One WTC geometry:
#   - Square base at bottom, rotates 45° by mid-height → octagonal cross-section
#   - Distinctive triangular glass facets on each face (isosceles triangles pointing up)
#   - Thin antenna spire at top
#   - Blue-gray glass curtain wall
# Oculus: white ribbed bird-wing, drawn in front of WTC

# Shared One WTC body — centered, 8 units wide at base tapering to 4 at top
# The triangular facets are the key visual: each face has a bright triangle pointing up
_WTC_CENTER = """
<rect x="9" y="4" width="6" height="24" fill="#5B8DB8" opacity="0.6"/>
<polygon points="12,4 9,4 9,28 12,28" fill="#4A7BA8" opacity="0.7"/>
<polygon points="12,4 15,4 15,28 12,28" fill="#6A9EC8" opacity="0.55"/>
<polygon points="9,28 15,28 13,16 11,16" fill="#7AAED8" opacity="0.5"/>
<polygon points="9,4  15,4  13,16 11,16" fill="#8ABEE8" opacity="0.65"/>
<polygon points="9,4  9,28  11,16" fill="#5A8DB8" opacity="0.4"/>
<polygon points="15,4 15,28 13,16" fill="#7AAED8" opacity="0.4"/>
<line x1="12" y1="4" x2="12" y2="28" stroke="#9ABEE8" stroke-width="0.3" opacity="0.5"/>
<line x1="9" y1="16" x2="15" y2="16" stroke="#9ABEE8" stroke-width="0.3" opacity="0.4"/>
<line x1="9" y1="10" x2="15" y2="10" stroke="#9ABEE8" stroke-width="0.25" opacity="0.35"/>
<line x1="9" y1="22" x2="15" y2="22" stroke="#9ABEE8" stroke-width="0.25" opacity="0.35"/>
<line x1="12" y1="1" x2="12" y2="4" stroke="#C0D8F0" stroke-width="0.9"/>
<circle cx="12" cy="1" r="0.7" fill="#FF3333" class="wtc-blink"/>
"""

_WTC_LEFT = """
<rect x="5" y="3" width="8" height="25" fill="#5B8DB8" opacity="0.6"/>
<polygon points="9,3 5,3 5,28 9,28" fill="#4A7BA8" opacity="0.7"/>
<polygon points="9,3 13,3 13,28 9,28" fill="#6A9EC8" opacity="0.55"/>
<polygon points="5,28 13,28 11,15 7,15" fill="#7AAED8" opacity="0.5"/>
<polygon points="5,3  13,3  11,15 7,15" fill="#8ABEE8" opacity="0.65"/>
<polygon points="5,3  5,28  7,15" fill="#5A8DB8" opacity="0.4"/>
<polygon points="13,3 13,28 11,15" fill="#7AAED8" opacity="0.4"/>
<line x1="9" y1="3" x2="9" y2="28" stroke="#9ABEE8" stroke-width="0.3" opacity="0.5"/>
<line x1="5" y1="15" x2="13" y2="15" stroke="#9ABEE8" stroke-width="0.3" opacity="0.4"/>
<line x1="5" y1="9" x2="13" y2="9" stroke="#9ABEE8" stroke-width="0.25" opacity="0.35"/>
<line x1="5" y1="21" x2="13" y2="21" stroke="#9ABEE8" stroke-width="0.25" opacity="0.35"/>
<line x1="9" y1="0.5" x2="9" y2="3" stroke="#C0D8F0" stroke-width="0.9"/>
<circle cx="9" cy="0.5" r="0.7" fill="#FF3333" class="wtc-blink"/>
"""

_WTC_WIDE = """
<rect x="8" y="5" width="8" height="23" fill="#5B8DB8" opacity="0.6"/>
<polygon points="12,5 8,5 8,28 12,28" fill="#4A7BA8" opacity="0.7"/>
<polygon points="12,5 16,5 16,28 12,28" fill="#6A9EC8" opacity="0.55"/>
<polygon points="8,28 16,28 14,16 10,16" fill="#7AAED8" opacity="0.5"/>
<polygon points="8,5  16,5  14,16 10,16" fill="#8ABEE8" opacity="0.65"/>
<polygon points="8,5  8,28  10,16" fill="#5A8DB8" opacity="0.4"/>
<polygon points="16,5 16,28 14,16" fill="#7AAED8" opacity="0.4"/>
<line x1="12" y1="5" x2="12" y2="28" stroke="#9ABEE8" stroke-width="0.3" opacity="0.5"/>
<line x1="8" y1="16" x2="16" y2="16" stroke="#9ABEE8" stroke-width="0.3" opacity="0.4"/>
<line x1="8" y1="10" x2="16" y2="10" stroke="#9ABEE8" stroke-width="0.25" opacity="0.35"/>
<line x1="8" y1="22" x2="16" y2="22" stroke="#9ABEE8" stroke-width="0.25" opacity="0.35"/>
<line x1="12" y1="2" x2="12" y2="5" stroke="#C0D8F0" stroke-width="0.9"/>
<circle cx="12" cy="2" r="0.7" fill="#FF3333" class="wtc-blink"/>
"""

# Oculus ribs — each rib drawn twice: gray outline underneath, white fill on top
# In dark mode CSS hides the outline class so only white shows
def _rib(d_or_coords, w, is_line=False):
    """Return (outline_svg, white_svg) tuple — caller groups them separately."""
    if is_line:
        x1,y1,x2,y2 = d_or_coords
        outline = f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#999" stroke-width="{w+0.8:.1f}" stroke-linecap="round" class="oc-rib-outline"/>'
        white   = f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#F0F0F0" stroke-width="{w}" stroke-linecap="round" class="oc-rib"/>'
    else:
        outline = f'<path d="{d_or_coords}" fill="none" stroke="#999" stroke-width="{w+0.8:.1f}" stroke-linecap="round" class="oc-rib-outline"/>'
        white   = f'<path d="{d_or_coords}" fill="none" stroke="#F0F0F0" stroke-width="{w}" stroke-linecap="round" class="oc-rib"/>'
    return outline, white

def _build_oculus(ribs):
    """ribs: list of (d_or_coords, w, is_line). Returns all outlines first, then all whites."""
    pairs = [_rib(d, w, il) for d, w, il in ribs]
    outlines = "".join(p[0] for p in pairs)
    whites   = "".join(p[1] for p in pairs)
    return outlines + whites

_OCULUS = _build_oculus([
    (("12","14","12","28"), 1.6, True),
    ("M12 17 Q7 20 3 27",      1.2, False),
    ("M12 19 Q8 22 5 28",      0.9, False),
    ("M12 21 Q9 23 7 28",      0.65, False),
    ("M12 23 Q10.5 24.5 9 28", 0.45, False),
    ("M12 17 Q17 20 21 27",    1.2, False),
    ("M12 19 Q16 22 19 28",    0.9, False),
    ("M12 21 Q15 23 17 28",    0.65, False),
    ("M12 23 Q13.5 24.5 15 28",0.45, False),
])

_OCULUS_B = _build_oculus([
    (("13","14","13","28"), 1.6, True),
    ("M13 17 Q8 20 4 27",       1.2, False),
    ("M13 19 Q9 22 6 28",       0.9, False),
    ("M13 21 Q10 23 8 28",      0.65, False),
    ("M13 23 Q11.5 24.5 10 28", 0.45, False),
    ("M13 17 Q18 20 22 27",     1.2, False),
    ("M13 19 Q17 22 20 28",     0.9, False),
    ("M13 21 Q16 23 18 28",     0.65, False),
    ("M13 23 Q14.5 24.5 16 28", 0.45, False),
])

_PATH_BASE = """
<rect x="2" y="28" width="20" height="2" rx="0.5" fill="#888"/>
<rect x="0" y="35" width="24" height="1.5" rx="0.5" fill="#777"/>
"""

# Single final PATH: WTC offset-left (B position) + wider body (C width) + offset Oculus
PATH_A = _WTC_CENTER + _OCULUS  + _PATH_BASE   # centered reference
PATH_B = _WTC_LEFT   + _OCULUS_B + _PATH_BASE  # offset-left WTC, wider, offset Oculus
PATH_C = _WTC_WIDE   + _OCULUS  + _PATH_BASE   # wide WTC centered

# ═══════════════════════════════════════════════════════════════════════════════
# NYW FERRY  (Option A with more contrast — darker hull outline, deeper water)
# ═══════════════════════════════════════════════════════════════════════════════

NYW_FERRY = """
<path d="M1 22 L1 17.5 L22 17.5 L23 22 Z" fill="#E8E8E8" stroke="#AAAAAA" stroke-width="0.6"/>
<path d="M1 20 L22 20 L23 22 L1 22 Z" fill="#CC0000"/>
<rect x="3" y="12.5" width="17" height="5" rx="0.5" fill="#DCDCDC" stroke="#AAAAAA" stroke-width="0.4"/>
<rect x="6" y="8.5" width="10" height="4.2" rx="0.5" fill="#D4D4D4" stroke="#AAAAAA" stroke-width="0.4"/>
<rect x="7" y="9" width="2" height="2.5" rx="0.3" fill="#7AB8D8" opacity="0.95"/>
<rect x="10" y="9" width="2" height="2.5" rx="0.3" fill="#7AB8D8" opacity="0.95"/>
<rect x="13" y="9" width="2" height="2.5" rx="0.3" fill="#7AB8D8" opacity="0.95"/>
<rect x="4" y="13" width="2.5" height="2.5" rx="0.3" fill="#7AB8D8" opacity="0.95"/>
<rect x="7.5" y="13" width="2.5" height="2.5" rx="0.3" fill="#7AB8D8" opacity="0.95"/>
<rect x="11" y="13" width="2.5" height="2.5" rx="0.3" fill="#7AB8D8" opacity="0.95"/>
<rect x="14.5" y="13" width="2.5" height="2.5" rx="0.3" fill="#7AB8D8" opacity="0.95"/>
<rect x="10.5" y="5.5" width="3" height="3.5" rx="0.5" fill="#CC0000"/>
<rect x="11" y="4" width="2" height="2" rx="0.3" fill="#777"/>
<circle cx="22.5" cy="18.5" r="0.9" fill="#FF4444" class="nyw-rl"/>
<circle cx="1.5" cy="18.5" r="0.9" fill="#44FF44" class="nyw-rl"/>
<path d="M0 22 Q4 24.5 8 22 Q12 19.5 16 22 Q20 24.5 24 22 L24 27 L0 27 Z" fill="#2A70C0" opacity="0.45"/>
<path d="M0 25.5 Q6 28 12 25.5 Q18 23 24 25.5 L24 30 L0 30 Z" fill="#2A70C0" opacity="0.28"/>
"""

# ═══════════════════════════════════════════════════════════════════════════════
# NYC FERRY  (Option A + Statue of Liberty — chest-up, flickering flame in dark)
# ═══════════════════════════════════════════════════════════════════════════════

# Ferry body — boat faces left, stern on right, SoL behind/right
_FERRY_BODY = """
<path d="M1 22 L1 17.5 L22 17.5 L23 22 Z" fill="#F5F5F5" stroke="#BBBBBB" stroke-width="0.5"/>
<path d="M1 20 L22 20 L23 22 L1 22 Z" fill="#00A3A3"/>
<rect x="3" y="12.5" width="17" height="5" rx="0.5" fill="#EBEBEB" stroke="#BBBBBB" stroke-width="0.4"/>
<rect x="6" y="8.5" width="10" height="4.2" rx="0.5" fill="#E2E2E2" stroke="#BBBBBB" stroke-width="0.4"/>
<rect x="7" y="9" width="2" height="2.5" rx="0.3" fill="#7ECFCF" opacity="0.9" class="nycf-win"/>
<rect x="10" y="9" width="2" height="2.5" rx="0.3" fill="#7ECFCF" opacity="0.9" class="nycf-win"/>
<rect x="13" y="9" width="2" height="2.5" rx="0.3" fill="#7ECFCF" opacity="0.9" class="nycf-win"/>
<rect x="4" y="13" width="2.5" height="2.5" rx="0.3" fill="#7ECFCF" opacity="0.9" class="nycf-win"/>
<rect x="7.5" y="13" width="2.5" height="2.5" rx="0.3" fill="#7ECFCF" opacity="0.9" class="nycf-win"/>
<rect x="11" y="13" width="2.5" height="2.5" rx="0.3" fill="#7ECFCF" opacity="0.9" class="nycf-win"/>
<rect x="14.5" y="13" width="2.5" height="2.5" rx="0.3" fill="#7ECFCF" opacity="0.9" class="nycf-win"/>
<rect x="10.5" y="5.5" width="3" height="3.5" rx="0.5" fill="#00A3A3"/>
<rect x="11" y="4" width="2" height="2" rx="0.3" fill="#777"/>
<circle cx="1.5" cy="18.5" r="0.9" fill="#FF4444" class="nycf-rl"/>
"""

# Statue of Liberty — chest-up silhouette, right side of icon, in background
# Crown spikes, face/head, robe shoulders, raised right arm holding torch
# Three size variants: A=small-ish, B=medium, C=large/prominent

def sol(x, scale, flame_id):
    """Build a Lady Liberty SVG at position x, scaled by scale factor.
    flame_id: unique suffix for animation element IDs."""
    # All coords relative to x offset, scaled
    s = scale
    # Pedestal / base (just a hint)
    ped   = f'<rect x="{x+2*s:.1f}" y="{22-2*s:.1f}" width="{4*s:.1f}" height="{2*s:.1f}" rx="0.3" fill="#7A9070" opacity="0.7"/>'
    # Robe / torso (trapezoid wider at bottom)
    robe  = f'<polygon points="{x:.1f},{22-2*s:.1f} {x+8*s:.1f},{22-2*s:.1f} {x+7*s:.1f},{22-8*s:.1f} {x+1*s:.1f},{22-8*s:.1f}" fill="#7A9070" opacity="0.85"/>'
    # Neck
    neck  = f'<rect x="{x+3*s:.1f}" y="{22-10*s:.1f}" width="{2*s:.1f}" height="{2*s:.1f}" fill="#7A9070" opacity="0.85"/>'
    # Head (circle)
    hx    = x + 4*s
    hy    = 22 - 12*s
    head  = f'<circle cx="{hx:.1f}" cy="{hy:.1f}" r="{2*s:.1f}" fill="#7A9070" opacity="0.85"/>'
    # Crown spikes (5 spikes radiating up from head)
    spikes = ""
    import math
    for i, ang in enumerate([-50,-25,0,25,50]):
        rad = math.radians(ang - 90)
        tx = hx + math.cos(rad)*3.5*s
        ty = hy + math.sin(rad)*3.5*s
        spikes += f'<line x1="{hx:.1f}" y1="{hy:.1f}" x2="{tx:.1f}" y2="{ty:.1f}" stroke="#7A9070" stroke-width="{0.7*s:.1f}" opacity="0.85" stroke-linecap="round"/>'
    # Raised right arm (her right = our left in icon, arm goes up-right)
    arm_x1 = x + 7*s
    arm_y1 = 22 - 8*s
    arm_x2 = x + 10*s
    arm_y2 = 22 - 14*s
    arm   = f'<line x1="{arm_x1:.1f}" y1="{arm_y1:.1f}" x2="{arm_x2:.1f}" y2="{arm_y2:.1f}" stroke="#7A9070" stroke-width="{1.2*s:.1f}" opacity="0.85" stroke-linecap="round"/>'
    # Torch handle
    torch_x = arm_x2
    torch_y = arm_y2
    torch = f'<rect x="{torch_x-0.4*s:.1f}" y="{torch_y-2*s:.1f}" width="{0.8*s:.1f}" height="{2*s:.1f}" rx="0.2" fill="#7A9070" opacity="0.85"/>'
    # Flame — light mode (static verdigris green)
    fx = torch_x
    fy = torch_y - 2*s
    flame_light = (f'<ellipse cx="{fx:.1f}" cy="{fy-1*s:.1f}" rx="{1.0*s:.1f}" ry="{1.5*s:.1f}" '
                   f'fill="#8AAE80" class="sol-flame-light"/>')
    # Flame — dark mode (static orange glow, no animation)
    flame_dark  = (f'<ellipse cx="{fx:.1f}" cy="{fy-1*s:.1f}" rx="{1.0*s:.1f}" ry="{1.5*s:.1f}" '
                   f'fill="#FF7700" filter="url(#flame-glow-{flame_id})" class="sol-flame-dark"/>'
                   f'<ellipse cx="{fx:.1f}" cy="{fy-0.5*s:.1f}" rx="{0.5*s:.1f}" ry="{0.8*s:.1f}" '
                   f'fill="#FFCC00" class="sol-flame-dark"/>')
    glow_def = (f'<defs><filter id="flame-glow-{flame_id}" x="-100%" y="-100%" width="300%" height="300%">'
                f'<feGaussianBlur stdDeviation="1.2" result="blur"/>'
                f'<feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>'
                f'</filter></defs>')
    return glow_def + ped + robe + neck + head + spikes + arm + torch + flame_light + flame_dark

_WATER = """
<path d="M0 22 Q4 24.5 8 22 Q12 19.5 16 22 Q20 24.5 24 22 L24 27 L0 27 Z" fill="#2A70C0" opacity="0.4"/>
<path d="M0 25.5 Q6 28 12 25.5 Q18 23 24 25.5 L24 30 L0 30 Z" fill="#2A70C0" opacity="0.25"/>
"""

# A: SoL at x=16, scale=0.55 — smaller, tucked behind stern
NYC_FERRY_A = _FERRY_BODY + sol(16, 0.55, "a") + _WATER
# B: SoL at x=15, scale=0.7 — medium, clearly visible
NYC_FERRY_B = _FERRY_BODY + sol(15, 0.70, "b") + _WATER
# C: SoL at x=14, scale=0.85 — large, prominent in background
NYC_FERRY_C = _FERRY_BODY + sol(14, 0.85, "c") + _WATER

# ═══════════════════════════════════════════════════════════════════════════════
# MTA BUS  (Option A — no changes needed)
# ═══════════════════════════════════════════════════════════════════════════════

MTA_BUS_A = """
<rect x="1" y="8" width="22" height="16" rx="2" fill="#F5F5F5"/>
<clipPath id="mAc"><rect x="1" y="8" width="22" height="16" rx="2"/></clipPath>
<rect x="1" y="8" width="22" height="3" fill="#0039A6" clip-path="url(#mAc)"/>
<rect x="1" y="19" width="22" height="5" fill="#0039A6" clip-path="url(#mAc)"/>
<rect x="2" y="11.5" width="4.5" height="5" rx="0.5" fill="#1A1A2E" opacity="0.85"/>
<rect x="9" y="8.4" width="13" height="2.2" rx="0.3" class="mb-sign"/>
<rect x="9" y="11.5" width="3.5" height="3.5" rx="0.4" fill="#B8D4E8" opacity="0.9" class="mb-win"/>
<rect x="13.5" y="11.5" width="3.5" height="3.5" rx="0.4" fill="#B8D4E8" opacity="0.9" class="mb-win"/>
<rect x="18" y="11.5" width="3.5" height="3.5" rx="0.4" fill="#B8D4E8" opacity="0.9" class="mb-win"/>
<line x1="8.5" y1="8" x2="8.5" y2="24" stroke="#ddd" stroke-width="0.5"/>
<rect x="1" y="24" width="22" height="2" fill="#777"/>
<circle cx="5.5" cy="28.5" r="3" fill="#2a2a2a"/><circle cx="5.5" cy="28.5" r="1.2" fill="#555"/>
<circle cx="18.5" cy="28.5" r="3" fill="#2a2a2a"/><circle cx="18.5" cy="28.5" r="1.2" fill="#555"/>
<rect x="0" y="31.5" width="24" height="1" rx="0.5" fill="#aaa"/>
"""

# ═══════════════════════════════════════════════════════════════════════════════
# HTML generation
# ═══════════════════════════════════════════════════════════════════════════════

def make_panel(mode):
    label = "Light Mode" if mode == "light" else "Dark Mode"
    body = f'<div class="panel {mode}">\n<h1>{label}</h1>\n'

    specs = [
        ("NJ Transit Bus — 3 options", [
            ("A — XD60 Xcelsior<br>Blue/magenta/orange arch",  NJT_BUS_A,  24, 38, TALL),
            ("B — XD60 Articulated<br>Accordion + arch livery", NJT_BUS_B, 24, 38, TALL),
            ("C — Hoboken Terminal<br>Bus bay arch",            NJT_BUS_C,  24, 38, TALL),
        ]),
        ("NJ Transit Rail — Option A (final)", [
            ("Comet V / Multilevel<br>Blue nose · red stripe · bright windows", NJT_RAIL_A, 24, 38, TALL),
        ]),
        ("PATH Train — Oculus + One WTC (3 variations)", [
            ("A — WTC centered<br>Reference / symmetric",        PATH_A, 24, 38, TALL),
            ("B — WTC offset-left + wide<br>★ Final pick",       PATH_B, 24, 38, TALL),
            ("C — WTC wide centered<br>Alternative",             PATH_C, 24, 38, TALL),
        ]),
        ("NY Waterway Ferry — Option A revised (final)", [
            ("White hull · red stripe<br>Higher contrast + deeper water", NYW_FERRY, 24, 38, TALL),
        ]),
        ("NYC Ferry — Ferry + Lady Liberty (final)", [
            ("C — Large SoL · static glow flame", NYC_FERRY_C, 24, 38, TALL),
        ]),
        ("MTA Bus — Option A (final)", [
            ("New Flyer XD40<br>MTA blue top + bottom bands", MTA_BUS_A, 24, 38, TALL),
        ]),
    ]

    for (sec_label, opts) in specs:
        body += section(sec_label, opts)

    body += "</div>\n"
    return body

html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Icon Drafts v3</title>
<style>{CSS}</style>
</head>
<body>
<div class="page">
{make_panel("light")}
<div class="divider"></div>
{make_panel("dark")}
</div>
</body>
</html>"""

out = "public/icon-drafts-new.html"
with open(out, "w", encoding="utf-8") as f:
    f.write(html)
print(f"Written {len(html):,} chars to {out}")
