// The flight kit: his guide gears up for the flight to Australia. A meter in each session, a celebration for
// every new piece, and the whole kit on the home screen. Points reward thinking (LTF-38) and can go down a little, but a
// piece he has earned is his to keep: gear follows his best total.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { flightPeak, flightPoints, GEAR, gearState, type GearPiece } from '@wayfinder/engine';
import { GearContext, Guide, GUIDES } from './art';
import { saveSettings, useEvents, type GuideId } from './db';
import { Btn } from './ui';
import { sfx } from './media';

/** Every guide on screen wears the gear he has earned. */
export function GearProvider({ children }: { children: ReactNode }) {
  const events = useEvents();
  const worn = useMemo(() => gearState(flightPoints(events ?? []), flightPeak(events ?? [])).owned.filter((g) => g.worn).map((g) => g.id), [events]);
  return <GearContext.Provider value={worn}>{children}</GearContext.Provider>;
}

/** Points toward the next piece, with a small "+2" that floats up when points arrive. */
export function KitMeter({ points, peak }: { points: number; peak: number }) {
  const g = gearState(points, peak);
  const prev = useRef(points);
  const [gain, setGain] = useState(0);
  useEffect(() => {
    const d = points - prev.current;
    prev.current = points;
    if (d <= 0) return;
    setGain(d);
    const t = setTimeout(() => setGain(0), 1400);
    return () => clearTimeout(t);
  }, [points]);
  const label = g.next ? `Flight kit: ${g.toNext} more ${g.toNext === 1 ? 'point' : 'points'} to the ${g.next.name.toLowerCase()}` : 'Flight kit complete';
  return <div className="kit-meter" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(g.frac * 100)}>
    <span className="kit-next" aria-hidden>{g.next?.emoji ?? '✈️'}</span>
    <span className="kit-bar" aria-hidden><span style={{ width: `${Math.round(g.frac * 100)}%` }} /></span>
    {gain > 0 && <span className="kit-gain" aria-hidden key={points}>+{gain}</span>}
  </div>;
}

/** Bits of paper that fall once. Hidden when motion is reduced or off. */
export function Confetti() {
  const colors = ['#f4a259', '#5f9fb6', '#9be37c', '#ffd166', '#d64545', '#b48ce0'];
  return <div className="confetti" aria-hidden>
    {Array.from({ length: 36 }, (_, i) => <span key={i} style={{ left: `${(i * 37) % 100}%`, background: colors[i % colors.length], animationDelay: `${(i % 9) * 0.07}s`, transform: `rotate(${i * 23}deg)` }} />)}
  </div>;
}

const listOf = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

/** Celebrates gear he has not been shown yet, over whatever screen he is on. Several new pieces share one celebration. */
export function GearCelebration({ peak, guide, seen }: { peak: number; guide: GuideId; seen: number }) {
  const owned = gearState(peak).owned.length;
  const fresh: GearPiece[] = owned > seen ? GEAR.slice(seen, owned) : [];
  useEffect(() => { if (fresh.length) sfx.gear(); }, [fresh.length]);
  if (!fresh.length) return null;
  const names = listOf(fresh.map((p) => p.name));
  return <ModalOverlay className="overlay" isOpen isDismissable={false}>
    <Modal><Dialog className="dialog celebrate" aria-label={`New flight gear: ${names}`}>
      <Confetti />
      <div className="center stack">
        <Heading slot="title" className="celebrate-title">New flight gear!</Heading>
        <div className="celebrate-guide"><Guide id={guide} mood="happy" size={150} /><span className="celebrate-piece" aria-hidden>{fresh.map((p) => p.emoji).join('')}</span></div>
        <p className="celebrate-name">{names}</p>
        <p style={{ margin: 0 }}>{owned === GEAR.length
          ? `${GUIDES[guide].name} is ready for take-off. Australia, here we come!`
          : `${GUIDES[guide].name} is getting ready to fly to Australia. ${owned} of ${GEAR.length} pieces.`}</p>
        <Btn className="primary big" autoFocus onPress={() => saveSettings({ kitSeen: owned })}>Keep going →</Btn>
      </div>
    </Dialog></Modal>
  </ModalOverlay>;
}

/** The whole kit: what he has, and how far the next piece is. */
export function KitPanel({ points, peak, guide }: { points: number; peak: number; guide: GuideId }) {
  const g = gearState(points, peak);
  return <div className="stack">
    <div className="guide-row"><Guide id={guide} mood="happy" size={110} />
      <div className="bubble">{g.next
        ? <>I have {g.owned.length} of {GEAR.length} pieces for the flight. <b>{g.toNext} more {g.toNext === 1 ? 'point' : 'points'}</b> for the {g.next.name.toLowerCase()}.</>
        : <>We have everything. Ready for take-off!</>}
        <span className="tagline" style={{ display: 'block', marginTop: '0.4rem' }}>Right the first time: four points. Right with the clue: two. When the answer is shown, one comes off. Finishing a session: three. A piece you have earned is yours to keep.</span>
      </div>
    </div>
    <KitMeter points={points} peak={peak} />
    <ul className="kit-grid">
      {GEAR.map((p) => {
        const have = g.owned.includes(p), next = p === g.next;
        return <li key={p.id} className={`kit-item ${have ? 'have' : ''} ${next ? 'next' : ''}`}>
          <span className="kit-emoji" aria-hidden>{have ? p.emoji : '🔒'}</span>
          <span>{p.name}</span>
          <span className="tagline">{have ? 'Got it' : next ? `${g.toNext} more` : `at ${p.at} points`}</span>
        </li>;
      })}
    </ul>
  </div>;
}
