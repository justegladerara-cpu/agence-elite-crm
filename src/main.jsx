import './lib/gardeReseauActif'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './palantir.css'
import './palantir-base.css'
import './saas-premium.css'
import './crm3.css'
import App from './App.jsx'
import { initBrand } from './lib/theme'

// Logo, nom et couleurs choisis dans Paramètres (gardés sur l'appareil)
initBrand()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Mode hors ligne : enregistre le service worker (version en ligne uniquement)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}
