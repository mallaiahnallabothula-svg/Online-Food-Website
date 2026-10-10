import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import MenuPreview from './MenuPreview.tsx';
import '../index.css';

// Standalone visual preview. No PWA registration, live checkout or API calls.
createRoot(document.getElementById('menu-preview-root')!).render(
  <StrictMode>
    <MenuPreview />
  </StrictMode>,
);
