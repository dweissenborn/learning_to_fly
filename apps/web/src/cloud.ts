// The family cloud copy. When a grown-up has signed in on this device, the open learner syncs with
// Cosmos DB through /api: local changes go up from the outbox, and changes from other devices come down.
// Without a sign-in (a local dev server, or offline) the app simply stays local.
import { useEffect, useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { LogEvent } from '@wayfinder/schema';
import { DB, currentDb, db, forgetDb, learnerDbs, rememberDb, switchDb, type Note } from './db';

export interface Me { userDetails: string; userRoles: string[] }
export interface Learner { id: string; name: string; created: number }
export interface Link { learner: string; since: number }
interface Pull { events: LogEvent[]; notes: Note[]; gone: string[]; settings: Record<string, unknown> | null; modules?: Record<string, Record<string, unknown>>; since: number }

/** me: undefined until checked or where there is no sign-in at all; null when signed out. */
interface Status { checked: boolean; me?: Me | null; state: 'idle' | 'syncing' | 'ok' | 'offline' | 'signed-out' | 'gone'; at?: number }
let status: Status = { checked: false, state: 'idle' };
const subs = new Set<() => void>();
const set = (p: Partial<Status>) => { status = { ...status, ...p }; subs.forEach((f) => f()); };
export const useCloudStatus = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => status);
export const isFamily = (me?: Me | null) => !!me?.userRoles?.includes('family');
export const useLink = () => useLiveQuery(async () => ((await db.kv.get('cloud'))?.value as Link | undefined) ?? null, []);

export async function checkSignIn() {
  let me: Me | null | undefined;
  try {
    const r = await fetch('/.auth/me');
    me = r.ok && r.headers.get('content-type')?.includes('json') ? ((await r.json()).clientPrincipal ?? null) : undefined;
  } catch { me = undefined; }
  set({ checked: true, me });
}

class CloudError extends Error { constructor(readonly status: number) { super(`cloud ${status}`); } }
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  // 'manual': an expired sign-in answers with a redirect to Microsoft, which a fetch must not follow.
  const r = await fetch(`/api/${path}`, { ...init, redirect: 'manual', headers: { 'content-type': 'application/json' } });
  if (r.type === 'opaqueredirect' || r.status === 401) throw new CloudError(401);
  if (!r.ok) throw new CloudError(r.status);
  return r.json() as Promise<T>;
}

export const listLearners = () => api<Learner[]>('learners');

/**
 * Tie this device's open learner to a cloud learner and queue what should go up:
 * 'new' sends everything, 'join' adds this device's history but keeps the cloud's settings, 'empty' sends nothing.
 */
export async function link(learner: string, mode: 'new' | 'join' | 'empty') {
  await db.transaction('rw', [db.events, db.notes, db.kv, db.outbox], async () => {
    await db.outbox.clear();
    if (mode !== 'empty') {
      const keys = [...(await db.events.toCollection().primaryKeys()).map((k) => `event:${k}`), ...(await db.notes.toCollection().primaryKeys()).map((k) => `note:${k}`)];
      if (mode === 'new') keys.push('settings', ...(await db.kv.where('key').startsWith('settings:').primaryKeys()).map(String));
      await db.outbox.bulkPut(keys.map((key) => ({ key, v: crypto.randomUUID() })));
    }
    await db.kv.put({ key: 'cloud', value: { learner, since: 0 } satisfies Link });
  });
  rememberDb(learner);
  set({ state: 'idle' });
  await syncNow();
}

export async function createAndLink(name: string) {
  const id = crypto.randomUUID();
  await api('learners', { method: 'POST', body: JSON.stringify({ id, name }) });
  await link(id, 'new');
}

let autoTried = false;
/**
 * A device that already has a learner saves it by itself when nobody is in the cloud copy yet, so there is no one
 * it could be mistaken for. Once anyone is saved, joining or adding stays a grown-up's choice in the Data tab.
 * ponytail: two devices doing this in the same second would make two learners; delete one in the Data tab.
 */
export async function autoSave(name: string) {
  if (autoTried) return;
  autoTried = true;
  try { if (!(await listLearners()).length) await createAndLink(name); } catch { /* offline or not signed in: try on the next start */ }
}

/** Open a cloud learner on this device: their local database if there is one, else a new one that fills from the cloud. */
export async function openLearner(learner: string) {
  const known = learnerDbs()[learner];
  if (known) return switchDb(known);
  const name = `ltf-${learner}`;
  const d = new DB(name);
  await d.kv.put({ key: 'cloud', value: { learner, since: 0 } satisfies Link });
  d.close();
  rememberDb(learner, name);
  switchDb(name);
}

