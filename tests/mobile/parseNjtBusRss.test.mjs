import { describe, it, expect } from 'vitest'
import { parseNjtBusRss, extractTag } from '../../server/parseNjtBusRss.mjs'

const OUR_ROUTES = new Set(['126', '119', '89', '22', '23', '128', '165', '166'])

describe('extractTag', () => {
  it('extracts text content from a tag', () => {
    expect(extractTag('<title>BUS 126 - Jul 16</title>', 'title')).toBe('BUS 126 - Jul 16')
  })

  it('returns empty string for empty tags', () => {
    expect(extractTag('<advisoryAlert></advisoryAlert>', 'advisoryAlert')).toBe('')
  })

  it('returns empty string for self-closing tags', () => {
    expect(extractTag('<advisoryAlert/>', 'advisoryAlert')).toBe('')
  })

  it('returns null when tag is not present', () => {
    expect(extractTag('<title>hello</title>', 'description')).toBe(null)
  })

  it('handles multiline content', () => {
    const xml = '<description>Line 1\nLine 2</description>'
    expect(extractTag(xml, 'description')).toBe('Line 1\nLine 2')
  })
})

describe('parseNjtBusRss', () => {
  const makeItem = ({ route, description, link, advisoryAlert = '', pubDate = 'Jul 16, 2026 11:00:38 AM' }) => `
    <item>
      <title>BUS ${route} - ${pubDate}</title>
      <description>${description}</description>
      <link>${link}</link>
      <guid>${link}</guid>
      <advisoryAlert>${advisoryAlert}</advisoryAlert>
      <pubDate>${pubDate}</pubDate>
    </item>`

  const wrapRss = (items) => `<?xml version="1.0"?><rss version="2.0"><channel>${items}</channel></rss>`

  it('parses a service advisory item', () => {
    const xml = wrapRss(makeItem({
      route: '126',
      description: 'Bus Detour for No. 126 in Hoboken - Monday, July 20, to Monday, October 19, 2026',
      link: 'https://www.njtransit.com/node/2136633',
      advisoryAlert: '',
    }))

    const alerts = parseNjtBusRss(xml, OUR_ROUTES)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].routes).toEqual(['126'])
    expect(alerts[0].text).toContain('Bus Detour for No. 126')
    expect(alerts[0].isAdvisory).toBe(true)
    expect(alerts[0].link).toBe('https://www.njtransit.com/node/2136633')
    expect(alerts[0].startedAt).toBeTypeOf('number')
  })

  it('parses a travel alert item', () => {
    const xml = wrapRss(makeItem({
      route: '126',
      description: 'NJ TRANSIT bus service is subject to 15-minute delays due to heavy traffic.',
      link: 'https://www.njtransit.com/node/2142942',
      advisoryAlert: '0',
    }))

    const alerts = parseNjtBusRss(xml, OUR_ROUTES)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].isAdvisory).toBe(false)
    expect(alerts[0].text).toContain('15-minute delays')
  })

  it('filters out routes not in our set', () => {
    const xml = wrapRss(makeItem({
      route: '999',
      description: 'Some other route alert',
      link: 'https://www.njtransit.com/node/1',
    }))

    const alerts = parseNjtBusRss(xml, OUR_ROUTES)
    expect(alerts).toHaveLength(0)
  })

  it('deduplicates alerts by link and merges routes', () => {
    const xml = wrapRss(
      makeItem({ route: '126', description: 'PABT delays', link: 'https://njtransit.com/node/100', advisoryAlert: '0' }) +
      makeItem({ route: '119', description: 'PABT delays', link: 'https://njtransit.com/node/100', advisoryAlert: '0' }) +
      makeItem({ route: '128', description: 'PABT delays', link: 'https://njtransit.com/node/100', advisoryAlert: '0' })
    )

    const alerts = parseNjtBusRss(xml, OUR_ROUTES)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].routes).toEqual(['126', '119', '128'])
  })

  it('decodes HTML entities in description', () => {
    const xml = wrapRss(makeItem({
      route: '22',
      description: 'Route Nos. 22 &amp; 23 &#8211; Effective Monday',
      link: 'https://njtransit.com/node/200',
    }))

    const alerts = parseNjtBusRss(xml, OUR_ROUTES)
    expect(alerts[0].text).toBe('Route Nos. 22 & 23 – Effective Monday')
  })

  it('truncates text at 300 characters', () => {
    const longText = 'A'.repeat(400)
    const xml = wrapRss(makeItem({
      route: '89',
      description: longText,
      link: 'https://njtransit.com/node/300',
    }))

    const alerts = parseNjtBusRss(xml, OUR_ROUTES)
    expect(alerts[0].text).toHaveLength(300)
  })

  it('skips items with empty description', () => {
    const xml = wrapRss(makeItem({
      route: '126',
      description: '',
      link: 'https://njtransit.com/node/400',
    }))

    const alerts = parseNjtBusRss(xml, OUR_ROUTES)
    expect(alerts).toHaveLength(0)
  })

  it('handles missing advisoryAlert tag as advisory', () => {
    const xml = wrapRss(`
      <item>
        <title>BUS 126 - Jul 28, 2026 02:00:00 PM</title>
        <description>Some advisory without the tag</description>
        <link>https://njtransit.com/node/500</link>
        <guid>https://njtransit.com/node/500</guid>
        <pubDate>Jul 28, 2026 02:00:00 PM</pubDate>
      </item>`)

    const alerts = parseNjtBusRss(xml, OUR_ROUTES)
    expect(alerts).toHaveLength(1)
    // advisoryAlert tag is missing entirely → null → isAdvisory = true
    expect(alerts[0].isAdvisory).toBe(true)
  })
})
