import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

import './App.css'
import App from './App.jsx'
import { I18nProvider } from './i18n/I18nContext.jsx'
import SinPuente from './components/movil/SinPuente.jsx'

import { instalarApiWeb } from './api-web.js'
import { instalarViajeEnSegundoPlano } from './viajeEnSegundoPlano.js'

instalarApiWeb().catch(() => {}).finally(() => {
  instalarViajeEnSegundoPlano()
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      {window.api ? (
        <I18nProvider>
          <App />
        </I18nProvider>
      ) : <SinPuente />}
    </StrictMode>,
  )
})
