import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AddStopPanel from '../../src/mobile/pages/AddStopPanel'

describe('AddStopPanel — NY Waterway Ferry flow', () => {
  const onClose = vi.fn()
  const onAdd = vi.fn()

  beforeEach(() => vi.clearAllMocks())

  it('advances to search step when Ferry mode is picked', () => {
    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('NY Waterway'))
    expect(screen.getByPlaceholderText('Search for a ferry terminal…')).toBeInTheDocument()
  })

  it('shows destination picker after selecting a terminal', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          terminals: [{ tag: 'hoboken_14', name: 'Hoboken / 14th St' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          routes: [
            { no: '1', name: 'Hoboken / W. Midtown', destinations: ['W. Midtown'] },
            { no: '2', name: 'Hoboken / Brookfield Place', destinations: ['Brookfield Place'] },
          ],
        }),
      })

    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('NY Waterway'))
    fireEvent.change(screen.getByPlaceholderText('Search for a ferry terminal…'), { target: { value: 'hoboken' } })

    await waitFor(() => expect(screen.getByText('Hoboken / 14th St')).toBeInTheDocument(), { timeout: 2000 })
    fireEvent.click(screen.getByText('Hoboken / 14th St'))

    await waitFor(() => {
      expect(screen.getByText('Select a destination')).toBeInTheDocument()
      expect(screen.getByText('→ W. Midtown')).toBeInTheDocument()
      expect(screen.getByText('→ Brookfield Place')).toBeInTheDocument()
    })
  })

  it('generates correct stop ID when destination is selected', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          terminals: [{ tag: 'hoboken_14', name: 'Hoboken / 14th St' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          routes: [
            { no: '1', name: 'Hoboken / W. Midtown', destinations: ['W. Midtown'] },
          ],
        }),
      })

    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('NY Waterway'))
    fireEvent.change(screen.getByPlaceholderText('Search for a ferry terminal…'), { target: { value: 'hoboken' } })

    await waitFor(() => expect(screen.getByText('Hoboken / 14th St')).toBeInTheDocument(), { timeout: 2000 })
    fireEvent.click(screen.getByText('Hoboken / 14th St'))

    await waitFor(() => expect(screen.getByText('→ W. Midtown')).toBeInTheDocument())
    fireEvent.click(screen.getByText('→ W. Midtown'))

    expect(onAdd).toHaveBeenCalledWith(
      'ferry:hoboken_14:1:W. Midtown',
      'Hoboken / 14th St → W. Midtown'
    )
  })

  it('handles route with no destinations', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          terminals: [{ tag: 'pier_11', name: 'Pier 11 / Wall St' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          routes: [
            { no: '5', name: 'Belford Ferry', destinations: [] },
          ],
        }),
      })

    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('NY Waterway'))
    fireEvent.change(screen.getByPlaceholderText('Search for a ferry terminal…'), { target: { value: 'pier' } })

    await waitFor(() => expect(screen.getByText('Pier 11 / Wall St')).toBeInTheDocument(), { timeout: 2000 })
    fireEvent.click(screen.getByText('Pier 11 / Wall St'))

    await waitFor(() => expect(screen.getByText('Belford Ferry')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Belford Ferry'))

    expect(onAdd).toHaveBeenCalledWith(
      'ferry:pier_11:5:',
      'Pier 11 / Wall St (Belford Ferry)'
    )
  })

  it('goes back from destination picker to search', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          terminals: [{ tag: 'hoboken_14', name: 'Hoboken / 14th St' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          routes: [{ no: '1', name: 'Test Route', destinations: ['Dest A'] }],
        }),
      })

    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('NY Waterway'))
    fireEvent.change(screen.getByPlaceholderText('Search for a ferry terminal…'), { target: { value: 'hoboken' } })

    await waitFor(() => expect(screen.getByText('Hoboken / 14th St')).toBeInTheDocument(), { timeout: 2000 })
    fireEvent.click(screen.getByText('Hoboken / 14th St'))

    await waitFor(() => expect(screen.getByText('Select a destination')).toBeInTheDocument())
    fireEvent.click(screen.getByText('←'))

    expect(screen.getByPlaceholderText('Search for a ferry terminal…')).toBeInTheDocument()
  })
})

