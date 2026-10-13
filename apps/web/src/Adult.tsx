// The grown-ups' area: what to practise and when to step in (R7), plus the controls the plan reserves for an adult.
import { useEffect, useMemo, useState } from 'react';
import { Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import type { Item, LogEvent, SkillId, Strand } from '@wayfinder/schema';
import { ALL_SKILLS, checkupResults, dayKey, delayEffect, errorPatterns, formatEffect, ideasUse, placementSupports, reasonRecord, recountTrend, flightPoints, freshness, FRESH_LOW, focusSkill, gate, GEAR, gearState, hintNeed, insights, interestEffect, journeyPosition, levelFor, sessionActivity, skillsOf, statusOf, STEP_LABEL, strandOf, tagAccuracy, trend, type Insight, type Progress, type StepName } from '@wayfinder/engine';
import { finishedCount, JOURNEY, journeyNow } from './journey';
import { deleteNote, exportAll, importAll, log, saveSettings, updateNote, useNotes, wipeAll, type GuideId, type Settings } from './db';
import { deleteEverywhere, useLink } from './cloud';
import { CloudCard } from './CloudScreens';
import { pool, SKILL, STRAND, today, TOPICS } from './content';
import { creditLine } from './Passage';
import { ItemView } from './ItemView';
import { ComfortPanel } from './Onboarding';
import { Guide, GUIDES } from './art';
import { Btn, Seg, Toggle } from './ui';
import { AMOUNT, FEATURES, LIKE, opinions } from './features';
import { canSpeak, speak, voices } from './media';

type Tab = 'overview' | 'skills' | 'activity' | 'today' | 'content' | 'settings' | 'data';
const STATUS_CLASS = { 'not started': '', learning: 'learning', mastered: 'mastered', 'review due': 'due' } as const;
const fmtDate = (ts?: number) => (ts ? new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '–');

export function Adult({ settings, events, progress, onExit, onRescout, onGrammar }: { settings: Settings; events: LogEvent[]; progress: Progress; onExit: () => void; onRescout: () => void; onGrammar: () => void }) {
  const [unlocked, setUnlocked] = useState(!settings.pin);
  const [code, setCode] = useState('');
  const [tab, setTab] = useState<Tab>('overview');
  const [report, setReport] = useState(false);
  if (!unlocked) return <main className="center" style={{ minHeight: '80vh' }}>
    <form className="card stack" style={{ maxWidth: 380 }} onSubmit={(e) => { e.preventDefault(); if (code === settings.pin) setUnlocked(true); }}>
      <h2>Grown-ups only</h2>
      <label htmlFor="code">Enter the 4-digit code</label>
      <input id="code" className="input" inputMode="numeric" maxLength={4} autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
      <div className="row"><Btn type="submit" className="primary">Open</Btn><Btn className="quiet" onPress={onExit}>Back</Btn></div>
    </form>
  </main>;
  if (report) return <Report settings={settings} events={events} progress={progress} onBack={() => setReport(false)} />;

  return <>
    <header className="topbar no-print"><h1 style={{ margin: 0 }}>Grown-ups</h1><span className="spacer" /><Btn onPress={onExit}>Back to the island</Btn></header>
    <main className="stack">
      <nav className="tabs" aria-label="Sections">
        {([['overview', 'Overview'], ['skills', 'Skills'], ['activity', 'Activity'], ['today', 'Today recounts'], ['content', 'Content library'], ['settings', 'Settings'], ['data', 'Data and report']] as [Tab, string][]).map(([t, l]) =>
          <Btn key={t} className="small" aria-current={tab === t ? 'page' : undefined} onPress={() => setTab(t)}>{l}</Btn>)}
      </nav>
      {tab === 'overview' && <Overview settings={settings} events={events} progress={progress} />}
      {tab === 'skills' && <Skills progress={progress} events={events} />}
      {tab === 'activity' && <Activity events={events} settings={settings} progress={progress} />}
      {tab === 'today' && <TodayAdmin settings={settings} events={events} />}
      {tab === 'content' && <Library settings={settings} />}
      {tab === 'settings' && <SettingsTab settings={settings} progress={progress} onRescout={onRescout} onGrammar={onGrammar} />}
      {tab === 'data' && <DataTab name={settings.name} onReport={() => setReport(true)} />}
    </main>
  </>;
}

function Overview({ settings, events, progress }: { settings: Settings; events: LogEvent[]; progress: Progress }) {
  const now = Date.now();
  const g = gate(progress, settings.gate);
  const sessions = progress.sessions.filter((s) => !s.gatecheck);
  const minutes = Math.round(progress.sessions.reduce((n, s) => n + ((s.end ?? s.start) - s.start), 0) / 60000);
  const ie = interestEffect(progress);
  const placement = [...events].reverse().find((e) => e.type === 'placement');
  const grammar = [...events].reverse().find((e) => e.type === 'placement' && e.grammar !== undefined);
  const g13 = grammar?.type === 'placement' ? grammar.grammar : undefined;
  const recounts = events.filter((e) => e.type === 'recount').length;
  const notes = useNotes();
  const lastRecount = notes.find((n) => n.kind === 'recount');
  const pct = (b: { correct: number; total: number }) => (b.total < 10 ? `${b.correct} of ${b.total} right, too few to compare yet` : `${Math.round((100 * b.correct) / b.total)}% of ${b.total}`);
  const days = new Set(progress.sessions.map((s) => dayKey(s.start))).size;

  return <div className="grid2">
    <section className="card stack">
      <h2>{settings.name || 'Learner'}</h2>
      <div className="kv">
        <span>Sessions finished</span><b>{sessions.filter((s) => s.finished).length} <span className="muted">({sessions.filter((s) => !s.finished).length} stopped early)</span></b>
        <span>Days used</span><b>{days}</b>
        <span>Time reading</span><b>{minutes} min</b>
        <span>Today recounts</span><b>{recounts}</b>
        <span>Journey</span><b>{(() => { const j = journeyNow(finishedCount(progress), settings); return j.fork ? `${j.here.name}, choosing a sea route` : j.next ? `${j.here.name}, ${j.legLength - j.step} more to ${j.next.name}` : `In Australia, ${Math.min(j.after + 1, JOURNEY.koalas.length)} koalas met`; })()}</b>
      </div>
      <p className="tagline">Studies of reading programs like this one measured gains after about 25 sessions, so give it that long before judging. Mastery needs two good days on a skill, so steady short sessions work best.</p>
    </section>
    <section className="card stack">
      <h2>Next steps</h2>
      {(['functional', 'narrative'] as Strand[]).map((s) => {
        const f = focusSkill(progress, s);
        return <div key={s} className={`path strand-${s}`}><span className="pico">{STRAND[s].icon}</span><div>
          <div className="pname">{STRAND[s].region}: step {f[1]}, {SKILL[f].name}</div>
          <div className="tagline">Try at home: {SKILL[f].offline}</div>
        </div></div>;
      })}
    </section>
    <section className="card stack">
      <h2>Lantern Peaks (philosophical strand)</h2>
      <ul className="gate-list" style={{ paddingLeft: '1.1rem', margin: 0 }}>
        <li>{g.conditions.narrative ? '✅' : '⬜'} Narrative steps 1 to 5 mastered</li>
        <li>{g.conditions.functional ? '✅' : '⬜'} Functional steps 1 to 3 mastered</li>
        <li>{g.conditions.lasted ? '✅' : '⬜'} Each has passed its 21-day review</li>
        <li>{g.conditions.inference ? '✅' : '⬜'} 80% on the inference check, no hints</li>
      </ul>
      <p className="tagline">{g.available ? 'Open now. It takes at most one session in four.' : g.opened && g.resting ? 'Resting while an earlier skill recovers. Nothing earned is taken away.' : 'Shown to him as “coming up”.'}</p>
      <Seg label="Your override" value={settings.gate} onChange={(gate) => saveSettings({ gate })} options={[['auto', 'Follow the rules'], ['open', 'Open early'], ['hold', 'Hold back']]} />
      <Toggle on={settings.hardThemes} onChange={(hardThemes) => saveSettings({ hardThemes })}>Allow hard themes (loss, illness, fear)</Toggle>
    </section>
    <section className="card stack">
      <h2>Does his interest help?</h2>
      <p className="tagline">Texts about a child's interests helped in one study but not in others, so the app checks it for him: one pick in five ignores his interests on purpose, which keeps this comparison fair.</p>
      <div className="kv"><span>Interest topics</span><b>{pct(ie.interest)}</b><span>Other topics</span><b>{pct(ie.other)}</b></div>
      {placement?.type === 'placement' && <><h3 style={{ marginTop: '0.8rem' }}>Starting point</h3>
        <div className="kv"><span>Word reading</span><b>{Math.round(placement.word * 100)}%</b><span>Reading a story</span><b>{Math.round(placement.reading * 100)}%</b><span>Listening to a story</span><b>{Math.round(placement.listening * 100)}%</b>
          <span>Started at</span><b>Functional step {placement.functional}, narrative step {placement.narrative}</b>
          <span>Sentence grammar</span><b>{g13 === undefined ? 'not checked yet' : `${Math.round(g13 * 100)}% (who did it, in six sentences)`}</b></div>
        {g13 !== undefined && placementSupports({ word: 1, reading: 1, listening: 1, grammar: g13 }).names &&
          <p className="tagline">Suggested: turn on "Names instead of he and she in the easiest texts" in Settings, under Learning.</p>}</>}
    </section>
    {lastRecount && <section className="card stack talk">
      <h2>Latest “Today”: {lastRecount.title}</h2>
      <p>{lastRecount.text}</p>
      {lastRecount.ask && <ul>{lastRecount.ask.map((a) => <li key={a}>{a}</li>)}</ul>}
    </section>}
    <FreshWarning settings={settings} progress={progress} />
    <SchoolGoals progress={progress} />
    <Messages progress={progress} />
    <Checkups events={events} progress={progress} settings={settings} />
    <Votes events={events} />
    <section className="card stack"><h2>Due for review</h2>
      {ALL_SKILLS.filter((s) => statusOf(progress.skills[s], now) === 'review due').map((s) => <div key={s}>{SKILL[s].name} <span className="chip due">review due</span></div>)}
      {!ALL_SKILLS.some((s) => statusOf(progress.skills[s], now) === 'review due') && <p className="muted">Nothing due. Reviews come back at about 3, 7 and 21 days after mastery, inside the warm-up.</p>}
    </section>
  </div>;
}

/** LTF-18: his votes on new things, next to each feature. */
function Votes({ events }: { events: LogEvent[] }) {
  const votes = opinions(events);
  const said = (f: (typeof FEATURES)[number]) => {
    const v = votes.get(f.id);
    if (v) return [LIKE.find(([k]) => k === v.like)![2], v.amount && AMOUNT.find(([k]) => k === v.amount)![1]].filter(Boolean).join(' · ');
    return f.met(events) ? 'Not answered yet' : 'Not used yet';
  };
  return <section className="card stack">
    <h2>What he thinks of new things</h2>
    <div className="kv">{FEATURES.map((f) => <span key={f.id} style={{ display: 'contents' }}>
      <span>{f.name} <span className="muted">(arrived {fmtDate(Date.parse(f.arrived + 'T12:00'))})</span></span><b>{said(f)}</b>
    </span>)}</div>
    <p className="tagline">He is asked once, on his island, after he first uses something new: does he like it, and is there too much of it or too little. At most one question a visit, never during a lesson.</p>
  </section>;
}

/** The school's current goals, measured on first-time answers (warm-up and your turn). */
const GOALS: [string, string][] = [['main-idea', 'Main idea'], ['key-detail', 'Key details'], ['problem-solving', 'Problem-solving'], ['plan-change', 'Reading about changed plans']];
const goalText = (r: { correct: number; total: number }) => (r.total < 5 ? `${r.correct} of ${r.total} right first time (too few to judge yet)` : `${Math.round((100 * r.correct) / r.total)}% right first time (${r.total} answers)`);

function SchoolGoals({ progress }: { progress: Progress }) {
  return <section className="card stack">
    <h2>School goals</h2>
    <p className="tagline">What his school is working on, measured on answers given without help, to questions he had not seen before.</p>
    <div className="kv">{GOALS.map(([tag, label]) => <span key={tag} style={{ display: 'contents' }}><span>{label}</span><b>{goalText(tagAccuracy(progress, pool, tag, { firstTimeOnly: true }))}</b></span>)}</div>
  </section>;
}

/** LTF-14: check-up flights, kept apart from practice and from Today, and how many unseen texts are left at his stop. */
function Checkups({ events, progress, settings }: { events: LogEvent[]; progress: Progress; settings: Settings }) {
  const results = useMemo(() => checkupResults(events), [events]);
  const here = journeyNow(finishedCount(progress), settings).here;
  const left = [...pool.items.values()].filter((i) => i.checkup === here?.id && !progress.seen.has(i.id) && !settings.hidden.includes(i.id)).length;
  return <section className="card stack">
    <h2>Check-up flights</h2>
    {!results.length ? <p className="muted">About every ten sessions, he can choose a check-up flight: six new texts, no hints, and no right or wrong shown. Results show here.</p>
      : <div className="kv">{results.map((r) => <span key={r.ts} style={{ display: 'contents' }}><span>{fmtDate(r.ts)}</span><b>{r.correct} of {r.total} right first time</b></span>)}</div>}
    {here && <p className="tagline" style={{ margin: 0 }}>{left >= 6 ? `${left} unseen check-up texts left at ${here.name}.` : `Only ${left} unseen check-up texts left at ${here.name}. A check-up would repeat some texts.`}</p>}
    <p className="tagline">Check-ups measure reading on texts he has never seen, themed to where he is on the journey. They never change his skills or levels. Growth in telling stories did not carry over to reading in one study, so reading is measured on its own here.</p>
  </section>;
}

/** LTF-12: understanding a message and acting on it, as two lines, because one can grow without the other. */
function Messages({ progress }: { progress: Progress }) {
  return <section className="card stack">
    <h2>Messages: understanding and acting</h2>
    <div className="kv">
      <span>Understood the message</span><b>{goalText(tagAccuracy(progress, pool, 'message', { firstTimeOnly: true }))}</b>
      <span>Did the right thing</span><b>{goalText(tagAccuracy(progress, pool, 'act', { firstTimeOnly: true }))}</b>
    </div>
    <p className="tagline">After a message question, a second step asks him to act on the same message: pick the reply that matches the plan, or tap what to do. In one study, understanding messages improved but replying did not, so the two are counted apart. Answers given without help, to questions he had not seen before.</p>
  </section>;
}

/** How his sessions go: where they end, where he pauses, how long things take, and what to try. Timing only. */
const TONE: Record<Insight['tone'], [string, string]> = { act: ['⚑', 'Needs attention'], watch: ['👀', 'Worth watching'], good: ['✅', 'Going well'] };
const span = (ms: number) => (ms < 60_000 ? `${Math.round(ms / 1000)} s` : `${Math.round(ms / 60_000)} min`);
const medianOf = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : 0; };
/** Plain names for the question kinds in "Pattern in misses" (LTF-09, LTF-10, LTF-12). Other tags read as words. */
const PATTERN_NAME: Record<string, string> = { 'know-think': 'knows or only thinks', quantifier: '"some", "only" and "all"', act: 'acting on a message' };
const skillName = (id: string) => SKILL[id as SkillId]?.name ?? id;

