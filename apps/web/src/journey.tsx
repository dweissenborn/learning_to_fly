// Learning to Fly: the journey from Home Island to the koalas of Australia.
// It moves with finished sessions only. Setbacks are scripted story beats, never consequences of
// answers: each one is explained, gives a calm coping line, and lets him choose a plan (no wrong choice).
import { useState, type ReactNode } from 'react';
import { Button, Dialog, Modal, ModalOverlay } from 'react-aria-components';
import type { Passage as P, Visual } from '@wayfinder/schema';
import { journeyPosition, type Progress } from '@wayfinder/engine';
import journeyData from '../../../content/journey.json';
import { saveSettings, type Settings } from './db';
import { passageText } from './content';
import { Passage } from './Passage';
import { Guide, GUIDES, Koala, Plane, pieceById } from './art';
import { Btn, SpeakBtn } from './ui';

export interface Beat {
  text: string;
  obstacle?: 'weather' | 'blocked' | 'broken';
  notice?: Visual;
  cope?: string;
  choice?: { ask: string; options: { label: string; reply: string; after: string }[] };
  talk?: string;
  smooth?: string;
}
export interface Stop { id: string; name: string; emoji: string; souvenir?: string; beats: Beat[]; postcard: string[] }
export const JOURNEY = journeyData as unknown as { stops: Stop[]; koalas: { name: string; facts: string[] }[]; allMet: string };

export const finishedCount = (p: Progress) => p.sessions.filter((s) => s.finished).length;

/** Where he is on the journey and what the story says now. */
export function journeyNow(finished: number, s: Settings) {
  const pos = journeyPosition(finished, JOURNEY.stops.length, s.legLength, s.journeyAnchor);
  const here = JOURNEY.stops[pos.stop];
  const next = JOURNEY.stops[pos.stop + 1];
  const beat = next ? shownBeat(next, pos.beat, s) : undefined;
  return { ...pos, here, next, beat, legLength: s.legLength, koala: pos.arrived ? JOURNEY.koalas[pos.after] : undefined };
}
export type JourneyNow = ReturnType<typeof journeyNow>;

/** The stops he has reached, for souvenirs and postcards. */
export const reachedStops = (stop: number) => new Set(JOURNEY.stops.slice(0, stop + 1).map((s) => s.id));

export interface ShownBeat extends Omit<Beat, 'smooth'> { key: string; stop: Stop; chosen?: number }
function shownBeat(stop: Stop, i: number, s: Settings): ShownBeat {
  const b = stop.beats[i];
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
export function BeatCard({ now, settings }: { now: JourneyNow; settings: Settings }) {
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
    {b.cope && <div className="guide-row"><Guide id={settings.guide} mood="think" size={48} /><div className="bubble"><b>{b.cope}</b></div></div>}
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
const AT: Record<string, [number, number]> = { home: [120, 430], gull: [290, 350], cape: [410, 230], airfield: [560, 150], takeoff: [715, 120], australia: [905, 365] };
const ctrl = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 50];
const onCurve = (a: [number, number], c: [number, number], b: [number, number], t: number): [number, number] =>
  [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t ** 2 * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t ** 2 * b[1]];
const OBSTACLE_ICON = { weather: '⛈️', blocked: '🪨', broken: '🔧' };

export function JourneyMap({ settings, progress, onExit }: { settings: Settings; progress: Progress; onExit: () => void }) {
  const now = journeyNow(finishedCount(progress), settings);
  const [open, setOpen] = useState<string | null>(null);
  const stops = JOURNEY.stops;
  const reached = (i: number) => i <= now.stop;
  const from = AT[now.here.id], to = now.next && AT[now.next.id];
  const marker = now.arrived || !to ? AT.australia : onCurve(from, ctrl(from, to), to, now.step / now.legLength);
  const flying = now.stop >= 3;
  const met = now.arrived ? JOURNEY.koalas.slice(0, Math.min(JOURNEY.koalas.length, now.after + 1)) : [];
  const openStop = stops.find((s) => s.id === open);

  return <>
    <header className="topbar"><h1 style={{ margin: 0 }}>🗺️ My journey</h1><span className="spacer" /><Btn className="quiet small" onPress={onExit}>← Back to island</Btn></header>
    <main className="stack">
      <div className="guide-row"><Guide id={settings.guide} size={64} mood="happy" />
        <div className="bubble">{now.arrived ? 'You made it to Australia. The koalas are glad you came.' : `You are at ${now.here.name}. Next stop: ${now.next!.name}. Far away is Australia, where the koalas live.`}</div></div>
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
            {flying ? <Plane s={0.7} rot={-8} /> : <text textAnchor="middle" fontSize="40" y="12">{now.stop === 2 ? '🚌' : '⛴️'}</text>}
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