describe('AddStopPanel — HBLR flow', () => {
  const onClose = vi.fn()
  const onAdd = vi.fn()

  beforeEach(() => vi.clearAllMocks())

  it('advances to search step when HBLR mode is picked', () => {
    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('Hudson-Bergen Light Rail'))
    expect(screen.getByPlaceholderText('Search for an HBLR stop…')).toBeInTheDocument()
  })

  it('adds stop directly when result is clicked (no step 2)', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          stops: [{ id: '38177', name: '2ND STREET' }],
        }),
      })

    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('Hudson-Bergen Light Rail'))
    fireEvent.change(screen.getByPlaceholderText('Search for an HBLR stop…'), { target: { value: '2nd' } })

    await waitFor(() => expect(screen.getByText('2ND STREET')).toBeInTheDocument(), { timeout: 2000 })
    fireEvent.click(screen.getByText('2ND STREET'))

    expect(onAdd).toHaveBeenCalledWith(
      'hblr:38177',
      '2ND STREET'
    )
  })

  it('uses correct search API with routes=HBLR param', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ stops: [] }),
      })

    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('Hudson-Bergen Light Rail'))
    fireEvent.change(screen.getByPlaceholderText('Search for an HBLR stop…'), { target: { value: 'hoboken' } })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/bus/stop-search?q=hoboken&routes=HBLR')
      )
    }, { timeout: 2000 })
  })
})

describe('AddStopPanel — Newark Light Rail flow', () => {
  const onClose = vi.fn()
  const onAdd = vi.fn()

  beforeEach(() => vi.clearAllMocks())

  it('advances to search step when Newark LR mode is picked', () => {
    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('Newark Light Rail'))
    expect(screen.getByPlaceholderText('Search for a Newark LR stop…')).toBeInTheDocument()
  })

  it('adds stop directly with hblr: prefix when result is clicked', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          stops: [{ id: '40001', name: 'PENN STATION' }],
        }),
      })

    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('Newark Light Rail'))
    fireEvent.change(screen.getByPlaceholderText('Search for a Newark LR stop…'), { target: { value: 'penn' } })

    await waitFor(() => expect(screen.getByText('PENN STATION')).toBeInTheDocument(), { timeout: 2000 })
    fireEvent.click(screen.getByText('PENN STATION'))

    // NLR uses hblr: prefix per buildSimpleStopId
    expect(onAdd).toHaveBeenCalledWith(
      'hblr:40001',
      'PENN STATION'
    )
  })

  it('uses correct search API with routes=NLR param', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ stops: [] }),
      })

    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('Newark Light Rail'))
    fireEvent.change(screen.getByPlaceholderText('Search for a Newark LR stop…'), { target: { value: 'broad' } })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/bus/stop-search?q=broad&routes=NLR')
      )
    }, { timeout: 2000 })
  })
})

