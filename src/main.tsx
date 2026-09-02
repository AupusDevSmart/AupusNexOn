import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/assets/globals.css';
// O mesmo CSS que o pacote publicava: o `index.ts` dele importava so este arquivo.
// `globals.css` puxa `design-system.css`, que nunca entrou no build da lib e nao
// compila (usa `@apply hover:bg-muted/50`, e os tokens de cor sao var() puro sem
// alpha). Era codigo morto; apontar para ele o ressuscitaria.
import '@/core/styles/design-minimal-components.css';
import '@/styles/design-minimal-components.css';

import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
