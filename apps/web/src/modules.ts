// LTF-39 (ADR-0003): modules as add-ons. Reading and Today are built into the core; extensions such as math live in their
// own packages under modules/ and plug in here through their manifest only (see host.ts for what they may use).
import math from '@wayfinder/math';
import type { ModuleManifest } from './host';

/** A core module opens one of the app's own screens; an extension brings its Screen. */
export type ModuleDef = ModuleManifest & { screen?: 'session' | 'today' };
export const MODULES: readonly ModuleDef[] = [
  { id: 'reading', kind: 'content', title: 'Start reading', icon: '📖', memory: 'cloud', sessions: true, screen: 'session' },
  { id: 'today', kind: 'function', title: 'Tell about today', icon: '📅', memory: 'cloud', screen: 'today' },
  math,
];