describe('AddStopPanel — LIRR flow', () => {
  const onClose = vi.fn()
  const onAdd = vi.fn()

  beforeEach(() => vi.clearAllMocks())

  it('advances to search step when LIRR mode is picked', () => {
    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('LIRR'))
    expect(screen.getByPlaceholderText('Search for a LIRR station…')).toBeInTheDocument()
  })

  it('shows branch picker after selecting a station', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          stations: [{ id: '15', name: 'Jamaica' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          routes: [
            { id: 'Babylon', name: 'Babylon Branch', color: '#00985F' },
            { id: 'Hempstead', name: 'Hempstead Branch', color: '#006EC7' },
            { id: 'LongBeach', name: 'Long Beach Branch', color: '#FF6319' },
          ],
        }),
      })

    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('LIRR'))
    fireEvent.change(screen.getByPlaceholderText('Search for a LIRR station…'), { target: { value: 'jamaica' } })

    await waitFor(() => expect(screen.getByText('Jamaica')).toBeInTheDocument(), { timeout: 2000 })
    fireEvent.click(screen.getByText('Jamaica'))

    await waitFor(() => {
      expect(screen.getByText('Branches at this station')).toBeInTheDocument()
      expect(screen.getByText('Babylon Branch')).toBeInTheDocument()
      expect(screen.getByText('Hempstead Branch')).toBeInTheDocument()
      expect(screen.getByText('Long Beach Branch')).toBeInTheDocument()
    })
  })

  it('generates correct stop ID with all branches selected', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          stations: [{ id: '15', name: 'Jamaica' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          routes: [
            { id: 'Babylon', name: 'Babylon Branch', color: '#00985F' },
            { id: 'Hempstead', name: 'Hempstead Branch', color: '#006EC7' },
          ],
        }),
      })

    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('LIRR'))
    fireEvent.change(screen.getByPlaceholderText('Search for a LIRR station…'), { target: { value: 'jamaica' } })

    await waitFor(() => expect(screen.getByText('Jamaica')).toBeInTheDocument(), { timeout: 2000 })
    fireEvent.click(screen.getByText('Jamaica'))

    await waitFor(() => expect(screen.getByText('Branches at this station')).toBeInTheDocument())

    // All branches selected by default — just confirm
    fireEvent.click(screen.getByText('Add to My Stops'))

    expect(onAdd).toHaveBeenCalledWith(
      'lirr:15:Babylon,Hempstead',
      'Jamaica'
    )
  })

  it('can deselect branches before adding', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          stations: [{ id: '15', name: 'Jamaica' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          routes: [
            { id: 'Babylon', name: 'Babylon Branch', color: '#00985F' },
            { id: 'Hempstead', name: 'Hempstead Branch', color: '#006EC7' },
            { id: 'LongBeach', name: 'Long Beach Branch', color: '#FF6319' },
          ],
        }),
      })

    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('LIRR'))
    fireEvent.change(screen.getByPlaceholderText('Search for a LIRR station…'), { target: { value: 'jamaica' } })

    await waitFor(() => expect(screen.getByText('Jamaica')).toBeInTheDocument(), { timeout: 2000 })
    fireEvent.click(screen.getByText('Jamaica'))

    await waitFor(() => expect(screen.getByText('Branches at this station')).toBeInTheDocument())

    // Deselect all, then pick only Babylon
    fireEvent.click(screen.getByText('Deselect all'))
    fireEvent.click(screen.getByText('Babylon Branch'))
    fireEvent.click(screen.getByText('Add to My Stops'))

    expect(onAdd).toHaveBeenCalledWith(
      'lirr:15:Babylon',
      'Jamaica'
    )
  })

  it('disables Add button when no branches selected', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          stations: [{ id: '15', name: 'Jamaica' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          routes: [
            { id: 'Babylon', name: 'Babylon Branch', color: '#00985F' },
          ],
        }),
      })

    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('LIRR'))
    fireEvent.change(screen.getByPlaceholderText('Search for a LIRR station…'), { target: { value: 'jamaica' } })

    await waitFor(() => expect(screen.getByText('Jamaica')).toBeInTheDocument(), { timeout: 2000 })
    fireEvent.click(screen.getByText('Jamaica'))

    await waitFor(() => expect(screen.getByText('Branches at this station')).toBeInTheDocument())

    // Deselect all
    fireEvent.click(screen.getByText('Deselect all'))

    const addBtn = screen.getByText('Add to My Stops')
    expect(addBtn).toBeDisabled()
  })

  it('goes back from branch picker to search', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          stations: [{ id: '15', name: 'Jamaica' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          routes: [{ id: 'Babylon', name: 'Babylon Branch', color: '#00985F' }],
        }),
      })

    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('LIRR'))
    fireEvent.change(screen.getByPlaceholderText('Search for a LIRR station…'), { target: { value: 'jamaica' } })

    await waitFor(() => expect(screen.getByText('Jamaica')).toBeInTheDocument(), { timeout: 2000 })
    fireEvent.click(screen.getByText('Jamaica'))

    await waitFor(() => expect(screen.getByText('Branches at this station')).toBeInTheDocument())
    fireEvent.click(screen.getByText('←'))

    expect(screen.getByPlaceholderText('Search for a LIRR station…')).toBeInTheDocument()
  })
})

