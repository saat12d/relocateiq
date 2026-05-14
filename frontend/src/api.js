const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export async function fetchCommute({ origin, destination, departureTime }) {
  const body = { origin, destination }
  if (departureTime != null) body.departure_time = departureTime

  const res = await fetch(`${API_BASE_URL}/commute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const data = await res.json()
      if (data?.detail) detail = data.detail
    } catch {
      // body wasn't JSON; keep the HTTP status
    }
    throw new Error(detail)
  }

  return res.json()
}
