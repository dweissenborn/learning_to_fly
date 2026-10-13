// "Today": telling about his own day, or about a show or video he watched (R16, and his school's routine
// for key details and the main idea). Built from templates, so nothing leaves the app.
// It sits outside the lesson and never changes a mastery score.
import { useMemo, useState } from 'react';
import { Button } from 'react-aria-components';
import type { LogEvent } from '@wayfinder/schema';
import { ideasUse, type Progress } from '@wayfinder/engine';
import { addNote, log, type Settings } from './db';
import { today, type Lesson } from './content';
import { Guide } from './art';
import { Btn, SpeakBtn } from './ui';
import { sfx, useReading } from './media';
import { askable, buildAsks, buildDaySentences, buildStrip, nextKey, ORDER, ownAnswer, skippedKeys, starter, type Part, type QKey } from './recount';
interface Show { kind?: string; name: string; about?: string; problem?: string; events: string[]; ending?: string }

/**
 * Supports fade slowly: one part with tiles, then typing his own words too, then three parts with the tiles behind
 * "Show me ideas", then the whole day in order. Steps back a stage if he leans on the ideas for two weeks (LTF-07).
 */
export function todayStage(settings: Settings, events: readonly LogEvent[]): 1 | 2 | 3 | 4 {
  if (settings.todayStage) return settings.todayStage as 1 | 2 | 3 | 4;
  const n = events.filter((e) => e.type === 'recount').length;
  const base = n < 5 ? 1 : n < 12 ? 2 : n < 20 ? 3 : 4;
  return base >= 3 && ideasUse(events).stepBack ? ((base - 1) as 2 | 3) : base;
}

const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

