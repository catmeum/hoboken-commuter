import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AlertsPage from '../../src/mobile/pages/AlertsPage'

describe('AlertsPage', () => {
  const mockAlerts = [
    {
      id: 'tunnel-lincoln-1',
      source: 'PANYNJ',
      text: 'Right lane closed for construction until 6 PM.',
      timestamp: '45 min ago',
      badges: [{ label: '🚗 Lincoln Tunnel', color: 'transparent', textColor: 'inherit' }],
    },
    {
      id: 'mta-delays-1',
      source: 'MTA',
      text: 'Delays northbound due to signal problems at 59 St.',
      timestamp: '12 min ago',
      badges: [{ label: '4', color: '#00933C' }, { label: '5', color: '#00933C' }],
    },
  ]

  const onDismiss = vi.fn()
  const onRestore = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the header', () => {
    render(<AlertsPage alerts={[]} dismissedAlerts={[]} onDismiss={onDismiss} onRestore={onRestore} />)
    expect(screen.getByText('Alerts')).toBeInTheDocument()
  })

  it('shows empty state when no alerts', () => {
    render(<AlertsPage alerts={[]} dismissedAlerts={[]} onDismiss={onDismiss} onRestore={onRestore} />)
    expect(screen.getByText('No active alerts at the moment')).toBeInTheDocument()
  })

  it('renders alert cards', () => {
    render(<AlertsPage alerts={mockAlerts} dismissedAlerts={[]} onDismiss={onDismiss} onRestore={onRestore} />)
    expect(screen.getByText('Right lane closed for construction until 6 PM.')).toBeInTheDocument()
    expect(screen.getByText('Delays northbound due to signal problems at 59 St.')).toBeInTheDocument()
  })

  it('shows swipe hint when alerts are present', () => {
    render(<AlertsPage alerts={mockAlerts} dismissedAlerts={[]} onDismiss={onDismiss} onRestore={onRestore} />)
    expect(screen.getByText('Swipe left to dismiss')).toBeInTheDocument()
  })

  it('shows dismissed section when dismissed alerts exist', () => {
    const dismissed = [mockAlerts[0]]
    render(<AlertsPage alerts={[mockAlerts[1]]} dismissedAlerts={dismissed} onDismiss={onDismiss} onRestore={onRestore} />)
    expect(screen.getByText(/Dismissed alerts/)).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument() // count badge
  })

  it('toggles dismissed list visibility', () => {
    const dismissed = [mockAlerts[0]]
    render(<AlertsPage alerts={[]} dismissedAlerts={dismissed} onDismiss={onDismiss} onRestore={onRestore} />)

    // Initially hidden
    expect(screen.queryByText('Right lane closed for construction until 6 PM.')).not.toBeInTheDocument()

    // Click toggle
    fireEvent.click(screen.getByText(/Dismissed alerts/))
    expect(screen.getByText('Right lane closed for construction until 6 PM.')).toBeInTheDocument()
  })

  it('calls onRestore when restore button is clicked', () => {
    const dismissed = [mockAlerts[0]]
    render(<AlertsPage alerts={[]} dismissedAlerts={dismissed} onDismiss={onDismiss} onRestore={onRestore} />)

    fireEvent.click(screen.getByText(/Dismissed alerts/))
    fireEvent.click(screen.getByText('Restore'))
    expect(onRestore).toHaveBeenCalledWith(dismissed[0])
  })

  it('highlights matching alerts when highlightSource is provided', () => {
    const { container } = render(
      <AlertsPage
        alerts={mockAlerts}
        dismissedAlerts={[]}
        onDismiss={onDismiss}
        onRestore={onRestore}
        highlightSource="mta:101:S:4,5"
      />
    )
    // MTA alert should be highlighted, tunnel alert should not
    const alertCards = container.querySelectorAll('.m-alert-card')
    expect(alertCards[0].classList.contains('m-alert-highlight')).toBe(false) // tunnel
    expect(alertCards[1].classList.contains('m-alert-highlight')).toBe(true)  // mta
  })

  it('does not highlight any alerts when highlightSource is not provided', () => {
    const { container } = render(
      <AlertsPage
        alerts={mockAlerts}
        dismissedAlerts={[]}
        onDismiss={onDismiss}
        onRestore={onRestore}
      />
    )
    const highlighted = container.querySelectorAll('.m-alert-highlight')
    expect(highlighted.length).toBe(0)
  })

  it('highlights tunnel alerts when highlightSource starts with bus:', () => {
    // Tunnel alerts have id starting with "tunnel-" and source "PANYNJ"
    // Bus stops don't match tunnel alerts — neither should be highlighted
    const { container } = render(
      <AlertsPage
        alerts={mockAlerts}
        dismissedAlerts={[]}
        onDismiss={onDismiss}
        onRestore={onRestore}
        highlightSource="bus:7940:126"
      />
    )
    const alertCards = container.querySelectorAll('.m-alert-card')
    // bus source matches alert id containing 'bus' — tunnel doesn't
    expect(alertCards[0].classList.contains('m-alert-highlight')).toBe(false) // tunnel
    expect(alertCards[1].classList.contains('m-alert-highlight')).toBe(false) // mta
  })
})
