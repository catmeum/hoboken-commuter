import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import WelcomePage from '../../src/mobile/pages/WelcomePage'

describe('WelcomePage', () => {
  const onComplete = vi.fn()
  const onManual = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the logo and tagline', () => {
    const { container } = render(<WelcomePage onComplete={onComplete} onManual={onManual} />)
    // Logo text is split across elements: MY<span>STOP</span>NOW
    const logo = container.querySelector('.m-welcome-logo')
    expect(logo).toBeInTheDocument()
    expect(logo.textContent).toBe('MYSTOPNOW')
    expect(screen.getByText('Real-time transit at a glance.')).toBeInTheDocument()
  })

  it('renders the zip code form', () => {
    render(<WelcomePage onComplete={onComplete} onManual={onManual} />)
    expect(screen.getByPlaceholderText('Zip code')).toBeInTheDocument()
    expect(screen.getByText('Find My Stops')).toBeInTheDocument()
  })

  it('shows error for invalid zip', async () => {
    render(<WelcomePage onComplete={onComplete} onManual={onManual} />)
    const input = screen.getByPlaceholderText('Zip code')
    const btn = screen.getByText('Find My Stops')

    fireEvent.change(input, { target: { value: '123' } })
    fireEvent.click(btn)

    expect(screen.getByText('Enter a 5-digit zip code')).toBeInTheDocument()
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('shows preset picker when "Pick stops manually" is clicked', () => {
    render(<WelcomePage onComplete={onComplete} onManual={onManual} />)
    fireEvent.click(screen.getByText('Pick stops manually'))
    // Should show preset picker, not call onManual directly
    expect(screen.getByText('Pick a neighborhood to get started.')).toBeInTheDocument()
    expect(screen.getByText('🚂 Hoboken')).toBeInTheDocument()
  })

  it('calls onManual when "Start from scratch" is clicked', () => {
    render(<WelcomePage onComplete={onComplete} onManual={onManual} />)
    fireEvent.click(screen.getByText('Pick stops manually'))
    fireEvent.click(screen.getByText('Start from scratch'))
    expect(onManual).toHaveBeenCalledOnce()
  })

  it('calls onComplete when a preset is clicked', () => {
    render(<WelcomePage onComplete={onComplete} onManual={onManual} />)
    fireEvent.click(screen.getByText('Pick stops manually'))
    fireEvent.click(screen.getByText('🚂 Hoboken'))
    expect(onComplete).toHaveBeenCalledOnce()
    // Should pass the hoboken preset stops
    expect(onComplete.mock.calls[0][0]).toContain('bus:7917:126')
  })

  it('calls onComplete with stops after successful zip lookup', async () => {
    // Mock fetch for zip geocoding and nearby-stops
    const mockStops = [
      { id: 'mta:D17:S:B,D,F', name: '47-50 Sts Rockefeller' },
      { id: 'bus:20935:126', name: 'Washington & 11th' },
    ]
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          places: [{ latitude: '40.758', longitude: '-73.978' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ stops: mockStops }),
      })

    render(<WelcomePage onComplete={onComplete} onManual={onManual} />)
    const input = screen.getByPlaceholderText('Zip code')
    fireEvent.change(input, { target: { value: '10019' } })
    fireEvent.click(screen.getByText('Find My Stops'))

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith(
        ['mta:D17:S:B,D,F', 'bus:20935:126'],
        { 'mta:D17:S:B,D,F': '47-50 Sts Rockefeller', 'bus:20935:126': 'Washington & 11th' }
      )
    })
  })

  it('shows error when zip geocoding fails', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false })

    render(<WelcomePage onComplete={onComplete} onManual={onManual} />)
    fireEvent.change(screen.getByPlaceholderText('Zip code'), { target: { value: '99999' } })
    fireEvent.click(screen.getByText('Find My Stops'))

    await waitFor(() => {
      expect(screen.getByText(/Zip code not found/)).toBeInTheDocument()
    })
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('shows error when no stops found nearby', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          places: [{ latitude: '40.0', longitude: '-74.0' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ stops: [] }),
      })

    render(<WelcomePage onComplete={onComplete} onManual={onManual} />)
    fireEvent.change(screen.getByPlaceholderText('Zip code'), { target: { value: '08001' } })
    fireEvent.click(screen.getByText('Find My Stops'))

    await waitFor(() => {
      expect(screen.getByText(/No transit stops found/)).toBeInTheDocument()
    })
  })
})
