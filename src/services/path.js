/**
 * PATH Train — via backend proxy
 * Supports ?dir=outbound (HOB→33rd) or ?dir=inbound (33rd→HOB + 33rd→Newport)
 */

export async function fetchPath(direction = 'outbound') {
  const res = await fetch(`/api/path/gtfsrt?dir=${direction}`)
  if (!res.ok) throw new Error(`PATH API returned ${res.status}`)
  return await res.json()
}
