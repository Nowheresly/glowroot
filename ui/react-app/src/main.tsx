import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppRouter } from './routes/Router'
import { applyStoredTheme } from './lib/theme'
import './index.css'

applyStoredTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>,
)