/** A blank database for someone new; onboarding then offers the cloud list again. */
export const startSomeoneNew = () => switchDb(`ltf-${crypto.randomUUID()}`);

export async function deleteEverywhere(learner: string) {
  await api(`learners/${learner}`, { method: 'DELETE' });
}

let running: Promise<void> | null = null;
/** One sync at a time; callers share the run in progress. */
export const syncNow = () => (running ??= run().finally(() => { running = null; }));

async function run() {
  const link = (await db.kv.get('cloud'))?.value as Link | undefined;
  if (!link || !isFamily(status.me)) return;
  set({ state: 'syncing' });
  try {
    for (let round = 0; round < 100; round++) {
      const box = await db.outbox.limit(1000).toArray();
      const events: LogEvent[] = [], notes: Note[] = [], gone: string[] = [];
      let settings: unknown;
      const modules: Record<string, unknown> = {}; // LTF-39: `settings:<module>` documents
      for (const { key } of box) {
        const [kind, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
        if (kind === 'event') { const e = await db.events.get(id); if (e) events.push(e); }
        else if (kind === 'note') { const n = await db.notes.get(id); if (n) notes.push(n); else gone.push(id); }
        else if (key === 'settings') settings = (await db.kv.get('settings'))?.value;
        else if (kind === 'settings') { const v = (await db.kv.get(key))?.value; if (v) modules[id] = v; }
      }
      const r = await api<Pull>('sync', { method: 'POST', body: JSON.stringify({ learner: link.learner, since: link.since, events, notes, gone, settings, modules }) });
      await db.transaction('rw', [db.events, db.notes, db.kv, db.outbox], async () => {
        for (const b of box) if ((await db.outbox.get(b.key))?.v === b.v) await db.outbox.delete(b.key); // sent, and not edited since
        const pending = new Set(await db.outbox.toCollection().primaryKeys());
        // Write only what is new, so screens do not redraw for nothing. Events never change once written.
        const have = new Set(await db.events.where('id').anyOf(r.events.map((e) => e.id)).primaryKeys());
        await db.events.bulkPut(r.events.filter((e) => !have.has(e.id)));
        for (const n of r.notes) if (!pending.has(`note:${n.id}`) && JSON.stringify(await db.notes.get(n.id)) !== JSON.stringify(n)) await db.notes.put(n);
        await db.notes.bulkDelete(r.gone.filter((id) => !pending.has(`note:${id}`)));
        const cur = (await db.kv.get('settings'))?.value;
        if (r.settings && !pending.has('settings') && JSON.stringify(cur) !== JSON.stringify(r.settings)) await db.kv.put({ key: 'settings', value: r.settings });
        for (const [m, v] of Object.entries(r.modules ?? {})) {
          const key = `settings:${m}`;
          if (!pending.has(key) && JSON.stringify((await db.kv.get(key))?.value) !== JSON.stringify(v)) await db.kv.put({ key, value: v });
        }
        await db.kv.put({ key: 'cloud', value: { ...link, since: r.since } });
      });
      link.since = r.since;
      if (box.length < 1000) break;
    }
    set({ state: 'ok', at: Date.now() });
  } catch (e) {
    if (e instanceof CloudError && e.status === 401) set({ state: 'signed-out' });
    else if (e instanceof CloudError && (e.status === 404 || e.status === 403)) {
      // Removed from the cloud (or this account lost access): keep what is on this device, stop syncing it.
      await db.kv.delete('cloud');
      forgetDb(currentDb());
      set({ state: 'gone' });
    } else set({ state: 'offline' });
  }
}

/** Runs once in the app shell: checks the sign-in, then syncs on start, every 30 seconds, on reconnect, and soon after a change. */
export function useCloudSync() {
  const s = useCloudStatus();
  const link = useLink();
  const pending = useLiveQuery(() => db.outbox.count(), [], 0);
  const on = isFamily(s.me) && !!link;
  useEffect(() => {
    void checkSignIn();
    const online = () => { void checkSignIn().then(() => syncNow()); };
    addEventListener('online', online);
    return () => removeEventListener('online', online);
  }, []);
  useEffect(() => {
    if (!on) return;
    void syncNow();
    const t = setInterval(() => { if (document.visibilityState === 'visible') void syncNow(); }, 30_000);
    const hide = () => { if (document.visibilityState === 'hidden') void syncNow(); };
    document.addEventListener('visibilitychange', hide);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', hide); };
  }, [on]);
  useEffect(() => {
    if (!on || !pending) return;
    const t = setTimeout(() => void syncNow(), 3000);
    return () => clearTimeout(t);
  }, [on, pending]);
  return { ...s, link };
}
