// The app shell: home island, and a calm, predictable move between screens.
import { Component, useEffect, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import type { SkillId, Strand } from '@wayfinder/schema';
import { dayKey, focusSkill, gate, skillsOf, stepOf, strandOf } from '@wayfinder/engine';
import { applyRetention, useEvents, useProgress, useSettings, type Settings } from './db';
import { SKILL, STRAND } from './content';
import { BrandMark, Guide, Island, pieceById } from './art';
import { Session, litFrom, placedFrom } from './Session';
import { Today } from './Today';
import { Onboarding, ComfortPanel } from './Onboarding';
import { Adult } from './Adult';
import { Btn } from './ui';
import { finishedCount, journeyNow, JourneyMap, LegDots } from './journey';
import { setSound, setVoice } from './media';

type Screen = 'home' | 'session' | 'today' | 'adult' | 'rescout' | 'map';

function useApplySettings(s: Settings | undefined) {
  useEffect(() => {
    if (!s) return;
    const r = document.documentElement;
    if (s.theme === 'auto') r.removeAttribute('data-theme'); else r.dataset.theme = s.theme;
    r.dataset.size = String(s.size);
    r.dataset.font = s.font;
    r.dataset.spacing = s.spacing;
    r.dataset.motion = s.motion === 'auto' ? (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full') : s.motion;
    setSound(s.sound);
    setVoice({ rate: s.rate, voice: s.voice });
  }, [s]);
}

/** If a screen fails, show a calm way back instead of a blank page. Progress is already saved. */
export class Safe extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="center" style={{ minHeight: '80vh' }}><div className="card stack center" style={{ maxWidth: 460 }}>
      <h2>Something did not load.</h2>
      <p>Everything you did is saved. Let's go back to your island.</p>
      <button className="btn primary big" onClick={() => location.reload()}>Back to my island</button>
    </div></main>;
  }
}

