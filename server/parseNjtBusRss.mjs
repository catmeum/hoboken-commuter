/**
 * Parse NJT Bus Advisories RSS XML and extract alerts for matching routes.
 * RSS items have: <title>BUS {route} - {date}</title>, <description>, <link>,
 * <advisoryAlert> (empty=advisory, "0"=travel alert)
 *
 * @param {string} xml - Raw RSS XML string
 * @param {Set<string>} routeSet - Set of route numbers to filter for
 * @returns {Array<{routes: string[], text: string, startedAt: number|null, isAdvisory: boolean, link: string|null}>}
 */
export function parseNjtBusRss(xml, routeSet) {
  const alerts = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match
  const seen = new Set()
  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1]
    const title = extractTag(item, 'title')
    const description = extractTag(item, 'description')
    const link = extractTag(item, 'link')
    const advisoryAlert = extractTag(item, 'advisoryAlert')
    const pubDate = extractTag(item, 'pubDate')

    const routeMatch = title?.match(/^BUS\s+(\d+)/i)
    if (!routeMatch) continue
    const route = routeMatch[1]
    if (!routeSet.has(route)) continue

    const isAdvisory = advisoryAlert === '' || advisoryAlert === null
    const text = (description || '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#039;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&#\d+;/g, m => String.fromCharCode(parseInt(m.slice(2, -1))))
      .trim()
    if (!text) continue

    if (seen.has(link)) {
      const existing = alerts.find(a => a.link === link)
      if (existing && !existing.routes.includes(route)) existing.routes.push(route)
      continue
    }
    seen.add(link)

    let startedAt = null
    if (pubDate) {
      const parsed = new Date(pubDate)
      if (!isNaN(parsed.getTime())) startedAt = parsed.getTime()
    }

    alerts.push({
      routes: [route],
      text: text.slice(0, 300),
      startedAt,
      isAdvisory,
      link: link || null,
    })
  }
  return alerts
}

/** Extract text content from a simple XML tag */
export function extractTag(xml, tag) {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`)
  const m = xml.match(regex)
  if (!m) {
    const emptyRegex = new RegExp(`<${tag}\\s*/>|<${tag}></${tag}>`)
    if (emptyRegex.test(xml)) return ''
    return null
  }
  return m[1].trim()
}
