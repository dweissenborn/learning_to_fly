// Progress lives on this device: an append-only event log, a notes store with retention limits, and settings.
// Every local change is also listed in an outbox, which cloud.ts sends to the family cloud copy when one is linked.
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
  /** Show the clue at once on a new skill's first guided item (LTF-01). */
  clueFirst: boolean;
  /** LTF-03: who's who dots under pronouns. */
  whosWho?: 'auto' | 'help' | 'off';
  /** LTF-03: names in place of he, she, it and they in level 1 texts (never in N4, which teaches them). */
  namesLevel1?: boolean;
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
  /** One flawless session (with a new format and a level 3+ text) can master a skill; reviews still check it. */
  fastTrack: boolean;
  /** The calm-down words his school uses, shown with the journey's setbacks so home and school sound the same. */
  resetWords: string;
  /** How many flight-kit pieces he has already been shown, so each one is celebrated once, on any device. */
  kitSeen?: number;
  /** Results of the first half of placement, kept so the scouting trip can be finished later. */
  scout?: { word: number; reading: number; listening: number; grammar?: number };
  /** LTF-20: the island he chose at each fork, and when. */
  routes?: Record<string, { to: string; at: number }>;
  /** LTF-20: forks already checked once for learners who were past them when the routes arrived. */
  forksSeen?: string[];
  /** LTF-30: the koala keeper arc's start was checked once; and where it is anchored after a pace change (in sessions after the eighth koala). */
  arcSeen?: boolean;
  arcAnchor?: { at: number; stop: number; step: number; after: number };
  /** LTF-27: the way home, once he chose it after Opening Day: when (finished sessions), the island he picked on the way, and
   * where it is anchored after a choice or a pace change (in sessions since he set off). */
  homeTrip?: { at: number; island?: string; anchor?: { at: number; stop: number; step: number; after: number } };
  /** LTF-27: he chose to stay at the sanctuary for now; the offer stays open. */
  homeStayed?: boolean;
  /** LTF-39: the module he chose last, marked on the picker so one tap starts it. */
  lastModule?: string;
  /** LTF-39: sessions a day across every subject together; unset or 0 is no limit. */
  perDay?: number;
  /** LTF-36: finished sessions when he first came ashore on each island; its areas open with the sessions after that. */
  islandsSeen?: Record<string, number>;
  /** LTF-38: notice answers faster than reading, set them aside, and stop kindly after two in a row. On unless a grown-up turns it off. */
  guessCheck?: boolean;
  /** LTF-38: end sessions on his next first-tap success after this many minutes. Off when unset. */
  endAt?: number;
}

export const DEFAULTS: Settings = {
  onboarded: false, name: '', guide: 'bolt', interests: [], pin: '',
  theme: 'auto', size: 2, font: 'atkinson', spacing: 'normal', motion: 'auto', sound: true,
  readAloud: false, pictures: true, voice: '', rate: 0.9,
  rewardPace: 'item', yourTurn: 4, hintDelay: 8, clueFirst: true, gate: 'auto', hardThemes: false, hidden: [],
  timetable: {}, people: [], todayStage: 0,
  legLength: 5, setbacks: true, journeyChoices: {}, journeyAnchor: JOURNEY_START, fastTrack: true, resetWords: '',
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

/** One local database per learner on this device. 'wayfinder' is the first one, named before the app was called Learning to Fly. */
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private window: one learner only */ } },
};
export const currentDb = () => store.get('ltf.db') ?? 'wayfinder';
/** Which local database holds each cloud learner. */
export const learnerDbs = (): Record<string, string> => { try { return JSON.parse(store.get('ltf.dbs') ?? '{}'); } catch { return {}; } };
export const rememberDb = (learner: string, name = currentDb()) => store.set('ltf.dbs', JSON.stringify({ ...learnerDbs(), [learner]: name }));
export const forgetDb = (name = currentDb()) => store.set('ltf.dbs', JSON.stringify(Object.fromEntries(Object.entries(learnerDbs()).filter(([, n]) => n !== name))));
/** Open another learner's database. The page reloads so every screen starts clean. */
export const switchDb = (name: string) => { store.set('ltf.db', name); location.reload(); };

export class DB extends Dexie {
  events!: EntityTable<LogEvent, 'id'>;
  notes!: EntityTable<Note, 'id'>;
  kv!: EntityTable<{ key: string; value: unknown }, 'key'>;
  /** Local changes not yet in the cloud copy: 'event:<id>', 'note:<id>' or 'settings'. v changes on every edit. */
  outbox!: EntityTable<{ key: string; v: string }, 'key'>;
  constructor(name = currentDb()) {
    super(name);
    this.version(1).stores({ events: 'id, ts, type', notes: 'id, ts', kv: 'key' });
    this.version(2).stores({ outbox: 'key' });
  }
}
export const db = new DB();

