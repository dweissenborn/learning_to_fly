// First run: the adult sets up, the learner picks a guide and interests, then a short scouting trip places him by profile (R1).
import { useEffect, useState } from 'react';
import { Button } from 'react-aria-components';
import type { Item, SkillId, Topic } from '@wayfinder/schema';
import { grammarSet, placementItems, placementStart, placementSupports } from '@wayfinder/engine';
import { log, saveSettings, useEvents, type GuideId, type Settings } from './db';
import { createAndLink, isFamily, useCloudStatus, useLink } from './cloud';
import { placement, pool, TOPICS, type GrammarItem } from './content';
import { Guide, GUIDES, BrandMark } from './art';
import { ItemView, type Result } from './ItemView';
import { Btn, Seg, SpeakBtn, Toggle } from './ui';
import { canSpeak, speak, stopSpeaking } from './media';

type Step = 'hello' | 'guide' | 'interests' | 'comfort' | 'scout' | 'words' | 'reading' | 'listening' | 'grammar' | 'break' | 'functional' | 'narrative' | 'done';

export function Onboarding({ settings, startAt = 'hello', onDone }: { settings: Settings; startAt?: Step; onDone: () => void }) {
  const [step, setStep] = useState<Step>(startAt);
  const [name, setName] = useState(settings.name);
  const [pin, setPin] = useState(settings.pin);
  const [scores, setScores] = useState(settings.scout ?? { word: 0, reading: 0, listening: 0 });
  const g = settings.guide;
  const events = useEvents() ?? [];
  const alone = startAt === 'grammar'; // Starting point can run the "Who did it?" stop on its own (LTF-13)
  const cloud = useCloudStatus();
  const linked = useLink();
  const family = isFamily(cloud.me);
  const header = <header className="topbar"><span className="brand"><BrandMark />Learning to Fly</span><span className="spacer" />
    {['words', 'reading', 'listening', 'grammar', 'functional', 'narrative'].includes(step) && !alone && <Btn className="quiet small" onPress={() => finishScout(scores, {})}>Stop scouting for now</Btn>}
  </header>;

  // Placement: steps below the first miss start as mastered and are confirmed by review.
  const finishScout = async (s: typeof scores, starts: { functional?: number; narrative?: number }) => {
    stopSpeaking();
    await log({ type: 'placement', functional: starts.functional ?? 1, narrative: starts.narrative ?? 1, word: s.word, reading: s.reading, listening: s.listening, ...(s.grammar !== undefined ? { grammar: s.grammar } : {}) });
    // Placement only ever switches supports on. Turning one off is the adult's call.
    const sup = placementSupports(s);
    await saveSettings({ readAloud: settings.readAloud || sup.readAloud, pictures: settings.pictures || sup.pictures, scout: s });
    setStep('done');
  };
  const [starts, setStarts] = useState<{ functional?: number; narrative?: number }>({});
  // Run on its own, the stop keeps his starting steps and earlier scores: placement only ever adds mastered steps.
  const grammarAlone = async (grammar: number) => {
    const last = [...events].reverse().find((e) => e.type === 'placement');
    const base = last?.type === 'placement' ? last : { functional: 1, narrative: 1, ...(settings.scout ?? { word: 0, reading: 0, listening: 0 }) };
    await log({ type: 'placement', functional: base.functional, narrative: base.narrative, word: base.word, reading: base.reading, listening: base.listening, grammar, ...(last?.type === 'placement' && last.manual ? { manual: true } : {}) });
    await saveSettings({ scout: { ...(settings.scout ?? { word: base.word, reading: base.reading, listening: base.listening }), grammar } });
    setStep('done');
  };

  return <>{header}<main className="stack" style={{ maxWidth: 900, margin: '0 auto', width: '100%' }}>
    {step === 'hello' && <div className="card stack">
      <h1>Welcome to Learning to Fly</h1>
      <p>A reading program built for one learner. Set it up together, then hand over the device.</p>
      <div className="field"><label htmlFor="nick">The learner's nickname</label><input id="nick" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" /></div>
      <div className="field"><label htmlFor="pin">A 4-digit code for the grown-ups' area (optional)</label><input id="pin" className="input" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} autoComplete="off" /></div>
      <p className="muted">{family
        ? "Progress is saved on this device and in your family's private cloud copy, so it opens on any device where a family member signs in."
        : 'Progress stays on this device. Nothing is sent anywhere.'} Only a nickname is stored: no real name, photo, birthday or diagnosis.</p>
      <Btn className="primary big" isDisabled={!name.trim()} onPress={async () => {
        await saveSettings({ name: name.trim(), pin });
        // Saved to the cloud straight away when signed in; offline, the grown-ups' Data tab can do it later.
        if (family && !linked) void createAndLink(name.trim()).catch(() => {});
        setStep('guide');
      }}>Next →</Btn>
    </div>}

    {step === 'guide' && <div className="stack">
      <h1>Hi {name}. Pick your guide.</h1>
      <p>Your guide shows you how things work. You can change your guide later.</p>
      <div className="choose">{(Object.keys(GUIDES) as GuideId[]).map((id) => <Button key={id} className={`ccard ${g === id ? 'strand-narrative' : ''}`} style={{ justifyItems: 'center', textAlign: 'center' }} aria-pressed={g === id} onPress={() => saveSettings({ guide: id })}>
        <Guide id={id} size={110} mood={g === id ? 'happy' : 'idle'} /><span className="cname">{GUIDES[id].name}</span><span>{GUIDES[id].blurb}</span>
      </Button>)}</div>
      <Btn className="primary big" onPress={() => setStep('interests')}>{GUIDES[g].name} it is →</Btn>
    </div>}

    {step === 'interests' && <div className="stack">
      <div className="guide-row"><Guide id={g} size={64} /><div className="bubble">What do you like? Pick as many as you want. I will find stories about them.</div></div>
      <div className="today-cards">{TOPICS.map((t) => {
        const on = settings.interests.includes(t.id);
        return <Button key={t.id} className={`tcard ${on ? 'on' : ''}`} aria-pressed={on} onPress={() => saveSettings({ interests: on ? settings.interests.filter((x) => x !== t.id) : [...settings.interests, t.id as Topic] })}>
          <span className="temoji" aria-hidden>{t.emoji}</span>{t.label}
        </Button>;
      })}</div>
      <Btn className="primary big" onPress={() => setStep('comfort')}>Next →</Btn>
    </div>}

    {step === 'comfort' && <div className="stack">
      <div className="guide-row"><Guide id={g} size={64} /><div className="bubble">How do you like the screen? You can change this any time with the ⚙️ button.</div></div>
      <ComfortPanel settings={settings} />
      <Btn className="primary big" onPress={() => setStep('scout')}>Next →</Btn>
    </div>}

    {step === 'scout' && <div className="stack">
      <div className="guide-row"><Guide id={g} size={72} /><div className="bubble">
        Now a short scouting trip. It helps me find where you should start. Some questions will be easy and some will be hard. That is how scouting works. There are no hints, and you cannot lose anything.
      </div></div>
      <div className="card"><ol style={{ margin: 0 }}><li>Words: match a word to a picture.</li><li>Read a short story.</li><li>Listen to a short story.</li><li>Who did it? Tap the picture.</li><li>A few questions from each part of the island.</li></ol></div>
      <div className="row"><Btn className="primary big" onPress={() => setStep('words')}>Start scouting →</Btn><Btn className="quiet" onPress={() => finishScout(scores, {})}>Skip, start at step 1</Btn></div>
    </div>}

    {step === 'words' && <WordCheck guide={g} onDone={(word) => { setScores((s) => ({ ...s, word })); setStep('reading'); }} />}
    {step === 'reading' && <Probe key="r" guide={g} items={placement.reading.items} onDone={(c) => { setScores((s) => ({ ...s, reading: c })); setStep(canSpeak ? 'listening' : 'grammar'); }} />}
    {step === 'listening' && <Probe key="l" guide={g} items={placement.listening.items} listen onDone={(c) => { setScores((s) => ({ ...s, listening: c })); setStep('grammar'); }} />}
    {step === 'grammar' && <GrammarCheck guide={g} set={placement.grammar[grammarSet(events, placement.grammar.length)]}
      onDone={(grammar) => { if (alone) void grammarAlone(grammar); else { setScores((s) => ({ ...s, grammar })); setStep('break'); } }} />}
    {step === 'break' && <div className="stack center card">
      <Guide id={g} size={90} mood="happy" />
      <h2>Halfway there.</h2>
      <p>Take a break if you want. Next: a few questions from Harbor Town and Story Woods.</p>
      <div className="row"><Btn className="primary big" onPress={() => setStep('functional')}>Keep going →</Btn><Btn onPress={() => finishScout(scores, {})}>Finish later</Btn></div>
    </div>}
    {step === 'functional' && <Ladder key="f" guide={g} items={placementItems(pool, 'functional')} onDone={(n) => { setStarts((s) => ({ ...s, functional: n })); setStep('narrative'); }} />}
    {step === 'narrative' && <Ladder key="n" guide={g} items={placementItems(pool, 'narrative')} onDone={(n) => finishScout(scores, { ...starts, narrative: n })} />}

    {step === 'done' && <div className="stack center card">
      <Guide id={g} size={110} mood="happy" />
      <h1>Your island is ready.</h1>
      <p>Each time you finish a session, you add something new to it.</p>
      <p>Far away is Australia, where koalas live. Each session takes you a little closer.</p>
      <Btn className="primary big" autoFocus onPress={async () => { await saveSettings({ onboarded: true }); onDone(); }}>Go to my island →</Btn>
    </div>}
  </main></>;
}

