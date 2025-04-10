import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css';
//import './assets/base.css';
import App from './App.tsx'

// Forzar el tema claro de Bootstrap
document.documentElement.setAttribute('data-bs-theme', 'light');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
