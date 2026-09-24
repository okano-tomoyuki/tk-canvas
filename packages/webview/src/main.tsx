import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { connectToHost } from './bridge.ts';
import { installShortcuts } from './shortcuts.ts';
import './style.css';

connectToHost();
installShortcuts();

const container = document.getElementById('root');
if (!container) throw new Error('#root が見つかりません');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
