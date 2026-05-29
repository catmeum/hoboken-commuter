import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AppV2 from './v2/AppV2.jsx'

const isV2 = window.location.pathname.startsWith('/v2')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isV2 ? <AppV2 /> : <App />}
  </StrictMode>,
)
