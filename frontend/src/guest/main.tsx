import { Toast } from '@base-ui/react/toast'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { GuestApp } from './GuestApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Toast.Provider>
      <GuestApp />
    </Toast.Provider>
  </StrictMode>,
)
