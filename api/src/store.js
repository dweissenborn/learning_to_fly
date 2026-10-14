// The family cloud copy: learner profiles plus each learner's events, notes and settings, one partition per learner.
// Pure logic over a small repository, so the same code runs on Cosmos DB in Azure and in memory in tests.
//
// Documents (partition key /learner):
//   { id: 'profile',  learner, kind: 'profile', name, created }
//   { id: 'e:<id>',   learner, kind: 'event',   data: LogEvent }            append-only
//   { id: 'n:<id>',   learner, kind: 'note',    data: Note | null }         null = deleted
//   { id: 'settings', learner, kind: 'settings', data: Settings }           last write wins
//   { id: 'settings:<module>', learner, kind: 'module', data: object }     LTF-39: one per module, last write wins
// Events and notes from a module other than reading carry `module` in their data (missing means reading).

export const ROLE = 'family';
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const MODULE = /^[a-z][a-z0-9-]{0,31}$/;
const MAX = 2000; // documents per request; the app sends at most 1000

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = (m) => new HttpError(400, m);

/** The signed-in family member from the x-ms-client-principal header, or null. Static Web Apps also enforces the role. */
export function who(header) {
  try {
    const p = JSON.parse(Buffer.from(header ?? '', 'base64').toString('utf8'));
    return Array.isArray(p?.userRoles) && p.userRoles.includes(ROLE) ? p : null;
  } catch { return null; }
}

const id = (v, what) => { if (typeof v !== 'string' || !ID.test(v)) throw bad(`bad ${what}`); return v; };
const list = (v, what) => { if (v === undefined) return []; if (!Array.isArray(v)) throw bad(`bad ${what}`); return v; };

export async function learners(repo) {
  return (await repo.profiles()).map(({ learner, name, created }) => ({ id: learner, name, created })).sort((a, b) => a.created - b.created);
}

export async function createLearner(repo, body) {
  const learner = id(body?.id, 'learner');
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 40) : '';
  if (!name) throw bad('a nickname is needed');
  const have = await repo.get(learner, 'profile');
  if (have) return { id: learner, name: have.name, created: have.created };
  const doc = { id: 'profile', learner, kind: 'profile', name, created: Date.now() };
  await repo.put(learner, [doc]);
  return { id: learner, name, created: doc.created };
}

export async function deleteLearner(repo, learnerId) {
  await repo.remove(id(learnerId, 'learner'));
  return { deleted: learnerId };
}

/** Push this device's changes, then return everything changed since `since` (server seconds, inclusive). */
export async function sync(repo, body) {
  const learner = id(body?.learner, 'learner');
  const since = Number.isFinite(body?.since) ? body.since : 0;
  const events = list(body.events, 'events'), notes = list(body.notes, 'notes'), gone = list(body.gone, 'gone');
  if (events.length + notes.length + gone.length > MAX) throw bad('too many changes in one request');
  for (const e of events) id(e?.id, 'event id');
  for (const n of notes) id(n?.id, 'note id');
  for (const g of gone) id(g, 'note id');
  const settings = body.settings && typeof body.settings === 'object' ? body.settings : null;
  const modules = body.modules && typeof body.modules === 'object' ? Object.entries(body.modules) : [];
  for (const [m, v] of modules) if (!MODULE.test(m) || m === 'reading' || !v || typeof v !== 'object') throw bad('bad module settings');

  const profile = await repo.get(learner, 'profile');
  if (!profile) throw new HttpError(404, 'this learner is not in the cloud');
  const docs = [
    ...events.map((e) => ({ id: `e:${e.id}`, learner, kind: 'event', data: e })),
    ...notes.map((n) => ({ id: `n:${n.id}`, learner, kind: 'note', data: n })),
    ...gone.map((g) => ({ id: `n:${g}`, learner, kind: 'note', data: null })),
    ...modules.map(([m, v]) => ({ id: `settings:${m}`, learner, kind: 'module', data: v })),
  ];
  if (settings) {
    docs.push({ id: 'settings', learner, kind: 'settings', data: settings });
    const name = typeof settings.name === 'string' ? settings.name.trim().slice(0, 40) : '';
    if (name && name !== profile.name) docs.push({ id: 'profile', learner, kind: 'profile', name, created: profile.created });
  }
  if (docs.length) await repo.put(learner, docs);

  const out = { events: [], notes: [], gone: [], settings: null, modules: {}, since };
  for (const d of await repo.changes(learner, since)) {
    out.since = Math.max(out.since, d._ts);
    if (d.kind === 'event') out.events.push(d.data);
    else if (d.kind === 'note') d.data ? out.notes.push(d.data) : out.gone.push(d.id.slice(2));
    else if (d.kind === 'settings') out.settings = d.data;
    else if (d.kind === 'module') out.modules[d.id.slice('settings:'.length)] = d.data;
  }
  return out;
}

/** LTF-39: deletes one module's memory (its events, notes and settings) in the learner's partition, and nothing else. */
export async function deleteModule(repo, learnerId, module) {
  const learner = id(learnerId, 'learner');
  if (typeof module !== 'string' || !MODULE.test(module) || module === 'reading') throw bad('bad module');
  const ids = (await repo.changes(learner, 0)).filter((d) => d.id === `settings:${module}` || ((d.kind === 'event' || d.kind === 'note') && d.data?.module === module)).map((d) => d.id);
  if (ids.length) await repo.drop(learner, ids);
  return { deleted: module, documents: ids.length };
}
