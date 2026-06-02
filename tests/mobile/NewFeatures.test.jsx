import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SettingsPage from '../../src/mobile/pages/SettingsPage'
import AddStopPanel from '../../src/mobile/pages/AddStopPanel'

describe('Swipe-to-edit', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    theme: 'auto',
    setTheme: vi.fn(),
    tempUnit: 'F',
    setTempUnit: vi.fn(),
    weatherZip: '',
    setWeatherZip: vi.fn(),
    showWeather: true,
    setShowWeather: vi.fn(),
    showTunnels: false,
    setShowTunnels: vi.fn(),
    tunnels: [],
    setTunnels: vi.fn(),
    alertBadge: 'count',
    setAlertBadge: vi.fn(),
    alertStaleness: 'off',
    setAlertStaleness: vi.fn(),
    stops: ['mta:D17:S:B,D,F'],
    stopNames: { 'mta:D17:S:B,D,F': '47-50 Sts' },
    onRemoveStop: vi.fn(),
    onEditStop: vi.fn(),
    onOpenAddStop: vi.fn(),
    onReset: vi.fn(),
    onReorderStops: vi.fn(),
  }

  beforeEach(() => vi.clearAllMocks())

  it('calls onEditStop when edit background is tapped', () => {
    const { container } = render(<SettingsPage {...defaultProps} />)
    const editBg = container.querySelector('.m-set-stop-edit-bg')
    fireEvent.click(editBg)
    expect(defaultProps.onEditStop).toHaveBeenCalledWith('mta:D17:S:B,D,F')
  })
})

describe('Edit stop panel — rename', () => {
  const onClose = vi.fn()
  const onAdd = vi.fn()
  const onUpdate = vi.fn()

  beforeEach(() => vi.clearAllMocks())

  it('shows edit-name step when editingStop is provided', () => {
    render(
      <AddStopPanel
        open={true}
        onClose={onClose}
        onAdd={onAdd}
        editingStop={{ stopId: 'mta:D17:S:B,D,F', displayName: '47-50 Sts', hiddenBadges: [] }}
        onUpdate={onUpdate}
      />
    )
    expect(screen.getByText('Edit Stop')).toBeInTheDocument()
    expect(screen.getByDisplayValue('47-50 Sts')).toBeInTheDocument()
  })

  it('calls onUpdate with new name on save', () => {
    render(
      <AddStopPanel
        open={true}
        onClose={onClose}
        onAdd={onAdd}
        editingStop={{ stopId: 'mta:D17:S:B,D,F', displayName: '47-50 Sts', hiddenBadges: [] }}
        onUpdate={onUpdate}
      />
    )
    const input = screen.getByDisplayValue('47-50 Sts')
    fireEvent.change(input, { target: { value: 'Rockefeller Center' } })
    fireEvent.click(screen.getByText('Save'))
    expect(onUpdate).toHaveBeenCalledWith('mta:D17:S:B,D,F', 'mta:D17:S:B,D,F', 'Rockefeller Center', [])
  })

  it('shows badge toggle switch', () => {
    render(
      <AddStopPanel
        open={true}
        onClose={onClose}
        onAdd={onAdd}
        editingStop={{ stopId: 'mta:D17:S:B,D,F', displayName: '47-50 Sts', hiddenBadges: [] }}
        onUpdate={onUpdate}
      />
    )
    expect(screen.getByText('Show Line Badges')).toBeInTheDocument()
  })

  it('saves hidden badges when toggle is off', () => {
    render(
      <AddStopPanel
        open={true}
        onClose={onClose}
        onAdd={onAdd}
        editingStop={{ stopId: 'mta:D17:S:B,D,F', displayName: '47-50 Sts', hiddenBadges: [] }}
        onUpdate={onUpdate}
      />
    )
    // Toggle the switch off (it's currently on)
    const switches = screen.getAllByRole('button').filter(b => b.classList.contains('m-set-switch'))
    fireEvent.click(switches[0])
    fireEvent.click(screen.getByText('Save'))
    expect(onUpdate).toHaveBeenCalledWith('mta:D17:S:B,D,F', 'mta:D17:S:B,D,F', '47-50 Sts', ['__all__'])
  })
})

describe('Alert staleness setting', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    theme: 'auto',
    setTheme: vi.fn(),
    tempUnit: 'F',
    setTempUnit: vi.fn(),
    weatherZip: '',
    setWeatherZip: vi.fn(),
    showWeather: true,
    setShowWeather: vi.fn(),
    showTunnels: false,
    setShowTunnels: vi.fn(),
    tunnels: [],
    setTunnels: vi.fn(),
    alertBadge: 'count',
    setAlertBadge: vi.fn(),
    alertStaleness: 'off',
    setAlertStaleness: vi.fn(),
    stops: [],
    stopNames: {},
    onRemoveStop: vi.fn(),
    onEditStop: vi.fn(),
    onOpenAddStop: vi.fn(),
    onReset: vi.fn(),
    onReorderStops: vi.fn(),
  }

  beforeEach(() => vi.clearAllMocks())

  it('renders alert staleness setting', () => {
    render(<SettingsPage {...defaultProps} />)
    expect(screen.getByText('Hide Old Alerts')).toBeInTheDocument()
    expect(screen.getByText('Off')).toBeInTheDocument()
  })

  it('cycles through staleness options', () => {
    render(<SettingsPage {...defaultProps} alertStaleness="off" />)
    fireEvent.click(screen.getByText('Off'))
    expect(defaultProps.setAlertStaleness).toHaveBeenCalledWith('30')
  })

  it('cycles from 720 back to off', () => {
    render(<SettingsPage {...defaultProps} alertStaleness="720" />)
    fireEvent.click(screen.getByText('12 hours'))
    expect(defaultProps.setAlertStaleness).toHaveBeenCalledWith('off')
  })
})

