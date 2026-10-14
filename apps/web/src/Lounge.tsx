// LTF-38: the lounge. "I need a break" is honoured at once and comes here: something calm and fun to do, nothing to
// answer, and the way back to his island. Asking for a break is never a failure.
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { flightPeak, flightPoints } from '@wayfinder/engine';
import type { LogEvent } from '@wayfinder/schema';
import { Guide } from './art';
import type { Settings } from './db';
import { KitPanel } from './gear';
import { sfx } from './media';
import { Btn } from './ui';

const KITES = ['#e4572e', '#3f88c5', '#f2b04a', '#58b38a', '#a68be0'];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** A kite on a string. It drifts toward wherever he points or taps; arrow keys move it, Space changes its colour. */
function KiteSky() {
  const [goal, setGoal] = useState({ x: 64, y: 20 });
  const [at, setAt] = useState(goal);
  const [c, setC] = useState(0);
  const calm = useRef(document.documentElement.dataset.motion !== 'full');
  useEffect(() => {
    if (calm.current) { setAt(goal); return; }
    let raf = 0;
    const step = () => {
      setAt((p) => {
        const n = { x: p.x + (goal.x - p.x) * 0.06, y: p.y + (goal.y - p.y) * 0.06 };
        if (Math.abs(n.x - goal.x) + Math.abs(n.y - goal.y) > 0.05) raf = requestAnimationFrame(step);
        return n;
      });
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [goal]);
  const toward = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setGoal({ x: clamp(((e.clientX - r.left) / r.width) * 100, 10, 92), y: clamp(((e.clientY - r.top) / r.height) * 60, 8, 40) });
  };
  const keys = (e: KeyboardEvent) => {
    const d = ({ ArrowLeft: [-6, 0], ArrowRight: [6, 0], ArrowUp: [0, -4], ArrowDown: [0, 4] } as Record<string, [number, number]>)[e.key];
    if (d) { e.preventDefault(); setGoal((g) => ({ x: clamp(g.x + d[0], 10, 92), y: clamp(g.y + d[1], 8, 40) })); }
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setC((k) => (k + 1) % KITES.length); sfx.soft(); }
  };
  const { x, y } = at, color = KITES[c];
  return <div className="kite-sky" role="group" tabIndex={0} onKeyDown={keys}
    aria-label="Fly a kite. Move or tap in the sky to fly it, or use the arrow keys. Tap the sky or press Space to change its colour.">
    <svg viewBox="0 0 100 60" aria-hidden="true" onPointerMove={(e) => e.pointerType === 'mouse' && toward(e)}
      onPointerDown={(e) => { toward(e); setC((k) => (k + 1) % KITES.length); sfx.soft(); }}>
      <rect width="100" height="60" fill="#bfe3f5" />
      <ellipse cx="22" cy="14" rx="9" ry="3" fill="#fff" opacity="0.8" /><ellipse cx="78" cy="9" rx="7" ry="2.4" fill="#fff" opacity="0.8" />
      <path d="M0 56 Q25 50 50 55 T100 54 L100 60 L0 60 Z" fill="#8cbf78" />
      <rect x="13.6" y="50.5" width="0.8" height="3.4" fill="#8a6a46" />
      <path d={`M14 51 Q${(14 + x) / 2} ${Math.max(y, 30) + 14} ${x} ${y + 7}`} stroke="#5b6170" strokeWidth="0.35" fill="none" />
      <g transform={`translate(${x} ${y})`}>
        <path d="M0 -6 L4.5 0 L0 7 L-4.5 0 Z" fill={color} stroke="#3a3a44" strokeWidth="0.3" />
        <path d="M0 -6 L0 7 M-4.5 0 L4.5 0" stroke="#fff" strokeWidth="0.35" opacity="0.8" />
        <path d="M0 7 q-2 3 0 6 q2 3 0 6" stroke="#3a3a44" strokeWidth="0.3" fill="none" />
        {[9, 13, 17].map((t) => <path key={t} d={`M-1.2 ${t} l1.2 0.8 l1.2 -0.8 l-1.2 -0.8 z`} fill={KITES[(c + 1) % KITES.length]} />)}
      </g>
    </svg>
  </div>;
}

export function Lounge({ settings, events, why, onJourney, onHome }: { settings: Settings; events: LogEvent[]; why: 'break' | 'rapid'; onJourney: () => void; onHome: () => void }) {
  const [kit, setKit] = useState(false);
  return <>
    <header className="topbar"><h1 style={{ margin: 0 }}>🛋️ The lounge</h1><span className="spacer" /><Btn className="primary" onPress={onHome}>Back to my island</Btn></header>
    <main className="stack">
      <div className="guide-row"><Guide id={settings.guide} mood="happy" size={72} />
        <div className="bubble">{why === 'rapid' ? 'Good place to stop. Your progress is saved.' : 'Good idea to take a break. Everything you did is saved.'} You can fly a kite, look at your journey, or try on your flight kit. Nothing here is a test.</div></div>
      <section className="card stack" aria-labelledby="kite-h"><h2 id="kite-h" style={{ margin: 0 }}>Fly a kite</h2><KiteSky /></section>
      <div className="tiles">
        <Btn onPress={onJourney}><span className="ico" aria-hidden>🗺️</span>My journey</Btn>
        <Btn onPress={() => setKit(true)}><span className="ico" aria-hidden>🎒</span>Flight kit</Btn>
      </div>
    </main>
    <ModalOverlay className="overlay" isOpen={kit} onOpenChange={setKit} isDismissable>
      <Modal><Dialog className="dialog">
        <Heading slot="title">Flight kit</Heading>
        <KitPanel points={flightPoints(events)} peak={flightPeak(events)} guide={settings.guide} />
        <div className="row" style={{ marginTop: '1rem' }}><span className="spacer" /><Btn className="primary" autoFocus onPress={() => setKit(false)}>Done</Btn></div>
      </Dialog></Modal>
    </ModalOverlay>
  </>;
}