export function App() {
  const settings = useSettings();
  const events = useEvents();
  const progress = useProgress(events);
  const [screen, setScreen] = useState<Screen>('home');
  const [dialog, setDialog] = useState<null | 'comfort' | 'shelf'>(null);
  useApplySettings(settings);
  useEffect(() => { applyRetention(); }, []);

  if (!settings || !events) return <div className="center" style={{ minHeight: '100vh' }}><span style={{ width: 80 }}><BrandMark /></span></div>;
  const go = (s: Screen) => {
    // A view transition waits for a drawn frame, so only animate when the app is in front; otherwise switch at once.
    const calm = document.documentElement.dataset.motion !== 'full' || !('startViewTransition' in document) || !document.hasFocus();
    if (calm) setScreen(s);
    else (document as Document & { startViewTransition: (f: () => void) => void }).startViewTransition(() => flushSync(() => setScreen(s)));
    window.scrollTo({ top: 0 });
  };

  if (!settings.onboarded || screen === 'rescout')
    return <div className="shell"><Onboarding settings={settings} startAt={screen === 'rescout' ? 'scout' : 'hello'} onDone={() => go('home')} /></div>;
  if (screen === 'session') return <div className="shell"><Session settings={settings} events={events} progress={progress} onExit={() => go('home')} /></div>;
  if (screen === 'today') return <div className="shell"><Today settings={settings} progress={progress} recounts={events.filter((e) => e.type === 'recount').length} onExit={() => go('home')} /></div>;
  if (screen === 'map') return <div className="shell"><JourneyMap settings={settings} progress={progress} onExit={() => go('home')} /></div>;
  if (screen === 'adult') return <div className="shell"><Adult settings={settings} events={events} progress={progress} onExit={() => go('home')} onRescout={() => go('rescout')} /></div>;

  const g = gate(progress, settings.gate);
  const placed = placedFrom(events);
  const lit = litFrom(progress);
  const strands: Strand[] = ['functional', 'narrative', 'philosophical'];
  const here: Partial<Record<Strand, number>> = {};
  for (const s of strands) {
    const f = focusSkill(progress, s);
    if (!progress.skills[f].everMastered && (s !== 'philosophical' || g.available)) here[s] = stepOf(f) - 1;
  }
  const shelf = strands.flatMap((s) => skillsOf(s).filter((id) => progress.skills[id].everMastered));
  const todayDone = progress.sessions.some((x) => x.finished && dayKey(x.start) === dayKey(Date.now()));
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const lastPiece = placed.at(-1);
  const jn = journeyNow(finishedCount(progress), settings);
  const story = jn.beat
    ? `${jn.beat.text}${jn.beat.cope ? ' ' + jn.beat.cope : ''}${jn.beat.choice && jn.beat.chosen === undefined ? ' Open My journey to choose a plan.' : ''}`
    : 'You made it to Australia. The koalas are waiting for you.';
  const say = `${hello}, ${settings.name}. ${todayDone ? 'You already read today. ' : ''}${story}`;

  return <div className="shell">
    <header className="topbar">
      <span className="brand"><BrandMark />Learning to Fly</span>
      <span className="spacer" />
      <Btn className="quiet iconbtn" aria-label="Comfort settings" onPress={() => setDialog('comfort')}>⚙️</Btn>
    </header>
    <main className="home">
      <div className="stack">
        <Island placed={placed} lit={lit} here={here} peaksOpen={g.available || g.opened} stage={jn.stop} />
        <p className="muted" style={{ textAlign: 'center', margin: 0 }}>
          {placed.length ? `Your island has ${placed.length} ${placed.length === 1 ? 'thing' : 'things'} you added. The newest is the ${pieceById.get(lastPiece!.piece)?.name.toLowerCase()}.` : 'Finish a session to add your first thing to the island.'}
        </p>
      </div>
      <aside className="side">
        <div className="guide-row"><Guide id={settings.guide} size={76} mood="happy" /><div className="bubble">{say}</div></div>
        <div className="hero-actions">
          <Btn className="primary big" autoFocus onPress={() => go('session')}><span className="ico" aria-hidden>📖</span>Start reading</Btn>
          <Btn className="big journey" onPress={() => go('map')}><span className="ico" aria-hidden>🗺️</span>My journey</Btn>
          {jn.next && <LegDots now={jn} />}
          <Btn className="big nar" onPress={() => go('today')}><span className="ico" aria-hidden>📅</span>Tell about today</Btn>
          <Btn className="big" onPress={() => setDialog('shelf')}><span className="ico" aria-hidden>⭐</span>Things I can do · {shelf.length}</Btn>
        </div>
        <section className="paths" aria-label="Your three paths">
          {strands.map((s) => {
            const f = focusSkill(progress, s);
            const closed = s === 'philosophical' && !g.available;
            return <div key={s} className={`path strand-${s}`}>
              <span className="pico" aria-hidden>{STRAND[s].icon}</span>
              <div>
                <div className="pname">{STRAND[s].region}{closed ? ' · coming up' : ''}</div>
                <div className="stones" role="img" aria-label={`${lit[s].filter(Boolean).length} of 6 steps done`}>
                  {lit[s].map((on, i) => <span key={i} className={`stone ${on ? 'lit' : ''} ${here[s] === i ? 'here' : ''}`} aria-hidden>{i + 1}</span>)}
                </div>
                <div className="tagline">{closed ? STRAND[s].short : progress.skills[f].everMastered ? 'All steps done. Reviews keep them strong.' : `Next: ${SKILL[f].name}`}</div>
              </div>
            </div>;
          })}
        </section>
      </aside>
    </main>
    <footer className="bottombar static"><span className="spacer" /><Btn className="quiet small" onPress={() => go('adult')}>Grown-ups</Btn></footer>

    <ModalOverlay className="overlay" isOpen={!!dialog} onOpenChange={(o) => !o && setDialog(null)} isDismissable>
      <Modal><Dialog className="dialog">
        {dialog === 'comfort' && <><Heading slot="title">How do you like it?</Heading><ComfortPanel settings={settings} /></>}
        {dialog === 'shelf' && <><Heading slot="title">Things I can do</Heading>
          {!shelf.length && <p>Your shelf fills up as you learn. Each skill you master adds a line here.</p>}
          <ul className="shelf" style={{ padding: 0 }}>{shelf.map((id: SkillId) => <li key={id} className={`strand-${strandOf(id)}`}><span aria-hidden>{STRAND[strandOf(id)].icon}</span>{SKILL[id].ican}</li>)}</ul></>}
        <div className="row" style={{ marginTop: '1rem' }}><span className="spacer" /><Btn className="primary" autoFocus onPress={() => setDialog(null)}>Done</Btn></div>
      </Dialog></Modal>
    </ModalOverlay>
  </div>;
}
