import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import OwlApp from './OwlApp.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>{new URLSearchParams(location.search).has('owl') ? <OwlApp /> : <App />}</StrictMode>,
);
