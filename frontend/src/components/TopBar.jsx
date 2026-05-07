import Icon from './Icon.jsx'

export default function TopBar({ mode, setMode, liveTraffic, setLiveTraffic }) {
  return (
    <header className="top-bar" aria-label="RelocateIQ navigation">
      <div className="brand-lockup">
        <div className="brand-mark">
          <Icon name="plus" size={18} />
        </div>
        <span>RelocateIQ</span>
      </div>

      <div className="top-controls" aria-label="Commute controls">
        <div className="segmented-toggle compact" role="tablist" aria-label="Commute mode">
          <button
            className={mode === 'drive' ? 'active' : ''}
            type="button"
            onClick={() => setMode('drive')}
          >
            Drive
          </button>
          <button
            className={mode === 'transit' ? 'active' : ''}
            type="button"
            onClick={() => setMode('transit')}
          >
            Transit
          </button>
        </div>

        <button
          className={`traffic-toggle ${liveTraffic ? 'enabled' : ''}`}
          type="button"
          aria-pressed={liveTraffic}
          onClick={() => setLiveTraffic((value) => !value)}
        >
          <span className="switch-track"><span className="switch-thumb" /></span>
          <span>Live<br />traffic</span>
        </button>
      </div>
    </header>
  )
}
