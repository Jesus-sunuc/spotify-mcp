import { Toast } from '@base-ui/react/toast'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Toast.Provider>
      <App />
    </Toast.Provider>
  </StrictMode>,
)