function Insights({ events }: { events: LogEvent[] }) {
  const tips = useMemo(() => insights(events, skillName), [events]);
  return <ul className="insights">{tips.map((t) => <li key={t.title} className={`insight ${t.tone}`}>
    <b><span aria-hidden>{TONE[t.tone][0]} </span><span className="sr-only">{TONE[t.tone][1]}: </span>{t.title}</b>
    <span>{t.detail}</span>
    {t.tryThis && <span className="try"><b>Try this:</b> {t.tryThis}</span>}
  </li>)}</ul>;
}

const FRESH_STATUS = { plenty: 'Plenty', low: 'Running low', repeating: 'Repeats now' } as const;
const useFresh = (settings: Settings, progress: Progress) =>
  useMemo(() => freshness(progress, pool, { now: Date.now(), hidden: new Set(settings.hidden), allowThemes: settings.hardThemes }), [progress, settings.hidden, settings.hardThemes]);

/** On the overview: only when a skill he is working on is close to giving him questions he has already seen. */
function FreshWarning({ settings, progress }: { settings: Settings; progress: Progress }) {
  const rows = useFresh(settings, progress).filter((r) => r.status !== 'plenty' && progress.skills[r.skill].answers.length > 0);
  if (!rows.length) return null;
  return <section className="card stack">
    <h2>New questions running low</h2>
    <p style={{ margin: 0 }}>{rows.map((r) => `${SKILL[r.skill].name}: ${r.status === 'repeating' ? 'he is getting questions he has seen before' : `${r.unseen} new at his level`}`).join('. ')}.</p>
    <p className="tagline">A right answer to a question he has seen may be memory, not reading. The Activity tab has the details; more content for these skills keeps his answers fresh.</p>
  </section>;
}

