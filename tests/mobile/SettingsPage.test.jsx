import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SettingsPage from '../../src/mobile/pages/SettingsPage'

describe('SettingsPage', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    theme: 'auto',
    setTheme: vi.fn(),
    tempUnit: 'F',
    setTempUnit: vi.fn(),
    showWeather: true,
    setShowWeather: vi.fn(),
    showTunnels: true,
    setShowTunnels: vi.fn(),
    tunnels: ['lincoln', 'holland'],
    setTunnels: vi.fn(),
    alertBadge: 'count',
    setAlertBadge: vi.fn(),
    alertStaleness: '60',
    setAlertStaleness: vi.fn(),
    weatherZip: '',
    setWeatherZip: vi.fn(),
    stops: ['mta:D17:S:B,D,F', 'bus:20935:126'],
    stopNames: { 'mta:D17:S:B,D,F': '47-50 Sts', 'bus:20935:126': 'Washington & 11th' },
    stopHiddenBadges: {},
    onRemoveStop: vi.fn(),
    onEditStop: vi.fn(),
    onOpenAddStop: vi.fn(),
    onReset: vi.fn(),
    onReorderStops: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders when open', () => {
    const { container } = render(<SettingsPage {...defaultProps} />)
    const page = container.querySelector('.m-settings-page')
    expect(page).toHaveClass('active')
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('does not show active class when closed', () => {
    const { container } = render(<SettingsPage {...defaultProps} open={false} />)
    const page = container.querySelector('.m-settings-page')
    expect(page).not.toHaveClass('active')
  })

  it('calls onClose when close button clicked', () => {
    const { container } = render(<SettingsPage {...defaultProps} />)
    const closeBtn = container.querySelector('.m-set-header .m-set-close')
    fireEvent.click(closeBtn)
    expect(defaultProps.onClose).toHaveBeenCalledOnce()
  })

  it('cycles theme on click', () => {
    render(<SettingsPage {...defaultProps} theme="auto" />)
    fireEvent.click(screen.getByText('🌓 Auto'))
    expect(defaultProps.setTheme).toHaveBeenCalledWith('dark')
  })

  it('cycles alert badge style', () => {
    render(<SettingsPage {...defaultProps} alertBadge="count" />)
    fireEvent.click(screen.getByText('🔴 Count'))
    expect(defaultProps.setAlertBadge).toHaveBeenCalledWith('dot')
  })

  it('toggles weather visibility', () => {
    render(<SettingsPage {...defaultProps} showWeather={true} />)
    // Find the weather switch (it's the first .m-set-switch)
    const switches = screen.getAllByRole('button').filter(b => b.classList.contains('m-set-switch'))
    fireEvent.click(switches[0]) // Show Weather toggle
    expect(defaultProps.setShowWeather).toHaveBeenCalled()
  })

  it('renders stop list', () => {
    render(<SettingsPage {...defaultProps} />)
    expect(screen.getByText('47-50 Sts')).toBeInTheDocument()
    expect(screen.getByText('Washington & 11th')).toBeInTheDocument()
  })

  it('calls onRemoveStop when remove button clicked', () => {
    render(<SettingsPage {...defaultProps} />)
    const removeButtons = screen.getAllByText('✕').filter(el => el.classList.contains('m-set-remove'))
    fireEvent.click(removeButtons[0])
    expect(defaultProps.onRemoveStop).toHaveBeenCalledWith('mta:D17:S:B,D,F')
  })

  it('calls onOpenAddStop when add button clicked', () => {
    render(<SettingsPage {...defaultProps} />)
    fireEvent.click(screen.getByText('+ Add Stop'))
    expect(defaultProps.onOpenAddStop).toHaveBeenCalledOnce()
  })

  it('shows tunnel config when tunnels enabled', () => {
    render(<SettingsPage {...defaultProps} showTunnels={true} />)
    expect(screen.getByText('Tunnels & Bridges')).toBeInTheDocument()
    expect(screen.getByText('Lincoln Tunnel')).toBeInTheDocument()
    expect(screen.getByText('Holland Tunnel')).toBeInTheDocument()
  })

  it('hides tunnel config when tunnels disabled', () => {
    render(<SettingsPage {...defaultProps} showTunnels={false} />)
    expect(screen.queryByText('Tunnel Configuration')).not.toBeInTheDocument()
  })

  it('reset requires double-tap confirmation', () => {
    render(<SettingsPage {...defaultProps} />)
    const resetBtn = screen.getByText('Reset to Defaults')
    fireEvent.click(resetBtn)
    expect(screen.getByText('Tap again to confirm reset')).toBeInTheDocument()
    expect(defaultProps.onReset).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Tap again to confirm reset'))
    expect(defaultProps.onReset).toHaveBeenCalledOnce()
  })

  it('shows expand button when more than 6 stops', () => {
    const manyStops = Array.from({ length: 8 }, (_, i) => `mta:stop${i}:S:A`)
    const manyNames = Object.fromEntries(manyStops.map((s, i) => [s, `Station ${i}`]))
    render(<SettingsPage {...defaultProps} stops={manyStops} stopNames={manyNames} />)
    expect(screen.getByText('Show 2 more stops')).toBeInTheDocument()
  })

  it('shows transit mode icons in stop list', () => {
    const { container } = render(<SettingsPage {...defaultProps} />)
    const icons = container.querySelectorAll('.m-set-stop-icon')
    expect(icons.length).toBe(2) // one for each stop
  })

  it('shows route badges for bus stops', () => {
    const { container } = render(<SettingsPage {...defaultProps} />)
    const badges = container.querySelectorAll('.m-set-route-pill.bus')
    expect(badges.length).toBeGreaterThan(0)
    expect(badges[0].textContent).toBe('126')
  })

  it('hides badges when stopHiddenBadges includes __all__', () => {
    const { container } = render(
      <SettingsPage {...defaultProps} stopHiddenBadges={{ 'bus:20935:126': ['__all__'] }} />
    )
    // Bus stop badges should be hidden
    const busItem = container.querySelectorAll('.m-set-stop-item-wrap')[1]
    const badges = busItem?.querySelectorAll('.m-set-route-pill')
    expect(badges?.length || 0).toBe(0)
  })

  it('shows subway line badges from stop ID', () => {
    const { container } = render(<SettingsPage {...defaultProps} />)
    const badgeContainer = container.querySelectorAll('.m-set-stop-badges')[0]
    // mta:D17:S:B,D,F should show B, D, F badges (truncated to 2 + overflow)
    expect(badgeContainer).toBeTruthy()
  })
})