describe('AddStopPanel — Metro-North flow', () => {
  const onClose = vi.fn()
  const onAdd = vi.fn()

  beforeEach(() => vi.clearAllMocks())

  it('advances to search step when Metro-North mode is picked', () => {
    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('Metro-North'))
    expect(screen.getByPlaceholderText('Search for a Metro-North station…')).toBeInTheDocument()
  })

  it('shows line picker after selecting a station', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          stations: [{ id: '1', name: 'Grand Central Terminal' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          routes: [
            { id: 'Hudson', name: 'Hudson', color: '#009B3A' },
            { id: 'Harlem', name: 'Harlem', color: '#0039A6' },
            { id: 'NewHaven', name: 'New Haven', color: '#EE0034' },
          ],
        }),
      })

    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('Metro-North'))
    fireEvent.change(screen.getByPlaceholderText('Search for a Metro-North station…'), { target: { value: 'grand' } })

    await waitFor(() => expect(screen.getByText('Grand Central Terminal')).toBeInTheDocument(), { timeout: 2000 })
    fireEvent.click(screen.getByText('Grand Central Terminal'))

    await waitFor(() => {
      expect(screen.getByText('Lines at this station')).toBeInTheDocument()
      expect(screen.getByText('Hudson')).toBeInTheDocument()
      expect(screen.getByText('Harlem')).toBeInTheDocument()
      expect(screen.getByText('New Haven')).toBeInTheDocument()
    })
  })

  it('generates correct stop ID with all lines selected', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          stations: [{ id: '52', name: 'Croton-Harmon' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          routes: [
            { id: 'Hudson', name: 'Hudson', color: '#009B3A' },
          ],
        }),
      })

    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('Metro-North'))
    fireEvent.change(screen.getByPlaceholderText('Search for a Metro-North station…'), { target: { value: 'croton' } })

    await waitFor(() => expect(screen.getByText('Croton-Harmon')).toBeInTheDocument(), { timeout: 2000 })
    fireEvent.click(screen.getByText('Croton-Harmon'))

    await waitFor(() => expect(screen.getByText('Lines at this station')).toBeInTheDocument())

    // All lines selected by default
    fireEvent.click(screen.getByText('Add to My Stops'))

    expect(onAdd).toHaveBeenCalledWith(
      'mnr:52:Hudson',
      'Croton-Harmon'
    )
  })

  it('can deselect lines before adding', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          stations: [{ id: '1', name: 'Grand Central Terminal' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          routes: [
            { id: 'Hudson', name: 'Hudson', color: '#009B3A' },
            { id: 'Harlem', name: 'Harlem', color: '#0039A6' },
            { id: 'NewHaven', name: 'New Haven', color: '#EE0034' },
          ],
        }),
      })

    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('Metro-North'))
    fireEvent.change(screen.getByPlaceholderText('Search for a Metro-North station…'), { target: { value: 'grand' } })

    await waitFor(() => expect(screen.getByText('Grand Central Terminal')).toBeInTheDocument(), { timeout: 2000 })
    fireEvent.click(screen.getByText('Grand Central Terminal'))

    await waitFor(() => expect(screen.getByText('Lines at this station')).toBeInTheDocument())

    // Deselect all, then pick Hudson and Harlem
    fireEvent.click(screen.getByText('Deselect all'))
    fireEvent.click(screen.getByText('Hudson'))
    fireEvent.click(screen.getByText('Harlem'))
    fireEvent.click(screen.getByText('Add to My Stops'))

    expect(onAdd).toHaveBeenCalledWith(
      'mnr:1:Hudson,Harlem',
      'Grand Central Terminal'
    )
  })

  it('disables Add button when no lines selected', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          stations: [{ id: '52', name: 'Croton-Harmon' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          routes: [
            { id: 'Hudson', name: 'Hudson', color: '#009B3A' },
          ],
        }),
      })

    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('Metro-North'))
    fireEvent.change(screen.getByPlaceholderText('Search for a Metro-North station…'), { target: { value: 'croton' } })

    await waitFor(() => expect(screen.getByText('Croton-Harmon')).toBeInTheDocument(), { timeout: 2000 })
    fireEvent.click(screen.getByText('Croton-Harmon'))

    await waitFor(() => expect(screen.getByText('Lines at this station')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Deselect all'))

    const addBtn = screen.getByText('Add to My Stops')
    expect(addBtn).toBeDisabled()
  })

  it('goes back from line picker to search', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          stations: [{ id: '1', name: 'Grand Central Terminal' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          routes: [{ id: 'Hudson', name: 'Hudson', color: '#009B3A' }],
        }),
      })

    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('Metro-North'))
    fireEvent.change(screen.getByPlaceholderText('Search for a Metro-North station…'), { target: { value: 'grand' } })

    await waitFor(() => expect(screen.getByText('Grand Central Terminal')).toBeInTheDocument(), { timeout: 2000 })
    fireEvent.click(screen.getByText('Grand Central Terminal'))

    await waitFor(() => expect(screen.getByText('Lines at this station')).toBeInTheDocument())
    fireEvent.click(screen.getByText('←'))

    expect(screen.getByPlaceholderText('Search for a Metro-North station…')).toBeInTheDocument()
  })
})