describe('Weather zip code', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    theme: 'auto',
    setTheme: vi.fn(),
    tempUnit: 'F',
    setTempUnit: vi.fn(),
    weatherZip: '',
    setWeatherZip: vi.fn(),
    showWeather: true,
    setShowWeather: vi.fn(),
    showTunnels: false,
    setShowTunnels: vi.fn(),
    tunnels: [],
    setTunnels: vi.fn(),
    alertBadge: 'count',
    setAlertBadge: vi.fn(),
    alertStaleness: 'off',
    setAlertStaleness: vi.fn(),
    stops: [],
    stopNames: {},
    onRemoveStop: vi.fn(),
    onEditStop: vi.fn(),
    onOpenAddStop: vi.fn(),
    onReset: vi.fn(),
    onReorderStops: vi.fn(),
  }

  beforeEach(() => vi.clearAllMocks())

  it('shows zip input with placeholder', () => {
    render(<SettingsPage {...defaultProps} />)
    expect(screen.getByPlaceholderText('Zip')).toBeInTheDocument()
  })

  it('shows confirm button when valid zip typed', () => {
    render(<SettingsPage {...defaultProps} />)
    const input = screen.getByPlaceholderText('Zip')
    fireEvent.change(input, { target: { value: '10001' } })
    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('does not show confirm for invalid zip', () => {
    render(<SettingsPage {...defaultProps} />)
    const input = screen.getByPlaceholderText('Zip')
    fireEvent.change(input, { target: { value: '123' } })
    expect(screen.queryByText('✓')).not.toBeInTheDocument()
  })

  it('calls setWeatherZip when confirm clicked', () => {
    render(<SettingsPage {...defaultProps} />)
    const input = screen.getByPlaceholderText('Zip')
    fireEvent.change(input, { target: { value: '07030' } })
    fireEvent.click(screen.getByText('✓'))
    expect(defaultProps.setWeatherZip).toHaveBeenCalledWith('07030')
  })

  it('shows reset button when zip is set', () => {
    render(<SettingsPage {...defaultProps} weatherZip="10001" />)
    expect(screen.getByText('Use auto-location')).toBeInTheDocument()
  })

  it('clears zip when reset clicked', () => {
    render(<SettingsPage {...defaultProps} weatherZip="10001" />)
    fireEvent.click(screen.getByText('Use auto-location'))
    expect(defaultProps.setWeatherZip).toHaveBeenCalledWith('')
  })

  it('clears input on focus for easier re-entry', () => {
    render(<SettingsPage {...defaultProps} weatherZip="10001" />)
    const input = screen.getByDisplayValue('10001')
    fireEvent.focus(input)
    expect(input.value).toBe('')
  })
})

describe('Drag to reorder', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    theme: 'auto',
    setTheme: vi.fn(),
    tempUnit: 'F',
    setTempUnit: vi.fn(),
    weatherZip: '',
    setWeatherZip: vi.fn(),
    showWeather: false,
    setShowWeather: vi.fn(),
    showTunnels: false,
    setShowTunnels: vi.fn(),
    tunnels: [],
    setTunnels: vi.fn(),
    alertBadge: 'count',
    setAlertBadge: vi.fn(),
    alertStaleness: 'off',
    setAlertStaleness: vi.fn(),
    stops: ['stop:a', 'stop:b', 'stop:c'],
    stopNames: { 'stop:a': 'Stop A', 'stop:b': 'Stop B', 'stop:c': 'Stop C' },
    onRemoveStop: vi.fn(),
    onEditStop: vi.fn(),
    onOpenAddStop: vi.fn(),
    onReset: vi.fn(),
    onReorderStops: vi.fn(),
  }

  beforeEach(() => vi.clearAllMocks())

  it('renders grip handles for each stop', () => {
    const { container } = render(<SettingsPage {...defaultProps} />)
    const grips = container.querySelectorAll('.m-set-grip')
    expect(grips.length).toBe(3)
  })

  it('renders stops in order', () => {
    render(<SettingsPage {...defaultProps} />)
    const names = screen.getAllByText(/Stop [ABC]/)
    expect(names[0]).toHaveTextContent('Stop A')
    expect(names[1]).toHaveTextContent('Stop B')
    expect(names[2]).toHaveTextContent('Stop C')
  })
})