/** Per skill: how much he has not met yet, and how many answers were repeats. */
function FreshContent({ settings, progress }: { settings: Settings; progress: Progress }) {
  const rows = useFresh(settings, progress);
  return <section className="card stack">
    <h2>Fresh content</h2>
    <p className="tagline">Questions he can be given now (at his level or easier) that he has never answered, and texts he has not read yet. A repeat is an answer to a question he had answered before. Running low means fewer than {FRESH_LOW} new questions at his level or the next one up.</p>
    <div className="table-wrap"><table className="skills-table">
      <thead><tr><th>Skill</th><th>Level</th><th>New questions</th><th>New texts</th><th>Repeats this week</th><th>Repeats overall</th><th>Status</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.skill}>
        <td>{r.skill} {SKILL[r.skill].name}</td><td>{r.level}</td>
        <td>{r.unseen} of {r.total}</td><td>{r.unseenTexts} of {r.texts}</td>
        <td>{r.answersWeek ? `${r.repeatsWeek} of ${r.answersWeek}` : '–'}</td><td>{r.answersAll ? `${r.repeatsAll} of ${r.answersAll}` : '–'}</td>
        <td><span className={`chip ${r.status === 'plenty' ? 'mastered' : r.status === 'low' ? 'learning' : 'due'}`}>{FRESH_STATUS[r.status]}</span></td>
      </tr>)}</tbody>
    </table></div>
  </section>;
}

/** LTF-01: right first time with the clue at once against after the wait, once there are 20 guided answers. */
function HintWait({ events, progress }: { events: LogEvent[]; progress: Progress }) {
  const e = useMemo(() => delayEffect(events, progress), [events, progress]);
  if (e.total < 20) return null;
  const line = (b: { correct: number; total: number }) => (b.total ? `${b.correct} of ${b.total} right first time (${Math.round((100 * b.correct) / b.total)}%)` : 'none yet');
  return <section className="card stack">
    <h2>Hint wait</h2>
    <div className="kv"><span>Clue at once</span><b>{line(e.atOnce)}</b><span>After the usual wait</span><b>{line(e.afterWait)}</b></div>
    <p className="tagline">Guided questions only, and only ones he had not seen before. The clue shows at once on a new skill's first guided question. These are different questions, so read this as a pattern over time, not a test.</p>
  </section>;
}

/** LTF-11: metaphors with the three-box map, against new metaphors without it: does the map carry over? */
function Metaphors({ progress }: { progress: Progress }) {
  return <section className="card stack">
    <h2>Metaphor map</h2>
    <div className="kv">
      <span>With the map</span><b>{goalText(tagAccuracy(progress, pool, 'metaphor-map', { firstTimeOnly: true }))}</b>
      <span>New metaphors, without the map</span><b>{goalText(tagAccuracy(progress, pool, 'metaphor-new', { firstTimeOnly: true }))}</b>
    </div>
    <p className="tagline">The map has three boxes: what it is like, what the two share, and so what it means. Teaching that marked what the two things share carried over to new metaphors in one study, so new ones without the map show whether it carries over for him. There are 20 for now; his results on the new ones decide whether to add more.</p>
  </section>;
}

/** LTF-04: the words he taps for their meaning, and how the warm-up's word for today goes. */
function WordHelp({ events }: { events: LogEvent[] }) {
  const taps = new Map<string, number>();
  const checks = { right: 0, total: 0 };
  for (const e of events) if (e.type === 'activity' && e.word) {
    if (e.kind === 'word-help') taps.set(e.word.toLowerCase(), (taps.get(e.word.toLowerCase()) ?? 0) + 1);
    if (e.kind === 'word-check') { checks.total += 1; if (e.correct) checks.right += 1; }
  }
  const most = [...taps].sort((a, b) => b[1] - a[1]).slice(0, 8);
  return <section className="card stack">
    <h2>Word help</h2>
    <div className="kv">
      <span>Words he tapped most</span><b>{most.length ? most.map(([w, n]) => `${w} (${n})`).join(', ') : 'none yet'}</b>
      <span>Word for today, right first time</span><b>{checks.total ? `${checks.right} of ${checks.total}` : 'none yet'}</b>
    </div>
    <p className="tagline">In some harder texts, up to three words are underlined. Tapping one shows a picture and a plain meaning, read aloud. Vocabulary teaching on a screen helped in studies, and the words he taps come back as a word for today at the start of a later warm-up. For now, about 60 texts have word help, to see whether it helps him before more are added.</p>
  </section>;
}

