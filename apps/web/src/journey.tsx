// Learning to Fly: the journey from Home Island to the koalas of Australia.
// It moves with finished sessions only. Setbacks are scripted story beats, never consequences of
// answers: each one is explained, gives a calm coping line, and lets him choose a plan (no wrong choice).
import { useState, type ReactNode } from 'react';
import { Button, Dialog, Modal, ModalOverlay } from 'react-aria-components';
import type { Passage as P, Visual } from '@wayfinder/schema';
import { forkOptions, journeyPosition, journeyRoute, pastFork, routePosition, type Progress } from '@wayfinder/engine';
import journeyData from '../../../content/journey.json';
import { log, saveSettings, type Settings } from './db';
import { passageText, STRAND, TOPICS } from './content';
import { Passage } from './Passage';
import { Guide, GUIDES, Koala, Plane, pieceById, areaOpen, ISLANDS, islandOf, type IslandDef } from './art';
import { Btn, SpeakBtn } from './ui';

export interface Beat {
  text: string;
  obstacle?: 'weather' | 'blocked' | 'broken';
  notice?: Visual;
  cope?: string;
  choice?: { ask: string; options: { label: string; reply: string; after: string }[] };
  talk?: string;
  smooth?: string;
  /** LTF-20: the text for a learner arriving from this stop, where it differs (the Windy Cape bus is not on island routes). */
  byFrom?: Record<string, string>;
}
/** LTF-25: one way to a stop reached by more than one flight path. The `legacy` one keeps the stop's own beats. */
export interface Path { id: string; name: string; emoji: string; beats?: Beat[]; legacy?: boolean }
export interface Stop { id: string; name: string; emoji: string; souvenir?: string; beats: Beat[]; postcard: string[]; daytrip?: string[]; paths?: Path[]; next?: string[]; topics?: string[]; legacy?: boolean }
export const JOURNEY = journeyData as unknown as { stops: Stop[]; koalas: { name: string; facts: string[] }[]; allMet: string; arc?: { about: string; stops: Stop[]; done: string };
  home?: { about: string; offer: { text: string; go: string; stay: string }; stayText: string; stops: (Stop & { place: string })[] } };
const BY_ID = new Map(JOURNEY.stops.map((s) => [s.id, s]));
/** Every route has the same number of stops (checked by npm run check), so Australia comes after the same number of sessions. */
export const ROUTE_LENGTH = (() => { let n = 1; for (let s = JOURNEY.stops[0]; s.next?.length; s = BY_ID.get(s.next[0])!) n++; return n; })();

/** LTF-20: his route, following the island he chose at each fork. It ends at a fork he has not chosen yet. */
export function routeOf(s: Settings) {
  const r = journeyRoute(JOURNEY.stops, Object.fromEntries(Object.entries(s.routes ?? {}).map(([k, v]) => [k, v.to])));
  // LTF-25: before a stop reached by flight paths, the journey waits as at a sea fork, until he picks a path.
  const pathAt = r.ids.findIndex((id, i) => i + 1 < r.ids.length && !!BY_ID.get(r.ids[i + 1])?.paths && !s.routes?.[id]);
  const forkAt = pathAt >= 0 && (r.forkAt === undefined || pathAt < r.forkAt) ? pathAt : r.forkAt;
  return { ...r, forkAt, stops: r.ids.map((id) => BY_ID.get(id)!) };
}
/** What a saved route choice names: a flight path, or the island he sailed to. */
export function routeLabel(from: string, to: string) {
  return BY_ID.get(BY_ID.get(from)?.next?.[0] ?? '')?.paths?.find((p) => p.id === to)?.name ?? BY_ID.get(to)?.name ?? to;
}

const FORKS = JOURNEY.stops.filter((s) => (s.next?.length ?? 0) > 1 || !!BY_ID.get(s.next?.[0] ?? '')?.paths);
/**
 * LTF-20, once per fork: a learner whose story had already gone past the fork when the routes arrived keeps the old route
 * (its `legacy` stop), so nothing moves him back. Everyone else gets the fork. Returns the settings to save, or null.
 */
export function forkMigration(s: Settings, finished: number): Partial<Settings> | null {
  const todo = FORKS.filter((f) => !(s.forksSeen ?? []).includes(f.id) && !s.routes?.[f.id]);
  if (!todo.length) return null;
  const routes = { ...(s.routes ?? {}) };
  for (const f of todo) {
    const at = routeOf({ ...s, routes }).ids.indexOf(f.id);
    const legacy = f.next!.length > 1 ? f.next!.find((id) => BY_ID.get(id)?.legacy) : BY_ID.get(f.next![0])?.paths?.find((p) => p.legacy)?.id;
    if (at >= 0 && legacy && pastFork(finished, at, ROUTE_LENGTH, s.legLength, s.journeyAnchor)) routes[f.id] = { to: legacy, at: 0 };
  }
  return { routes, forksSeen: [...(s.forksSeen ?? []), ...todo.map((f) => f.id)] };
}

export const finishedCount = (p: Progress) => p.sessions.filter((s) => s.finished).length;

/** Where he is on the journey and what the story says now. */
export function journeyNow(finished: number, settings: Settings) {
  const fix = forkMigration(settings, finished); // shown at once; App saves it
  const s0 = fix ? { ...settings, ...fix } : settings;
  const arcFix = arcStart(s0, finished);
  const s = arcFix ? { ...s0, ...arcFix } : s0;
  const route = routeOf(s);
  const pos = routePosition(finished, route, ROUTE_LENGTH, s.legLength, s.journeyAnchor);
  const here = route.stops[pos.stop];
  const next = route.stops[pos.stop + 1];
  const beat = next ? shownBeat(next, pos.beat, s, here.id) : undefined;
  // LTF-20: where his route meets a fork he has not chosen, the islands that best match his interests are offered (the map shows them
  // ahead), and once he is there the journey waits for his pick.
  const forkStop = route.forkAt === undefined ? undefined : route.stops[route.forkAt];
  const pathStop = route.forkAt === undefined ? undefined : route.stops[route.forkAt + 1]?.paths ? route.stops[route.forkAt + 1] : undefined;
  const branches = forkStop && !pathStop ? forkOptions(JOURNEY.stops, forkStop.id, s.interests).map((o) => BY_ID.get(o.id)!) : [];
  // LTF-25: at Take-off the choice is between flight paths to the same stop, not between islands.
  const options: { id: string; name: string; emoji: string; first: string; topics?: readonly string[] }[] = pathStop
    ? pathStop.paths!.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, first: (p.beats ?? pathStop.beats)[0].text }))
    : branches.map((o) => ({ id: o.id, name: o.name, emoji: o.emoji, first: o.beats[0].text, topics: o.topics }));
  const outwardFork = pos.waiting ? { id: here.id, at: pos.stop, kind: pathStop ? 'path' as const : 'sea' as const, options } : undefined;
  // LTF-30: after the eighth koala, the story is the keeper arc: its next stop, beat and leg step stand in for the journey's.
  const arc = pos.arrived ? arcOf(pos.after, s) : undefined;
  // LTF-27: after Opening Day, if he chose to fly home, the story is the way home, and his island is the place he is at.
  const trip = arc?.done ? tripOf(finished, s) : undefined;
  const story = trip ? { here: trip.place, next: trip.next, beat: trip.beat, step: trip.step } : arc && !arc.done ? { next: arc.next, beat: arc.beat, step: arc.step } : {};
  const fork = outwardFork ?? (trip?.waiting ? { id: 'back-cloud', at: trip.stop, kind: 'home' as const,
    options: trip.options.map((o) => ({ id: o.place, name: o.name, emoji: o.emoji, first: o.beats[0].text, topics: o.topics as readonly string[] | undefined })) } : undefined);
  return { ...pos, here, next, beat, fork, branches, route: route.stops, finished, legLength: s.legLength,
    koala: pos.arrived && pos.after < JOURNEY.koalas.length ? JOURNEY.koalas[pos.after] : undefined, arc, trip, outward: { stop: pos.stop, step: pos.step, after: pos.after }, ...story };
}
export type JourneyNow = ReturnType<typeof journeyNow>;