const mark = (keys: string[]) => db.outbox.bulkPut(keys.map((key) => ({ key, v: crypto.randomUUID() })));
type NewEvent = LogEvent extends infer E ? (E extends LogEvent ? Omit<E, 'id' | 'ts'> : never) : never;
export const log = (e: NewEvent) => db.transaction('rw', db.events, db.outbox, async () => {
  const id = await db.events.add({ ...e, id: crypto.randomUUID(), ts: Date.now() } as LogEvent);
  await mark([`event:${id}`]);
});
export const addNote = (n: Omit<Note, 'id' | 'ts'>) => db.transaction('rw', db.notes, db.outbox, async () => {
  const id = await db.notes.add({ ...n, id: crypto.randomUUID(), ts: Date.now() });
  await mark([`note:${id}`]);
});
export const updateNote = (id: string, patch: Partial<Note>) => db.transaction('rw', db.notes, db.outbox, async () => { await db.notes.update(id, patch); await mark([`note:${id}`]); });
export const deleteNote = (id: string) => db.transaction('rw', db.notes, db.outbox, async () => { await db.notes.delete(id); await mark([`note:${id}`]); });
export const saveModuleSettings = (module: string, patch: Record<string, unknown>) => db.transaction('rw', db.kv, db.outbox, async () => {
  const key = `settings:${module}`;
  const cur = ((await db.kv.get(key))?.value ?? {}) as Record<string, unknown>;
  await db.kv.put({ key, value: { ...cur, ...patch } });
  await mark([key]);
});
export const useModuleSettings = <T,>(module: string) => useLiveQuery(async () => ((await db.kv.get(`settings:${module}`))?.value ?? {}) as T, [module]);
/** Every module's own settings document, by module id. */
export const useAllModuleSettings = () => useLiveQuery(async () => Object.fromEntries((await db.kv.where('key').startsWith('settings:').toArray()).map((r) => [r.key.slice('settings:'.length), r.value as Record<string, unknown>])), []);
export const saveSettings = (patch: Partial<Settings>) => db.transaction('rw', db.kv, db.outbox, async () => {
  const cur = ((await db.kv.get('settings'))?.value ?? {}) as Partial<Settings>;
  await db.kv.put({ key: 'settings', value: { ...cur, ...patch } });
  await mark(['settings']);
});

/** Retention from the plan: open-answer text 90 days, personal text 30 days, unless an adult saved it. */
export async function applyRetention(now = Date.now()) {
  const day = 86_400_000;
  await db.transaction('rw', db.notes, db.outbox, async () => {
    const old = await db.notes.filter((n) => !n.saved && now - n.ts > (n.personal ? 30 : 90) * day).primaryKeys();
    await db.notes.bulkDelete(old);
    await mark(old.map((id) => `note:${id}`));
  });
}

export function useSettings(): Settings | undefined {
  const row = useLiveQuery(async () => (await db.kv.get('settings')) ?? null, []); // null: no settings yet; undefined: still loading
  return useMemo(() => (row === undefined ? undefined : { ...DEFAULTS, ...((row?.value ?? {}) as Partial<Settings>) }), [row]);
}
export const useEvents = () => useLiveQuery(() => db.events.orderBy('ts').toArray(), [], undefined);
export function useProgress(events: LogEvent[] | undefined, fastTrack = true) {
  return useMemo(() => derive(events ?? [], { fastTrack }), [events, fastTrack]);
}
export const useNotes = () => useLiveQuery(() => db.notes.orderBy('ts').reverse().toArray(), [], [] as Note[]);

export async function exportAll() {
  return { app: 'wayfinder', version: 1, exported: new Date().toISOString(), events: await db.events.toArray(), notes: await db.notes.toArray(), settings: (await db.kv.get('settings'))?.value ?? {} };
}
export async function importAll(data: { app?: string; events?: LogEvent[]; notes?: Note[]; settings?: Partial<Settings> }) {
  if (data.app !== 'wayfinder' || !Array.isArray(data.events)) throw new Error('This file is not a Learning to Fly export.');
  await db.transaction('rw', [db.events, db.notes, db.kv, db.outbox], async () => {
    await db.events.bulkPut(data.events!);
    await mark(data.events!.map((e) => `event:${e.id}`));
    if (Array.isArray(data.notes)) { await db.notes.bulkPut(data.notes); await mark(data.notes.map((n) => `note:${n.id}`)); }
    if (data.settings) { await db.kv.put({ key: 'settings', value: { ...DEFAULTS, ...data.settings } }); await mark(['settings']); }
  });
}
/** Clears this device only. The cloud copy, if any, stays until it is deleted there. */
export const wipeAll = async () => {
  await db.transaction('rw', [db.events, db.notes, db.kv, db.outbox], async () => {
    await db.events.clear(); await db.notes.clear(); await db.kv.clear(); await db.outbox.clear();
  });
  forgetDb();
};
