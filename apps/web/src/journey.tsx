// Learning to Fly: the journey from Home Island to the koalas of Australia.
// It moves with finished sessions only. Setbacks are scripted story beats, never consequences of
// answers: each one is explained, gives a calm coping line, and lets him choose a plan (no wrong choice).
import { useState, type ReactNode } from 'react';
import { Button, Dialog, Modal, ModalOverlay } from 'react-aria-components';
import type { Passage as P, Visual } from '@wayfinder/schema';
import { forkOptions, journeyRoute, pastFork, routePosition, type Progress } from '@wayfinder/engine';
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
export interface Stop { id: string; name: string; emoji: string; souvenir?: string; beats: Beat[]; postcard: string[]; next?: string[]; topics?: string[]; legacy?: boolean }
export const JOURNEY = journeyData as unknown as { stops: Stop[]; koalas: { name: string; facts: string[] }[]; allMet: string };
const BY_ID = new Map(JOURNEY.stops.map((s) => [s.id, s]));
/** Every route has the same number of stops (checked by npm run check), so Australia comes after the same number of sessions. */
export const ROUTE_LENGTH = (() => { let n = 1; for (let s = JOURNEY.stops[0]; s.next?.length; s = BY_ID.get(s.next[0])!) n++; return n; })();

/** LTF-20: his route, following the island he chose at each fork. It ends at a fork he has not chosen yet. */
export function routeOf(s: Settings) {
  const r = journeyRoute(JOURNEY.stops, Object.fromEntries(Object.entries(s.routes ?? {}).map(([k, v]) => [k, v.to])));
  return { ...r, stops: r.ids.map((id) => BY_ID.get(id)!) };
}

const FORKS = JOURNEY.stops.filter((s) => (s.next?.length ?? 0) > 1);
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
    const legacy = f.next!.find((id) => BY_ID.get(id)?.legacy);
    if (at >= 0 && legacy && pastFork(finished, at, ROUTE_LENGTH, s.legLength, s.journeyAnchor)) routes[f.id] = { to: legacy, at: 0 };
  }
  return { routes, forksSeen: [...(s.forksSeen ?? []), ...todo.map((f) => f.id)] };
}

export const finishedCount = (p: Progress) => p.sessions.filter((s) => s.finished).length;

/** Where he is on the journey and what the story says now. */
export function journeyNow(finished: number, settings: Settings) {
  const fix = forkMigration(settings, finished); // shown at once; App saves it
  const s = fix ? { ...settings, ...fix } : settings;
  const route = routeOf(s);
  const pos = routePosition(finished, route, ROUTE_LENGTH, s.legLength, s.journeyAnchor);
  const here = route.stops[pos.stop];
  const next = route.stops[pos.stop + 1];
  const beat = next ? shownBeat(next, pos.beat, s, here.id) : undefined;
  // LTF-20: where his route meets a fork he has not chosen, the islands that best match his interests are offered (the map shows them
  // ahead), and once he is there the journey waits for his pick.
  const forkStop = route.forkAt === undefined ? undefined : route.stops[route.forkAt];
  const branches = forkStop ? forkOptions(JOURNEY.stops, forkStop.id, s.interests).map((o) => BY_ID.get(o.id)!) : [];
  const fork = pos.waiting ? { id: here.id, at: pos.stop, options: branches } : undefined;
  return { ...pos, here, next, beat, fork, branches, route: route.stops, finished, legLength: s.legLength, koala: pos.arrived ? JOURNEY.koalas[pos.after] : undefined };
}
export type JourneyNow = ReturnType<typeof journeyNow>;