/** LTF-36: the islands on his route so far, in order. The last is the one he is on. */
export function islandsReached(now: JourneyNow): string[] {
  return [...new Set([...now.route.slice(0, now.outward.stop + 1).map((s) => islandOf(s.id)), ...(now.trip?.places ?? []).map(islandOf)])];
}
/** LTF-36: the first time he is on a new island, remember how many sessions were finished, so its areas open after that. */
export function islandArrival(s: Settings, finished: number): Partial<Settings> | null {
  const cur = islandOf(journeyNow(finished, s).here.id);
  return cur === 'home' || s.islandsSeen?.[cur] !== undefined ? null : { islandsSeen: { ...(s.islandsSeen ?? {}), [cur]: finished } };
}
type Lit = Record<'functional' | 'narrative' | 'philosophical', boolean[]>;
/** LTF-36: an island and which of its areas are open. Islands he has sailed on from have all their quest areas open. */
export function islandAreas(isle: string, now: JourneyNow, s: Settings, lit: Lit) {
  const def = ISLANDS[isle];
  const order = islandsReached(now), current = islandOf(now.here.id);
  const left = order.includes(isle) && isle !== current;
  const sessions = isle === current ? now.finished - (s.islandsSeen?.[isle] ?? now.finished) : 0;
  return { def, open: def.areas.map((a, i) => areaOpen(a, i, { sessions, left, lit })), current: isle === current };
}

/** LTF-36: the island's quest, and what opens the area that waits for a lantern. */
export function IslandQuest({ def, open, current }: { def: IslandDef; open: readonly boolean[]; current: boolean }) {
  return <section className="card stack quest" aria-label={`${def.name} quest`}>
    <h3 style={{ margin: 0 }}>{def.name}</h3>
    <ul className="quest-list">{def.areas.map((a, i) => a.quest && <li key={a.name} className={open[i] ? 'done' : ''}>
      <span aria-hidden>{open[i] ? '✅' : '⬜'}</span><span>{a.quest}{open[i] ? <span className="muted"> Done: {a.name} is open.</span> : <span className="sr-only"> Not yet.</span>}</span></li>)}</ul>
    {def.areas.map((a, i) => a.gate && <p key={a.name} className="tagline" style={{ margin: 0 }}>{open[i] ? `🔓 ${a.name} is open.` : `🔒 ${a.name} opens when lantern ${a.gate.step} is lit on the ${STRAND[a.gate.strand].region} path. You can come back for it later.`}</p>)}
    {current && open.some((o, i) => !o && def.areas[i].quest) && <p className="tagline" style={{ margin: 0 }}>Each session you finish here does the next step.</p>}
  </section>;
}

/** The stops he has reached on his route, for souvenirs and postcards. */
export const reachedStops = (stop: number, s: Settings, arcStop = 0) => new Set([...routeOf(s).ids.slice(0, stop + 1), ...ARC.slice(1, arcStop + 1).map((x) => x.id)]);

// ---------------------------------------------------------------- the koala keeper arc (LTF-30)
/** Bluegum (Australia) is the arc's start; its five legs follow the eight koalas, one leg per `legLength` sessions. */
export const ARC: Stop[] = JOURNEY.arc ? [BY_ID.get('australia')!, ...JOURNEY.arc.stops] : [];
const ARC_START = { at: 0, stop: 0, step: 0, after: 0 };
function arcOf(after: number, s: Settings) {
  if (!ARC.length || after < JOURNEY.koalas.length) return undefined;
  const sessions = after - JOURNEY.koalas.length;
  const p = journeyPosition(sessions, ARC.length, s.legLength, s.arcAnchor ?? ARC_START);
  const next = ARC[p.stop + 1];
  return { sessions, stop: p.stop, step: p.step, here: ARC[p.stop], next, beat: next ? shownBeat(next, p.beat, s) : undefined, done: p.arrived };
}
/** LTF-30, once: a learner who had met every koala before the arc existed starts it at its first beat, not partway. */
export function arcStart(s: Settings, finished: number): Partial<Settings> | null {
  if (s.arcSeen || !ARC.length) return null;
  const pos = routePosition(finished, routeOf(s), ROUTE_LENGTH, s.legLength, s.journeyAnchor);
  const n = pos.arrived ? pos.after - JOURNEY.koalas.length : -1;
  return n > 0 ? { arcSeen: true, arcAnchor: { at: n, stop: 0, step: 0, after: 0 } } : { arcSeen: true };
}
// ---------------------------------------------------------------- the way home (LTF-27)
type HomeStop = Stop & { place: string };
const HOME = JOURNEY.home;
const HOME_AT = new Map((HOME?.stops ?? []).map((x) => [x.place, x]));
const THEMED = ['fossil', 'reef', 'star', 'rail'];
/** The islands he has not visited, best match for his interests first: at most three, offered at Cloud Hill on the way home. */
function homeOptions(s: Settings) {
  const seen = new Set(routeOf(s).ids);
  const fit = (x: HomeStop) => (x.topics ?? []).filter((t) => (s.interests as readonly string[]).includes(t)).length;
  return THEMED.filter((id) => !seen.has(id) && HOME_AT.has(id)).map((id) => HOME_AT.get(id)!).sort((a, b) => fit(b) - fit(a)).slice(0, 3);
}
function tripOf(finished: number, s: Settings) {
  if (!HOME || !s.homeTrip) return undefined;
  const sessions = finished - s.homeTrip.at;
  const isle = s.homeTrip.island ? HOME_AT.get(s.homeTrip.island) : undefined;
  const list: (Stop | undefined)[] = [BY_ID.get('australia')!, HOME_AT.get('airfield'), isle, HOME_AT.get('gull'), HOME_AT.get('home')];
  const p = routePosition(sessions, { forkAt: isle ? undefined : 1 }, list.length, s.legLength, s.homeTrip.anchor ?? ARC_START);
  const here = list[p.stop]!, next = p.waiting ? undefined : list[p.stop + 1];
  const places = list.slice(1, p.stop + 1).filter(Boolean).map((x) => (x as HomeStop).place);
  return { sessions, stop: p.stop, step: p.step, here, place: BY_ID.get((here as HomeStop).place ?? 'australia')!, next, places,
    beat: next ? shownBeat(next, p.beat, s, here.id) : undefined, done: p.arrived, waiting: p.waiting, options: p.waiting ? homeOptions(s) : [] };
}
/** The way home's stops he has reached, for postcards and souvenirs. */
export const tripReached = (now: JourneyNow): Stop[] => (HOME?.stops ?? []).filter((x) => now.trip?.places.includes(x.place));

