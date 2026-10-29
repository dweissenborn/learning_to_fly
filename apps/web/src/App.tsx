// The app shell: home island, and a calm, predictable move between screens.
import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { Dialog, Heading, Modal, ModalOverlay, ToggleButton } from 'react-aria-components';
import type { SkillId, Strand } from '@wayfinder/schema';
import { dayKey, flightPeak, flightPoints, focusSkill, gate, GEAR, gearState, pictureBalance, sessionsToday, skillsOf, stepOf, strandOf } from '@wayfinder/engine';
import { applyRetention, saveSettings, useAllModuleSettings, useEvents, useProgress, useSettings, type Settings } from './db';
import { SKILL, STRAND } from './content';
import { BrandMark, Guide, Island, islandOf, ISLANDS, pieceById } from './art';
import { Session, litFrom, placedFrom } from './Session';
import { Today } from './Today';
import { Onboarding, ComfortPanel } from './Onboarding';
import { Adult } from './Adult';
import { Btn, NewThing } from './ui';
import { FEATURES, nextFeature, opinions } from './features';
import { arcStart, finishedCount, forkMigration, islandArrival, islandsReached, IslandQuest, islandView, journeyNow, JourneyMap, Keepsakes, LegDots, JOURNEY, questDone } from './journey';
import { setSound, setVoice } from './media';
import { autoSave, isFamily, useCloudSync } from './cloud';
import { SaveProgress, WhoIsLearning } from './CloudScreens';
import { PicturePanel } from './Pictures';
import { GearCelebration, KitPanel } from './gear';
import { MODULES } from './modules';
import { maybeSwitch, startUpdates } from './update';
import { Lounge } from './Lounge';

