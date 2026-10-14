// The app shell: home island, and a calm, predictable move between screens.
import { Component, useEffect, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { Dialog, Heading, Modal, ModalOverlay, ToggleButton } from 'react-aria-components';
import type { SkillId, Strand } from '@wayfinder/schema';
import { dayKey, flightPeak, flightPoints, focusSkill, gate, GEAR, gearState, skillsOf, stepOf, strandOf } from '@wayfinder/engine';
import { applyRetention, saveSettings, useEvents, useProgress, useSettings, type Settings } from './db';
import { SKILL, STRAND } from './content';
import { BrandMark, Guide, Island, islandOf, ISLANDS, pieceById } from './art';
import { Session, litFrom, placedFrom } from './Session';
import { Today } from './Today';
import { Onboarding, ComfortPanel } from './Onboarding';
import { Adult } from './Adult';
import { Btn, NewThing } from './ui';
import { FEATURES, nextFeature, opinions } from './features';
import { arcStart, finishedCount, forkMigration, islandArrival, islandAreas, islandsReached, IslandQuest, journeyNow, JourneyMap, LegDots, JOURNEY } from './journey';
import { setSound, setVoice } from './media';
import { autoSave, isFamily, useCloudSync } from './cloud';
import { WhoIsLearning } from './CloudScreens';
import { GearCelebration, KitPanel } from './gear';
import { Lounge } from './Lounge';

type Screen = 'home' | 'session' | 'today' | 'adult' | 'rescout' | 'regrammar' | 'map' | 'lounge';

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
  const progress = useProgress(events, settings?.fastTrack ?? true);
  const [screen, setScreen] = useState<Screen>('home');
  const [dialog, setDialog] = useState<null | 'comfort' | 'shelf' | 'kit'>(null);
  const cloud = useCloudSync();
  const [newHere, setNewHere] = useState(false);
  const [asked, setAsked] = useState<string>(); // the one "What do you think?" card for this visit
  const [visit, setVisit] = useState<string | null>(null); // LTF-36: an earlier island he is looking at
  const [breakWhy, setBreakWhy] = useState<'break' | 'rapid'>('break'); // LTF-38
  useApplySettings(settings);
  useEffect(() => { applyRetention(); }, []);
  // LTF-20: once per fork, keep the old route for a learner who was already past it when the routes arrived.
  useEffect(() => {
    if (!settings?.onboarded || !events) return;
    const fix = forkMigration(settings, finishedCount(progress));
    const arc = arcStart({ ...settings, ...fix }, finishedCount(progress)); // LTF-30
    const ashore = islandArrival({ ...settings, ...fix, ...arc }, finishedCount(progress)); // LTF-36
    if (fix || arc || ashore) void saveSettings({ ...fix, ...arc, ...ashore });
  }, [settings, events, progress]);
  useEffect(() => {
    if (isFamily(cloud.me) && cloud.link === null && settings?.onboarded && settings.name) void autoSave(settings.name);
  }, [cloud.me, cloud.link, settings?.onboarded, settings?.name]);

  // A device with no learner yet waits for the sign-in check, so it can offer the learners saved in the cloud.
  const deciding = settings && !settings.onboarded && (!cloud.checked || cloud.link === undefined);
  if (!settings || !events || deciding) return <div className="center" style={{ minHeight: '100vh' }}><span style={{ width: 80 }}><BrandMark /></span></div>;
  const go = (s: Screen) => {
    // A view transition waits for a drawn frame, so only animate when the app is in front; otherwise switch at once.
    const calm = document.documentElement.dataset.motion !== 'full' || !('startViewTransition' in document) || !document.hasFocus();
    if (calm) setScreen(s);
    else (document as Document & { startViewTransition: (f: () => void) => void }).startViewTransition(() => flushSync(() => setScreen(s)));
    window.scrollTo({ top: 0 });
  };

  if (!settings.onboarded && screen !== 'rescout' && screen !== 'regrammar' && isFamily(cloud.me) && !cloud.link && !newHere)
    return <div className="shell"><WhoIsLearning onNew={() => setNewHere(true)} /></div>;
  if (!settings.onboarded || screen === 'rescout' || screen === 'regrammar')
    return <div className="shell"><Onboarding settings={settings} startAt={screen === 'rescout' ? 'scout' : screen === 'regrammar' ? 'grammar' : 'hello'} onDone={() => go('home')} /></div>;
  if (screen === 'session') return <div className="shell"><Session settings={settings} events={events} progress={progress} onExit={() => go('home')} onBreak={(why) => { setBreakWhy(why); go('lounge'); }} /></div>;
  if (screen === 'lounge') return <div className="shell"><Lounge settings={settings} events={events} why={breakWhy} onJourney={() => go('map')} onHome={() => go('home')} /></div>;
  if (screen === 'today') return <div className="shell"><Today settings={settings} progress={progress} events={events} onExit={() => go('home')} /></div>;
  if (screen === 'map') return <div className="shell"><JourneyMap settings={settings} progress={progress} onExit={() => go('home')} /></div>;
  if (screen === 'adult') return <div className="shell"><Adult settings={settings} events={events} progress={progress} onExit={() => go('home')} onRescout={() => go('rescout')} onGrammar={() => go('regrammar')} /></div>;

  const g = gate(progress, settings.gate);
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
  const jn = journeyNow(finishedCount(progress), settings);
  // LTF-36: the island he is on, or an earlier one he chose to look at.
  const isles = islandsReached(jn);
  const atIsle = islandOf(jn.here.id);
  const isle = visit && isles.includes(visit) ? visit : atIsle;
  const view = islandAreas(isle, jn, settings, lit);
  const placed = placedFrom(events).filter((p) => p.island === isle);
  const lastPiece = placed.at(-1);
  const story = jn.fork ? (jn.fork.kind === 'path' ? 'Captain Ada has two flight paths to Australia. Open My journey to choose one.'
    : jn.fork.kind === 'home' ? "Captain Ada's boat can take you to one more island on the way home. Open My journey to choose it." : `Sea routes leave ${jn.here.name}. Open My journey to choose which island to sail to.`)
    : jn.beat ? `${jn.beat.text}${jn.beat.cope ? ' ' + jn.beat.cope : ''}${jn.beat.choice && jn.beat.chosen === undefined ? ' Open My journey to choose a plan.' : ''}`
    : jn.trip?.done && JOURNEY.home ? JOURNEY.home.stops.at(-1)!.postcard.at(-1)!
    : jn.arc?.done && JOURNEY.arc ? `${JOURNEY.arc.done}${JOURNEY.home && !settings.homeTrip ? ' ' + JOURNEY.home.offer.text + ' Open My journey to choose.' : ''}` : 'You made it to Australia. The koalas are waiting for you.';
  const newThing = asked ? FEATURES.find((f) => f.id === asked) : nextFeature(events);
  const say = `${hello}, ${settings.name}. ${todayDone ? 'You already read today. ' : ''}${story}`;

  return <div className="shell">
    <header className="topbar">
      <span className="brand"><BrandMark />Learning to Fly</span>
      <span className="spacer" />
      <Btn className="quiet iconbtn" aria-label="Comfort settings" onPress={() => setDialog('comfort')}>⚙️</Btn>
    </header>
    <main className="home">
      <div className="stack">
        {isles.length > 1 && <div className="isle-switch" role="group" aria-label="Your islands">{isles.map((id) =>
          <ToggleButton key={id} className="btn small" isSelected={id === isle} onChange={() => setVisit(id === atIsle ? null : id)}>{ISLANDS[id].name}</ToggleButton>)}</div>}
        <Island placed={placed} lit={lit} here={here} peaksOpen={g.available || g.opened} stage={jn.stop} island={view.def} areas={view.open} />
        <p className="muted" style={{ textAlign: 'center', margin: 0 }}>
          {placed.length ? `${isle === 'home' ? 'Your island' : view.def.name} has ${placed.length} ${placed.length === 1 ? 'thing' : 'things'} you added. The newest is the ${pieceById.get(lastPiece!.piece)?.name.toLowerCase()}.` : `Finish a session to add your first thing to ${isle === 'home' ? 'the island' : view.def.name}.`}
        </p>
        {view.def.areas.length > 0 && <IslandQuest def={view.def} open={view.open} current={view.current} />}
      </div>
      <aside className="side">
        <div className="guide-row"><Guide id={settings.guide} size={76} mood="happy" /><div className="bubble">{say}</div></div>
        <div className="hero-actions">
          <Btn className="primary big" autoFocus onPress={() => go('session')}><span className="ico" aria-hidden>📖</span>Start reading</Btn>
          <Btn className="big journey" onPress={() => go('map')}><span className="ico" aria-hidden>🗺️</span>My journey</Btn>
          {jn.next && !jn.fork && <LegDots now={jn} />}
          <Btn className="big nar" onPress={() => go('today')}><span className="ico" aria-hidden>📅</span>Tell about today</Btn>
          <Btn className="big" onPress={() => setDialog('shelf')}><span className="ico" aria-hidden>⭐</span>Things I can do · {shelf.length}</Btn>
          <Btn className="big kit" onPress={() => setDialog('kit')}><span className="ico" aria-hidden>🎒</span>Flight kit · {gearState(flightPoints(events), flightPeak(events)).owned.length} of {GEAR.length}</Btn>
        </div>
        {newThing && <NewThing key={newThing.id} feature={newThing} answered={opinions(events).has(newThing.id)} onShown={setAsked} />}
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

    <GearCelebration peak={flightPeak(events)} guide={settings.guide} seen={settings.kitSeen ?? 0} />
    <ModalOverlay className="overlay" isOpen={!!dialog} onOpenChange={(o) => !o && setDialog(null)} isDismissable>
      <Modal><Dialog className="dialog">
        {dialog === 'comfort' && <><Heading slot="title">How do you like it?</Heading><ComfortPanel settings={settings} /></>}
        {dialog === 'kit' && <><Heading slot="title">Flight kit</Heading><KitPanel points={flightPoints(events)} peak={flightPeak(events)} guide={settings.guide} /></>}
        {dialog === 'shelf' && <><Heading slot="title">Things I can do</Heading>
          {!shelf.length && <p>Your shelf fills up as you learn. Each skill you master adds a line here.</p>}
          <ul className="shelf" style={{ padding: 0 }}>{shelf.map((id: SkillId) => <li key={id} className={`strand-${strandOf(id)}`}><span aria-hidden>{STRAND[strandOf(id)].icon}</span>{SKILL[id].ican}</li>)}</ul></>}
        <div className="row" style={{ marginTop: '1rem' }}><span className="spacer" /><Btn className="primary" autoFocus onPress={() => setDialog(null)}>Done</Btn></div>
      </Dialog></Modal>
    </ModalOverlay>
  </div>;
}