/** LTF-02: his feelings answers before and after the reasoning card, as a single-case record. */
function ReasonRecord({ progress }: { progress: Progress }) {
  const r = useMemo(() => reasonRecord(progress), [progress]);
  const line = (b: { correct: number; total: number }) => (b.total ? `${b.correct} of ${b.total} right first time (${Math.round((100 * b.correct) / b.total)}%)` : 'none yet');
  return <section className="card stack">
    <h2>Thinking-it-through card</h2>
    <div className="kv">
      <span>{r.since ? `Before ${fmtDate(r.since)}` : 'So far'}</span><b>{line(r.before)}</b>
      {r.since && <><span>Since he first saw the card</span><b>{line(r.after)}</b></>}
    </div>
    <p className="tagline">On new questions about what characters feel and why, the second hint is a card with three boxes: the clue from the story, what people generally know, and "so", which he works out. These lines are his own first-time answers on what characters feel, before and after he first saw the card. Thinking aloud with a card like this helped children of his age in one study; this shows whether it helps him.</p>
  </section>;
}

/** LTF-15: which question types work for him, compared only within the same skill and level. */
const FORMAT_NAME: Record<string, string> = { tap: 'Choose', order: 'Put in order', storymap: 'Story map', highlight: 'Find it in the text', sort: 'Sort', scene: 'Picture scene', build: 'Build an answer' };
function Formats({ progress }: { progress: Progress }) {
  const rows = useMemo(() => formatEffect(progress), [progress]);
  const strands: Strand[] = ['functional', 'narrative', 'philosophical'];
  return <section className="card stack">
    <h2>Which question types work for him</h2>
    {!rows.length ? <p className="muted">Shows once he has answered one skill, at one level, in two different question types.</p>
      : strands.filter((s) => rows.some((r) => strandOf(r.skill as SkillId) === s)).map((s) => <div key={s} className="stack" style={{ gap: '0.3rem' }}>
        <h3 style={{ margin: 0 }}>{STRAND[s].region}</h3>
        <div className="kv">{rows.filter((r) => strandOf(r.skill as SkillId) === s).map((r) => <span key={`${r.skill}${r.level}`} style={{ display: 'contents' }}>
          <span>{skillName(r.skill)}, level {r.level}</span>
          <b>{r.formats.map((f) => `${FORMAT_NAME[f.format] ?? f.format}: ${f.correct} of ${f.total}`).join(' · ')}</b>
        </span>)}</div>
      </div>)}
    <p className="tagline">Right first time on his own first-time answers, in the warm-up and his own practice. Each line compares question types on one skill at one text level, so a harder skill or a longer text never makes a type look worse. Reading on a screen can go differently from reading on paper, so the finish screen offers a paper story map after story sessions.</p>
  </section>;
}