const logPlacement = (item: Item, r: Result) =>
  log({ type: 'answer', session: 'placement', item: item.id, skill: item.skill, phase: 'placement', correct: r.correct, hint: 0, tries: r.tries, ms: r.ms, format: item.format });

function WordCheck({ guide, onDone }: { guide: GuideId; onDone: (score: number) => void }) {
  const [i, setI] = useState(0);
  const [right, setRight] = useState(0);
  const w = placement.words[i];
  const pick = (k: number) => {
    const r = right + (k === w.answer ? 1 : 0);
    if (i + 1 < placement.words.length) { setRight(r); setI(i + 1); } else onDone(r / placement.words.length);
  };
  return <div className="stack">
    <div className="guide-row"><Guide id={guide} size={56} /><div className="bubble">Read the word. Tap the picture that matches it. ({i + 1} of {placement.words.length})</div></div>
    <div className="card center"><span style={{ fontSize: '3rem', fontWeight: 800, letterSpacing: '0.04em' }}>{w.word}</span></div>
    <div className="choose" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>{w.options.map((o, k) => <Button key={k} className="tcard" aria-label={`Picture ${k + 1}`} onPress={() => pick(k)}><span style={{ fontSize: '3.4rem' }} aria-hidden>{o}</span></Button>)}</div>
  </div>;
}

