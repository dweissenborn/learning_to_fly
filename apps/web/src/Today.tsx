// "Today": telling about his own day, cued by his timetable (R16). Built from templates, so nothing leaves the app.
// It sits outside the lesson and never changes a mastery score.
import { useMemo, useState } from 'react';
import { Button } from 'react-aria-components';
import type { Progress } from '@wayfinder/engine';
import { addNote, log, type Settings } from './db';
import { today, type Lesson } from './content';
import { Guide } from './art';
import { Btn, SpeakBtn } from './ui';
import { sfx } from './media';

interface Part { lesson: Lesson; who?: string; what?: string; feeling?: string; why?: string; hard?: string }

/** Supports fade slowly: one part with tiles, then starters and typing, then three parts, then the whole day in order. */
export function todayStage(settings: Settings, recounts: number): 1 | 2 | 3 | 4 {
  if (settings.todayStage) return settings.todayStage as 1 | 2 | 3 | 4;
  return recounts < 5 ? 1 : recounts < 12 ? 2 : recounts < 20 ? 3 : 4;
}

export function Today({ settings, progress, recounts, onExit }: { settings: Settings; progress: Progress; recounts: number; onExit: () => void }) {
  const stage = todayStage(settings, recounts);
  const day = new Date().getDay();
  const weekend = day === 0 || day === 6;
  const ids = weekend ? today.weekend.map((l) => l.id) : settings.timetable[String(day)]?.length ? settings.timetable[String(day)] : today.defaultTimetable;
  const cards = ids.map((id) => [...today.lessons, ...today.weekend].find((l) => l.id === id)).filter((l): l is Lesson => !!l);
  const n = progress.skills;
  // A narrative step counts once he is practising it, so the recount practises the same step (R16).
  const stepReached = (k: number) => n[`N${k}` as 'N1'].everMastered || n[`N${k}` as 'N1'].answers.length > 0;
  const maxParts = stage >= 4 ? cards.length : stage === 3 ? 3 : 1;

  const [picked, setPicked] = useState<string[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [at, setAt] = useState<{ part: number; q: number } | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [main, setMain] = useState<string>();
  const [typed, setTyped] = useState('');
  const [phase, setPhase] = useState<'pick' | 'ask' | 'order' | 'main' | 'built' | 'card'>('pick');

  // Questions grow with the narrative ladder: who and what first; why at step 5; something hard at step 3.
  const questions = useMemo(() => {
    const q: { key: keyof Part; ask: (p: Part) => string; tiles: (p: Part) => { text: string; emoji?: string }[] }[] = [
      { key: 'who', ask: (p) => `In ${p.lesson.name}, who were you with?`, tiles: () => [...today.who, ...settings.people].map((t) => ({ text: t })) },
      { key: 'what', ask: (p) => `What did you do in ${p.lesson.name}?`, tiles: (p) => p.lesson.what.map((t) => ({ text: t })) },
      { key: 'feeling', ask: () => 'How did you feel?', tiles: () => today.feelings.map((f) => ({ text: f.word, emoji: f.emoji })) },
    ];
    if (stepReached(5) || stage >= 2) q.push({ key: 'why', ask: (p) => `Why did you feel ${p.feeling ?? 'that way'}?`, tiles: () => today.why.map((t) => ({ text: t })) });
    if (stepReached(3)) q.push({ key: 'hard', ask: () => 'Was anything hard, or did something go wrong?', tiles: () => today.hard.map((t) => ({ text: t })) });
    return q;
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  const startAsking = () => { setParts(picked.map((id) => ({ lesson: cards.find((c) => c.id === id)! }))); setAt({ part: 0, q: 0 }); setPhase('ask'); };
  const answer = (value: string) => {
    if (!at) return;
    const key = questions[at.q].key;
    setParts((ps) => ps.map((p, i) => (i === at.part ? { ...p, [key]: value } : p)));
    if (at.q + 1 < questions.length) setAt({ ...at, q: at.q + 1 });
    else if (at.part + 1 < parts.length) setAt({ part: at.part + 1, q: 0 });
    else afterAsking();
  };
  const afterAsking = () => {
    if (parts.length > 1 && stepReached(2)) setPhase('order');
    else if (parts.length > 1 && stepReached(6)) setPhase('main');
    else setPhase('built');
  };

  const sentences = useMemo(() => {
    const out: string[] = [];
    const ordered = order.length === parts.length ? order.map((id) => parts.find((p) => p.lesson.id === id)!) : parts;
    if (order.length === parts.length && parts.length > 1) {
      const words = ['First', 'Then', 'Next', 'After that', 'Then'];
      ordered.forEach((p, i) => out.push(`${i === ordered.length - 1 ? 'Last' : words[i]}, I had ${p.lesson.name}.`));
    }
    for (const p of ordered) {
      if (p.what) out.push(weekend ? `Today, I ${p.what}.` : `In ${p.lesson.name}, I ${p.what}.`);
      if (p.who) out.push(p.who === 'by myself' ? 'I worked by myself.' : `I was with ${p.who}.`);
      if (p.feeling) out.push(`I felt ${p.feeling}${p.why ? ` because ${p.why}` : ''}.`);
      if (p.hard && p.hard !== 'nothing was hard') out.push(`Something hard: ${p.hard}.`);
    }
    if (main) out.push(`The main thing about today was ${main}.`);
    if (typed.trim()) out.push(typed.trim());
    return out;
  }, [parts, order, main, typed, weekend]);

  const asks = useMemo(() => {
    const a: string[] = [];
    for (const p of parts) {
      a.push(...p.lesson.ask.slice(0, 2));
      if (p.feeling) a.push(`You said you felt ${p.feeling}. What made you feel ${p.feeling}?`);
      if (p.hard && p.hard !== 'nothing was hard') a.push(`You said: ${p.hard}. What happened then?`);
    }
    return [...new Set(a)].slice(0, 4);
  }, [parts]);

  const save = async () => {
    await addNote({ kind: 'recount', personal: true, title: new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }), text: sentences.join(' '), ask: asks });
    await log({ type: 'recount', stage, parts: parts.length, typed: !!typed.trim() });
    sfx.finish();
    setPhase('card');
  };

  const guideSay = (t: string) => <div className="guide-row"><Guide id={settings.guide} size={64} /><div className="bubble appear">{t} <SpeakBtn lines={[t]} k={'today-' + t} label="" className="small iconbtn" /></div></div>;

  return <>
    <header className="topbar"><h1 style={{ margin: 0 }}>📅 Today</h1><span className="spacer" /><Btn className="quiet small" onPress={onExit}>← Back to island</Btn></header>
    <main className="stack">
      {phase === 'pick' && <>
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

      {phase === 'ask' && at && <>
        <div className="chip" style={{ width: 'fit-content' }}>{parts[at.part].lesson.emoji} {parts[at.part].lesson.name}</div>
        {guideSay(questions[at.q].ask(parts[at.part]))}
        <div className="tiles" role="group" aria-label="Choices">
          {questions[at.q].tiles(parts[at.part]).map((t) => <Button key={t.text} className="tile" onPress={() => answer(t.text)}>{t.emoji && <span className="temoji" aria-hidden>{t.emoji}</span>}{t.text}</Button>)}
        </div>
        <Btn className="quiet small" onPress={() => answer('')}>Skip this one</Btn>
      </>}

      {phase === 'order' && <>
        {guideSay('What came first? Tap them in order.')}
        <div className="tiles">{parts.filter((p) => !order.includes(p.lesson.id)).map((p) => <Button key={p.lesson.id} className="tile" onPress={() => {
          const o = [...order, p.lesson.id];
          setOrder(o);
          if (o.length === parts.length) setPhase(stepReached(6) ? 'main' : 'built');
        }}><span className="temoji" aria-hidden>{p.lesson.emoji}</span>{p.lesson.name}</Button>)}</div>
        <ol>{order.map((id) => <li key={id}>{parts.find((p) => p.lesson.id === id)?.lesson.name}</li>)}</ol>
      </>}

      {phase === 'main' && <>
        {guideSay('What was the main thing about today?')}
        <div className="tiles">{parts.map((p) => <Button key={p.lesson.id} className="tile" onPress={() => { setMain(p.lesson.name); setPhase('built'); }}><span className="temoji" aria-hidden>{p.lesson.emoji}</span>{p.lesson.name}</Button>)}</div>
      </>}

      {phase === 'built' && <>
        {guideSay('Here is what you told me. You can read it aloud, or show your grown-up.')}
        <div className="built" aria-live="polite">{sentences.map((s, i) => <p key={i}>{s}</p>)}</div>
        <SpeakBtn lines={sentences} k="today-built" label="Play it aloud" />
        {stage >= 2 && <div className="field">
          <label htmlFor="today-typed">Add your own words, if you want to.</label>
          <textarea id="today-typed" className="express-note" placeholder="Also, ..." value={typed} onChange={(e) => setTyped(e.target.value)} />
        </div>}
        <Btn className="primary big" onPress={save}>Save and show my grown-up</Btn>
      </>}

      {phase === 'card' && <>
        <div className="built"><div className="muted" style={{ fontSize: '0.9rem' }}>{settings.name || 'Your learner'} says:</div>{sentences.map((s, i) => <p key={i}>{s}</p>)}</div>
        <div className="card talk">
          <h3>For the grown-up: ask about these</h3>
          <p className="muted">Specific questions work better than “What happened at school?”.</p>
          <ul>{asks.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
        <Btn className="primary big" onPress={onExit}>Back to my island</Btn>
      </>}
    </main>
  </>;
}
