import Icon from './Icon.jsx'

const commuteStress = {
  light: '#6fa866',
  moderate: '#f2a83b',
  heavy: '#d7523c',
}

export default function Legend() {
  return (
    <aside className="map-legend" aria-label="Map legend">
      <LegendLine color={commuteStress.light} label="Light (<20 min)" />
      <LegendLine color={commuteStress.moderate} label="Moderate (20-35 min)" />
      <LegendLine color={commuteStress.heavy} label="Heavy (35+ min)" />
      <LegendIcon icon="building" label="Workplace" />
      <LegendIcon icon="transit" label="Transit Stop" />
      <LegendLine color="#a9aaa8" label="Highway" />
      <LegendLine color="#d4c9b8" label="Surface Street" thin />
      <LegendDot className="walkable" label="Walkable Area" />
      <LegendDot className="park" label="Park" />
      <LegendDot className="water" label="Water" />
    </aside>
  )
}

function LegendLine({ color, label, thin = false }) {
  return (
    <div className="legend-item">
      <span className={`legend-line ${thin ? 'thin' : ''}`} style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  )
}

function LegendIcon({ icon, label }) {
  return (
    <div className="legend-item icon-item">
      <span className="legend-icon"><Icon name={icon} size={18} /></span>
      <span>{label}</span>
    </div>
  )
}

function LegendDot({ className, label }) {
  return (
    <div className="legend-item">
      <span className={`legend-dot ${className}`} />
      <span>{label}</span>
    </div>
  )
}