function Activity({ events, settings, progress }: { events: LogEvent[]; settings: Settings; progress: Progress }) {
  const sessions = useMemo(() => sessionActivity(events), [events]);
  const recent = sessions.slice(-10).reverse();
  const perStep = new Map<StepName, number[]>();
  for (const s of sessions) for (const st of s.steps) if (st.step !== 'finish') perStep.set(st.step, [...(perStep.get(st.step) ?? []), st.ms]);
  const answers = events.filter((e) => e.type === 'answer' && e.phase !== 'placement' && e.ms > 0);
  const bySkill = ALL_SKILLS.map((s) => ({ s, list: answers.filter((a) => a.type === 'answer' && a.skill === s) })).filter((x) => x.list.length);
  const kit = gearState(flightPoints(events));
  const ended = (s: (typeof sessions)[number]) => (s.outcome === 'finished' ? 'Finished' : `${s.outcome === 'stopped' ? 'Stopped' : 'Left open'}${s.lastStep ? ` at ${STEP_LABEL[s.lastStep]}` : ''}`);
  return <div className="stack">
    <section className="card stack">
      <h2>What his sessions tell us</h2>
      <p className="tagline">Read from timing alone: where sessions end, where he pauses for 45 seconds or more, when the app is put away, and how long questions take. Nothing he types is used.</p>
      <Insights events={events} />
    </section>
    <FreshContent settings={settings} progress={progress} />
    <HintWait events={events} progress={progress} />
    <Formats progress={progress} />
    <ReasonRecord progress={progress} />
    <WordHelp events={events} />
    <Metaphors progress={progress} />
    <section className="card stack">
      <h2>Recent sessions</h2>
      {!recent.length ? <p className="muted">No sessions yet.</p> : <div className="table-wrap"><table className="skills-table">
        <thead><tr><th>When</th><th>Learning</th><th>Length</th><th>How it ended</th><th>Pauses</th><th>Put away</th><th>Answers</th></tr></thead>
        <tbody>{recent.map((s) => <tr key={s.id}>
          <td>{new Date(s.start).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</td>
          <td>{s.skill ? skillName(s.skill) : 'Lantern Peaks check'}</td>
          <td>{span(s.end - s.start)}</td>
          <td>{ended(s)}{s.skippedDemo ? ' · skipped the demo' : ''}</td>
          <td>{s.idle ? `${s.idle} (${span(s.idleMs)})` : '–'}</td>
          <td>{s.away ? `${s.away} (${span(s.awayMs)})` : '–'}</td>
          <td>{s.answers ? `${s.firstTry} of ${s.answers} first time` : '–'}</td>
        </tr>)}</tbody>
      </table></div>}
    </section>
    <div className="grid2">
      <section className="card stack">
        <h2>Typical time in each step</h2>
        {!perStep.size ? <p className="muted">Shows after his next session.</p> : <div className="kv">{(['plan', 'choose', 'warmup', 'watch', 'together', 'yourturn', 'gatecheck'] as StepName[]).filter((k) => perStep.has(k)).map((k) =>
          <span key={k} style={{ display: 'contents' }}><span>{STEP_LABEL[k]}</span><b>{span(medianOf(perStep.get(k)!))}</b></span>)}</div>}
      </section>
      <section className="card stack">
        <h2>Flight kit</h2>
        <p style={{ margin: 0 }}>{kit.owned.length} of {GEAR.length} pieces, {kit.points} points. {kit.next ? `Next: the ${kit.next.name.toLowerCase()} in ${kit.toNext} points.` : 'Ready for take-off.'}</p>
        <p className="tagline">His guide earns flight gear for the trip to Australia. Points reward effort only, never speed or scores: 2 per answer, right or not, 3 for finishing, and 3 for getting past the step where his sessions usually end. Rewards promised for good scores can make children like a task less, so none are.</p>
      </section>
    </div>
    <section className="card stack">
      <h2>Time per question</h2>
      {!bySkill.length ? <p className="muted">Shows after his first questions in a session.</p> : <div className="table-wrap"><table className="skills-table">
        <thead><tr><th>Skill</th><th>Answers</th><th>Typical time</th><th>Right first time</th></tr></thead>
        <tbody>{bySkill.map(({ s, list }) => <tr key={s}>
          <td>{s} {SKILL[s].name}</td><td>{list.length}</td><td>{span(medianOf(list.map((a) => (a.type === 'answer' ? a.ms : 0))))}</td>
          <td>{Math.round((100 * list.filter((a) => a.type === 'answer' && a.correct && a.tries <= 1).length) / list.length)}%</td>
        </tr>)}</tbody>
      </table></div>}
    </section>
  </div>;
}

function Spark({ points }: { points: { acc: number }[] }) {
  if (points.length < 2) return <span className="muted">{points.length ? `${Math.round(points[0].acc * 100)}%` : '–'}</span>;
  const w = 120, h = 34;
  const d = points.map((p, i) => `${(i / (points.length - 1)) * (w - 8) + 4},${h - 4 - p.acc * (h - 8)}`).join(' ');
  return <svg className="spark" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Your-turn accuracy by session: ${points.map((p) => Math.round(p.acc * 100) + '%').join(', ')}`}>
    <line x1="4" x2={w - 4} y1={h - 4 - 0.8 * (h - 8)} y2={h - 4 - 0.8 * (h - 8)} stroke="currentColor" strokeOpacity="0.25" strokeDasharray="3 3" />
    <polyline points={d} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
  </svg>;
}

function Skills({ progress, events }: { progress: Progress; events: LogEvent[] }) {
  const now = Date.now();
  const [confirm, setConfirm] = useState<SkillId | null>(null);
  const real = (s: SkillId) => events.filter((e) => e.type === 'realworld' && e.skill === s).length;
  return <section className="card stack">
    <p className="tagline">Only “your turn” answers count toward mastery: 80% or better across two sessions on different days, with one item in a new format. The dashed line on each trend is 80%.</p>
    <div className="table-wrap"><table className="skills-table">
      <thead><tr><th>Skill</th><th>Status</th><th>Level</th><th>Hints needed</th><th>Trend</th><th>Pattern in misses</th><th>Real world</th><th>Next review</th></tr></thead>
      <tbody>{ALL_SKILLS.map((s) => {
        const st = progress.skills[s];
        const status = statusOf(st, now);
        const h = hintNeed(st);
        const pats = errorPatterns(st, pool).slice(0, 2);
        return <tr key={s}>
          <td><b>{s}</b> {SKILL[s].name}{st.placed && <div className="tagline">placed by scouting, confirming by review</div>}{st.relearning && <div className="tagline">back in practice after a review</div>}</td>
          <td><span className={`chip ${STATUS_CLASS[status]}`}>{status}</span></td>
          <td>{st.answers.length ? levelFor(st, pool) : '–'}</td>
          <td>{h === undefined ? '–' : h < 0.5 ? 'little' : h < 1.5 ? 'light' : h < 2.5 ? 'strategy' : 'full'}</td>
          <td><Spark points={trend(st)} /></td>
          <td>{pats.length ? pats.map((p) => <div key={p.tag}>{PATTERN_NAME[p.tag] ?? p.tag.replace(/-/g, ' ')} <span className="muted">({p.missed} of {p.total})</span></div>) : <span className="muted">none yet</span>}</td>
          <td>{real(s)} <Btn className="small quiet" onPress={() => setConfirm(s)}>Add</Btn></td>
          <td>{st.status === 'mastered' ? fmtDate(st.nextReview) : '–'}</td>
        </tr>;
      })}</tbody>
    </table></div>
    <ModalOverlay className="overlay" isOpen={!!confirm} onOpenChange={(o) => !o && setConfirm(null)} isDismissable>
      <Modal><Dialog className="dialog" style={{ maxWidth: 520 }}>
        {confirm && <><Heading slot="title">Real-world check: {SKILL[confirm].name}</Heading>
          <p>{SKILL[confirm].realworld}</p>
          <p className="tagline">Skills learned in practice do not always carry over to real life, so this records when one did. It does not change mastery.</p>
          <div className="row"><Btn className="primary" onPress={async () => { await log({ type: 'realworld', skill: confirm }); setConfirm(null); }}>Yes, I saw it</Btn><Btn className="quiet" onPress={() => setConfirm(null)}>Cancel</Btn></div></>}
      </Dialog></Modal>
    </ModalOverlay>
  </section>;
}

/** LTF-08: how his telling is growing. Length always sits next to the parts of the day he told. */
const QUESTION_NAME: Record<string, string> = {
  who: 'who he was with', what: 'what he did', afterDone: 'what happened after what he did', feeling: 'how he felt',
  why: 'why he felt that way', hard: 'whether anything was hard', afterHard: 'what happened after something hard',
};
function Telling({ events }: { events: LogEvent[] }) {
  const t = useMemo(() => recountTrend(events), [events]);
  const num = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));
  return <section className="card stack">
    <h2>How his telling is growing</h2>
    {!t.recounts.length ? <p className="muted">Shows after his next recount.</p> : <>
      {t.early && t.recent && <div className="kv">
        <span>His first {t.early.n} recounts</span><b>{num(t.early.sentences)} sentences, about {num(t.early.parts)} {t.early.parts === 1 ? 'part' : 'parts'} of the day</b>
        <span>His last {t.recent.n} recounts</span><b>{num(t.recent.sentences)} sentences, about {num(t.recent.parts)} {t.recent.parts === 1 ? 'part' : 'parts'} of the day</b>
      </div>}
      <div className="table-wrap"><table className="skills-table">
        <thead><tr><th>Date</th><th>Sentences</th><th>Parts told</th><th>Said what happened after</th><th>Own words</th></tr></thead>
        <tbody>{t.recounts.slice(-8).reverse().map((r) => <tr key={r.ts}>
          <td>{fmtDate(r.ts)}</td><td>{r.sentences}</td><td>{r.parts}</td><td>{r.after ? 'Yes' : '–'}</td><td>{r.typed ? 'Yes' : '–'}</td>
        </tr>)}</tbody>
      </table></div>
      <div className="kv">
        <span>Adds his own words</span><b>{t.ownWords.count} of {t.ownWords.of} recounts</b>
        <span>Questions he skips most</span><b>{t.skippedMost.length ? t.skippedMost.slice(0, 3).map(([k, n]) => `${QUESTION_NAME[k] ?? k} (${n})`).join(', ') : 'none so far'}</b>
      </div>
    </>}
    <p className="tagline">Longer recounts explained most of the difference in how well children's stories were put together, so length is worth watching, but always next to how much of the day he told.</p>
  </section>;
}

/** LTF-07: from stage 3, how often he answers in his own words before opening the ideas. */
function Ideas({ settings, events }: { settings: Settings; events: LogEvent[] }) {
  const u = useMemo(() => ideasUse(events), [events]);
  return <section className="card stack">
    <h2>Telling without the ideas</h2>
    {!u.recounts ? <p className="muted">Shows once Today puts the answer tiles behind a button (stage 3).</p>
      : <div className="kv"><span>Answered without ideas</span><b>{u.week.without} of {u.week.of} questions this week</b></div>}
    {u.stepBack && !settings.todayStage && <p style={{ margin: 0 }}>He opened the ideas for every question in his recent recounts, so Today has stepped back a stage for now. It moves on again by itself.</p>}
    <p className="tagline">From stage 3 the answer tiles wait behind a "Show me ideas" button, so he can try his own words first. Nothing times him. If he opens the ideas on every question for two weeks, Today steps back a stage. Printed cues helped a child tell about past events, but in that study they were never taken away, so this checks whether he manages without them.</p>
  </section>;
}

function TodayAdmin({ settings, events }: { settings: Settings; events: LogEvent[] }) {
  const notes = useNotes();
  const [people, setPeople] = useState(settings.people.join(', '));
  const days = [['1', 'Monday'], ['2', 'Tuesday'], ['3', 'Wednesday'], ['4', 'Thursday'], ['5', 'Friday']];
  const tt = (d: string) => settings.timetable[d]?.length ? settings.timetable[d] : today.defaultTimetable;
  const toggle = (d: string, id: string) => {
    const cur = tt(d);
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    saveSettings({ timetable: { ...settings.timetable, [d]: next } });
  };
  return <div className="stack">
    <Telling events={events} />
    <Ideas settings={settings} events={events} />
    <section className="card stack">
      <h2>What he told you</h2>
      <p className="tagline">Personal answers are never sent to any model. They are deleted after 30 days unless you keep them, and other typed answers after 90 days. With the family cloud copy they are kept there too, and deleted there at the same time.</p>
      {!notes.length && <p className="muted">Nothing yet.</p>}
      {notes.map((n) => <div key={n.id} className="lib-item">
        <div className="row"><b>{n.kind === 'recount' ? `Today: ${n.title}` : n.title}</b>{n.personal && <span className="chip">personal</span>}<span className="spacer" /><span className="muted">{fmtDate(n.ts)}</span></div>
        <p style={{ margin: 0 }}>{n.text}</p>
        {n.ask && <ul style={{ margin: 0 }}>{n.ask.map((a) => <li key={a}>{a}</li>)}</ul>}
        <div className="row"><Toggle on={!!n.saved} onChange={(saved) => updateNote(n.id, { saved })}>Keep</Toggle><Btn className="small quiet" onPress={() => deleteNote(n.id)}>Delete</Btn></div>
      </div>)}
    </section>
    <section className="card stack">
      <h2>His school timetable</h2>
      <p className="tagline">These cards cue the daily recount. Tap to add or remove a lesson for each day, in the order they happen.</p>
      {days.map(([d, name]) => <div key={d} className="field"><span className="label">{name}: {tt(d).map((id) => today.lessons.find((l) => l.id === id)?.name).join(' → ')}</span>
        <div className="tiles">{today.lessons.map((l) => <Btn key={l.id} className={`small ${tt(d).includes(l.id) ? 'on' : 'quiet'}`} aria-pressed={tt(d).includes(l.id)} onPress={() => toggle(d, l.id)}>{l.emoji} {l.name}</Btn>)}</div>
      </div>)}
      <div className="field"><label htmlFor="people">Names he can pick (teachers, friends), separated by commas</label>
        <input id="people" className="input" value={people} onChange={(e) => setPeople(e.target.value)} onBlur={() => saveSettings({ people: people.split(',').map((x) => x.trim()).filter(Boolean) })} /></div>
      <Seg label="Recount support" value={settings.todayStage} onChange={(todayStage) => saveSettings({ todayStage })}
        options={[[0, 'Automatic'], [1, 'One part, tiles'], [2, 'Tiles and typing'], [3, 'Three parts, ideas on a button'], [4, 'Whole day']]} />
    </section>
  </div>;
}

function Library({ settings }: { settings: Settings }) {
  const [skill, setSkill] = useState<SkillId>('F1');
  const [trying, setTrying] = useState<Item | null>(null);
  const [tick, setTick] = useState(0);
  const hidden = new Set(settings.hidden);
  const items = pool.bySkill.get(skill) ?? [];
  const model = pool.models.get(skill)?.item;
  const byPassage = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const i of items) m.set(i.passage, [...(m.get(i.passage) ?? []), i]);
    return [...m];
  }, [items]);
  return <section className="card stack">
    <p className="tagline">Every passage was drafted for this program and is waiting for your review. Try any item, and hide anything you would not show him. Hidden items are never served.</p>
    <div className="field"><label htmlFor="sk">Skill</label>
      <select id="sk" className="input" value={skill} onChange={(e) => setSkill(e.target.value as SkillId)}>
        {(['functional', 'narrative', 'philosophical'] as Strand[]).map((s) => <optgroup key={s} label={STRAND[s].region}>{skillsOf(s).map((id) => <option key={id} value={id}>{id} {SKILL[id].name}</option>)}</optgroup>)}
      </select></div>
    {byPassage.map(([pid, list]) => {
      const p = pool.passages.get(pid)!;
      return <details key={pid} className="lib-item">
        <summary>{p.picture} {p.title} <span className="muted">· level {p.level}{p.themes?.length ? ` · theme: ${p.themes.join(', ')}` : ''}</span></summary>
        {p.sentences.length > 0 && <p>{p.sentences.join(' ')}</p>}
        <p className="tagline">{creditLine(p)}</p>
        {list.map((i) => <div key={i.id} className={`lib-item ${hidden.has(i.id) ? 'hidden-item' : ''}`}>
          <div><b>{i.prompt}</b></div>
          <div className="tagline">{i.id} · {i.format} · level {i.level}{i.id === model ? ' · worked example' : ''}{i.transfer ? ' · new format or setting' : ''}{i.gatecheck ? ' · inference check' : ''}{i.placement ? ' · scouting' : ''}{i.tier ? ` · ${i.tier}` : ''}</div>
          <div className="row"><Btn className="small" onPress={() => setTrying(i)}>Try it</Btn>
            <Toggle on={!hidden.has(i.id)} onChange={(on) => saveSettings({ hidden: on ? settings.hidden.filter((x) => x !== i.id) : [...settings.hidden, i.id] })}>{hidden.has(i.id) ? 'Hidden' : 'Shown'}</Toggle></div>
        </div>)}
      </details>;
    })}
    <ModalOverlay className="overlay" isOpen={!!trying} onOpenChange={(o) => !o && setTrying(null)} isDismissable>
      <Modal><Dialog className="dialog" style={{ width: 'min(1100px, 100%)' }} aria-label="Try an item">
        {trying && <><ItemView key={trying.id} item={trying} mode="request" guide={settings.guide} pictures={settings.pictures} helpTick={tick} onDone={() => setTrying(null)}
          whosWho={{ setting: settings.whosWho ?? 'auto', n4Mastered: false, names: !!settings.namesLevel1 }} />
          <div className="row" style={{ marginTop: '1rem' }}><Btn className="small" onPress={() => setTick((t) => t + 1)}>💡 Show a hint</Btn><span className="spacer" /><Btn className="quiet" onPress={() => setTrying(null)}>Close</Btn></div></>}
      </Dialog></Modal>
    </ModalOverlay>
  </section>;
}

function SettingsTab({ settings, progress, onRescout, onGrammar }: { settings: Settings; progress: Progress; onRescout: () => void; onGrammar: () => void }) {
  const [pin, setPin] = useState(settings.pin);
  const [vs, setVs] = useState(voices());
  useEffect(() => {
    const f = () => setVs(voices());
    window.speechSynthesis?.addEventListener('voiceschanged', f);
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', f);
  }, []);
  const [f, setF] = useState(1);
  const [n, setN] = useState(1);
  return <div className="grid2">
    <section className="stack"><h2>Comfort (he can change these too)</h2><ComfortPanel settings={settings} /></section>
    <section className="card stack">
      <h2>Learning</h2>
      <Seg label="Small rewards" value={settings.rewardPace} onChange={(rewardPace) => saveSettings({ rewardPace })} options={[['item', 'After every item'], ['step', 'After every step'], ['session', 'At the end only']]} />
      <p className="tagline">Start with frequent rewards if he needs them, then thin them out, as is standard in teaching. Rewards build his island and never depend on scores, because rewards promised for scores can make children like a task less.</p>
      <Seg label="Sessions between places on the journey" value={settings.legLength} options={[[3, '3'], [5, '5'], [7, '7']]} onChange={(legLength) => {
        // Re-anchor at today's place, so a new pace never moves him back.
        const finished = finishedCount(progress);
        const pos = journeyNow(finished, settings); // on his route (LTF-20)
        saveSettings({ legLength, journeyAnchor: { at: finished, stop: pos.stop, step: pos.step, after: pos.after } });
      }} />
      {Object.entries(settings.routes ?? {}).map(([from, r]) => <p key={from} style={{ margin: 0 }}>Route from {JOURNEY.stops.find((s) => s.id === from)?.name}: <b>{JOURNEY.stops.find((s) => s.id === r.to)?.name}</b>{r.at ? `, chosen ${fmtDate(r.at)}` : ' (he was already on this route when the island routes arrived)'}.</p>)}
      <p className="tagline">The journey to the koalas moves with finished sessions, never with scores. Five a leg reaches Australia at about session 25, about where studies measured gains.</p>
      <Toggle on={settings.setbacks} onChange={(setbacks) => saveSettings({ setbacks })}>Story setbacks (a storm, a blocked path, a broken part)</Toggle>
      <p className="tagline">Setbacks model coping with change: each one is explained, he hears a calm coping line, and he picks a plan. Nothing is lost. Turn them off for a smoother story.</p>
      <Toggle on={settings.fastTrack} onChange={(fastTrack) => saveSettings({ fastTrack })}>Fast track: one flawless session can master a skill</Toggle>
      <p className="tagline">For a learner who locks a skill in once he sees how. It needs every answer right first time, a new format, and a level 3 or harder text. Reviews at 3, 7 and 21 days still check that it lasts. Harder levels (4 and 5) open by themselves after two right answers in a row.</p>
      <div className="field"><label htmlFor="reset">Calm-down words his school uses</label>
        <input id="reset" className="input" placeholder="For example: reset, breathe, try a new plan" defaultValue={settings.resetWords} onBlur={(e) => saveSettings({ resetWords: e.target.value })} /></div>
      <p className="tagline">Shown with the journey's setbacks, so home and school use the same words.</p>
      <Seg label="Your-turn items per session" value={settings.yourTurn} onChange={(yourTurn) => saveSettings({ yourTurn })} options={[[3, '3'], [4, '4'], [5, '5']]} />
      <Seg label="Wait before a hint in “together”" value={settings.hintDelay} onChange={(hintDelay) => saveSettings({ hintDelay })} options={[[5, '5 s'], [8, '8 s'], [12, '12 s'], [20, '20 s']]} />
      <Toggle on={settings.clueFirst} onChange={(clueFirst) => saveSettings({ clueFirst })}>Show the clue at once on a new skill's first guided question</Toggle>
      <Seg label="Who's who help" value={settings.whosWho ?? 'auto'} onChange={(whosWho) => saveSettings({ whosWho })} options={[['auto', 'Automatic'], ['help', 'On Help only'], ['off', 'Off']]} />
      <Toggle on={!!settings.namesLevel1} onChange={(namesLevel1) => saveSettings({ namesLevel1 })}>Names instead of he and she in the easiest texts</Toggle>
      <p className="tagline">Dotted pronouns: tapping "she" shows "she = Priya". Automatic shows them in guided practice on "he", "she" and "they", and in the easiest stories, and only on Help once he has mastered that step. Never in his own practice of that step or the Peak check. Cueing who a pronoun means helped autistic readers in studies. With names on, level 1 texts say "Maya took Maya's flute" in place of "She took her flute", and read it aloud that way; readers with weaker working memory understood more with names. Never in the step that teaches pronouns, and never inside what a character says.</p>
      <p className="tagline">In a 2025 review of reading apps, how long the app waited before a prompt was the one setting that made a measurable difference. So a skill he has never practised starts with its clue showing; after that, the usual wait. The Activity tab compares the two once there are 20 guided answers.</p>
      <div className="field"><span className="label">Guide</span><div className="row">{(Object.keys(GUIDES) as GuideId[]).map((g) => <Btn key={g} className={`small ${settings.guide === g ? 'on' : 'quiet'}`} onPress={() => saveSettings({ guide: g })}><Guide id={g} size={30} /> {GUIDES[g].name}</Btn>)}</div></div>
      <div className="field"><span className="label">Interests</span><div className="tiles">{TOPICS.map((t) => {
        const on = settings.interests.includes(t.id);
        return <Btn key={t.id} className={`small ${on ? 'on' : 'quiet'}`} aria-pressed={on} onPress={() => saveSettings({ interests: on ? settings.interests.filter((x) => x !== t.id) : [...settings.interests, t.id] })}>{t.emoji} {t.label}</Btn>;
      })}</div></div>
      {canSpeak && <div className="field"><label htmlFor="voice">Reading voice</label>
        <div className="row"><select id="voice" className="input" value={settings.voice} onChange={(e) => saveSettings({ voice: e.target.value })}>
          <option value="">Device default</option>{vs.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
        </select><Btn className="small" onPress={() => speak(['This is how I sound when I read to you.'], 'voice-test')}>Try it</Btn></div>
        <p className="tagline">Voices come from this device. Natural-sounding ones are often named “Natural” or “Enhanced”.</p></div>}
      <div className="field"><label htmlFor="pin2">Grown-ups' code (leave empty for none)</label>
        <div className="row"><input id="pin2" className="input" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} /><Btn className="small" onPress={() => saveSettings({ pin })}>Save code</Btn></div></div>
    </section>
    <section className="card stack">
      <h2>Starting point</h2>
      <p className="tagline">Set the starting step yourself, for example after talking with his speech-language therapist. Steps below it start as mastered and are confirmed by review.</p>
      <Seg label="Functional starting step" value={f} onChange={setF} options={[1, 2, 3, 4, 5, 6].map((x) => [x, String(x)] as [number, string])} />
      <Seg label="Narrative starting step" value={n} onChange={setN} options={[1, 2, 3, 4, 5, 6].map((x) => [x, String(x)] as [number, string])} />
      <div className="row"><Btn onPress={() => log({ type: 'placement', functional: f, narrative: n, word: settings.scout?.word ?? 1, reading: settings.scout?.reading ?? 1, listening: settings.scout?.listening ?? 1, manual: true })}>Apply starting steps</Btn>
        <Btn className="quiet" onPress={onRescout}>Run scouting again</Btn>
        <Btn className="quiet" onPress={onGrammar}>Run the "Who did it?" stop</Btn></div>
    </section>
  </div>;
}

function DataTab({ name, onReport }: { name: string; onReport: () => void }) {
  const [msg, setMsg] = useState('');
  const [confirm, setConfirm] = useState('');
  const linked = useLink();
  const download = async () => {
    const blob = new Blob([JSON.stringify(await exportAll(), null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `learning-to-fly-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return <div className="grid2">
    <CloudCard name={name} />
    <section className="card stack">
      <h2>Report for his therapist or teacher</h2>
      <p className="tagline">Per skill: status, dates, starting point, trend and example items. Print it or save it as a PDF.</p>
      <Btn className="primary" onPress={onReport}>Open the report</Btn>
    </section>
    <section className="card stack">
      <h2>Export and import</h2>
      <p className="tagline">{linked ? 'Progress is also in the family cloud copy. Export a file to keep your own backup.' : 'Everything lives in this browser. Export a file to keep a backup or to move to another device.'}</p>
      <Btn onPress={download}>Export everything (JSON)</Btn>
      <label className="field"><span className="label">Import a Learning to Fly file</span>
        <input type="file" accept="application/json" onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try { await importAll(JSON.parse(await file.text())); setMsg('Imported.'); } catch (err) { setMsg((err as Error).message); }
        }} /></label>
      {msg && <p role="status">{msg}</p>}
    </section>
    <section className="card stack">
      <h2>Delete everything</h2>
      <p className="tagline">Removes all progress, notes and settings from this device. {linked ? `The cloud copy stays unless you also delete ${name} everywhere. ` : ''}Export first if you want a copy. Type DELETE to confirm.</p>
      <input className="input" aria-label="Type DELETE to confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <div className="row">
        <Btn isDisabled={confirm !== 'DELETE'} onPress={async () => { await wipeAll(); location.reload(); }}>Delete from this device</Btn>
        {linked && <Btn isDisabled={confirm !== 'DELETE'} onPress={async () => {
          try { await deleteEverywhere(linked.learner); } catch { setMsg('The cloud copy could not be reached, so nothing was deleted. Try again when online.'); return; }
          await wipeAll(); location.reload();
        }}>Delete {name} everywhere</Btn>}
      </div>
    </section>
    <section className="card stack">
      <h2>Why it is built this way</h2>
      <ul className="why">
        <li><b>Show, help, then let him try.</b> Clear step-by-step teaching is the best-supported approach for autistic readers. Demos drop out once he shows he can do a skill.</li>
        <li><b>Hints wait, then step up.</b> Waiting a moment before a prompt, then giving more help, is an established way to teach.</li>
        <li><b>Answer by choosing and pointing.</b> Story maps and picture supports help most, and understanding is checked before he is asked to explain.</li>
        <li><b>Feelings come last and gently.</b> Working out what characters feel is the hardest part at his age, so it is taught on purpose and its own strand opens only after the basics.</li>
        <li><b>Rewards tell a story, not a score.</b> Points come from effort, and nothing is lost for a wrong answer.</li>
        <li><b>A grown-up stays in the loop.</b> Programs like this worked best with an adult nearby, and the evidence is still thin, so the app measures its own effect for him.</li>
        <li><b>Some choices are ours.</b> The level steps, the fast track and the review timing are design choices to check against his results, not tested rules.</li>
      </ul>
      <p className="tagline">Every study the design rests on, what the app does with each one, and where the evidence is thin: <a href="https://dweissenborn.github.io/learning_to_fly/" target="_blank" rel="noreferrer">The research behind Learning to Fly</a>.</p>
    </section>
    <section className="card stack">
      <h2>About the content</h2>
      <p className="tagline">Passages were written for this program or retold from public-domain fables (The Aesop for Children, 1919, Library of Congress). The content bank is shared under CC BY-SA 4.0. Credits show under every passage.</p>
    </section>
  </div>;
}