describe('AddStopPanel — MTA Bus flow', () => {
  const onClose = vi.fn()
  const onAdd = vi.fn()

  beforeEach(() => vi.clearAllMocks())

  it('advances to search step when MTA Bus mode is picked', () => {
    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('MTA Bus'))
    expect(screen.getByPlaceholderText('Search for a bus route (M1, B63, Q32)…')).toBeInTheDocument()
  })

  it('shows stop picker after selecting a route', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          routes: [{ id: 'MTA NYCT_M1', name: 'M1', desc: 'Fifth Ave / Madison Ave' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          directions: [
            {
              direction: 'to HARLEM - 147 ST',
              stops: [
                { id: '401490', name: '5 AV/W 42 ST' },
                { id: '401500', name: '5 AV/W 50 ST' },
              ],
            },
            {
              direction: 'to SOUTH FERRY',
              stops: [
                { id: '401491', name: 'MADISON AV/E 42 ST' },
                { id: '401501', name: 'MADISON AV/E 34 ST' },
              ],
            },
          ],
        }),
      })

    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('MTA Bus'))
    fireEvent.change(screen.getByPlaceholderText('Search for a bus route (M1, B63, Q32)…'), { target: { value: 'M1' } })

    await waitFor(() => expect(screen.getByText('M1')).toBeInTheDocument(), { timeout: 2000 })
    fireEvent.click(screen.getByText('M1'))

    await waitFor(() => {
      expect(screen.getByText(/Select a stop on M1/)).toBeInTheDocument()
      expect(screen.getByText('5 AV/W 42 ST')).toBeInTheDocument()
      expect(screen.getByText('MADISON AV/E 42 ST')).toBeInTheDocument()
    })
  })

  it('generates correct stop ID when stop is selected', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          routes: [{ id: 'MTA NYCT_M1', name: 'M1', desc: 'Fifth Ave / Madison Ave' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          directions: [
            {
              direction: 'to HARLEM - 147 ST',
              stops: [
                { id: '401490', name: '5 AV/W 42 ST' },
              ],
            },
          ],
        }),
      })

    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('MTA Bus'))
    fireEvent.change(screen.getByPlaceholderText('Search for a bus route (M1, B63, Q32)…'), { target: { value: 'M1' } })

    await waitFor(() => expect(screen.getByText('M1')).toBeInTheDocument(), { timeout: 2000 })
    fireEvent.click(screen.getByText('M1'))

    await waitFor(() => expect(screen.getByText('5 AV/W 42 ST')).toBeInTheDocument())
    fireEvent.click(screen.getByText('5 AV/W 42 ST'))

    expect(onAdd).toHaveBeenCalledWith(
      'mtabus:401490:MTA NYCT_M1',
      '5 AV/W 42 ST'
    )
  })

  it('shows direction labels for stops', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          routes: [{ id: 'MTA NYCT_B63', name: 'B63' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          directions: [
            {
              direction: 'to BAY RIDGE',
              stops: [{ id: '305400', name: '5 AV/36 ST' }],
            },
          ],
        }),
      })

    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('MTA Bus'))
    fireEvent.change(screen.getByPlaceholderText('Search for a bus route (M1, B63, Q32)…'), { target: { value: 'B63' } })

    await waitFor(() => expect(screen.getByText('B63')).toBeInTheDocument(), { timeout: 2000 })
    fireEvent.click(screen.getByText('B63'))

    await waitFor(() => {
      expect(screen.getByText('5 AV/36 ST')).toBeInTheDocument()
      expect(screen.getByText('to BAY RIDGE')).toBeInTheDocument()
    })
  })

  it('shows route description in stop picker', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          routes: [{ id: 'MTA NYCT_M1', name: 'M1', desc: 'Fifth Ave / Madison Ave' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          directions: [
            { direction: 'to HARLEM', stops: [{ id: '1', name: 'Stop A' }] },
          ],
        }),
      })

    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('MTA Bus'))
    fireEvent.change(screen.getByPlaceholderText('Search for a bus route (M1, B63, Q32)…'), { target: { value: 'M1' } })

    await waitFor(() => expect(screen.getByText('M1')).toBeInTheDocument(), { timeout: 2000 })

    // The route description is shown in the search results
    expect(screen.getByText('Fifth Ave / Madison Ave')).toBeInTheDocument()
  })

  it('goes back from stop picker to search', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          routes: [{ id: 'MTA NYCT_M1', name: 'M1' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          directions: [
            { direction: 'to HARLEM', stops: [{ id: '1', name: 'Stop A' }] },
          ],
        }),
      })

    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('MTA Bus'))
    fireEvent.change(screen.getByPlaceholderText('Search for a bus route (M1, B63, Q32)…'), { target: { value: 'M1' } })

    await waitFor(() => expect(screen.getByText('M1')).toBeInTheDocument(), { timeout: 2000 })
    fireEvent.click(screen.getByText('M1'))

    await waitFor(() => expect(screen.getByText(/Select a stop on M1/)).toBeInTheDocument())
    fireEvent.click(screen.getByText('←'))

    expect(screen.getByPlaceholderText('Search for a bus route (M1, B63, Q32)…')).toBeInTheDocument()
  })
})

