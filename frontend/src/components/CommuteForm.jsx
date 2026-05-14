import { useState } from 'react'
import { fetchCommute } from '../api'
import './CommuteForm.css'

function formatDuration(seconds) {
  if (seconds == null) return null
  const mins = Math.round(seconds / 60)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

export default function CommuteForm() {
  const [origin, setOrigin] = useState('UCLA, Los Angeles, CA')
  const [destination, setDestination] = useState('Santa Monica, CA')
  const [useTraffic, setUseTraffic] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const onSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const departureTime = useTraffic
        ? Math.floor(Date.now() / 1000) + 86400 // ~24h from now
        : null
      const data = await fetchCommute({ origin, destination, departureTime })
      setResult(data)
    } catch (err) {
      setError(err.message ?? 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  const trafficDuration = formatDuration(result?.duration_in_traffic_seconds)
  const freeFlowDuration = formatDuration(result?.duration_seconds)

  return (
    <section className="commute">
      <h2>Estimate a commute</h2>
      <form className="commute-form" onSubmit={onSubmit}>
        <label>
          <span>Origin</span>
          <input
            type="text"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="Address or place name"
            required
          />
        </label>
        <label>
          <span>Destination</span>
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Address or place name"
            required
          />
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={useTraffic}
            onChange={(e) => setUseTraffic(e.target.checked)}
          />
          <span>Traffic-aware (predicted ~24h ahead)</span>
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Loading…' : 'Get commute'}
        </button>
      </form>

      {error && <p className="commute-error">Error: {error}</p>}

      {result && (
        <div className="commute-result">
          <div className="route">
            <span>{result.origin_address}</span>
            <span className="arrow">→</span>
            <span>{result.destination_address}</span>
          </div>
          <dl className="stats">
            <div>
              <dt>Distance</dt>
              <dd>{result.distance_text}</dd>
            </div>
            <div>
              <dt>Drive time</dt>
              <dd>{freeFlowDuration}</dd>
            </div>
            {trafficDuration && (
              <div>
                <dt>With traffic</dt>
                <dd>{trafficDuration}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </section>
  )
}
