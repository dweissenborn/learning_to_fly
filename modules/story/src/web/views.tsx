// LTF-65: the story's places outside its own screen: the path on his island, its switch in Settings, the whole book for a
// grown-up to read first (every branch, every answer), and what he did with each chapter.
import type { LogEvent } from '@wayfinder/schema';
import { Btn, saveModuleSettings, Toggle, useModuleSettings } from '@wayfinder/web/host';
import { BOOK, itemId, KINDS, MAIN_PROMPT, outcomes, pickOf, say, type Text, type StoryState } from '../book';
import { Scene } from './Scene';

const TOTAL = BOOK.chapters.length;
const at = (own: StoryState) => Math.min(own.chapter ?? 0, TOTAL);

export function StoryPath() {
  const own = useModuleSettings<StoryState>('story');
  if (!own) return null;
  const n = at(own);
  return <div className="path strand-story">
    <span className="pico" aria-hidden>📚</span>
    <div>
      <div className="pname">{BOOK.title}</div>
      <div className="stones" role="img" aria-label={`${n} of ${TOTAL} chapters read`}>
        {BOOK.chapters.map((_, i) => <span key={i} className={`stone ${i < n ? 'lit' : ''} ${i === n ? 'here' : ''}`} aria-hidden>{i + 1}</span>)}
      </div>
      <div className="tagline">{n < TOTAL ? `Next: Chapter ${n + 1}: ${BOOK.chapters[n].title}` : 'The book is finished. You can read any chapter again.'}</div>
    </div>
  </div>;
}

export function StorySettingsPanel() {
  const own = useModuleSettings<StoryState>('story') ?? {};
  return <div className="stack" style={{ gap: '0.5rem' }}>
    <Toggle on={!!own.enabled} onChange={(enabled) => saveModuleSettings('story', { enabled })}>Story: a chapter book with choices</Toggle>
    {own.enabled && <>
      <p className="tagline">“{BOOK.title}”: {TOTAL} chapters, one a sitting. A chapter counts as a session. He is at chapter {Math.min(at(own) + 1, TOTAL)}{at(own) === TOTAL ? ' (finished)' : ''}. You can read all of it first in the Content library.</p>
      {(at(own) > 0 || Object.keys(own.picks ?? {}).length > 0) && <div><Btn className="small" onPress={() => saveModuleSettings('story', { chapter: 0, picks: {} })}>Start the book again</Btn></div>}
    </>}
  </div>;
}

/** Every version of a line, for the grown-ups' read-through. */
const versions = (t: Text) => (typeof t === 'string' ? [say(t, {}, 'his guide')] : BOOK.picks[t.by].map((v) => `(${v}) ${say(t, { [t.by]: v }, 'his guide')}`));

export function StoryPreview() {
  return <section className="card stack" aria-labelledby="story-h">
    <h2 id="story-h" style={{ margin: 0 }}>Story: {BOOK.title}</h2>
    <p className="tagline">The whole book, with every choice and every answer. Where a line has more than one version, each is shown with the choice it follows. The koala's name is his to pick ({BOOK.picks.koala.join(', ')}); “{pickOf({}, 'koala')}” stands in here.</p>
    {BOOK.chapters.map((c, i) => <details key={i} className="story-preview">
      <summary><b>Chapter {i + 1}: {c.title}</b></summary>
      <div className="stack">
        {c.pages.map((p, j) => <div key={j} className="stack" style={{ gap: '0.4rem' }}>
          <Scene spec={p.scene} picks={{}} />
          <p className="prose">{p.text.flatMap(versions).join(' ')}</p>
          {c.choice?.after === j && <div className="card soft stack" style={{ gap: '0.3rem' }}>
            <b>His choice</b>
            {[c.choice.obstacle, c.choice.notice, c.choice.cope, c.choice.ask].filter(Boolean).map((x) => <span key={x}>{x}</span>)}
            <ul style={{ margin: 0 }}>{c.choice.options.map((o) => <li key={o.value}>{o.label}: <span className="muted">{o.reply}</span></li>)}</ul>
          </div>}
        </div>)}
        {KINDS.map(([kind, , label]) => <div key={kind}>
          <b>{label}:</b> {c[kind].prompt ? versions(c[kind].prompt!).join(' / ') : MAIN_PROMPT}
          <ol style={{ margin: '0.2rem 0' }}>{c[kind].options.map((o, a) => <li key={a}>{versions(o).join(' / ')}{a === c[kind].answer && <b> ✓</b>}</li>)}</ol>
          <span className="muted">{versions(c[kind].explain).join(' / ')}</span>
        </div>)}
        <p className="tagline">For his notebook: {versions(c.clue).join(' / ')} To talk about after: {c.talk.replace(/^Ask: /, '')}</p>
      </div>
    </details>)}
  </section>;
}

const HOW = { right: 'Right first time', clue: 'Found with the clue', shown: 'Shown the answer', guess: 'A fast guess, set aside' } as const;

export function StoryReport({ events }: { events: LogEvent[] }) {
  const own = useModuleSettings<StoryState>('story') ?? {};
  const got = outcomes(events), n = at(own);
  const made = BOOK.chapters.flatMap((c) => c.choice?.options.filter((o) => o.value === own.picks?.[c.choice!.key]).map((o) => o.label) ?? []); // in his words, not the book's keys
  return <section className="card stack">
    <h2>{BOOK.title}, chapter by chapter</h2>
    <div className="table-wrap"><table className="skills-table">
      <thead><tr><th>Chapter</th><th>Read</th>{KINDS.map(([kind, , label]) => <th key={kind}>{label}</th>)}</tr></thead>
      <tbody>{BOOK.chapters.map((c, i) => <tr key={i}>
        <td>{i + 1}. {c.title}</td><td>{i < n ? 'Yes' : '–'}</td>
        {KINDS.map(([kind]) => { const o = got.get(itemId(i, kind)); return <td key={kind}>{o ? HOW[o] : '–'}</td>; })}
      </tr>)}</tbody>
    </table></div>
    <div className="kv">
      <span>Chapters read</span><b>{n} of {TOTAL}</b>
      <span>His choices</span><b>{made.length ? made.join(' · ') : 'None yet'}</b>
    </div>
    <p className="tagline">Each chapter asks for one key detail and for what the chapter was mostly about. A miss opens a clue and one more try; a second miss shows the answer and why. A first tap faster than the question can be read is set aside as a guess, as in Reading. Eight chapters are too few to measure a skill, so read this as a record of the book, not a score.</p>
  </section>;
}