/** A new pace starts from where he is, on the way to Australia and in the arc, so it never moves him back or ahead. */
export function repace(s: Settings, finished: number, legLength: Settings['legLength']): Partial<Settings> {
  const now = journeyNow(finished, s);
  return { legLength, journeyAnchor: { at: finished, ...now.outward }, ...(now.arc ? { arcAnchor: { at: now.arc.sessions, stop: now.arc.stop, step: now.arc.step, after: 0 } } : {}),
    ...(now.trip && s.homeTrip ? { homeTrip: { ...s.homeTrip, anchor: { at: now.trip.sessions, stop: now.trip.stop, step: now.trip.step, after: 0 } } } : {}) };
}

export interface ShownBeat extends Omit<Beat, 'smooth'> { key: string; stop: Stop; chosen?: number }
function shownBeat(stop: Stop, i: number, s: Settings, from?: string): ShownBeat {
  const path = stop.paths?.find((p) => p.id === s.routes?.[from ?? '']?.to);
  const beats = path?.beats ?? stop.beats; // LTF-25: the chosen flight path's own story, setback and plans
  const b = { ...beats[i] };
  if (from && b.byFrom?.[from]) b.text = b.byFrom[from];
  const guide = GUIDES[s.guide].name;
  const fill = (t: string) => t.replaceAll('{guide}', guide);
  if (!s.setbacks && b.smooth) return { key: `${stop.id}-${i}`, stop, text: fill(b.smooth) };
  const obstacle = beats.find((x) => x.choice);
  const chosen = s.journeyChoices[stop.id];
  // Beat 3 tells how his chosen plan worked.
  const text = i === 3 && obstacle?.choice && chosen !== undefined ? obstacle.choice.options[chosen]?.after ?? b.text : b.text;
  return { key: `${stop.id}-${i}`, stop, text: fill(text), obstacle: b.obstacle, notice: b.notice, cope: b.cope, choice: b.choice, chosen, talk: b.talk };
}

const NOTICE_TITLE = { weather: 'Weather news', blocked: 'A sign on the path', broken: 'A message' };
const noticePassage = (b: ShownBeat): P => ({
  id: `notice-${b.key}`, title: NOTICE_TITLE[b.obstacle ?? 'weather'], kind: 'notice', sentences: [], visual: b.notice, topics: ['safety'], level: 1, socialLoad: 0,
  credit: { title: 'Journey notice', author: 'Learning to Fly', source: 'Written for Learning to Fly', licence: 'original', retrieved: '2026-10-12', adapted: false },
});

/** Progress along the current leg: one dot per finished session. */
export function LegDots({ now }: { now: JourneyNow }) {
  if (!now.next) return null;
  const left = now.legLength - now.step;
  return <div className="row" style={{ gap: '0.5rem' }}>
    <span className="leg-dots" role="img" aria-label={`${now.step} of ${now.legLength} sessions on the way to ${now.next.name}`}>
      {Array.from({ length: now.legLength }, (_, i) => <span key={i} className={`leg-dot ${i < now.step ? 'on' : ''}`} />)}
    </span>
    <span className="tagline">{left === 1 ? `One more session to ${now.next.name}.` : `${left} more sessions to ${now.next.name}.`}</span>
  </div>;
}

/** The story beat for now: a hint, or an obstacle with its notice, a coping line and a choice of plan. */
/** LTF-20: the sea routes at a fork. Every route reaches Australia; the choice waits for him and has no timer. */
function ForkCard({ now, settings }: { now: JourneyNow; settings: Settings }) {
  const f = now.fork!;
  const flight = f.kind === 'path', home = f.kind === 'home';
  const title = flight ? 'Choose your flight path' : home ? 'Choose an island on the way home' : 'Choose your sea route';
  const ask = flight ? 'Captain Ada shows you two flight paths on her map. Both land in Australia. Which way do you want to fly?'
    : home ? "Captain Ada's boat can take you to one island you have not seen. Then you sail on to Gull Island and home. Which island do you want to visit?"
    : `Sea routes leave ${now.here.name}. Each one goes to a different island, and every route reaches Australia. Which island do you want to sail to?`;
  const about = (o: (typeof f.options)[number]) => (o.topics ?? []).map((t) => TOPICS.find((x) => x.id === t)).filter(Boolean).map((t) => `${t!.emoji} ${t!.label}`).join(' · ');
  const choose = (to: string) => {
    if (home && settings.homeTrip) void saveSettings({ homeTrip: { ...settings.homeTrip, island: to, anchor: { at: now.trip!.sessions, stop: f.at, step: 0, after: 0 } } });
    else void saveSettings({ routes: { ...(settings.routes ?? {}), [f.id]: { to, at: Date.now() } }, journeyAnchor: { at: now.finished, stop: f.at, step: 0, after: 0 } });
    void log({ type: 'activity', session: 'home', kind: 'route', item: to });
  };
  return <section className="card journey-card stack" aria-label={title}>
    <div className="row"><span style={{ fontSize: '1.8rem' }} aria-hidden>{flight ? '🗺️' : '🧭'}</span><h3 style={{ margin: 0, flex: 1 }}>{title}</h3>
      <SpeakBtn lines={[ask, ...f.options.map((o) => `${o.name}. ${o.first}`)]} k={'fork-' + f.id} label="" className="small iconbtn" /></div>
    <p style={{ margin: 0 }}>{ask}</p>
    <div className="choose">{f.options.map((o) => <Button key={o.id} className="ccard" onPress={() => choose(o.id)}>
      <span className="cico" aria-hidden>{o.emoji}</span><span className="cname">{o.name}</span>
      <span>{o.first}</span>{about(o) && <span className="muted">{about(o)}</span>}
    </Button>)}</div>
    <p className="tagline">The journey waits here until you choose. There is no rush.</p>
  </section>;
}

