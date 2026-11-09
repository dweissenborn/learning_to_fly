// LTF-65: a chapter a sitting. He reads the pages, each with a picture of the same hilltop; where a plan falls through he
// picks what to do next, and the story follows his pick; then two questions from the chapter (a key detail, and what it
// was mostly about) and a new line for his clue notebook. A chapter finishes like any session: the journey moves.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'react-aria-components';
import { ALL_SKILLS, pointsFor } from '@wayfinder/engine';
import { Btn, Finish, finishedCount, Guide, GUIDES, log, SaveMenu, saveModuleSettings, sfx, SpeakBtn, stopSpeaking, useReading, type ScreenProps } from '@wayfinder/web/host';
import { BOOK, itemId, KINDS, MAIN_PROMPT, paragraphs, say, type Chapter, type Picks, type StoryState } from '../book';
import { Scene } from './Scene';

const WIDE = { maxWidth: 720, margin: '0 auto', width: '100%' } as const;
const MAIN_CLUE = 'One choice is only a small part of the chapter. One choice did not happen. Pick the one that tells about the whole chapter.';
const Top = ({ label }: { label?: string }) => <header className="topbar strand-story"><h1 style={{ margin: 0, fontSize: '1.4rem' }}>📚 {BOOK.title}</h1><span className="spacer" />{label && <span className="muted">{label}</span>}<SaveMenu /></header>;

/** A page's words in short paragraphs. Read-aloud lights each sentence as it is spoken; `hl` marks the line that holds an answer. */
export function Lines({ lines, k, hl }: { lines: string[]; k?: string; hl?: number }) {
  const reading = useReading();
  return <div>{paragraphs(lines).map((para) => <p key={para[0]} className="prose">{para.map((i) =>
    <span key={i}><span className={`sentence ${k && reading.key === k && reading.line === i ? 'reading' : ''} ${hl === i ? 'hl' : ''}`}>{lines[i]}</span>{' '}</span>)}</p>)}</div>;
}

/** His clue notebook: one line from each chapter he has finished. */
export function Notebook({ upTo, picks, guide, fresh }: { upTo: number; picks: Picks; guide: string; fresh?: boolean }) {
  if (!upTo) return null;
  return <section className="card soft stack" aria-labelledby="clues-h">
    <h2 id="clues-h" style={{ margin: 0, fontSize: '1.15rem' }}><span aria-hidden>🔎</span> Your clue notebook</h2>
    <ol className="story-clues">{BOOK.chapters.slice(0, upTo).map((c, i) => <li key={i} className={fresh && i === upTo - 1 ? 'new' : undefined}>{say(c.clue, picks, guide)}</li>)}</ol>
  </section>;
}

interface Result { correct: boolean; shown: boolean; tries: number; ms: number }
/** One question from the chapter. A miss opens a clue for one more try; a second miss shows the answer and why. */
function Ask({ ch, kind, picks, guide, guideId, onDone }: { ch: Chapter; kind: 'detail' | 'main'; picks: Picks; guide: string; guideId: ScreenProps['settings']['guide']; onDone: (r: Result) => void }) {
  const q = ch[kind];
  const [tried, setTried] = useState<number[]>([]);
  const [state, setState] = useState<null | 'clue' | 'right' | 'helped' | 'shown'>(null);
  const start = useRef(Date.now());
  const done = state !== null && state !== 'clue';
  const prompt = q.prompt ? say(q.prompt, picks, guide) : MAIN_PROMPT;
  const options = q.options.map((o) => say(o, picks, guide)), explain = say(q.explain, picks, guide);
  const pick = (i: number) => {
    if (i === q.answer) { if (tried.length) setState('helped'); else { setState('right'); sfx.good(); } return; }
    setTried([...tried, i]);
    setState(tried.length ? 'shown' : 'clue');
  };
  const [pg, ln] = q.evidence ?? [0, 0], from = Math.max(0, ln - 2);
  return <div className="stack">
    <div className="row"><h2 style={{ margin: 0, flex: 1, fontSize: '1.3rem' }}>{prompt}</h2><SpeakBtn lines={[prompt, ...options]} k={`story-q-${kind}`} label="" className="small iconbtn" /></div>
    <div className="options" role="group" aria-label="Answers">{options.map((o, i) =>
      <Button key={i} className={['opt', tried.includes(i) && 'tried', done && i === q.answer && (state === 'shown' ? 'hinted' : 'right')].filter(Boolean).join(' ')}
        isDisabled={done || tried.includes(i)} onPress={() => pick(i)}><span>{o}</span></Button>)}</div>
    <div aria-live="polite" className="stack">
      {state === 'clue' && <div className="feedback hint appear"><Guide id={guideId} mood="think" size={44} /><div className="stack" style={{ gap: '0.5rem' }}>
        {q.evidence ? <><span>Read this part again. Try once more.</span><Lines lines={ch.pages[pg].text.slice(from, ln + 3).map((t) => say(t, picks, guide))} hl={ln - from} /></> : <span>{MAIN_CLUE} Try once more.</span>}
      </div></div>}
      {state === 'right' && <div className="feedback good appear"><Guide id={guideId} mood="happy" size={44} /><span><b>Right.</b> {explain}</span></div>}
      {state === 'helped' && <div className="feedback neutral appear"><Guide id={guideId} size={44} /><span><b>You found it with the clue.</b> {explain}</span></div>}
      {state === 'shown' && <div className="feedback neutral appear"><Guide id={guideId} mood="think" size={44} /><span><b>Here is the answer.</b> {explain}</span></div>}
    </div>
    {done && <Btn className="primary big appear" autoFocus onPress={() => onDone({ correct: state === 'right', shown: state === 'shown', tries: tried.length + (state === 'shown' ? 0 : 1), ms: Date.now() - start.current })}>Next <span aria-hidden>→</span></Btn>}
  </div>;
}