export function Today({ settings, progress, events, onExit }: { settings: Settings; progress: Progress; events: readonly LogEvent[]; onExit: () => void }) {
  const stage = todayStage(settings, events);
  const day = new Date().getDay();
  const weekend = day === 0 || day === 6;
  const ids = weekend ? today.weekend.map((l) => l.id) : settings.timetable[String(day)]?.length ? settings.timetable[String(day)] : today.defaultTimetable;
  const cards = ids.map((id) => [...today.lessons, ...today.weekend].find((l) => l.id === id)).filter((l): l is Lesson => !!l);
  const n = progress.skills;
  // A narrative step counts once he is practising it, so the recount practises the same step (R16).
  const stepReached = (k: number) => n[`N${k}` as 'N1'].everMastered || n[`N${k}` as 'N1'].answers.length > 0;
  const maxParts = stage >= 4 ? cards.length : stage === 3 ? 3 : 1;

  const [topic, setTopic] = useState<'day' | 'show' | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [at, setAt] = useState<{ part: number; key: QKey } | null>(null);
  const [edit, setEdit] = useState<QKey[] | null>(null); // the questions of a strip panel he tapped to change (LTF-06)
  const [changed, setChanged] = useState(0);
  const [own, setOwn] = useState(''); // from stage 3: his own words after the sentence starter (LTF-07)
  const [ideasOpen, setIdeasOpen] = useState(false);
  const [ideas, setIdeas] = useState<Record<string, boolean>>({}); // `${part}:${question}` -> he opened the ideas
  const [order, setOrder] = useState<string[]>([]);
  const [main, setMain] = useState<string>();
  const [typed, setTyped] = useState('');
  const [show, setShow] = useState<Show>({ name: '', events: [] });
  const [showStep, setShowStep] = useState<'kind' | 'about' | 'problem' | 'events' | 'ending'>('kind');
  const [phase, setPhase] = useState<'pick' | 'ask' | 'order' | 'main' | 'built' | 'card'>('pick');

  // Who and what first. "Was anything hard?" is always asked: noticing when plans change is a school goal.
  // "What happened after that?" follows anything hard, and from stage 2 what he did (LTF-05).
  const asked = { stage, why: stepReached(5) };
  const questions: Record<QKey, { ask: (p: Part) => string; tiles: (p: Part) => { text: string; emoji?: string }[] }> = {
    who: { ask: (p) => `In ${p.lesson.name}, who were you with?`, tiles: () => [...today.who, ...settings.people].map((t) => ({ text: t })) },
    what: { ask: (p) => `What did you do in ${p.lesson.name}?`, tiles: (p) => p.lesson.what.map((t) => ({ text: t })) },
    afterDone: { ask: () => 'What happened after that?', tiles: () => today.after.done.map((t) => ({ text: t })) },
    feeling: { ask: () => 'How did you feel?', tiles: () => today.feelings.map((f) => ({ text: f.word, emoji: f.emoji })) },
    why: { ask: (p) => `Why did you feel ${p.feeling ?? 'that way'}?`, tiles: () => today.why.map((t) => ({ text: t })) },
    hard: { ask: () => 'Was anything hard, or did something go wrong?', tiles: () => today.hard.map((t) => ({ text: t })) },
    afterHard: { ask: () => 'What happened after that?', tiles: () => today.after.hard.map((t) => ({ text: t })) },
  };

  const startAsking = () => {
    const ps = picked.map((id) => ({ lesson: cards.find((c) => c.id === id)! }));
    setParts(ps);
    setAt({ part: 0, key: nextKey(ps[0], null, asked)! });
    setPhase('ask');
  };
  const answer = (value: string, usedIdeas = false) => {
    if (!at) return;
    setOwn('');
    setIdeasOpen(false);
    setIdeas((m) => ({ ...m, [`${at.part}:${at.key}`]: usedIdeas }));
    const part = { ...parts[at.part], [at.key]: value || undefined };
    const ps = parts.map((p, i) => (i === at.part ? part : p));
    setParts(ps);
    if (edit) {
      const next = edit.slice(edit.indexOf(at.key) + 1).find((k) => askable(k, part, asked));
      if (next) setAt({ ...at, key: next });
      else { setEdit(null); setPhase('built'); }
      return;
    }
    const next = nextKey(part, at.key, asked);
    if (next) setAt({ ...at, key: next });
    else if (at.part + 1 < ps.length) setAt({ part: at.part + 1, key: nextKey(ps[at.part + 1], null, asked)! });
    else afterAsking();
  };
  const change = (part: number, keys: QKey[]) => {
    const first = keys.find((k) => askable(k, parts[part], asked));
    if (!first) return;
    setEdit(keys);
    setChanged((n) => n + 1);
    setAt({ part, key: first });
    setPhase('ask');
  };
  const afterAsking = () => {
    if (parts.length > 1 && stepReached(2)) setPhase('order');
    else if (parts.length > 1) setPhase('main');
    else setPhase('built');
  };

  const sentences = useMemo(() => {
    const out: string[] = [];
    if (topic === 'show') {
      if (show.kind) out.push(`I watched ${show.kind}${show.name.trim() ? ` called ${show.name.trim()}` : ''}.`);
      if (show.about) out.push(`It was mostly about ${show.about}.`);
      if (show.problem) out.push(show.problem === 'there was no big problem' ? 'There was no big problem.' : `The problem: ${show.problem}.`);
      if (show.events.length) out.push(`Important things that happened: ${list(show.events)}.`);
      if (show.ending) out.push(`At the end, ${show.ending}.`);
    } else out.push(...buildDaySentences(parts, { order, weekend, main }));
    if (typed.trim()) out.push(typed.trim());
    return out;
  }, [topic, show, parts, order, main, typed, weekend]);

  const asks = useMemo(() => {
    const a: string[] = [];
    if (topic === 'show') {
      a.push(...today.show.ask);
      if (show.about) a.push(`You said it was mostly about ${show.about}. What makes you say that?`);
      if (show.events[0]) a.push(`You said ${show.events[0]}. What happened then?`);
      return [...new Set(a)].slice(0, 4);
    }
    return buildAsks(parts);
  }, [topic, show, parts]);

  const save = async () => {
    const date = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    await addNote({ kind: 'recount', personal: true, title: topic === 'show' ? `${date}: ${show.name.trim() || show.kind || 'a show'}` : date, text: sentences.join(' '), ask: asks });
    await log({
      type: 'recount', stage, parts: topic === 'show' ? 1 : parts.length, typed: !!typed.trim(), topic: topic ?? 'day',
      sentences: sentences.length, skipped: topic === 'show' ? [] : skippedKeys(parts, asked), ...(topic === 'show' ? {} : { changed }),
      ...(hideTiles ? { ideas: parts.flatMap((p, i) => ORDER.filter((k) => askable(k, p, asked) && p[k]).map((k) => !!ideas[`${i}:${k}`])) } : {}), after: parts.some((p) => !!(p.afterHard || p.afterDone)),
    });
    sfx.finish();
    setPhase('card');
  };

  const guideSay = (t: string) => <div className="guide-row"><Guide id={settings.guide} size={64} /><div className="bubble appear">{t} <SpeakBtn lines={[t]} k={'today-' + t} label="" className="small iconbtn" /></div></div>;
  const tiles = (items: { text: string; emoji?: string }[], onPick: (t: string) => void, on?: (t: string) => boolean) =>
    <div className="tiles" role="group" aria-label="Choices">
      {items.map((t) => <Button key={t.text} className={`tile ${on?.(t.text) ? 'on' : ''}`} aria-pressed={on ? on(t.text) : undefined} onPress={() => onPick(t.text)}>
        {t.emoji && <span className="temoji" aria-hidden>{t.emoji}</span>}{t.text}
      </Button>)}
    </div>;
  const asText = (xs: string[]) => xs.map((text) => ({ text }));
  const hideTiles = topic === 'day' && stage >= 3; // LTF-07

  // LTF-06: the day as four panels per part, in the order he gave. Play it aloud reads one panel at a time.
  const reading = useReading();
  const ordered = order.length === parts.length ? order.map((id) => parts.find((p) => p.lesson.id === id)!) : parts;
  let line = 0;
  const strips = ordered.map((p) => ({ p, at: parts.indexOf(p), panels: buildStrip(p, { weekend }).map((x) => ({ ...x, line: x.text ? line++ : -1 })) }));
  const mainLine = main ? `The main thing about today was ${main}.` : undefined;
  const stripLines = [...strips.flatMap((s) => s.panels.flatMap((x) => (x.text ? [x.text] : []))), ...(mainLine ? [mainLine] : [])];

  return <>
    <header className="topbar"><h1 style={{ margin: 0 }}>📅 Today</h1><span className="spacer" /><Btn className="quiet small" onPress={onExit}>← Back to island</Btn></header>
    <main className="stack">
      {phase === 'pick' && !topic && <>
        {guideSay('What do you want to tell about?')}
        <div className="today-cards" role="group" aria-label="What to tell about">
          <Button className="tcard" onPress={() => setTopic('day')}><span className="temoji" aria-hidden>📅</span>My day</Button>
          <Button className="tcard" onPress={() => { setTopic('show'); setPhase('ask'); }}><span className="temoji" aria-hidden>📺</span>A show or video</Button>
        </div>
      </>}

      {phase === 'pick' && topic === 'day' && <>
        {guideSay(weekend ? 'No school today. Pick something you did.' : maxParts === 1 ? 'Here is your school day. Pick one part to tell about.' : `Here is your school day. Pick up to ${maxParts} parts to tell about.`)}
        <div className="today-cards" role="group" aria-label="Parts of your day">
          {cards.map((c) => {
            const on = picked.includes(c.id);
            return <Button key={c.id} className={`tcard ${on ? 'on' : ''}`} aria-pressed={on}
              onPress={() => setPicked((p) => (on ? p.filter((x) => x !== c.id) : maxParts === 1 ? [c.id] : p.length < maxParts ? [...p, c.id] : p))}>
              <span className="temoji" aria-hidden>{c.emoji}</span>{c.name}
            </Button>;
          })}
        </div>
        <Btn className="primary big" isDisabled={!picked.length} onPress={startAsking}>Next →</Btn>
      </>}

      {phase === 'ask' && topic === 'show' && <>
        {showStep === 'kind' && <>
          {guideSay('What did you watch?')}
          <div className="field"><label htmlFor="show-name">Its name, if you want to type it</label>
            <input id="show-name" className="input" value={show.name} onChange={(e) => setShow({ ...show, name: e.target.value })} autoComplete="off" /></div>
          {tiles(today.show.kinds, (k) => { setShow({ ...show, kind: k }); setShowStep('about'); })}
        </>}
        {showStep === 'about' && <>
          {guideSay('What was it mostly about?')}
          {tiles(asText(today.show.mostlyAbout), (t) => { setShow({ ...show, about: t }); setShowStep('problem'); })}
        </>}
        {showStep === 'problem' && <>
          {guideSay('What was the problem?')}
          {tiles(asText(today.show.problem), (t) => { setShow({ ...show, problem: t }); setShowStep('events'); })}
        </>}
        {showStep === 'events' && <>
          {guideSay('Pick up to three important things that happened.')}
          {tiles(asText(today.show.events), (t) => setShow((s) => ({ ...s, events: s.events.includes(t) ? s.events.filter((x) => x !== t) : s.events.length < 3 ? [...s.events, t] : s.events })), (t) => show.events.includes(t))}
          <Btn className="primary big" isDisabled={!show.events.length} onPress={() => setShowStep('ending')}>Next →</Btn>
        </>}
        {showStep === 'ending' && <>
          {guideSay('How did it end?')}
          {tiles(asText(today.show.ending), (t) => { setShow({ ...show, ending: t }); setPhase('built'); })}
        </>}
      </>}

      {phase === 'ask' && topic === 'day' && at && <>
        <div className="chip" style={{ width: 'fit-content' }}>{parts[at.part].lesson.emoji} {parts[at.part].lesson.name}</div>
        {guideSay(questions[at.key].ask(parts[at.part]))}
        {!hideTiles ? tiles(questions[at.key].tiles(parts[at.part]), (t) => answer(t)) : <>
          <form className="starter" onSubmit={(e) => { e.preventDefault(); if (own.trim()) answer(ownAnswer(at.key, own)); }}>
            <label htmlFor="own-words">{starter(at.key, parts[at.part], { weekend })}</label>
            <input id="own-words" className="input" value={own} onChange={(e) => setOwn(e.target.value)} autoComplete="off" />
            <Btn type="submit" className="primary" isDisabled={!own.trim()}>Next</Btn>
          </form>
          {ideasOpen ? tiles(questions[at.key].tiles(parts[at.part]), (t) => answer(t, true))
            : <Btn className="big" onPress={() => setIdeasOpen(true)}><span className="ico" aria-hidden>💡</span>Show me ideas</Btn>}
        </>}
        <Btn className="quiet small" onPress={() => answer('')}>Skip this one</Btn>
      </>}

      {phase === 'order' && <>
        {guideSay('What came first? Tap them in order.')}
        <div className="tiles">{parts.filter((p) => !order.includes(p.lesson.id)).map((p) => <Button key={p.lesson.id} className="tile" onPress={() => {
          const o = [...order, p.lesson.id];
          setOrder(o);
          if (o.length === parts.length) setPhase('main');
        }}><span className="temoji" aria-hidden>{p.lesson.emoji}</span>{p.lesson.name}</Button>)}</div>
        <ol>{order.map((id) => <li key={id}>{parts.find((p) => p.lesson.id === id)?.lesson.name}</li>)}</ol>
      </>}

      {phase === 'main' && <>
        {guideSay('What was the main thing about today?')}
        <div className="tiles">{parts.map((p) => <Button key={p.lesson.id} className="tile" onPress={() => { setMain(p.lesson.name); setPhase('built'); }}><span className="temoji" aria-hidden>{p.lesson.emoji}</span>{p.lesson.name}</Button>)}</div>
      </>}

      {phase === 'built' && topic === 'show' && <>
        {guideSay('Here is what you told me. You can read it aloud, or show your grown-up.')}
        <div className="built" aria-live="polite">{sentences.map((s, i) => <p key={i}>{s}</p>)}</div>
        <SpeakBtn lines={sentences} k="today-built" label="Play it aloud" />
      </>}
      {phase === 'built' && topic === 'day' && <>
        {guideSay('Here is what you told me. Tap a box to change it, read it aloud, or show your grown-up.')}
        {strips.map(({ p, at: pi, panels }) => <section key={p.lesson.id} className="stack" style={{ gap: '0.4rem' }}>
          {strips.length > 1 && <h2 className="chip" style={{ width: 'fit-content', margin: 0, fontSize: '1rem' }}>{p.lesson.emoji} {p.lesson.name}</h2>}
          <ol className="strip" aria-label={`${p.lesson.name}, in four parts`}>
            {panels.map((x) => {
              const body = <><span className="plabel">{x.label}</span><span className={x.text ? 'ptext' : 'ptext muted'}>{x.text ?? 'skipped'}</span></>;
              const live = reading.key === 'today-strip' && reading.line === x.line;
              return <li key={x.label} className={`panel ${live ? 'reading' : ''}`}>
                {x.keys.some((k) => askable(k, p, asked)) ? <Button className="pbox" onPress={() => change(pi, x.keys)}>{body}<span className="pchange">Change</span></Button> : <div className="pbox">{body}</div>}
              </li>;
            })}
          </ol>
        </section>)}
        {mainLine && <p className="built" style={{ margin: 0 }}>{mainLine}</p>}
        <SpeakBtn lines={stripLines} k="today-strip" label="Play it aloud" />
      </>}
      {phase === 'built' && <>
        {(stage >= 2 || topic === 'show') && <div className="field">
          <label htmlFor="today-typed">Add your own words, if you want to.</label>
          <textarea id="today-typed" className="express-note" placeholder="Also, ..." value={typed} onChange={(e) => setTyped(e.target.value)} />
        </div>}
        <Btn className="primary big" onPress={save}>Save and show my grown-up</Btn>
      </>}

      {phase === 'card' && <>
        <div className="built"><div className="muted" style={{ fontSize: '0.9rem' }}>{settings.name || 'Your learner'} says:</div>{sentences.map((s, i) => <p key={i}>{s}</p>)}</div>
        <div className="card talk">
          <h3>For the grown-up: ask about these</h3>
          <p className="muted">{topic === 'show' ? 'His school suggests this: important details first, then what it was mostly about.' : 'Specific questions work better than “What happened at school?”.'}</p>
          <ul>{asks.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
        <Btn className="primary big" onPress={onExit}>Back to my island</Btn>
      </>}
    </main>
  </>;
}
