// A passage: prose with sentence and word highlighting, or a functional text drawn like the real thing.
import type { Passage as P, Sign } from '@wayfinder/schema';
import { useReading } from './media';
import { passageText } from './content';
import { SpeakBtn } from './ui';

export type Mark = 'hl' | 'picked' | 'tried' | 'right' | 'hinted';
export interface PassageProps {
  passage: P;
  /** Marks per sentence (prose) or per row (visual). */
  marks?: Record<number, Mark>;
  /** Marks per word (lower case). */
  wordMarks?: Record<string, Mark>;
  /** Make sentences, rows or words tappable. */
  tap?: { unit: 'sentence' | 'word' | 'row'; onTap: (index: number, word?: string) => void };
  focus?: string;
  pictures?: boolean;
  listenOnly?: boolean;
  credit?: boolean;
  speakKey?: string;
}

export const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9'-]/g, '').replace(/'s$/, '');

export function Passage({ passage: p, marks = {}, wordMarks = {}, tap, focus, pictures = true, listenOnly, credit = true, speakKey }: PassageProps) {
  const reading = useReading();
  const readingHere = reading.key === (speakKey ?? p.id);
  const visual = !!p.visual;
  const cls = (m?: Mark) => (m === 'hinted' ? 'hl' : m ?? '');
  return <article className={`passage ${tap ? 'tappable' : ''} ${listenOnly ? 'listen-only' : ''}`} aria-label={p.title}>
    <div className="passage-head">
      {pictures && p.picture && <span className="picture" aria-hidden>{p.picture}</span>}
      <h3>{listenOnly ? 'Listen' : p.title}</h3>
      <SpeakBtn lines={passageText(p)} k={speakKey ?? p.id} label={listenOnly ? 'Hear it again' : 'Read to me'} className="small" />
    </div>
    {p.sentences.length > 0 && <div aria-hidden={listenOnly || undefined}>{paragraphs(p).map(([from, to]) => <p key={from} className="prose">
      {p.sentences.slice(from, to).map((s, k) => {
        const i = from + k;
        const m = visual ? undefined : marks[i];
        const live = readingHere && reading.line === i;
        const words = tokens(s);
        const body = words.map((w, k) => {
          if (/^\s+$/.test(w.text)) return w.text;
          const n = norm(w.text);
          const wm = wordMarks[n];
          const reads = live && reading.char >= w.start && reading.char < w.start + Math.max(w.text.length, reading.len);
          const c = `word ${focus && n === norm(focus) ? 'cue' : ''} ${reads ? 'reading' : ''} ${cls(wm)}`;
          return tap?.unit === 'word'
            ? <span key={k} className={c} {...pressable(() => tap.onTap(i, n))}>{w.text}</span>
            : <span key={k} className={c}>{w.text}</span>;
        });
        const c = `sentence ${cls(m)} ${live ? 'reading' : ''}`;
        return <span key={i}><span className={c} {...(tap?.unit === 'sentence' ? pressable(() => tap.onTap(i)) : {})}>{body}</span>{' '}</span>;
      })}
    </p>)}</div>}
    {p.visual && <div style={{ marginTop: p.sentences.length ? '1rem' : 0 }}><Visual p={p} marks={marks} onRow={tap?.unit === 'row' ? (i) => tap.onTap(i) : undefined} /></div>}
    {credit && <div className="credit">{creditLine(p)}</div>}
  </article>;
}

/** Sentence ranges for each paragraph; `breaks` lists the sentences that start a new one. */
const paragraphs = (p: P): [number, number][] => {
  const starts = [0, ...(p.breaks ?? []).filter((b) => b > 0 && b < p.sentences.length)];
  return starts.map((s, k) => [s, starts[k + 1] ?? p.sentences.length]);
};

/** Inline text that acts as a button but still wraps like text, so the layout does not jump between modes. */
const pressable = (on: () => void) => ({
  role: 'button', tabIndex: 0, onClick: on,
  onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); on(); } },
});

function tokens(s: string) {
  const out: { text: string; start: number }[] = [];
  const re = /\s+|[^\s]+/g;
  let m;
  while ((m = re.exec(s))) out.push({ text: m[0], start: m.index });
  return out;
}

export function creditLine(p: P) {
  const c = p.credit;
  const lic = { original: 'Written for Learning to Fly, shared under CC BY-SA 4.0', 'public-domain': 'Public domain', CC0: 'CC0', 'CC-BY-4.0': 'CC BY 4.0', 'CC-BY-SA-4.0': 'CC BY-SA 4.0' }[c.licence];
  return `“${c.title}”. ${c.author}. ${c.licence === 'original' ? '' : c.source + '. '}${lic}${c.adapted ? '. Adapted' : ''}.`;
}

