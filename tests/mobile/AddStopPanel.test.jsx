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
    expect(screen.getByText('NY Waterway')).toBeInTheDocument()
    expect(screen.getByText('HBLR Light Rail')).toBeInTheDocument()
  })

  it('advances to search step when mode is picked', () => {
    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('MTA Subway'))
    expect(screen.getByText('MTA Subway — Search')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search for a subway station…')).toBeInTheDocument()
  })

  it('shows hint when query is too short', () => {
    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('NJT Bus'))
    expect(screen.getByText('Type at least 2 characters to search')).toBeInTheDocument()
  })

  it('searches and displays results', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        results: [
          { id: 'bus:20935:126', name: 'Washington & 11th St', subtitle: 'Routes: 126, 89' },
        ],
      }),
    })

    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('NJT Bus'))

    const input = screen.getByPlaceholderText('Search for a bus stop…')
    fireEvent.change(input, { target: { value: 'washington' } })

    await waitFor(() => {
      expect(screen.getByText('Washington & 11th St')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('calls onAdd when a result is clicked', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        results: [
          { id: 'bus:20935:126', name: 'Washington & 11th St' },
        ],
      }),
    })

    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('NJT Bus'))
    fireEvent.change(screen.getByPlaceholderText('Search for a bus stop…'), { target: { value: 'washington' } })

    await waitFor(() => {
      expect(screen.getByText('Washington & 11th St')).toBeInTheDocument()
    }, { timeout: 2000 })

    fireEvent.click(screen.getByText('Washington & 11th St'))
    expect(onAdd).toHaveBeenCalledWith('bus:20935:126', 'Washington & 11th St')
  })

  it('goes back from search to mode picker', () => {
    render(<AddStopPanel open={true} onClose={onClose} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('PATH'))
    expect(screen.getByText('PATH — Search')).toBeInTheDocument()

    fireEvent.click(screen.getByText('←'))
    expect(screen.getByText('Add a Stop')).toBeInTheDocument()
    expect(screen.getByText('MTA Subway')).toBeInTheDocument()
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

  it('does not have open class when open prop is false', () => {
    const { container } = render(<AddStopPanel open={false} onClose={onClose} onAdd={onAdd} />)
    expect(container.querySelector('.m-addstop-panel')).not.toHaveClass('open')
  })
})
