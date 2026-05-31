import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AddStopPanel from '../../src/mobile/pages/AddStopPanel'

describe('AddStopPanel', () => {
  const onClose = vi.fn()
  const onAdd = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders mode picker on step 1', () => {
    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    expect(screen.getByText('Add a Stop')).toBeInTheDocument()
    expect(screen.getByText('MTA Subway')).toBeInTheDocument()
    expect(screen.getByText('NJT Bus')).toBeInTheDocument()
    expect(screen.getByText('PATH')).toBeInTheDocument()
  })

  it('advances to search step when mode is picked', () => {
    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('MTA Subway'))
    expect(screen.getByPlaceholderText('Search for a subway station…')).toBeInTheDocument()
  })

  it('goes back from search to mode picker', () => {
    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('PATH'))
    fireEvent.click(screen.getByText('←'))
    expect(screen.getByText('Add a Stop')).toBeInTheDocument()
  })

  it('calls onClose when close button clicked', () => {
    const { container } = render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    const closeBtn = container.querySelector('.m-set-close')
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('has open class when open prop is true', () => {
    const { container } = render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    expect(container.querySelector('.m-addstop-panel')).toHaveClass('open')
  })

  describe('MTA Subway flow', () => {
    it('shows line/direction picker after selecting a station', async () => {
      // Mock search
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            stations: [{ name: '72 St', ids: ['123'], lines: ['1', '2', '3'], linesLabel: '1, 2, 3' }],
          }),
        })
        // Mock station-lines fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ lines: ['1', '2', '3'] }),
        })

      render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
      fireEvent.click(screen.getByText('MTA Subway'))
      fireEvent.change(screen.getByPlaceholderText('Search for a subway station…'), { target: { value: '72 st' } })

      await waitFor(() => {
        expect(screen.getByText('72 St')).toBeInTheDocument()
      }, { timeout: 2000 })

      fireEvent.click(screen.getByText('72 St'))

      await waitFor(() => {
        expect(screen.getByText('Lines at this station')).toBeInTheDocument()
        expect(screen.getByText('Direction')).toBeInTheDocument()
      })
    })

    it('generates correct stop ID with selected lines and direction', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            stations: [{ name: '72 St', ids: ['123'], lines: ['1', '2', '3'], linesLabel: '1, 2, 3' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ lines: ['1', '2', '3'] }),
        })

      render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
      fireEvent.click(screen.getByText('MTA Subway'))
      fireEvent.change(screen.getByPlaceholderText('Search for a subway station…'), { target: { value: '72 st' } })

      await waitFor(() => expect(screen.getByText('72 St')).toBeInTheDocument(), { timeout: 2000 })
      fireEvent.click(screen.getByText('72 St'))

      await waitFor(() => expect(screen.getByText('Lines at this station')).toBeInTheDocument())

      // Select Uptown direction
      fireEvent.click(screen.getByText('Uptown / Bronx / Queens'))

      // Click Add
      fireEvent.click(screen.getByText('Add to My Stops'))

      expect(onAdd).toHaveBeenCalledWith(
        'mta:123:N:1,2,3',
        '72 St (Uptown)'
      )
    })

    it('can deselect lines before adding', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            stations: [{ name: '34 St', ids: ['D17', 'R17'], lines: ['B', 'D', 'F', 'M', 'N', 'Q', 'R', 'W'], linesLabel: 'B, D, F, M, N, Q, R, W' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ lines: ['B', 'D', 'F', 'M', 'N', 'Q', 'R', 'W'] }),
        })

      render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
      fireEvent.click(screen.getByText('MTA Subway'))
      fireEvent.change(screen.getByPlaceholderText('Search for a subway station…'), { target: { value: '34 st' } })

      await waitFor(() => expect(screen.getByText('34 St')).toBeInTheDocument(), { timeout: 2000 })
      fireEvent.click(screen.getByText('34 St'))

      await waitFor(() => expect(screen.getByText('Lines at this station')).toBeInTheDocument())

      // All lines are selected by default — deselect some by clicking their badges
      // The badges are rendered as SubwayBadge components inside buttons
      const lineButtons = screen.getAllByRole('button').filter(b => b.classList.contains('m-addstop-line-btn'))
      // Deselect the last 4 (N, Q, R, W) — click them to toggle off
      for (let i = 4; i < lineButtons.length; i++) {
        fireEvent.click(lineButtons[i])
      }

      // Select "Both directions"
      fireEvent.click(screen.getByText('Both directions'))
      fireEvent.click(screen.getByText('Add to My Stops'))

      // Should have B,D,F,M with direction A (all)
      expect(onAdd).toHaveBeenCalledWith(
        'mta:D17,R17:A:B,D,F,M',
        '34 St (Both)'
      )
    })

    it('disables Add button when no lines selected', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            stations: [{ name: '72 St', ids: ['123'], lines: ['1'], linesLabel: '1' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ lines: ['1'] }),
        })

      render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
      fireEvent.click(screen.getByText('MTA Subway'))
      fireEvent.change(screen.getByPlaceholderText('Search for a subway station…'), { target: { value: '72' } })

      await waitFor(() => expect(screen.getByText('72 St')).toBeInTheDocument(), { timeout: 2000 })
      fireEvent.click(screen.getByText('72 St'))

      await waitFor(() => expect(screen.getByText('Lines at this station')).toBeInTheDocument())

      // Deselect the only line
      const lineButtons = screen.getAllByRole('button').filter(b => b.classList.contains('m-addstop-line-btn'))
      fireEvent.click(lineButtons[0])

      const addBtn = screen.getByText('Add to My Stops')
      expect(addBtn).toBeDisabled()
    })
  })

  describe('NJT Bus flow', () => {
    it('shows route picker after selecting a stop', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            stops: [{ id: '7940', name: 'WILLOW AVE AT 15TH ST' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ routes: ['126', '89', '119'] }),
        })

      render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
      fireEvent.click(screen.getByText('NJT Bus'))
      fireEvent.change(screen.getByPlaceholderText('Search for a bus stop…'), { target: { value: 'willow' } })

      await waitFor(() => expect(screen.getByText('WILLOW AVE AT 15TH ST')).toBeInTheDocument(), { timeout: 2000 })
      fireEvent.click(screen.getByText('WILLOW AVE AT 15TH ST'))

      await waitFor(() => {
        expect(screen.getByText('Routes at this stop')).toBeInTheDocument()
        expect(screen.getByText('Route 126')).toBeInTheDocument()
        expect(screen.getByText('Route 89')).toBeInTheDocument()
        expect(screen.getByText('Route 119')).toBeInTheDocument()
      })
    })

    it('generates correct stop ID with selected routes', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            stops: [{ id: '7940', name: 'WILLOW AVE AT 15TH ST' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ routes: ['126', '89', '119'] }),
        })
        // Headsign check — single variant, no picker needed
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ variants: [{ route: '126', variant: 'via Willow', keyword: 'WILLOW' }], isPabt: false }),
        })

      render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
      fireEvent.click(screen.getByText('NJT Bus'))
      fireEvent.change(screen.getByPlaceholderText('Search for a bus stop…'), { target: { value: 'willow' } })

      await waitFor(() => expect(screen.getByText('WILLOW AVE AT 15TH ST')).toBeInTheDocument(), { timeout: 2000 })
      fireEvent.click(screen.getByText('WILLOW AVE AT 15TH ST'))

      await waitFor(() => expect(screen.getByText('Routes at this stop')).toBeInTheDocument())

      // All routes selected by default — just confirm
      fireEvent.click(screen.getByText('Add to My Stops'))

      await waitFor(() => {
        expect(onAdd).toHaveBeenCalledWith(
          'bus:7940:126,89,119',
          'WILLOW AVE AT 15TH ST (126,89,119)'
        )
      })
    })

    it('can deselect routes', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            stops: [{ id: '7940', name: 'WILLOW AVE AT 15TH ST' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ routes: ['126', '89', '119'] }),
        })
        // Headsign check — single variant
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ variants: [{ route: '126', variant: 'via Willow', keyword: 'WILLOW' }], isPabt: false }),
        })

      render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
      fireEvent.click(screen.getByText('NJT Bus'))
      fireEvent.change(screen.getByPlaceholderText('Search for a bus stop…'), { target: { value: 'willow' } })

      await waitFor(() => expect(screen.getByText('WILLOW AVE AT 15TH ST')).toBeInTheDocument(), { timeout: 2000 })
      fireEvent.click(screen.getByText('WILLOW AVE AT 15TH ST'))

      await waitFor(() => expect(screen.getByText('Routes at this stop')).toBeInTheDocument())

      // Deselect all, then select only 126
      fireEvent.click(screen.getByText('Deselect all'))
      fireEvent.click(screen.getByText('Route 126'))
      fireEvent.click(screen.getByText('Add to My Stops'))

      await waitFor(() => {
        expect(onAdd).toHaveBeenCalledWith(
          'bus:7940:126',
          'WILLOW AVE AT 15TH ST (126)'
        )
      })
    })
  })

  describe('PATH flow', () => {
    it('shows direction picker after selecting a station', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            stations: [{ id: '26729', name: 'Hoboken' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            options: [
              { dirId: '1', label: 'To WTC', routeIds: ['860'], routeNames: ['HOB-WTC'] },
              { dirId: '1', label: 'To 33rd St', routeIds: ['862', '1024'], routeNames: ['HOB-33', 'JSQ-33'] },
            ],
          }),
        })

      render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
      fireEvent.click(screen.getByText('PATH'))
      fireEvent.change(screen.getByPlaceholderText('Search for a PATH station…'), { target: { value: 'hoboken' } })

      await waitFor(() => expect(screen.getByText('Hoboken')).toBeInTheDocument(), { timeout: 2000 })
      fireEvent.click(screen.getByText('Hoboken'))

      await waitFor(() => {
        expect(screen.getByText('Where are you going?')).toBeInTheDocument()
        expect(screen.getByText('To WTC')).toBeInTheDocument()
        expect(screen.getByText('To 33rd St')).toBeInTheDocument()
      })
    })

    it('generates correct stop ID with selected directions', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            stations: [{ id: '26729', name: 'Hoboken' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            options: [
              { dirId: '1', label: 'To WTC', routeIds: ['860'], routeNames: ['HOB-WTC'] },
              { dirId: '1', label: 'To 33rd St', routeIds: ['862', '1024'], routeNames: ['HOB-33', 'JSQ-33'] },
            ],
          }),
        })

      render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
      fireEvent.click(screen.getByText('PATH'))
      fireEvent.change(screen.getByPlaceholderText('Search for a PATH station…'), { target: { value: 'hoboken' } })

      await waitFor(() => expect(screen.getByText('Hoboken')).toBeInTheDocument(), { timeout: 2000 })
      fireEvent.click(screen.getByText('Hoboken'))

      await waitFor(() => expect(screen.getByText('To 33rd St')).toBeInTheDocument())

      // Select "To 33rd St" only
      fireEvent.click(screen.getByText('To 33rd St'))
      fireEvent.click(screen.getByText('Add to My Stops'))

      expect(onAdd).toHaveBeenCalledWith(
        'path:862,1024:1:26729',
        'Hoboken · To 33rd St'
      )
    })
  })

  describe('NJT Rail flow', () => {
    it('shows line picker after selecting a station', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            stations: [{ code: 'HB', name: 'Hoboken' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            lines: [
              { code: 'BC', name: 'Bergen County Line', abbr: 'BERG', color: '#98A8BF' },
              { code: 'ML', name: 'Main Line', abbr: 'MAIN', color: '#F2B826' },
            ],
          }),
        })

      render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
      fireEvent.click(screen.getByText('NJT Rail'))
      fireEvent.change(screen.getByPlaceholderText('Search for a rail station…'), { target: { value: 'hoboken' } })

      await waitFor(() => expect(screen.getByText('Hoboken')).toBeInTheDocument(), { timeout: 2000 })
      fireEvent.click(screen.getByText('Hoboken'))

      await waitFor(() => {
        expect(screen.getByText('Lines at this station')).toBeInTheDocument()
        expect(screen.getByText('Bergen County Line')).toBeInTheDocument()
        expect(screen.getByText('Main Line')).toBeInTheDocument()
      })
    })

    it('generates correct stop ID with selected lines', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            stations: [{ code: 'HB', name: 'Hoboken' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            lines: [
              { code: 'BC', name: 'Bergen County Line', abbr: 'BERG', color: '#98A8BF' },
              { code: 'ML', name: 'Main Line', abbr: 'MAIN', color: '#F2B826' },
              { code: 'PV', name: 'Pascack Valley Line', abbr: 'PASC', color: '#A34F8B' },
            ],
          }),
        })

      render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
      fireEvent.click(screen.getByText('NJT Rail'))
      fireEvent.change(screen.getByPlaceholderText('Search for a rail station…'), { target: { value: 'hoboken' } })

      await waitFor(() => expect(screen.getByText('Hoboken')).toBeInTheDocument(), { timeout: 2000 })
      fireEvent.click(screen.getByText('Hoboken'))

      await waitFor(() => expect(screen.getByText('Lines at this station')).toBeInTheDocument())

      // All selected by default — just confirm
      fireEvent.click(screen.getByText('Add to My Stops'))

      expect(onAdd).toHaveBeenCalledWith(
        'rail:HB:BC,ML,PV',
        'Hoboken (All lines)'
      )
    })

    it('shows error for stations with no lines', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            stations: [{ code: 'SC', name: 'Secaucus Concourse' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ lines: [] }),
        })

      render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
      fireEvent.click(screen.getByText('NJT Rail'))
      fireEvent.change(screen.getByPlaceholderText('Search for a rail station…'), { target: { value: 'secaucus' } })

      await waitFor(() => expect(screen.getByText('Secaucus Concourse')).toBeInTheDocument(), { timeout: 2000 })
      fireEvent.click(screen.getByText('Secaucus Concourse'))

      await waitFor(() => {
        expect(screen.getByText(/No lines found/)).toBeInTheDocument()
      })
    })
  })
})