export function BeatCard({ now, settings }: { now: JourneyNow; settings: Settings }) {
  if (now.fork) return <ForkCard now={now} settings={settings} />;
  const b = now.beat;
  if (!b) {
    if (!now.arrived) return null;
    if (now.trip?.done && JOURNEY.home) { const last = JOURNEY.home.stops.at(-1)!.postcard.at(-1)!; return <section className="card journey-card stack" aria-label="Your journey">
      <div className="row"><span style={{ fontSize: '1.8rem' }} aria-hidden>🏝️</span><h3 style={{ margin: 0, flex: 1 }}>Home again</h3><SpeakBtn lines={[last]} k="home-done" label="" className="small iconbtn" /></div>
      <p style={{ margin: 0 }}>{last}</p>
    </section>; }
    // LTF-27: after Opening Day, Captain Ada offers the way home. Staying is always fine, and the offer stays open.
    if (now.arc?.done && JOURNEY.arc && JOURNEY.home && !settings.homeTrip) { const h = JOURNEY.home; const say = [JOURNEY.arc.done, settings.homeStayed ? h.stayText : h.offer.text];
      return <section className="card journey-card stack" aria-label="Your journey">
        <div className="row"><span style={{ fontSize: '1.8rem' }} aria-hidden>🐨</span><h3 style={{ margin: 0, flex: 1 }}>Junior koala keeper</h3><SpeakBtn lines={say} k="home-offer" label="" className="small iconbtn" /></div>
        {say.map((x) => <p key={x} style={{ margin: 0 }}>{x}</p>)}
        <div className="row"><Btn className="primary" onPress={() => { void saveSettings({ homeTrip: { at: now.finished } }); void log({ type: 'activity', session: 'home', kind: 'home' }); }}>✈️ {h.offer.go}</Btn>
          {!settings.homeStayed && <Btn onPress={() => saveSettings({ homeStayed: true })}>🐨 {h.offer.stay}</Btn>}</div>
      </section>; }
    if (now.arc?.done && JOURNEY.arc) return <section className="card journey-card stack" aria-label="Your journey">
      <div className="row"><span style={{ fontSize: '1.8rem' }} aria-hidden>🐨</span><h3 style={{ margin: 0, flex: 1 }}>Junior koala keeper</h3>
        <SpeakBtn lines={[JOURNEY.arc.done]} k="arc-done" label="" className="small iconbtn" /></div>
      <p style={{ margin: 0 }}>{JOURNEY.arc.done}</p>
    </section>;
    const k = now.koala;
    return <section className="card journey-card stack" aria-label="Your journey">
      <div className="row"><span style={{ fontSize: '1.8rem' }} aria-hidden>🐨</span><h3 style={{ margin: 0 }}>Bluegum Koala Sanctuary</h3></div>
      <p style={{ margin: 0 }}>{k && now.after + 1 < JOURNEY.koalas.length ? 'Next time you finish a session, you meet another koala.' : JOURNEY.allMet}</p>
    </section>;
  }
  const lines = [b.text, ...(b.notice ? passageText(noticePassage(b)) : []), ...(b.cope ? [b.cope] : []), ...(b.choice && b.chosen === undefined ? [b.choice.ask] : [])];
  return <section className={`card journey-card stack ${b.obstacle ? 'setback' : ''}`} aria-label={`On the way to ${b.stop.name}`}>
    <div className="row">
      <span style={{ fontSize: '1.8rem' }} aria-hidden>{b.stop.emoji}</span>
      <h3 style={{ margin: 0, flex: 1 }}>On the way to {b.stop.name}</h3>
      <SpeakBtn lines={lines} k={'beat-' + b.key} label="" className="small iconbtn" />
    </div>
    <p style={{ margin: 0, fontSize: '1.08rem' }}>{b.text}</p>
    {b.notice && <Passage passage={noticePassage(b)} credit={false} />}
    {b.cope && <div className="guide-row"><Guide id={settings.guide} mood="think" size={48} /><div className="bubble"><b>{b.cope}</b>{settings.resetWords.trim() && <> Remember your reset words: <b>{settings.resetWords.trim()}</b>.</>}</div></div>}
    {b.choice && <div className="stack" style={{ gap: '0.6rem' }}>
      <div className="label">{b.choice.ask}</div>
      <div className="tiles" role="group" aria-label={b.choice.ask}>
        {b.choice.options.map((o, i) => <Button key={i} className={`tile ${b.chosen === i ? 'on' : ''}`} aria-pressed={b.chosen === i}
          onPress={() => saveSettings({ journeyChoices: { ...settings.journeyChoices, [b.stop.id]: i } })}>{o.label}</Button>)}
      </div>
      {b.chosen !== undefined && <p className="appear" style={{ margin: 0 }}>{b.choice.options[b.chosen].reply}</p>}
    </div>}
    <LegDots now={now} />
  </section>;
}

/** The arrival postcard for a stop. */
export function PostcardCard({ stop, arrived }: { stop: Stop; arrived?: boolean }) {
  const souvenir = stop.souvenir && pieceById.get(stop.souvenir);
  const [trip, setTrip] = useState(false);
  // LTF-26: a reached island's day trip, a short read about a second place there. It costs nothing and moves nothing.
  if (trip && stop.daytrip) return <section className="card postcard stack" aria-label={`Day trip on ${stop.name}`}>
    <div className="row"><h2 style={{ margin: 0, flex: 1 }}>Day trip on {stop.name}</h2>
      <SpeakBtn lines={stop.daytrip} k={'daytrip-' + stop.id} label="" className="small iconbtn" /></div>
    <p className="prose" style={{ margin: 0 }}>{stop.daytrip.join(' ')}</p>
    <div className="row"><Btn className="small" onPress={() => setTrip(false)}>← Back to the postcard</Btn></div>
  </section>;
  return <section className="card postcard stack" aria-label={`Postcard from ${stop.name}`}>
    <StopArt id={stop.id} />
    <div className="row"><h2 style={{ margin: 0, flex: 1 }}>{arrived ? `You reached ${stop.name}!` : stop.name}</h2>
      <SpeakBtn lines={stop.postcard} k={'postcard-' + stop.id} label="" className="small iconbtn" /></div>
    <p className="prose" style={{ margin: 0 }}>{stop.postcard.join(' ')}</p>
    {arrived && souvenir && <p className="ican-new" style={{ margin: 0 }}>New for your island: {souvenir.name}. You can pick it below.</p>}
    {stop.daytrip && <div className="row"><Btn className="small" onPress={() => { setTrip(true); void log({ type: 'activity', session: 'home', kind: 'daytrip', item: stop.id }); }}>🧭 Day trip</Btn></div>}
  </section>;
}

export function KoalaCard({ koala }: { koala: { name: string; facts: string[] } }) {
  return <section className="card postcard stack" aria-label={`You met ${koala.name}`}>
    <svg viewBox="0 0 320 150" role="img" aria-label={`${koala.name} the koala in a eucalyptus tree`} className="stop-art">
      <rect width="320" height="150" fill="#cfe8f2" /><rect y="118" width="320" height="32" fill="#d9a066" />
      <rect x="146" y="20" width="22" height="110" rx="10" fill="#e3dccf" />
      <circle cx="120" cy="34" r="30" fill="#86b5a2" /><circle cx="190" cy="30" r="34" fill="#9cc5b4" /><circle cx="158" cy="14" r="26" fill="#7aa996" />
      <Koala x={157} y={78} s={0.95} />
    </svg>
    <div className="row"><h2 style={{ margin: 0, flex: 1 }}>You met {koala.name}</h2><SpeakBtn lines={[`You met ${koala.name}.`, ...koala.facts]} k={'koala-' + koala.name} label="" className="small iconbtn" /></div>
    <p className="prose" style={{ margin: 0 }}>{koala.facts.join(' ')}</p>
  </section>;
}

