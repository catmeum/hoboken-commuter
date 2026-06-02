import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AddStopPanel from '../../src/mobile/pages/AddStopPanel'

describe('AddStopPanel — Bus headsign variant flow', () => {
  const onClose = vi.fn()
  const onAdd = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows variant picker when PABT route has multiple headsigns', async () => {
    global.fetch = vi.fn()
      // Search results
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          stops: [{ id: '15972,16977,16809', name: 'PORT AUTHORITY BUS TERMINAL', ids: ['15972', '16977', '16809'] }],
        }),
      })
      // Stop routes
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ routes: ['126', '119'] }),
      })
      // Stop directions (multi-platform check — no picker needed)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ needsPicker: false, directions: [] }),
      })
      // Headsign variants (triggered by checkBusVariants)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          variants: [
            { route: '126', headsign: '126 HOBOKEN VIA WILLOW AVE', variant: 'via Willow', keyword: 'WILLOW', gate: '214', gateSchedule: { day: '214', late: '323', overnight: '79' } },
            { route: '126', headsign: '126 HAMILTON PK VIA HOBOKEN', variant: 'via Washington', keyword: 'HOBOKEN', gate: '213', gateSchedule: { day: '213', late: '323', overnight: '79' } },
          ],
          isPabt: true,
        }),
      })

    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)

    // Step 1: pick NJT Bus
    fireEvent.click(screen.getByText('NJT Bus'))

    // Step 2: search
    fireEvent.change(screen.getByPlaceholderText('Search for a bus stop…'), { target: { value: 'port authority' } })
    await waitFor(() => expect(screen.getByText('PORT AUTHORITY BUS TERMINAL')).toBeInTheDocument(), { timeout: 2000 })
    fireEvent.click(screen.getByText('PORT AUTHORITY BUS TERMINAL'))

    // Step 3: route picker — deselect 119, keep only 126
    await waitFor(() => expect(screen.getByText('Routes at this stop')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Route 119')) // deselect
    fireEvent.click(screen.getByText('Add to My Stops'))

    // Step 4: variant picker should appear
    await waitFor(() => {
      expect(screen.getByText('Which direction / variant?')).toBeInTheDocument()
      expect(screen.getByText(/via Willow/)).toBeInTheDocument()
      expect(screen.getByText(/via Washington/)).toBeInTheDocument()
    })
  })

  it('adds stop with headsign filter when variant is selected', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          stops: [{ id: '15972,16977', name: 'PORT AUTHORITY BUS TERMINAL', ids: ['15972', '16977'] }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ routes: ['126'] }),
      })
      // Stop directions (multi-platform check — no picker needed)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ needsPicker: false, directions: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          variants: [
            { route: '126', headsign: '126 HOBOKEN VIA WILLOW AVE', variant: 'via Willow', keyword: 'WILLOW', gate: '214', gateSchedule: { day: '214', late: '323', overnight: '79' } },
            { route: '126', headsign: '126 HAMILTON PK VIA HOBOKEN', variant: 'via Washington', keyword: 'HOBOKEN', gate: '213', gateSchedule: { day: '213', late: '323', overnight: '79' } },
          ],
          isPabt: true,
        }),
      })

    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)

    fireEvent.click(screen.getByText('NJT Bus'))
    fireEvent.change(screen.getByPlaceholderText('Search for a bus stop…'), { target: { value: 'port' } })
    await waitFor(() => expect(screen.getByText('PORT AUTHORITY BUS TERMINAL')).toBeInTheDocument(), { timeout: 2000 })
    fireEvent.click(screen.getByText('PORT AUTHORITY BUS TERMINAL'))

    await waitFor(() => expect(screen.getByText('Routes at this stop')).toBeInTheDocument())
    // All routes selected by default (just 126), click confirm
    fireEvent.click(screen.getByText('Add to My Stops'))

    await waitFor(() => expect(screen.getByText(/via Willow/)).toBeInTheDocument())

    // Pick "via Willow"
    fireEvent.click(screen.getByText(/126 · via Willow/))

    expect(onAdd).toHaveBeenCalledWith(
      'bus:15972,16977:126:WILLOW',
      'PORT AUTHORITY BUS TERMINAL · 126 via Willow'
    )
  })

  it('skips variant picker for stops without multiple variants', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          stops: [{ id: '7940', name: 'WILLOW AVE AT 15TH ST', ids: ['7940'] }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ routes: ['126'] }),
      })
      // Headsign check returns only one variant — no picker needed
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          variants: [
            { route: '126', headsign: '126 HOBOKEN VIA WILLOW AVE', variant: 'via Willow', keyword: 'WILLOW' },
          ],
          isPabt: false,
        }),
      })

    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)

    fireEvent.click(screen.getByText('NJT Bus'))
    fireEvent.change(screen.getByPlaceholderText('Search for a bus stop…'), { target: { value: 'willow' } })
    await waitFor(() => expect(screen.getByText('WILLOW AVE AT 15TH ST')).toBeInTheDocument(), { timeout: 2000 })
    fireEvent.click(screen.getByText('WILLOW AVE AT 15TH ST'))

    await waitFor(() => expect(screen.getByText('Routes at this stop')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Add to My Stops'))

    // Should add directly without variant picker
    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith(
        'bus:7940:126',
        'WILLOW AVE AT 15TH ST'
      )
    })
  })

  it('shows gate info in variant picker for PABT routes', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          stops: [{ id: '15972,16977', name: 'PORT AUTHORITY BUS TERMINAL', ids: ['15972', '16977'] }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ routes: ['165', '166'] }),
      })
      // Stop directions (multi-platform check — no picker needed)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ needsPicker: false, directions: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          variants: [
            { route: '165', headsign: '165 NEW YORK LOCAL VIA BLVD EAST', variant: '165 NEW YORK LOCAL VIA BLVD EAST', keyword: 'NEW', gate: '225', gateSchedule: { day: '225', late: '325', overnight: '82' } },
            { route: '165', headsign: '165T NEW YORK TURNPIKE EXP', variant: '165T NEW YORK TURNPIKE EXP', keyword: '165T', gate: '225', gateSchedule: { day: '225', late: '325', overnight: '82' } },
            { route: '166', headsign: '166 NEW YORK LOCAL VIA BLVD EAST', variant: '166 NEW YORK LOCAL VIA BLVD EAST', keyword: 'NEW', gate: '226', gateSchedule: { day: '226', late: '325', overnight: '82' } },
          ],
          isPabt: true,
        }),
      })

    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)

    fireEvent.click(screen.getByText('NJT Bus'))
    fireEvent.change(screen.getByPlaceholderText('Search for a bus stop…'), { target: { value: 'port' } })
    await waitFor(() => expect(screen.getByText('PORT AUTHORITY BUS TERMINAL')).toBeInTheDocument(), { timeout: 2000 })
    fireEvent.click(screen.getByText('PORT AUTHORITY BUS TERMINAL'))

    await waitFor(() => expect(screen.getByText('Routes at this stop')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Add to My Stops'))

    await waitFor(() => {
      expect(screen.getByText('Which direction / variant?')).toBeInTheDocument()
      // Gate info should be visible
      expect(screen.getAllByText(/Gate 225/).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/Gate 226/).length).toBeGreaterThan(0)
    })
  })
})
