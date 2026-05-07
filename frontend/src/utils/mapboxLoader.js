let mapboxPromise

export function loadMapboxGL() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Mapbox GL can only load in the browser.'))
  }

  if (window.mapboxgl) return Promise.resolve(window.mapboxgl)
  if (mapboxPromise) return mapboxPromise

  mapboxPromise = Promise.all([loadMapboxCSS(), loadMapboxScript()]).then(([, mapboxgl]) => mapboxgl)

  return mapboxPromise
}

function loadMapboxCSS() {
  const existingCss = document.querySelector('link[data-mapbox-gl]')
  if (existingCss?.dataset.loaded === 'true' || existingCss?.sheet) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const css = existingCss || document.createElement('link')
    css.rel = 'stylesheet'
    css.href = 'https://api.mapbox.com/mapbox-gl-js/v3.20.0/mapbox-gl.css'
    css.dataset.mapboxGl = 'true'
    css.addEventListener('load', () => {
      css.dataset.loaded = 'true'
      resolve()
    }, { once: true })
    css.addEventListener('error', () => reject(new Error('Could not load Mapbox GL CSS.')), { once: true })

    if (!existingCss) document.head.appendChild(css)
  })
}

function loadMapboxScript() {
  const existingScript = document.querySelector('script[data-mapbox-gl]')
  if (window.mapboxgl) return Promise.resolve(window.mapboxgl)

  return new Promise((resolve, reject) => {
    const script = existingScript || document.createElement('script')
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.20.0/mapbox-gl.js'
    script.async = true
    script.dataset.mapboxGl = 'true'
    script.addEventListener('load', () => resolve(window.mapboxgl), { once: true })
    script.addEventListener('error', () => reject(new Error('Could not load Mapbox GL JS.')), { once: true })

    if (!existingScript) document.body.appendChild(script)
  })
}