function Report({ settings, events, progress, onBack }: { settings: Settings; events: LogEvent[]; progress: Progress; onBack: () => void }) {
  const now = Date.now();
  const placement = events.find((e) => e.type === 'placement');
  return <main className="stack" style={{ maxWidth: 900, margin: '0 auto' }}>
    <div className="row no-print"><Btn onPress={onBack}>← Back</Btn><span className="spacer" /><Btn className="primary" onPress={() => window.print()}>Print or save as PDF</Btn></div>
    <h1>Reading progress: {settings.name}</h1>
    <p>Report made {new Date().toLocaleDateString()} from {events.filter((e) => e.type === 'answer').length} recorded answers across {progress.sessions.length} sessions. Mastery rule: 80% or better on independent items across two sessions on different days, including one item in a new format or setting; reviews at about 3, 7 and 21 days.</p>
    {placement?.type === 'placement' && <p><b>Baseline ({fmtDate(placement.ts)}):</b> word reading {Math.round(placement.word * 100)}%, reading comprehension {Math.round(placement.reading * 100)}%, listening comprehension {Math.round(placement.listening * 100)}%. Started at functional step {placement.functional} and narrative step {placement.narrative}.</p>}
    <section className="card" style={{ breakInside: 'avoid' }}>
      <h3>How sessions go</h3>
      <Insights events={events} />
    </section>
    <section className="card" style={{ breakInside: 'avoid' }}>
      <h3>School goals</h3>
      <p className="tagline">Answers given without help, to questions he had not seen before.</p>
      <div className="kv">{GOALS.map(([tag, label]) => <span key={tag} style={{ display: 'contents' }}><span>{label}</span><b>{goalText(tagAccuracy(progress, pool, tag, { firstTimeOnly: true }))}</b></span>)}</div>
    </section>
    {ALL_SKILLS.filter((s) => strandOf(s) !== 'philosophical' || progress.skills[s].answers.length).map((s) => {
      const st = progress.skills[s];
      const t = trend(st);
      const examples = st.answers.filter((a) => a.phase === 'yourturn').slice(-3);
      return <section key={s} className="card" style={{ breakInside: 'avoid' }}>
        <h3>{s} {SKILL[s].name}: {statusOf(st, now)}</h3>
        <div className="kv">
          <span>Mastered</span><b>{st.masteredAt ? fmtDate(st.masteredAt) + (st.placed ? ' (placed, awaiting review)' : '') : '–'}</b>
          <span>Reviews passed</span><b>{st.reviewStage}</b>
          <span>First-time answers</span><b>{st.answers.length ? `${st.answers.length - st.answers.filter((a) => progress.repeats.has(a.id)).length} of ${st.answers.length}` : '–'}</b>
          <span>Text level now</span><b>{st.answers.length ? `${levelFor(st, pool)} of 5` : '–'}</b>
          <span>Your-turn trend</span><b>{t.length ? t.map((x) => `${fmtDate(x.ts)} ${Math.round(x.acc * 100)}% (${x.n})`).join(' · ') : '–'}</b>
          <span>Real-world checks</span><b>{events.filter((e) => e.type === 'realworld' && e.skill === s).length}</b>
        </div>
        {examples.length > 0 && <ul>{examples.map((a) => <li key={a.id}>{pool.items.get(a.item)?.prompt} <span className="muted">({a.correct ? 'right first time' : `hint level ${a.hint}`})</span></li>)}</ul>}
      </section>;
    })}
  </main>;
}