/** A small painted scene for each stop. */
export function StopArt({ id }: { id: string }) {
  const sky = <><rect width="320" height="170" fill="#cfe8f2" /><circle cx="270" cy="34" r="16" fill="#ffe08a" /></>;
  const sea = (y: number) => <rect y={y} width="320" height={170 - y} fill="#6fb6dc" />;
  const gull = (x: number, y: number) => <path d={`M${x} ${y} q6 -6 12 0 q6 -6 12 0`} stroke="#33363d" strokeWidth="2" fill="none" />;
  const scenes: Record<string, ReactNode> = {
    home: <>{sky}{sea(110)}<ellipse cx="150" cy="122" rx="110" ry="22" fill="#f0dca0" /><path d="M70 120 Q120 70 190 116 Z" fill="#9fcf7a" />
      <rect x="215" y="66" width="14" height="52" fill="#f5f5f0" /><rect x="215" y="80" width="14" height="10" fill="#d64545" /><rect x="215" y="100" width="14" height="10" fill="#d64545" /><path d="M212 66 L222 54 L232 66 Z" fill="#3a3a44" />
      <circle cx="110" cy="96" r="12" fill="#5ea64c" /></>,
    gull: <>{sky}{sea(100)}<path d="M70 120 Q100 70 150 82 Q190 62 230 112 Q150 130 70 120 Z" fill="#9a968f" />
      <ellipse cx="128" cy="92" rx="20" ry="7" fill="#5e646d" /><circle cx="146" cy="86" r="6" fill="#6b717a" />
      <ellipse cx="186" cy="98" rx="16" ry="6" fill="#5e646d" /><circle cx="200" cy="93" r="5" fill="#6b717a" />
      {gull(60, 40)}{gull(110, 28)}{gull(200, 46)}</>,
    cape: <>{sky}{sea(118)}<path d="M0 170 L0 80 Q60 70 120 96 L150 170 Z" fill="#7fbf6a" /><path d="M120 96 L150 170 L130 170 Z" fill="#a8916c" />
      <path d="M200 40 l12 14 l-12 16 l-12 -16 z" fill="#4fa3d1" /><path d="M200 70 q-8 8 0 14 q8 6 0 14" stroke="#e4572e" strokeWidth="2" fill="none" />
      <path d="M250 60 l10 12 l-10 14 l-10 -14 z" fill="#f2b04a" /><path d="M250 86 q-6 6 0 12" stroke="#e4572e" strokeWidth="2" fill="none" />
      <path d="M200 70 L80 90 M250 86 L84 92" stroke="#555" strokeWidth="0.8" /></>,
    airfield: <>{sky}<path d="M0 120 Q160 80 320 116 L320 170 L0 170 Z" fill="#8fc77a" /><path d="M20 150 L300 136 L304 146 L24 160 Z" fill="#6a6f78" />
      <path d="M210 118 a34 30 0 0 1 68 0 Z" fill="#a9a39a" /><rect x="232" y="100" width="24" height="18" fill="#5a5450" />
      <Plane x={110} y={128} s={0.9} /></>,
    fossil: <>{sky}{sea(128)}{[0, 1, 2, 3, 4].map((k) => <rect key={k} x={150 + k * 6} y={40 + k * 18} width={170 - k * 6} height="18" fill={['#b9b2a4', '#a79f90', '#c4bcab', '#9a9282', '#b1a998'][k]} />)}
      <path d="M40 140 L72 112 L104 140 Z" fill="#e8913a" /><path d="M20 140 L320 140 L320 150 L20 150 Z" fill="#e9d6a8" />
      <path d="M230 128 m-10 0 a10 10 0 1 1 20 0 a7 7 0 1 1 -14 0 a4 4 0 1 1 8 0" stroke="#6b5a3a" strokeWidth="2.5" fill="none" /></>,
    reef: <>{sky}<rect y="70" width="320" height="100" fill="#4fa3d1" /><ellipse cx="160" cy="120" rx="130" ry="38" fill="#7fd0e8" stroke="#ffffff" strokeWidth="6" strokeDasharray="14 8" />
      <ellipse cx="160" cy="118" rx="44" ry="14" fill="#e9d6a8" /><path d="M152 112 q4 -26 -6 -38 M152 112 q10 -24 26 -28" stroke="#7a5034" strokeWidth="3" fill="none" /><ellipse cx="148" cy="74" rx="16" ry="6" fill="#5fae5a" /><ellipse cx="176" cy="84" rx="14" ry="5" fill="#5fae5a" />
      <path d="M232 132 L262 132 L256 140 L238 140 Z" fill="#f2e6d0" /><path d="M247 132 L247 112 L260 130 Z" fill="#fff" /></>,
    star: <><rect width="320" height="170" fill="#243b6b" />{[[30, 30], [80, 18], [140, 40], [210, 22], [270, 46], [300, 16], [110, 70], [250, 80]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="2" fill="#fff" />)}
      <path d="M0 170 L0 120 Q120 96 230 118 L320 150 L320 170 Z" fill="#3f6b4a" /><rect x="150" y="96" width="60" height="22" fill="#f2f2ec" /><path d="M150 96 A30 30 0 0 1 210 96 Z" fill="#ffffff" /><rect x="176" y="68" width="8" height="28" fill="#9aa5b1" />
      <circle cx="60" cy="40" r="10" fill="#f5f0d8" /></>,
    rail: <>{sky}{sea(110)}<rect y="118" width="320" height="14" fill="#a9a39a" /><path d="M0 132 L320 132" stroke="#6b5a4a" strokeWidth="3" />
      <rect x="60" y="94" width="110" height="24" rx="5" fill="#3f88c5" /><rect x="170" y="98" width="40" height="20" rx="4" fill="#2f6f99" />{[74, 100, 126, 152].map((x) => <rect key={x} x={x} y="99" width="16" height="10" fill="#bfe3f5" />)}
      <rect x="250" y="70" width="6" height="48" fill="#4a4a5a" /><rect x="242" y="58" width="22" height="34" rx="4" fill="#2b2b2b" /><circle cx="253" cy="68" r="5" fill="#3fbf5a" /><circle cx="253" cy="83" r="5" fill="#5a2b2b" /></>,
    takeoff: <><rect width="320" height="170" fill="#9fd3f0" /><circle cx="270" cy="34" r="16" fill="#ffe08a" />
      <ellipse cx="70" cy="130" rx="60" ry="16" fill="#fff" /><ellipse cx="240" cy="140" rx="70" ry="18" fill="#fff" /><ellipse cx="160" cy="60" rx="34" ry="10" fill="#fff" opacity="0.8" />
      <Plane x={150} y={96} s={1.1} rot={-12} /></>,
    // LTF-30: the keeper arc at Bluegum.
    nursery: <>{sky}<rect y="118" width="320" height="52" fill="#a9c98e" />{[40, 80, 120, 160].map((x) => <g key={x}><path d={`M${x - 10} 118 L${x + 10} 118 L${x + 7} 136 L${x - 7} 136 Z`} fill="#b5653a" />
      <rect x={x - 1.5} y="96" width="3" height="22" fill="#8a6a46" /><circle cx={x - 6} cy="96" r="8" fill="#86b5a2" /><circle cx={x + 6} cy="92" r="7" fill="#9cc5b4" /></g>)}
      <rect x="220" y="70" width="44" height="60" rx="6" fill="#9aa3ab" /><ellipse cx="242" cy="70" rx="22" ry="6" fill="#b9c0c7" /><rect x="268" y="112" width="22" height="18" fill="#5b6170" /><path d="M264 120 L268 120" stroke="#5b6170" strokeWidth="4" /></>,
    keeper: <>{sky}<rect y="122" width="320" height="48" fill="#c9a46a" /><rect x="40" y="36" width="14" height="88" rx="6" fill="#e3dccf" /><circle cx="40" cy="40" r="22" fill="#86b5a2" /><circle cx="64" cy="34" r="18" fill="#9cc5b4" />
      <rect x="132" y="112" width="56" height="12" fill="#9aa3ab" /><rect x="157" y="72" width="6" height="40" fill="#6b6458" /><path d="M136 70 L184 70" stroke="#8a6a46" strokeWidth="6" strokeLinecap="round" /><circle cx="160" cy="96" r="10" fill="#fffdf6" stroke="#4a4a52" strokeWidth="2" />
      <rect x="226" y="60" width="64" height="56" rx="4" fill="#fffdf6" stroke="#6b4a2f" strokeWidth="3" />{[72, 84, 96, 108].map((y) => <path key={y} d={`M234 ${y} L282 ${y}`} stroke="#9aa3ab" strokeWidth="2" />)}
      <path d="M206 124 L220 70" stroke="#8a6a46" strokeWidth="3" /><path d="M214 68 L228 72" stroke="#4a4a52" strokeWidth="3" /></>,
    clinic: <>{sky}<rect y="124" width="320" height="46" fill="#a9c98e" /><rect x="90" y="64" width="140" height="62" fill="#f2ecdc" /><path d="M80 66 L160 30 L240 66 Z" fill="#3f88c5" />
      <rect x="146" y="92" width="28" height="34" fill="#8a6a46" /><rect x="104" y="80" width="28" height="20" fill="#bfe3f5" /><rect x="188" y="80" width="28" height="20" fill="#bfe3f5" />
      <circle cx="160" cy="54" r="7" fill="#fffdf6" />{[-6, -2, 2, 6].map((d) => <circle key={d} cx={160 + d} cy={46 - Math.abs(d) * 0.4} r="2.4" fill="#fffdf6" />)}<rect x="262" y="60" width="12" height="66" rx="5" fill="#e3dccf" /><circle cx="268" cy="58" r="20" fill="#86b5a2" /></>,
    habitat: <>{sky}<rect y="118" width="320" height="52" fill="#a9c98e" />{[50, 250].map((x) => <g key={x}><rect x={x - 6} y="40" width="12" height="80" rx="5" fill="#e3dccf" /><circle cx={x - 10} cy="42" r="20" fill="#86b5a2" /><circle cx={x + 12} cy="36" r="17" fill="#9cc5b4" /></g>)}
      <path d="M0 150 L320 132 L320 146 L0 164 Z" fill="#c9a46a" />{[30, 90, 150, 210, 270].map((x) => <rect key={x} x={x} y={146 - x * 0.06 - 18} width="4" height="18" fill="#8a6a46" />)}
      <rect x="132" y="90" width="56" height="30" rx="4" fill="#fffdf6" stroke="#6b4a2f" strokeWidth="2" /><path d="M140 100 L180 100 M140 110 L170 110" stroke="#9aa3ab" strokeWidth="2" /><rect x="158" y="120" width="4" height="18" fill="#6b4a2f" /></>,
    opening: <><rect width="320" height="170" fill="#bfe3f5" /><circle cx="270" cy="34" r="16" fill="#ffe08a" /><rect y="122" width="320" height="48" fill="#a9c98e" />
      <path d="M10 40 Q160 80 310 40" stroke="#6b4a2f" strokeWidth="1.5" fill="none" />{[30, 70, 110, 150, 190, 230, 270].map((x, i) => { const y = 40 + Math.sin((x / 320) * Math.PI) * 26; return <path key={x} d={`M${x - 8} ${y} L${x + 8} ${y} L${x} ${y + 14} Z`} fill={['#e4572e', '#3f88c5', '#f2b04a', '#58b38a'][i % 4]} />; })}
      {[70, 100, 130, 200, 230].map((x, i) => <g key={x}><circle cx={x} cy="96" r="8" fill={['#f2c9a0', '#c98d5c', '#8a5a3a', '#f2c9a0', '#c98d5c'][i]} /><rect x={x - 8} y="104" width="16" height="22" rx="6" fill={['#3f88c5', '#e4572e', '#58b38a', '#f2b04a', '#a68be0'][i]} /></g>)}
      <rect x="150" y="70" width="6" height="56" fill="#6b4a2f" /><rect x="136" y="64" width="34" height="18" rx="3" fill="#fffdf6" stroke="#6b4a2f" /><text x="153" y="77" textAnchor="middle" fontSize="10" fontWeight="800" fill="#1d2b3a">OPEN</text></>,
    australia: <><rect width="320" height="170" fill="#cfe8f2" /><rect y="128" width="320" height="42" fill="#d9a066" />
      <rect x="196" y="30" width="18" height="104" rx="8" fill="#e3dccf" /><circle cx="176" cy="40" r="26" fill="#86b5a2" /><circle cx="236" cy="36" r="30" fill="#9cc5b4" />
      <Koala x={205} y={86} s={0.8} sleepy /><rect x="40" y="96" width="70" height="34" rx="4" fill="#7a4a2a" /><rect x="72" y="128" width="6" height="14" fill="#7a4a2a" />
      <text x="75" y="112" textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff" fontFamily="Arial, sans-serif">BLUEGUM</text>
      <text x="75" y="123" textAnchor="middle" fontSize="8" fill="#fff" fontFamily="Arial, sans-serif">KOALAS</text></>,
  };
  return <svg viewBox="0 0 320 170" role="img" aria-label={`A picture of ${JOURNEY.stops.find((s) => s.id === id)?.name}`} className="stop-art">{scenes[id]}</svg>;
}