/** LTF-13: "Who did it?" Six one-sentence grammar items, each answered by tapping a picture. About two minutes. */
function GrammarCheck({ guide, set, onDone }: { guide: GuideId; set: GrammarItem[]; onDone: (share: number) => void }) {
  const [i, setI] = useState(0);
  const [right, setRight] = useState(0);
  const it = set[i];
  const pick = (k: number) => {
    const r = right + (k === it.answer ? 1 : 0);
    if (i + 1 < set.length) { setRight(r); setI(i + 1); } else onDone(r / set.length);
  };
  return <div className="stack">
    <h2 style={{ margin: 0 }}>Who did it?</h2>
    <div className="guide-row"><Guide id={guide} size={56} /><div className="bubble">Read the sentence. {it.ask} Tap the picture. ({i + 1} of {set.length})</div></div>
    <div className="card center"><span style={{ fontSize: '1.6rem', fontWeight: 700 }}>{it.sentence}</span></div>
    <SpeakBtn lines={[it.sentence, it.ask]} k={`grammar-${i}`} className="small" />
    <div className="choose" style={{ gridTemplateColumns: `repeat(${it.options.length}, 1fr)` }}>{it.options.map((o, k) =>
      <Button key={`${i}-${k}`} className="tcard" onPress={() => pick(k)}><span style={{ fontSize: '3rem' }} aria-hidden>{o.emoji}</span>{o.label}</Button>)}</div>
  </div>;
}

