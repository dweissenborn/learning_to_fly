// Math for Learning to Fly, as a functional extension (ADR-0003): its own activity, on the core's settings, sync, event
// log, journey and rewards. The core knows only this manifest; everything else here is the module's own.
import type { ModuleManifest, ScreenProps } from '@wayfinder/web/host';
import { createElement } from 'react';
import { useModuleSettings } from '@wayfinder/web/host';
import type { MathSettings } from './settings';
import { MathPath } from './web/HomePath';
import { MathPreview } from './web/MathView';
import { MathSession } from './web/MathSession';
import { MathSettingsPanel } from './web/SettingsPanel';
import './math.css';

function MathScreen(p: ScreenProps) {
  const math = useModuleSettings<MathSettings>('math');
  return math ? createElement(MathSession, { ...p, math }) : null;
}

const math: ModuleManifest = {
  id: 'math', kind: 'function', title: 'Math', icon: '🧮', memory: 'cloud', sessions: true,
  enabled: (own) => !!(own as MathSettings).enabled,
  Screen: MathScreen, HomePath: MathPath, SettingsPanel: MathSettingsPanel, Preview: MathPreview,
};
export default math;