// ---------------------------------------------------------------- the map screen
const AT: Record<string, [number, number]> = {
  home: [120, 430], gull: [290, 350], cape: [410, 230], airfield: [560, 150], takeoff: [715, 120], australia: [905, 365],
  star: [330, 210], rail: [480, 380], fossil: [300, 485], reef: [110, 250], // LTF-20: north, east, south and west of Gull Island
};
const ctrl = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 50];
/** LTF-27: the way home bows below the outward route, so the two stay apart. */
const back = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + 45];
/** LTF-25: a curve that bows the other way, for the reef way. */
const low = (a: [number, number], b: [number, number]): [number, number] => [Math.min(a[0], b[0]) - 60, Math.max(a[1], b[1]) + 40];
const onCurve = (a: [number, number], c: [number, number], b: [number, number], t: number): [number, number] =>
  [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t ** 2 * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t ** 2 * b[1]];
const OBSTACLE_ICON = { weather: '⛈️', blocked: '🪨', broken: '🔧' };

export function JourneyMap({ settings, progress, onExit }: { settings: Settings; progress: Progress; onExit: () => void }) {
  const now = journeyNow(finishedCount(progress), settings);
  const [open, setOpen] = useState<string | null>(null);
  // LTF-20: his route so far; at a fork he has not chosen, the offered islands branch off, and the rest of the way follows.
  const stops = now.route;
  const reached = (i: number) => i <= now.stop;
  const branches = now.branches;
  const forkStop = stops[stops.length - 1];
  const tail = branches.length ? journeyRoute(JOURNEY.stops, { ...Object.fromEntries(Object.entries(settings.routes ?? {}).map(([k, v]) => [k, v.to])), [forkStop.id]: branches[0].id }).ids.slice(stops.length + 1).map((id) => BY_ID.get(id)!) : [];
  const ahead: Stop[] = [...branches, ...tail];
  const dashed = (a: [number, number], b: [number, number], key: string, c = ctrl(a, b)) => { return <path key={key} d={`M${a[0]} ${a[1]} Q${c[0]} ${c[1]} ${b[0]} ${b[1]}`} fill="none" stroke="#ffffff" strokeWidth={4} strokeDasharray="10 10" strokeLinecap="round" />; };
  const from = AT[now.here.id], to = now.next && AT[now.next.id];
  const onReef = !!now.next?.paths && !!settings.routes?.[now.here.id] && !now.next.paths.find((p) => p.id === settings.routes?.[now.here.id]?.to)?.legacy; // LTF-25
  // LTF-27: on the way home the marker follows the return path, by the places it visits.
  const trip = now.trip, tripTo = trip?.next && AT[(trip.next as HomeStop).place], tripFrom = trip && AT[trip.place.id];
  const marker = trip ? (trip.done ? AT.home : tripTo ? onCurve(tripFrom!, back(tripFrom!, tripTo), tripTo, now.step / now.legLength) : tripFrom!)
    : now.arrived ? AT.australia : to ? onCurve(from, onReef ? low(from, to) : ctrl(from, to), to, now.step / now.legLength) : from;
  const flying = trip ? trip.stop === 0 && !trip.done : now.stop >= 3;
  const homeWay = trip ? ['australia', 'airfield', settings.homeTrip?.island, 'gull', 'home'].filter((x): x is string => !!x && (x !== 'gull' && x !== 'home' || !!settings.homeTrip?.island)) : [];
  const met = now.arrived ? JOURNEY.koalas.slice(0, Math.min(JOURNEY.koalas.length, now.after + 1)) : [];
  const arcReached = [...(now.arc ? ARC.slice(1, now.arc.stop + 1) : []), ...tripReached(now)]; // LTF-30, LTF-27
  const openStop = [...stops, ...arcReached].find((s) => s.id === open);

  return <>
    <header className="topbar"><h1 style={{ margin: 0 }}>🗺️ My journey</h1><span className="spacer" /><Btn className="quiet small" onPress={onExit}>← Back to island</Btn></header>
    <main className="stack">
      <div className="guide-row"><Guide id={settings.guide} size={64} mood="happy" />
        <div className="bubble">{now.trip ? (now.trip.done ? 'You are home again, after the whole journey. Your island is waiting.' : now.fork ? "Captain Ada's boat can take you to one more island. Choose one below." : `On the way home. Next stop: ${now.next?.name}.`) : now.arrived ? (now.arc?.done ? 'You are a junior koala keeper at Bluegum. The koalas and the visitors are glad you came.' : now.arc?.next ? `You are at Bluegum Koala Sanctuary, on the way to ${now.arc.next.name}.` : 'You made it to Australia. The koalas are glad you came.') : now.next ? `You are at ${now.here.name}. Next stop: ${now.next.name}. Far away is Australia, where the koalas live.` : `You are at ${now.here.name}. Sea routes go to different islands, and every route reaches Australia. Choose one below.`}</div></div>
      <div className="journey-map">
        <svg viewBox="0 0 1000 560" role="group" aria-label={`Map of the journey. You are at ${now.here.name}.`}>
          <defs><linearGradient id="seaG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#bfe3f5" /><stop offset="1" stopColor="#5fb0dc" /></linearGradient></defs>
          <rect width="1000" height="560" fill="url(#seaG)" />
          {Array.from({ length: 18 }, (_, i) => <path key={i} d={`M${(i * 137) % 960 + 20} ${(i * 89) % 480 + 50} q10 -4 20 0 t20 0`} stroke="#fff" strokeOpacity="0.5" strokeWidth="2" fill="none" />)}
          <path d="M790 292 C805 270 830 256 852 258 C866 252 878 262 884 274 L888 296 C893 276 898 252 903 243 Q907 236 911 245 C918 268 928 294 948 322 C966 348 972 380 964 414 C956 444 938 462 914 462 C898 462 888 450 870 442 C852 436 836 446 812 446 C792 448 776 436 768 418 C760 396 758 360 766 330 C772 310 780 298 790 292 Z" fill="#e0a868" stroke="#c48a4e" strokeWidth="3" />
          <path d="M903 243 Q907 236 911 245 C918 268 928 294 948 322 C966 348 972 380 964 414 C956 444 938 462 914 462 C930 440 944 410 946 372 C946 330 920 290 903 243 Z" fill="#8cbf78" />
          <ellipse cx="926" cy="488" rx="15" ry="11" fill="#8cbf78" stroke="#c48a4e" strokeWidth="2" />
          {stops.slice(1).map((s, i) => {
            // LTF-25: the reef way to Australia bows the other way, over a chain of small islands.
            const reefWay = !!s.paths && !s.paths.find((p) => p.id === settings.routes?.[stops[i].id]?.to)?.legacy && !!settings.routes?.[stops[i].id];
            const a = AT[stops[i].id], b = AT[s.id], c = reefWay ? low(a, b) : ctrl(a, b);
            return <path key={s.id} d={`M${a[0]} ${a[1]} Q${c[0]} ${c[1]} ${b[0]} ${b[1]}`} fill="none" stroke={reached(i + 1) ? '#f2b04a' : '#ffffff'} strokeWidth={reached(i + 1) ? 6 : 4} strokeDasharray={reached(i + 1) ? undefined : '10 10'} strokeLinecap="round" />;
          })}
          {branches.map((o) => dashed(AT[forkStop.id], AT[o.id], 'to-' + o.id))}
          {homeWay.slice(1).map((id, i) => { const a = AT[homeWay[i]], b = AT[id], c = back(a, b), done = i + 1 <= trip!.stop; // LTF-27: the way home
            return <path key={'home-' + id} d={`M${a[0]} ${a[1]} Q${c[0]} ${c[1]} ${b[0]} ${b[1]}`} fill="none" stroke="#a68be0" strokeWidth={done ? 6 : 4} strokeDasharray={done ? undefined : '10 10'} strokeLinecap="round" />; })}
          {(() => { // LTF-25: while he chooses, both flight paths show; once on the reef way, its small islands stay.
            const i = stops.findIndex((x, k) => k > 0 && !!x.paths);
            if (i < 1) return null;
            const from = stops[i - 1].id, to = settings.routes?.[from]?.to;
            const reef = stops[i].paths!.find((p) => !p.legacy)!;
            if (to && to !== reef.id) return null;
            const a = AT[from], b = AT[stops[i].id], c = low(a, b);
            return <g aria-hidden="true">{!to && dashed(a, b, 'reef-way', c)}
              {[0.25, 0.42, 0.58].map((t) => { const [x, y] = onCurve(a, c, b, t); return <ellipse key={t} cx={x + 16} cy={y + 6} rx="12" ry="5" fill="#8cbf78" stroke="#c48a4e" strokeWidth="1.5" />; })}</g>;
          })()}
          {tail.length > 0 && branches.map((o) => dashed(AT[o.id], AT[tail[0].id], 'from-' + o.id))}
          {tail.slice(1).map((s, i) => dashed(AT[tail[i].id], AT[s.id], 'tail-' + s.id))}
          {ahead.map((s) => { const [x, y] = AT[s.id]; return <g key={'ahead-' + s.id}>
            <circle cx={x} cy={y} r={s.id === 'australia' ? 40 : 32} fill="#fffdf6" stroke={branches.includes(s) ? '#3f88c5' : '#b9b2a4'} strokeWidth="5" strokeDasharray={branches.includes(s) ? '8 6' : undefined} opacity={0.85} />
            <text x={x} y={y + 11} textAnchor="middle" fontSize={s.id === 'australia' ? 38 : 30}>{s.emoji}</text>
            <text x={x} y={y + (s.id === 'australia' ? 64 : 54)} textAnchor="middle" fontSize="20" fontWeight="800" fill="#1d2b3a" stroke="#fffdf6" strokeWidth="5" paintOrder="stroke">{s.name}</text>
          </g>; })}
          {stops.map((s, i) => {
            const [x, y] = AT[s.id];
            const isNext = i === now.stop + 1;
            const body = <>
              <circle cx={x} cy={y} r={i === stops.length - 1 ? 40 : 32} fill="#fffdf6" stroke={reached(i) ? '#3f9a5c' : isNext ? '#3f88c5' : '#b9b2a4'} strokeWidth="5" strokeDasharray={isNext ? '8 6' : undefined} opacity={reached(i) || isNext ? 1 : 0.75} />
              <text x={x} y={y + 11} textAnchor="middle" fontSize={i === stops.length - 1 ? 38 : 30}>{s.emoji}</text>
              <text x={x} y={y + (i === stops.length - 1 ? 64 : 54)} textAnchor="middle" fontSize="20" fontWeight="800" fill="#1d2b3a" stroke="#fffdf6" strokeWidth="5" paintOrder="stroke">{s.name}</text>
              {reached(i) && <text x={x + 24} y={y - 18} fontSize="22">✅</text>}
            </>;
            return reached(i)
              ? <g key={s.id} role="button" tabIndex={0} aria-label={`Open the postcard from ${s.name}`} className="map-stop" onClick={() => setOpen(s.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(s.id); } }}>{body}</g>
              : <g key={s.id}>{body}</g>;
          })}
          {homeWay.filter((id) => !stops.some((x) => x.id === id)).map((id) => { const st = BY_ID.get(id)!, [x, y] = AT[id], been = !!trip?.places.includes(id); // LTF-27: an island first seen on the way home
            return <g key={'home-node-' + id} aria-hidden="true">
              <circle cx={x} cy={y} r={32} fill="#fffdf6" stroke={been ? '#a68be0' : '#b9b2a4'} strokeWidth="5" strokeDasharray={been ? undefined : '8 6'} />
              <text x={x} y={y + 11} textAnchor="middle" fontSize={30}>{st.emoji}</text>
              <text x={x} y={y + 54} textAnchor="middle" fontSize="20" fontWeight="800" fill="#1d2b3a" stroke="#fffdf6" strokeWidth="5" paintOrder="stroke">{st.name}</text>
              {been && <text x={x + 24} y={y - 18} fontSize="22">✅</text>}
            </g>; })}
          <g transform={`translate(${marker[0]} ${marker[1] - 44})`} aria-hidden="true">
            {flying ? <Plane s={0.7} rot={-8} /> : <text textAnchor="middle" fontSize="40" y="12">{now.here?.id === 'cape' ? '🚌' : '⛴️'}</text>}
            {now.beat?.obstacle && <text x="34" y="-14" fontSize="30">{OBSTACLE_ICON[now.beat.obstacle]}</text>}
          </g>
        </svg>
      </div>
      <BeatCard now={now} settings={settings} />
      <section className="card stack">
        <h2 style={{ margin: 0 }}>Postcards</h2>
        <div className="tiles">{[...stops.filter((_, i) => reached(i)), ...arcReached].map((s) => <Btn key={s.id} onPress={() => setOpen(s.id)}><span className="ico" aria-hidden>{s.emoji}</span>{s.name}</Btn>)}</div>
      </section>
      {now.arc && <section className="card stack" aria-labelledby="bluegum-h">
        <h2 id="bluegum-h" style={{ margin: 0 }}>Bluegum Koala Sanctuary</h2>
        <ol className="arc-steps">{ARC.slice(1).map((s, i) => { const done = i + 1 <= now.arc!.stop, next = i + 1 === now.arc!.stop + 1;
          return <li key={s.id} className={done ? 'done' : next ? 'next' : ''}><span aria-hidden>{done ? '✅' : s.emoji}</span> {s.name}<span className="sr-only">{done ? ', reached' : next ? ', next' : ''}</span></li>; })}</ol>
      </section>}
      {met.length > 0 && <section className="card stack">
        <h2 style={{ margin: 0 }}>Koalas you met</h2>
        <div className="tiles">{met.map((k) => <Btn key={k.name} onPress={() => setOpen('koala:' + k.name)}><span className="ico" aria-hidden>🐨</span>{k.name}</Btn>)}</div>
      </section>}
    </main>
    <ModalOverlay className="overlay" isOpen={!!open} onOpenChange={(o) => !o && setOpen(null)} isDismissable>
      <Modal><Dialog className="dialog" aria-label="Postcard">
        {openStop && <PostcardCard stop={openStop} />}
        {open?.startsWith('koala:') && <KoalaCard koala={JOURNEY.koalas.find((k) => 'koala:' + k.name === open)!} />}
        <div className="row" style={{ marginTop: '1rem' }}><span className="spacer" /><Btn className="primary" autoFocus onPress={() => setOpen(null)}>Done</Btn></div>
      </Dialog></Modal>
    </ModalOverlay>
  </>;
}
