// The stable surface the core offers extension modules (ADR-0003). An extension imports only this from the app, so the
// app can change inside without breaking it, and the core imports only an extension's manifest.
import type { ComponentType } from 'react';
import type { Progress } from '@wayfinder/engine';
import type { LogEvent } from '@wayfinder/schema';
import type { Settings } from './db';

export { Btn, SpeakBtn, Toggle } from './ui';
export { Guide, GUIDES, Koala } from './art';
export { log, saveModuleSettings, useModuleSettings, type Settings } from './db';
export { Finish } from './Session';
export { finishedCount } from './journey';
export { SaveMenu } from './CloudScreens';
export { sfx, stopSpeaking, useReading } from './media';

/** What a module's own screen gets from the core. `onBreak` goes to the lounge; `waits` names what he can carry on where he
 * stopped ("chapter 3"), and the lounge then says so and offers the way back to the module. */
export interface ScreenProps { settings: Settings; events: LogEvent[]; progress: Progress; onExit: () => void; onBreak: (why: 'break' | 'rapid', waits?: string) => void }

export interface ModuleManifest {
  id: string;
  /** content: skills on the core's item engine (reading). function: its own activity, on the core's settings, sync, event
   * log, journey and rewards (Today, math). */
  kind: 'content' | 'function';
  title: string;
  icon: string;
  /** Where its memory lives: none, this device only, or the family cloud copy too. */
  memory: 'none' | 'device' | 'cloud';
  /** It runs sessions: they count toward the day's budget and move the journey. */
  sessions?: boolean;
  /** Whether it shows, from its own settings document (for example, a grown-up turned it on). Missing: always. */
  enabled?: (own: Record<string, unknown>) => boolean;
  /** Its own screen, opened from the picker. */
  Screen?: ComponentType<ScreenProps>;
  /** A path on his island's home screen. */
  HomePath?: ComponentType<{ events: LogEvent[] }>;
  /** Its section in the grown-ups' Settings. */
  SettingsPanel?: ComponentType;
  /** Its section in the grown-ups' Content library. */
  Preview?: ComponentType;
  /** Its own tab in the grown-ups' area while it is on (LTF-44). */
  Report?: ComponentType<{ events: LogEvent[] }>;
}
