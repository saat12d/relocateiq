import './App.css'
import CommuteForm from './components/CommuteForm'

function App() {
  return (
    <main className="app">
      <header className="app-header">
        <h1>RelocateIQ</h1>
        <p className="tagline">Smarter relocation by commute.</p>
      </header>
      <CommuteForm />
    </main>
  )
}

export default App