/** LTF-36: the islands on his route so far, in order. The last is the one he is on. */
export function islandsReached(now: JourneyNow): string[] {
  return [...new Set(now.route.slice(0, now.stop + 1).map((s) => islandOf(s.id)))];
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
  const left = order.indexOf(isle) < order.indexOf(current);
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
export const reachedStops = (stop: number, s: Settings) => new Set(routeOf(s).ids.slice(0, stop + 1));

export interface ShownBeat extends Omit<Beat, 'smooth'> { key: string; stop: Stop; chosen?: number }
function shownBeat(stop: Stop, i: number, s: Settings, from?: string): ShownBeat {
  const b = { ...stop.beats[i] };
  if (from && b.byFrom?.[from]) b.text = b.byFrom[from];
  const guide = GUIDES[s.guide].name;
  const fill = (t: string) => t.replaceAll('{guide}', guide);
  if (!s.setbacks && b.smooth) return { key: `${stop.id}-${i}`, stop, text: fill(b.smooth) };
  const obstacle = stop.beats.find((x) => x.choice);
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
  const ask = `Sea routes leave ${now.here.name}. Each one goes to a different island, and every route reaches Australia. Which island do you want to sail to?`;
  const about = (o: Stop) => (o.topics ?? []).map((t) => TOPICS.find((x) => x.id === t)).filter(Boolean).map((t) => `${t!.emoji} ${t!.label}`).join(' · ');
  const choose = (to: string) => {
    void saveSettings({ routes: { ...(settings.routes ?? {}), [f.id]: { to, at: Date.now() } }, journeyAnchor: { at: now.finished, stop: f.at, step: 0, after: 0 } });
    void log({ type: 'activity', session: 'home', kind: 'route', item: to });
  };
  return <section className="card journey-card stack" aria-label="Choose your sea route">
    <div className="row"><span style={{ fontSize: '1.8rem' }} aria-hidden>🧭</span><h3 style={{ margin: 0, flex: 1 }}>Choose your sea route</h3>
      <SpeakBtn lines={[ask, ...f.options.map((o) => `${o.name}. ${o.beats[0].text}`)]} k={'fork-' + f.id} label="" className="small iconbtn" /></div>
    <p style={{ margin: 0 }}>{ask}</p>
    <div className="choose">{f.options.map((o) => <Button key={o.id} className="ccard" onPress={() => choose(o.id)}>
      <span className="cico" aria-hidden>{o.emoji}</span><span className="cname">{o.name}</span>
      <span>{o.beats[0].text}</span>{about(o) && <span className="muted">{about(o)}</span>}
    </Button>)}</div>
    <p className="tagline">The journey waits here until you choose. There is no rush.</p>
  </section>;
}

export function BeatCard({ now, settings }: { now: JourneyNow; settings: Settings }) {
  if (now.fork) return <ForkCard now={now} settings={settings} />;
  const b = now.beat;
  if (!b) {
    if (!now.arrived) return null;
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
  return <section className="card postcard stack" aria-label={`Postcard from ${stop.name}`}>
    <StopArt id={stop.id} />
    <div className="row"><h2 style={{ margin: 0, flex: 1 }}>{arrived ? `You reached ${stop.name}!` : stop.name}</h2>
      <SpeakBtn lines={stop.postcard} k={'postcard-' + stop.id} label="" className="small iconbtn" /></div>
    <p className="prose" style={{ margin: 0 }}>{stop.postcard.join(' ')}</p>
    {arrived && souvenir && <p className="ican-new" style={{ margin: 0 }}>New for your island: {souvenir.name}. You can pick it below.</p>}
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
  const dashed = (a: [number, number], b: [number, number], key: string) => { const c = ctrl(a, b); return <path key={key} d={`M${a[0]} ${a[1]} Q${c[0]} ${c[1]} ${b[0]} ${b[1]}`} fill="none" stroke="#ffffff" strokeWidth={4} strokeDasharray="10 10" strokeLinecap="round" />; };
  const from = AT[now.here.id], to = now.next && AT[now.next.id];
  const marker = now.arrived ? AT.australia : to ? onCurve(from, ctrl(from, to), to, now.step / now.legLength) : from;
  const flying = now.stop >= 3;
  const met = now.arrived ? JOURNEY.koalas.slice(0, Math.min(JOURNEY.koalas.length, now.after + 1)) : [];
  const openStop = stops.find((s) => s.id === open);

  return <>
    <header className="topbar"><h1 style={{ margin: 0 }}>🗺️ My journey</h1><span className="spacer" /><Btn className="quiet small" onPress={onExit}>← Back to island</Btn></header>
    <main className="stack">
      <div className="guide-row"><Guide id={settings.guide} size={64} mood="happy" />
        <div className="bubble">{now.arrived ? 'You made it to Australia. The koalas are glad you came.' : now.next ? `You are at ${now.here.name}. Next stop: ${now.next.name}. Far away is Australia, where the koalas live.` : `You are at ${now.here.name}. Sea routes go to different islands, and every route reaches Australia. Choose one below.`}</div></div>
      <div className="journey-map">
        <svg viewBox="0 0 1000 560" role="group" aria-label={`Map of the journey. You are at ${now.here.name}.`}>
          <defs><linearGradient id="seaG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#bfe3f5" /><stop offset="1" stopColor="#5fb0dc" /></linearGradient></defs>
          <rect width="1000" height="560" fill="url(#seaG)" />
          {Array.from({ length: 18 }, (_, i) => <path key={i} d={`M${(i * 137) % 960 + 20} ${(i * 89) % 480 + 50} q10 -4 20 0 t20 0`} stroke="#fff" strokeOpacity="0.5" strokeWidth="2" fill="none" />)}
          <path d="M790 292 C805 270 830 256 852 258 C866 252 878 262 884 274 L888 296 C893 276 898 252 903 243 Q907 236 911 245 C918 268 928 294 948 322 C966 348 972 380 964 414 C956 444 938 462 914 462 C898 462 888 450 870 442 C852 436 836 446 812 446 C792 448 776 436 768 418 C760 396 758 360 766 330 C772 310 780 298 790 292 Z" fill="#e0a868" stroke="#c48a4e" strokeWidth="3" />
          <path d="M903 243 Q907 236 911 245 C918 268 928 294 948 322 C966 348 972 380 964 414 C956 444 938 462 914 462 C930 440 944 410 946 372 C946 330 920 290 903 243 Z" fill="#8cbf78" />
          <ellipse cx="926" cy="488" rx="15" ry="11" fill="#8cbf78" stroke="#c48a4e" strokeWidth="2" />
          {stops.slice(1).map((s, i) => {
            const a = AT[stops[i].id], b = AT[s.id], c = ctrl(a, b);
            return <path key={s.id} d={`M${a[0]} ${a[1]} Q${c[0]} ${c[1]} ${b[0]} ${b[1]}`} fill="none" stroke={reached(i + 1) ? '#f2b04a' : '#ffffff'} strokeWidth={reached(i + 1) ? 6 : 4} strokeDasharray={reached(i + 1) ? undefined : '10 10'} strokeLinecap="round" />;
          })}
          {branches.map((o) => dashed(AT[forkStop.id], AT[o.id], 'to-' + o.id))}
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
          <g transform={`translate(${marker[0]} ${marker[1] - 44})`} aria-hidden="true">
            {flying ? <Plane s={0.7} rot={-8} /> : <text textAnchor="middle" fontSize="40" y="12">{now.here?.id === 'cape' ? '🚌' : '⛴️'}</text>}
            {now.beat?.obstacle && <text x="34" y="-14" fontSize="30">{OBSTACLE_ICON[now.beat.obstacle]}</text>}
          </g>
        </svg>
      </div>
      <BeatCard now={now} settings={settings} />
      <section className="card stack">
        <h2 style={{ margin: 0 }}>Postcards</h2>
        <div className="tiles">{stops.filter((_, i) => reached(i)).map((s) => <Btn key={s.id} onPress={() => setOpen(s.id)}><span className="ico" aria-hidden>{s.emoji}</span>{s.name}</Btn>)}</div>
      </section>
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
