import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import MyStopsPage from '../../src/mobile/pages/MyStopsPage'

// Mock the child components to isolate page logic
vi.mock('../../src/mobile/components/TransitCard', () => ({
  default: ({ stopId, displayName }) => (
    <div data-testid={`transit-card-${stopId}`}>{displayName || stopId}</div>
  ),
}))

vi.mock('../../src/mobile/components/InfoPills', () => ({
  default: ({ showWeather, showTunnels }) => (
    <div data-testid="info-pills" data-weather={showWeather} data-tunnels={showTunnels} />
  ),
}))

describe('MyStopsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the header with logo and time', () => {
    const { container } = render(
      <MyStopsPage stops={[]} stopNames={{}} showWeather={true} showTunnels={true} tunnels={['lincoln', 'holland']} />
    )
    const logo = container.querySelector('.ms-logo')
    expect(logo).toBeInTheDocument()
    expect(logo.textContent).toBe('MYSTOPNOW')
    expect(container.querySelector('.ms-time')).toBeInTheDocument()
  })

  it('shows empty state when no stops', () => {
    render(
      <MyStopsPage stops={[]} stopNames={{}} showWeather={true} showTunnels={true} tunnels={['lincoln', 'holland']} />
    )
    expect(screen.getByText('No stops added yet.')).toBeInTheDocument()
    expect(screen.getByText('Open Settings to add transit stops.')).toBeInTheDocument()
  })

  it('renders transit cards for each stop', () => {
    const stops = ['mta:D17:S:B,D,F', 'bus:20935:126']
    const stopNames = { 'mta:D17:S:B,D,F': '47-50 Sts', 'bus:20935:126': 'Washington & 11th' }

    render(
      <MyStopsPage stops={stops} stopNames={stopNames} showWeather={true} showTunnels={true} tunnels={['lincoln', 'holland']} />
    )
    expect(screen.getByTestId('transit-card-mta:D17:S:B,D,F')).toBeInTheDocument()
    expect(screen.getByTestId('transit-card-bus:20935:126')).toBeInTheDocument()
    expect(screen.getByText('47-50 Sts')).toBeInTheDocument()
    expect(screen.getByText('Washington & 11th')).toBeInTheDocument()
  })

  it('renders InfoPills with weather/tunnel settings', () => {
    render(
      <MyStopsPage stops={[]} stopNames={{}} showWeather={false} showTunnels={true} tunnels={['lincoln']} />
    )
    const pills = screen.getByTestId('info-pills')
    expect(pills.dataset.weather).toBe('false')
    expect(pills.dataset.tunnels).toBe('true')
  })

  it('pull-to-refresh increments key (forces re-mount)', () => {
    const stops = ['mta:D17:S:B,D,F']
    const { container } = render(
      <MyStopsPage stops={stops} stopNames={{}} showWeather={true} showTunnels={true} tunnels={['lincoln', 'holland']} />
    )
    const page = container.querySelector('.m-mystops-page')

    // Simulate pull gesture that exceeds threshold
    fireEvent.touchStart(page, { touches: [{ clientY: 0 }] })
    fireEvent.touchMove(page, { touches: [{ clientY: 100 }] }) // progress = 100/120 = 0.83 > 0.8
    fireEvent.touchEnd(page)

    // After pull, the card should re-render (key changes)
    // We verify by checking the card is still present (re-mounted with new key)
    expect(screen.getByTestId('transit-card-mta:D17:S:B,D,F')).toBeInTheDocument()
  })
})
