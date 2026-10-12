// Progress stays on this device: an append-only event log, a notes store with retention limits, and settings.
import Dexie, { type EntityTable } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import type { LogEvent, Topic } from '@wayfinder/schema';
import { derive, JOURNEY_START, type GateOverride, type JourneyAnchor } from '@wayfinder/engine';

export type GuideId = 'bolt' | 'rook' | 'moss';
export interface Settings {
  onboarded: boolean;
  name: string;
  guide: GuideId;
  interests: Topic[];
  pin: string;
  theme: 'auto' | 'light' | 'dark' | 'calm' | 'contrast';
  size: 1 | 2 | 3 | 4;
  font: 'atkinson' | 'lexend' | 'system';
  spacing: 'normal' | 'wide';
  motion: 'auto' | 'full' | 'reduced' | 'off';
  sound: boolean;
  readAloud: boolean;
  pictures: boolean;
  voice: string;
  rate: number;
  rewardPace: 'item' | 'step' | 'session';
  yourTurn: 3 | 4 | 5;
  hintDelay: number;
  gate: GateOverride;
  hardThemes: boolean;
  hidden: string[];
  timetable: Record<string, string[]>;
  people: string[];
  todayStage: 0 | 1 | 2 | 3 | 4;
  /** Finished sessions per leg of the journey (3, 5 or 7). */
  legLength: 3 | 5 | 7;
  /** Story setbacks on the journey: storms, blocked paths, broken parts. */
  setbacks: boolean;
  /** The plan he picked at each obstacle, by stop id. */
  journeyChoices: Record<string, number>;
  /** Where he was when the pace last changed. */
  journeyAnchor: JourneyAnchor;
  /** Results of the first half of placement, kept so the scouting trip can be finished later. */
  scout?: { word: number; reading: number; listening: number };
}

export const DEFAULTS: Settings = {
  onboarded: false, name: '', guide: 'bolt', interests: [], pin: '',
  theme: 'auto', size: 2, font: 'atkinson', spacing: 'normal', motion: 'auto', sound: true,
  readAloud: false, pictures: true, voice: '', rate: 0.9,
  rewardPace: 'item', yourTurn: 4, hintDelay: 8, gate: 'auto', hardThemes: false, hidden: [],
  timetable: {}, people: [], todayStage: 0,
  legLength: 5, setbacks: true, journeyChoices: {}, journeyAnchor: JOURNEY_START,
};

export interface Note {
  id: string;
  ts: number;
  kind: 'recount' | 'answer';
  /** About the learner's own life: shown to the adult, kept 30 days unless saved. */
  personal: boolean;
  item?: string;
  title?: string;
  text: string;
  ask?: string[];
  saved?: boolean;
}

class DB extends Dexie {
  events!: EntityTable<LogEvent, 'id'>;
  notes!: EntityTable<Note, 'id'>;
  kv!: EntityTable<{ key: string; value: unknown }, 'key'>;
  constructor() {
    super('wayfinder'); // internal name from before the app was called Learning to Fly; renaming it would orphan saved progress
    this.version(1).stores({ events: 'id, ts, type', notes: 'id, ts', kv: 'key' });
  }
}
export const db = new DB();

type NewEvent = LogEvent extends infer E ? (E extends LogEvent ? Omit<E, 'id' | 'ts'> : never) : never;
export const log = (e: NewEvent) => db.events.add({ ...e, id: crypto.randomUUID(), ts: Date.now() } as LogEvent);
export const addNote = (n: Omit<Note, 'id' | 'ts'>) => db.notes.add({ ...n, id: crypto.randomUUID(), ts: Date.now() });
export const saveSettings = async (patch: Partial<Settings>) => {
  const cur = ((await db.kv.get('settings'))?.value ?? {}) as Partial<Settings>;
  await db.kv.put({ key: 'settings', value: { ...cur, ...patch } });
};

/** Retention from the plan: open-answer text 90 days, personal text 30 days, unless an adult saved it. */
export async function applyRetention(now = Date.now()) {
  const day = 86_400_000;
  await db.notes.filter((n) => !n.saved && now - n.ts > (n.personal ? 30 : 90) * day).delete();
}

export function useSettings(): Settings | undefined {
  const row = useLiveQuery(async () => (await db.kv.get('settings')) ?? null, []); // null: no settings yet; undefined: still loading
  return useMemo(() => (row === undefined ? undefined : { ...DEFAULTS, ...((row?.value ?? {}) as Partial<Settings>) }), [row]);
}
export const useEvents = () => useLiveQuery(() => db.events.orderBy('ts').toArray(), [], undefined);
export function useProgress(events: LogEvent[] | undefined) {
  return useMemo(() => derive(events ?? []), [events]);
}
export const useNotes = () => useLiveQuery(() => db.notes.orderBy('ts').reverse().toArray(), [], [] as Note[]);

export async function exportAll() {
  return { app: 'wayfinder', version: 1, exported: new Date().toISOString(), events: await db.events.toArray(), notes: await db.notes.toArray(), settings: (await db.kv.get('settings'))?.value ?? {} };
}
export async function importAll(data: { app?: string; events?: LogEvent[]; notes?: Note[]; settings?: Partial<Settings> }) {
  if (data.app !== 'wayfinder' || !Array.isArray(data.events)) throw new Error('This file is not a Learning to Fly export.');
  await db.transaction('rw', db.events, db.notes, db.kv, async () => {
    await db.events.bulkPut(data.events!);
    if (Array.isArray(data.notes)) await db.notes.bulkPut(data.notes);
    if (data.settings) await db.kv.put({ key: 'settings', value: { ...DEFAULTS, ...data.settings } });
  });
}
export const wipeAll = () => db.transaction('rw', db.events, db.notes, db.kv, async () => {
  await db.events.clear(); await db.notes.clear(); await db.kv.clear();
});
