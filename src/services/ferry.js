/**
 * NY Waterway Ferry — via backend proxy
 * Supports ?dir=outbound (Hoboken 14th→W39th) or ?dir=inbound (W39th→Hoboken 14th)
 */

export async function fetchFerry(direction = 'outbound') {
  const res = await fetch(`/api/ferry?dir=${direction}`)
  if (!res.ok) throw new Error(`Ferry API returned ${res.status}`)
  return await res.json()
}
