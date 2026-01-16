import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

import './index.css'                // <--- 1. Tailwind styles
import 'leaflet/dist/leaflet.css'   // <--- 2. Map styles

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)