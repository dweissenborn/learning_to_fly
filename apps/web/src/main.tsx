import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/atkinson-hyperlegible-next/400.css';
import '@fontsource/atkinson-hyperlegible-next/700.css';
import '@fontsource/atkinson-hyperlegible-next/800.css';
import '@fontsource/lexend/400.css';
import '@fontsource/lexend/700.css';
import './styles.css';
import { App, Safe } from './App';
import { GearProvider } from './gear';

createRoot(document.getElementById('root')!).render(<StrictMode><Safe><GearProvider><App /></GearProvider></Safe></StrictMode>);
