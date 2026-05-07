import { useState } from 'react'
import './App.css'
import Legend from './components/Legend.jsx'
import MapView from './components/MapView.jsx'
import TopBar from './components/TopBar.jsx'

function App() {
  const [mode, setMode] = useState('drive')
  const [liveTraffic, setLiveTraffic] = useState(false)

  return (
    <main className="relocate-app">
      <div className="app-frame">
        <MapView mode={mode} liveTraffic={liveTraffic} />
        <TopBar
          mode={mode}
          setMode={setMode}
          liveTraffic={liveTraffic}
          setLiveTraffic={setLiveTraffic}
        />
        <Legend />
      </div>
    </main>
  )
}

export default App