describe('AddStopPanel — NYC Ferry flow', () => {
  const onClose = vi.fn()
  const onAdd = vi.fn()

  beforeEach(() => vi.clearAllMocks())

  it('advances to search step when NYC Ferry mode is picked', () => {
    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('NYC Ferry'))
    expect(screen.getByPlaceholderText('Search for a ferry stop…')).toBeInTheDocument()
  })

  it('adds stop directly when result is clicked (no step 2)', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          stops: [{ id: 'LIC', name: 'Long Island City' }],
        }),
      })

    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('NYC Ferry'))
    fireEvent.change(screen.getByPlaceholderText('Search for a ferry stop…'), { target: { value: 'long island' } })

    await waitFor(() => expect(screen.getByText('Long Island City')).toBeInTheDocument(), { timeout: 2000 })
    fireEvent.click(screen.getByText('Long Island City'))

    expect(onAdd).toHaveBeenCalledWith(
      'nycferry:LIC',
      'Long Island City'
    )
  })

  it('handles multiple search results', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          stops: [
            { id: 'DUMBO', name: 'DUMBO' },
            { id: 'PIER11', name: 'Wall St / Pier 11' },
          ],
        }),
      })

    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('NYC Ferry'))
    fireEvent.change(screen.getByPlaceholderText('Search for a ferry stop…'), { target: { value: 'pier' } })

    await waitFor(() => {
      expect(screen.getByText('DUMBO')).toBeInTheDocument()
      expect(screen.getByText('Wall St / Pier 11')).toBeInTheDocument()
    }, { timeout: 2000 })

    fireEvent.click(screen.getByText('Wall St / Pier 11'))

    expect(onAdd).toHaveBeenCalledWith(
      'nycferry:PIER11',
      'Wall St / Pier 11'
    )
  })
})