// ---------------------------------------------------------------- visuals
function Visual({ p, marks, onRow }: { p: P; marks: Record<number, Mark>; onRow?: (i: number) => void }) {
  const v = p.visual!;
  const rc = (i: number) => `vrow ${marks[i] === 'hinted' ? 'hl' : marks[i] ?? ''}`;
  const rowProps = (i: number) => onRow ? { onClick: () => onRow(i), onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRow(i); } }, tabIndex: 0, role: 'button' } : {};
  switch (v.type) {
    case 'signs':
      return <div className="v-signs">{v.signs.map((s, i) => <div key={i} className={`v-sign ${rc(i)}`} {...rowProps(i)}><SignSvg s={s} /></div>)}</div>;
    case 'table':
      return <div className="table-wrap"><table className="v-table">
        {v.title && <caption>{v.title}</caption>}
        <thead><tr>{v.columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
        <tbody>{v.rows.map((r, i) => <tr key={i} className={rc(i)} {...rowProps(i)}>{r.map((c, k) => <td key={k}>{c}</td>)}</tr>)}</tbody>
      </table>{v.note && <div className="v-note">{v.note}</div>}</div>;
    case 'list': {
      const L = v.ordered ? 'ol' : 'ul';
      return <div>{v.title && <h4 style={{ margin: '0 0 0.4rem' }}>{v.title}</h4>}<L className="v-list">{v.rows.map((r, i) => <li key={i} className={rc(i)} {...rowProps(i)}>{r}</li>)}</L>{v.note && <div className="v-note">{v.note}</div>}</div>;
    }
    case 'label':
      return <div className="v-label"><h4>{v.title}</h4>{v.rows.map((r, i) => <div key={i} className={`lrow ${rc(i)}`} {...rowProps(i)}><b>{r.k}</b><span>{r.v}</span></div>)}{v.warning && <div className="warn">⚠️ {v.warning}</div>}</div>;
    case 'message':
      return <div className={`v-msg ${v.app}`}>
        <div className="from">{v.app === 'email' ? '✉️' : v.app === 'note' ? '📝' : '💬'} {v.from}{v.to ? ` to ${v.to}` : ''}{v.time ? ` · ${v.time}` : ''}</div>
        {v.subject && <div className="subject">{v.subject}</div>}
        {v.rows.map((r, i) => <div key={i} className={`mrow ${rc(i)}`} {...rowProps(i)}>{r}</div>)}
      </div>;
    case 'prompt':
      return <div className="v-prompt" role="group" aria-label="A message on a screen">
        {v.icon && <div className="picon" aria-hidden>{v.icon}</div>}
        <h4>{v.title}</h4>
        {v.rows.map((r, i) => <p key={i} className={rc(i)} {...rowProps(i)}>{r}</p>)}
        <div className="pbtns">{v.buttons.map((b, k) => <span key={k} className={`pbtn ${rc(v.rows.length + k)}`} {...rowProps(v.rows.length + k)}>{b}</span>)}</div>
      </div>;
    case 'form':
      return <div className="v-form"><h4>{v.title}</h4>{v.rows.map((r, i) => <div key={i} className={`frow ${rc(i)}`} {...rowProps(i)}><span>{r.k}</span><span className="fbox">{r.v}</span></div>)}</div>;
    case 'notice':
      return <div className="v-notice">{v.icon && <div style={{ textAlign: 'center', fontSize: '2rem' }} aria-hidden>{v.icon}</div>}<h4>{v.title}</h4>{v.rows.map((r, i) => <p key={i} className={rc(i)} {...rowProps(i)}>{r}</p>)}</div>;
  }
}

const SIGN_FILL = { red: '#c8322f', yellow: '#f4c430', green: '#1f7a4a', blue: '#1f5fa8', white: '#fafafa', orange: '#f28c28', brown: '#7a4a2a', black: '#222' };
export function SignSvg({ s }: { s: Sign }) {
  const fill = SIGN_FILL[s.color];
  const ink = ['yellow', 'white', 'orange'].includes(s.color) ? '#111' : '#fff';
  const shape = {
    octagon: <polygon points="30,4 70,4 96,30 96,70 70,96 30,96 4,70 4,30" fill={fill} stroke="#fff" strokeWidth="4" />,
    triangle: <polygon points="50,6 96,90 4,90" fill={fill} stroke={ink === '#fff' ? '#fff' : '#111'} strokeWidth="4" strokeLinejoin="round" />,
    diamond: <polygon points="50,3 97,50 50,97 3,50" fill={fill} stroke="#111" strokeWidth="3" />,
    circle: <circle cx="50" cy="50" r="46" fill={fill} stroke={ink === '#fff' ? '#fff' : '#111'} strokeWidth="4" />,
    rect: <rect x="3" y="18" width="94" height="64" rx="8" fill={fill} stroke={ink === '#fff' ? '#fff' : '#111'} strokeWidth="3" />,
    square: <rect x="5" y="5" width="90" height="90" rx="10" fill={fill} stroke={ink === '#fff' ? '#fff' : '#111'} strokeWidth="3" />,
  }[s.shape];
  // Text must sit inside the shape: each shape has a usable width and a line length.
  const fit = { octagon: [70, 8], circle: [68, 8], triangle: [52, 8], diamond: [56, 7], rect: [86, 12], square: [76, 9] }[s.shape];
  const lines = wrap(s.text, fit[1]);
  const longest = Math.max(3, ...lines.map((l) => l.length));
  const fs = Math.min(s.shape === 'triangle' ? 14 : 19, fit[0] / (longest * 0.76), (s.shape === 'rect' ? 52 : 60) / (lines.length * 1.1 + (s.icon ? 1.2 : 0)));
  const cy = s.shape === 'triangle' ? 66 : 50;
  const block = lines.length * fs * 1.05 + (s.icon ? 22 : 0);
  const top = cy - block / 2 + (s.icon ? 22 : 0) + fs * 0.8;
  const iconY = cy - block / 2 + 17;
  return <svg viewBox="0 0 100 100" role="img" aria-label={`Sign: ${s.text}`}>
    {shape}
    {s.icon && <text x="50" y={iconY} textAnchor="middle" fontSize="19">{s.icon}</text>}
    {lines.map((l, i) => <text key={i} x="50" y={top + i * fs * 1.05} textAnchor="middle" fontSize={fs} fontWeight="800" fill={ink} fontFamily="Arial, Helvetica, sans-serif">{l}</text>)}
  </svg>;
}
function wrap(t: string, max: number) {
  const out: string[] = [];
  for (const w of t.split(/\s+/)) {
    const last = out.at(-1);
    if (last && (last + ' ' + w).length <= max) out[out.length - 1] = last + ' ' + w;
    else out.push(w);
  }
  return out.slice(0, 4);
}