function Probe({ guide, items, listen, onDone }: { guide: GuideId; items: Item[]; listen?: boolean; onDone: (share: number) => void }) {
  const [i, setI] = useState(0);
  const [right, setRight] = useState(0);
  const p = pool.passages.get(items[0].passage)!;
  useEffect(() => { if (listen) speak(p.sentences, p.id); return () => stopSpeaking(); }, [listen, p]);
  const item = items[i];
  useEffect(() => { if (listen && i > 0) speak([item.prompt, ...item.options!.map((o, k) => `${k + 1}. ${o}`)], 'q'); }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="stack">
    <div className="guide-row"><Guide id={guide} size={56} /><div className="bubble">{listen ? 'Listen to the story. Then answer.' : 'Read the story. Then answer.'} ({i + 1} of {items.length})
      {listen && <SpeakBtn lines={[item.prompt, ...item.options!.map((o, k) => `${k + 1}. ${o}`)]} k="probe-q" label="Hear the question" className="small" />}</div></div>
    <ItemView key={item.id} item={item} mode="none" guide={guide} listenOnly={listen} onDone={(r) => {
      logPlacement(item, r);
      const n = right + (r.correct ? 1 : 0);
      if (i + 1 < items.length) { setRight(n); setI(i + 1); } else onDone(n / items.length);
    }} />
  </div>;
}

/** One item per step, in order. A strand stops after two misses. */
function Ladder({ guide, items, onDone }: { guide: GuideId; items: Item[]; onDone: (start: number) => void }) {
  const [i, setI] = useState(0);
  const [results, setResults] = useState<{ skill: SkillId; correct: boolean }[]>([]);
  if (!items.length) { queueMicrotask(() => onDone(1)); return null; }
  const item = items[i];
  return <div className="stack">
    <div className="guide-row"><Guide id={guide} size={56} /><div className="bubble">Scouting: question {i + 1}. Do your best.</div></div>
    <ItemView key={item.id} item={item} mode="none" guide={guide} onDone={(r) => {
      logPlacement(item, r);
      const res = [...results, { skill: item.skill, correct: r.correct }];
      setResults(res);
      if (res.filter((x) => !x.correct).length >= 2 || i + 1 >= items.length) onDone(placementStart(res));
      else setI(i + 1);
    }} />
  </div>;
}

export function ComfortPanel({ settings }: { settings: Settings }) {
  const s = settings;
  return <div className="card stack">
    <Seg label="Colours" value={s.theme} onChange={(theme) => saveSettings({ theme })} options={[['auto', 'Match device'], ['light', 'Light'], ['dark', 'Dark'], ['calm', 'Calm'], ['contrast', 'High contrast']]} />
    <Seg label="Text size" value={s.size} onChange={(size) => saveSettings({ size })} options={[[1, 'Small'], [2, 'Medium'], [3, 'Large'], [4, 'Extra large']]} />
    <Seg label="Letters" value={s.font} onChange={(font) => saveSettings({ font })} options={[['atkinson', 'Clear'], ['lexend', 'Wide'], ['system', 'Plain']]} />
    <Seg label="Line spacing" value={s.spacing} onChange={(spacing) => saveSettings({ spacing })} options={[['normal', 'Normal'], ['wide', 'Wide']]} />
    <Seg label="Movement" value={s.motion} onChange={(motion) => saveSettings({ motion })} options={[['auto', 'Match device'], ['full', 'Full'], ['reduced', 'Less'], ['off', 'None']]} />
    <Toggle on={s.sound} onChange={(sound) => saveSettings({ sound })}>Soft sounds</Toggle>
    {canSpeak && <>
      <Toggle on={s.readAloud} onChange={(readAloud) => saveSettings({ readAloud })}>Read everything aloud to me</Toggle>
      <Seg label="Reading voice speed" value={s.rate} onChange={(rate) => saveSettings({ rate })} options={[[0.7, 'Slow'], [0.9, 'Medium'], [1.05, 'Quick']]} />
    </>}
    <Toggle on={s.pictures} onChange={(pictures) => saveSettings({ pictures })}>Show pictures with answers</Toggle>
  </div>;
}