type Screen = 'home' | 'session' | 'today' | 'adult' | 'rescout' | 'regrammar' | 'map' | 'lounge' | 'module';

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
  const [dialog, setDialog] = useState<null | 'comfort' | 'shelf' | 'kit' | 'pictures'>(null);
  const cloud = useCloudSync();
  const [newHere, setNewHere] = useState(false);
  const [asked, setAsked] = useState<string>(); // the one "What do you think?" card for this visit
  const [visit, setVisit] = useState<string | null>(null); // LTF-36: an earlier island he is looking at
  const [breakWhy, setBreakWhy] = useState<'break' | 'rapid'>('break'); // LTF-38
  const own = useAllModuleSettings(); // each module's own settings (LTF-39)
  const [ext, setExt] = useState<string | null>(null); // the extension module on screen
  useApplySettings(settings);
  // New versions switch in only on the home screen with nothing open, even while the app is in the background (LTF-64).
  const safe = useRef(false);
  safe.current = screen === 'home' && !dialog && !!settings?.onboarded;
  useEffect(() => { void startUpdates(() => safe.current); }, []);
  useEffect(() => { if (safe.current) maybeSwitch(); }, [screen, dialog, settings?.onboarded]);
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
  if (screen === 'module') { const Screen = MODULES.find((m) => m.id === ext)?.Screen; if (Screen) return <div className="shell"><Screen settings={settings} events={events} progress={progress} onExit={() => go('home')} onBreak={(why) => { setBreakWhy(why); go('lounge'); }} /></div>; }
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
  const budgetUsed = !!settings.perDay && sessionsToday(events) >= settings.perDay; // LTF-39: across every subject
  const on = (m: (typeof MODULES)[number]) => !m.enabled || m.enabled(own?.[m.id] ?? {}); // a grown-up turned it on
  // LTF-36: the island he is on, or an earlier one he chose to look at.
  const isles = islandsReached(jn);
  const atIsle = islandOf(jn.here.id);
  const isle = visit && isles.includes(visit) ? visit : atIsle;
  const allPlaced = placedFrom(events);
  const builtOn = (id: string) => new Set(allPlaced.filter((p) => p.island === id).map((p) => p.piece));
  const view = islandView(isle, jn, settings, lit, builtOn(isle));
  const placed = allPlaced.filter((p) => p.island === isle);
  const keepsakes = isle === 'home' ? isles.filter((id) => ISLANDS[id].keepsake).map((id) => ({ def: ISLANDS[id], done: questDone(islandView(id, jn, settings, lit, builtOn(id)).state) })) : [];
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
        <Island placed={placed} lit={lit} here={here} peaksOpen={g.available || g.opened} stage={jn.stop} island={view.def} state={view.state} />
        <p className="muted" style={{ textAlign: 'center', margin: 0 }}>
          {placed.length ? `${isle === 'home' ? 'Your island' : view.def.name} has ${placed.length} ${placed.length === 1 ? 'thing' : 'things'} you added. The newest is the ${pieceById.get(lastPiece!.piece)?.name.toLowerCase()}.` : `Finish a session to add your first thing to ${isle === 'home' ? 'the island' : view.def.name}.`}
        </p>
        {view.def.steps.length > 0 && <IslandQuest def={view.def} state={view.state} current={view.current} />}
        {keepsakes.length > 0 && <Keepsakes items={keepsakes} />}
      </div>
      <aside className="side">
        <div className="guide-row"><Guide id={settings.guide} size={76} mood="happy" /><div className="bubble">{say}</div></div>
        <div className="hero-actions">
          {/* LTF-39: one picker, always here: his last choice is marked so one tap starts it; the day has one budget. */}
          <section className="picker stack" aria-labelledby="pick-h">
            <h2 id="pick-h" className="pick-h">What would you like to do?</h2>
            {MODULES.filter(on).map((m) => { const last = (settings.lastModule ?? 'reading') === m.id, full = !!m.sessions && budgetUsed;
              return <Btn key={m.id} className={`big ${last && !full ? 'primary' : m.id === 'today' ? 'nar' : ''}`} autoFocus={last && !full} isDisabled={full}
                onPress={() => { if (!last) void saveSettings({ lastModule: m.id }); if (m.screen) go(m.screen); else { setExt(m.id); go('module'); } }}>
                <span className="ico" aria-hidden>{m.icon}</span>{m.title}{last && settings.lastModule && <span className="pick-last"> · Last time</span>}</Btn>; })}
            {budgetUsed && <p className="tagline" style={{ margin: 0 }}>That's today's session done. You can tell about today, look at your journey, or rest. More tomorrow.</p>}
          </section>
          <Btn className="big journey" onPress={() => go('map')}><span className="ico" aria-hidden>🗺️</span>My journey</Btn>
          {jn.next && !jn.fork && <LegDots now={jn} />}
          <Btn className="big" onPress={() => setDialog('shelf')}><span className="ico" aria-hidden>⭐</span>Things I can do · {shelf.length}</Btn>
          <Btn className="big kit" onPress={() => setDialog('kit')}><span className="ico" aria-hidden>🎒</span>Flight kit · {gearState(flightPoints(events), flightPeak(events)).owned.length} of {GEAR.length}</Btn>
          <Btn className="big" onPress={() => setDialog('pictures')}><span className="ico" aria-hidden>🎨</span>Draw a picture · {Math.max(0, pictureBalance(events))} points</Btn>
          <SaveProgress />
        </div>
        {newThing && <NewThing key={newThing.id} feature={newThing} answered={opinions(events).has(newThing.id)} onShown={setAsked} />}
        <section className="paths" aria-label="Your paths">
          {strands.map((s) => {
            const f = focusSkill(progress, s);
            const closed = s === 'philosophical' && !g.available;
            return <div key={s} className={`path strand-${s}`}>
              <span className="pico" aria-hidden>{STRAND[s].icon}</span>
              <div>
                <div className="pname">{STRAND[s].region}{closed ? ' · coming up' : ''}{isle !== 'home' && <span className="muted"> · {view.def.names[s === 'functional' ? 'town' : s === 'narrative' ? 'forest' : 'peaks']} here</span>}</div>
                <div className="stones" role="img" aria-label={`${lit[s].filter(Boolean).length} of 6 steps done`}>
                  {lit[s].map((on, i) => <span key={i} className={`stone ${on ? 'lit' : ''} ${here[s] === i ? 'here' : ''}`} aria-hidden>{i + 1}</span>)}
                </div>
                <div className="tagline">{closed ? STRAND[s].short : progress.skills[f].everMastered ? 'All steps done. Reviews keep them strong.' : `Next: ${SKILL[f].name}`}</div>
              </div>
            </div>;
          })}
          {MODULES.filter((m) => m.HomePath && on(m)).map((m) => { const Path = m.HomePath!; return <Path key={m.id} events={events} />; })}
        </section>
      </aside>
    </main>
    <footer className="bottombar static"><span className="spacer" /><Btn className="quiet small" onPress={() => go('adult')}>Grown-ups</Btn></footer>

    <GearCelebration peak={flightPeak(events)} guide={settings.guide} seen={settings.kitSeen ?? 0} />
    <ModalOverlay className="overlay" isOpen={!!dialog} onOpenChange={(o) => !o && setDialog(null)} isDismissable>
      <Modal><Dialog className="dialog">
        {dialog === 'comfort' && <><Heading slot="title">How do you like it?</Heading><ComfortPanel settings={settings} /></>}
        {dialog === 'pictures' && <><Heading slot="title">Draw a picture</Heading><PicturePanel events={events} settings={settings} /></>}
        {dialog === 'kit' && <><Heading slot="title">Flight kit</Heading><KitPanel points={flightPoints(events)} peak={flightPeak(events)} guide={settings.guide} /></>}
        {dialog === 'shelf' && <><Heading slot="title">Things I can do</Heading>
          {!shelf.length && <p>Your shelf fills up as you learn. Each skill you master adds a line here.</p>}
          <ul className="shelf" style={{ padding: 0 }}>{shelf.map((id: SkillId) => <li key={id} className={`strand-${strandOf(id)}`}><span aria-hidden>{STRAND[strandOf(id)].icon}</span>{SKILL[id].ican}</li>)}</ul></>}
        <div className="row" style={{ marginTop: '1rem' }}><span className="spacer" /><Btn className="primary" autoFocus onPress={() => setDialog(null)}>Done</Btn></div>
      </Dialog></Modal>
    </ModalOverlay>
  </div>;
}
