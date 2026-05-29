export default function TabBar({ activeTab, onTabChange, alertCount }) {
  const tabs = [
    { id: 'stops', icon: '◉', label: 'My Stops' },
    { id: 'alerts', icon: '△', label: 'Alerts' },
    { id: 'explore', icon: '◎', label: 'Explore' },
    { id: 'settings', icon: '≡', label: 'Settings' },
  ]

  return (
    <nav className="v2-tabbar">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`v2-tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          <span className="v2-tab-icon">{tab.icon}</span>
          {tab.id === 'alerts' && alertCount > 0 && (
            <span className="v2-tab-badge">{alertCount > 9 ? '9+' : alertCount}</span>
          )}
          <span className="v2-tab-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