export function StoryScreen({ settings, events, progress, onExit, onBreak, own }: ScreenProps & { own: StoryState }) {
  const total = BOOK.chapters.length;
  const [n] = useState(() => Math.min(own.chapter ?? 0, total)); // this sitting's chapter: it stays put when the next one is saved
  const [again, setAgain] = useState<number | null>(null); // reading a finished chapter again: its pages only, nothing logged
  const [stage, setStage] = useState<'cover' | 'read' | 'detail' | 'main' | 'clue' | 'finish'>('cover');
  const [step, setStep] = useState(0);
  const [mine, setMine] = useState<Picks>({});
  const sid = useMemo(() => 'story-' + crypto.randomUUID(), []);
  const before = useMemo(() => ({ mastered: new Set(ALL_SKILLS.filter((s) => progress.skills[s].everMastered)), opened: progress.gateOpened, finished: finishedCount(progress) }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const started = useRef(false);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [stage, step, again]); // braces: newer browsers return a promise from scrollTo, and an effect may only return a clean-up
  const guide = GUIDES[settings.guide].name, picks = { ...own.picks, ...mine };
  const text = (t: Parameters<typeof say>[0]) => say(t, picks, guide);
  const go = (s: typeof stage, at = 0) => { stopSpeaking(); setStage(s); setStep(at); };
  const breakBar = <footer className="bottombar"><Btn className="quiet" onPress={() => { stopSpeaking(); if (started.current) void log({ type: 'session', session: sid, action: 'stop', reason: 'break', module: 'story' }); onBreak('break'); }}>
    <span className="ico" aria-hidden>⏸️</span><span className="lbl">I need a break</span></Btn><span className="spacer" /></footer>;

  if (stage === 'cover') {
    const ch = BOOK.chapters[n];
    return <><Top /><main className="stack" style={WIDE}>
      {ch ? <section className="card stack" aria-labelledby="chapter-h">
        <div className="row"><span className="chip">Chapter {n + 1} of {total}</span></div>
        <h2 id="chapter-h" style={{ margin: 0, fontSize: '1.7rem' }}>{ch.title}</h2>
        <Scene spec={ch.pages[0].scene} picks={picks} />
        <p style={{ margin: 0 }}>{n ? <><b>Last time:</b> {text(BOOK.chapters[n - 1].recap)}</> : BOOK.blurb}</p>
        <div className="row"><Btn className="primary big" autoFocus onPress={() => { if (!started.current) { started.current = true; void log({ type: 'session', session: sid, action: 'start', module: 'story' }); } go('read'); }}>Start chapter {n + 1}</Btn>
          <Btn className="quiet" onPress={onExit}>Back to my island</Btn></div>
      </section> : <section className="card stack center" aria-labelledby="chapter-h">
        <Guide id={settings.guide} mood="happy" size={96} />
        <h2 id="chapter-h" style={{ margin: 0 }}>You finished the book</h2>
        <Scene spec={BOOK.chapters[total - 1].pages.at(-1)!.scene} picks={picks} />
        <p style={{ margin: 0 }}>You solved the mystery of the nine o'clock wind. You can read any chapter again.</p>
        <Btn className="primary big" autoFocus onPress={onExit}>Back to my island</Btn>
      </section>}
      <Notebook upTo={n} picks={picks} guide={guide} />
      {n > 0 && <section className="card soft stack" aria-labelledby="again-h">
        <h2 id="again-h" style={{ margin: 0, fontSize: '1.15rem' }}>Read a chapter again</h2>
        <div className="row" style={{ flexWrap: 'wrap' }}>{BOOK.chapters.slice(0, n).map((c, i) => <Btn key={i} className="small" onPress={() => { setAgain(i); go('read'); }}>{i + 1}. {c.title}</Btn>)}</div>
      </section>}
    </main></>;
  }

  const k = again ?? n, ch = BOOK.chapters[k];
  if (stage === 'finish') return <Finish sid={sid} plan={null} done={[]} settings={settings} events={events} progress={progress} before={before} onExit={onExit} module="story" talk={ch.talk} />;

  if (stage === 'read') {
    const choice = again === null ? ch.choice : undefined;
    const steps = ch.pages.flatMap((_, i): (number | 'choice')[] => (choice?.after === i ? [i, 'choice'] : [i]));
    const at = steps[step], last = step === steps.length - 1;
    const next = () => (!last ? go('read', step + 1) : again === null ? go('detail') : (setAgain(null), go('cover')));
    const nav = (ready = true) => <div className="row">
      {step > 0 && <Btn onPress={() => go('read', step - 1)}><span aria-hidden>←</span> Back</Btn>}
      {again !== null && <Btn className="quiet" onPress={() => { setAgain(null); go('cover'); }}>Close the chapter</Btn>}
      <span className="spacer" />
      <Btn className="primary big" isDisabled={!ready} onPress={next}>{last && again !== null ? 'Done' : 'Next'} <span aria-hidden>→</span></Btn>
    </div>;
    if (at === 'choice' && choice) {
      const chosen = choice.options.find((o) => o.value === mine[choice.key]);
      const lead = [choice.obstacle, choice.notice, choice.cope].filter((x): x is string => !!x);
      return <><Top label={`Chapter ${k + 1} · your choice`} /><main className="stack" style={WIDE}>
        <Scene spec={ch.pages[choice.after].scene} picks={picks} />
        {lead.length > 0 && <div className="feedback neutral"><span className="ico" aria-hidden>🔀</span><div className="stack" style={{ gap: '0.3rem' }}><b>{lead[0]}</b>{lead.slice(1).map((x) => <span key={x}>{x}</span>)}</div></div>}
        <div className="guide-row"><Guide id={settings.guide} mood="think" size={72} /><div className="bubble">{choice.ask}</div></div>
        <div className="row"><span className="spacer" /><SpeakBtn lines={[...lead, choice.ask, ...choice.options.map((o) => o.label)]} k={`story-choice-${k}`} className="small" /></div>
        <div className="options" role="group" aria-label="Your choice">{choice.options.map((o) =>
          <Button key={o.value} className={`opt ${chosen === o ? 'picked' : ''}`} aria-pressed={chosen === o} onPress={() => {
            setMine({ ...mine, [choice.key]: o.value });
            void saveModuleSettings('story', { picks: { ...picks, [choice.key]: o.value } }); // the whole map: the save merges one level deep
          }}><span>{o.label}</span></Button>)}</div>
        <div aria-live="polite">{chosen && <div className="feedback good appear"><Guide id={settings.guide} mood="happy" size={44} /><span>{chosen.reply}</span></div>}</div>
        {nav(!!chosen)}
      </main>{breakBar}</>;
    }
    const page = at as number, lines = ch.pages[page].text.map(text), key = `story-${k}-${page}`;
    return <><Top label={`Chapter ${k + 1} · page ${page + 1} of ${ch.pages.length}`} /><main className="stack" style={WIDE}>
      <div className="row"><h2 style={{ margin: 0, flex: 1, fontSize: '1.3rem' }}>{ch.title}</h2><SpeakBtn lines={lines} k={key} className="small" /></div>
      <Scene spec={ch.pages[page].scene} picks={picks} />
      <Lines lines={lines} k={key} />
      {nav()}
    </main>{again === null && breakBar}</>;
  }

  if (stage === 'clue') return <><Top label={`Chapter ${n + 1} · your notebook`} /><main className="stack" style={WIDE}>
    <div className="guide-row"><Guide id={settings.guide} mood="happy" size={72} /><div className="bubble">A new line for your clue notebook.</div></div>
    <Notebook upTo={n + 1} picks={picks} guide={guide} fresh />
    <Btn className="primary big" autoFocus onPress={() => { void saveModuleSettings('story', { chapter: n + 1 }); go('finish'); }}>Finish chapter {n + 1}</Btn>
  </main>{breakBar}</>;

  const [kind, skill, label] = KINDS[stage === 'detail' ? 0 : 1];
  return <><Top label={`Chapter ${n + 1} · question ${stage === 'detail' ? 1 : 2} of 2`} /><main className="stack" style={WIDE}>
    <div className="row"><span className="chip">{label}</span></div>
    <Ask key={kind} ch={ch} kind={kind} picks={picks} guide={guide} guideId={settings.guide} onDone={(r) => {
      void log({ type: 'answer', session: sid, item: itemId(n, kind), skill, phase: 'yourturn', correct: r.correct, hint: r.correct ? 0 : 1, tries: r.tries, ms: r.ms, format: 'choice', module: 'story',
        ...(r.shown ? { shown: true } : {}), points: pointsFor({ correct: r.correct, shown: r.shown }) });
      go(stage === 'detail' ? 'main' : 'clue');
    }} />
  </main>{breakBar}</>;
}
