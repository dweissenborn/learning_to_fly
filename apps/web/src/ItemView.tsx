// One item in any of the seven formats. Every format works by tapping alone; dragging is an extra.
// A wrong answer never ends an item and never shows a cross: it opens the next hint (R6).
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button, DropIndicator, GridList, GridListItem, isTextDropItem, useDragAndDrop, type DropItem, type DropTarget, type Key } from 'react-aria-components';
import type { Item } from '@wayfinder/schema';
import { pool, passageText, praiseFor } from './content';
import { Passage, SignSvg, norm, type Mark } from './Passage';
import { Btn, SpeakBtn, shuffled } from './ui';
import { sfx, speak, stopSpeaking } from './media';
import { Guide } from './art';
import type { GuideId } from './db';

export interface Result { correct: boolean; hint: number; tries: number; ms: number; rubric?: number; note?: string }
export type HintMode = 'auto' | 'request' | 'none' | 'demo';
export interface ItemViewProps {
  item: Item;
  mode: HintMode;
  guide: GuideId;
  hintDelay?: number;
  pictures?: boolean;
  /** Bumped by the bottom bar's Help button. */
  helpTick?: number;
  demo?: { show?: number[]; reveal?: boolean };
  autoRead?: boolean;
  listenOnly?: boolean;
  praiseIndex?: number;
  onDone?: (r: Result) => void;
}

const SLOT: Record<string, [string, string]> = {
  who: ['👤', 'Who'], where: ['📍', 'Where'], when: ['🕒', 'When'], problem: ['⚡', 'Problem'], feeling: ['💗', 'Feeling'], want: ['🎯', 'Wants'],
  plan: ['🧭', 'Plan'], ending: ['🏁', 'Ending'], first: ['1️⃣', 'First'], then: ['2️⃣', 'Then'], last: ['3️⃣', 'Last'], why: ['❓', 'Why'],
  main: ['⭐', 'Main idea'], lesson: ['💡', 'Lesson'], evidence: ['🔎', 'Clue'], me: ['🙋', 'Me'], other: ['👥', 'Someone else'],
};
const RUBRIC = ['', 'You named the feeling or idea.', 'You gave a reason.', 'You tied it to the story.', 'You added your own life or another view.'];

export function ItemView({ item, mode, guide, hintDelay = 8, pictures = true, helpTick = 0, demo, autoRead, listenOnly, praiseIndex = 0, onDone }: ItemViewProps) {
  const passage = pool.passages.get(item.passage)!;
  const [hint, setHint] = useState(0);
  const [tries, setTries] = useState(0);
  const [solved, setSolved] = useState<null | 'right' | 'answered'>(null);
  const [poke, setPoke] = useState(0); // any interaction restarts the hint timer
  const [rubric, setRubric] = useState<number | undefined>();
  const [note, setNote] = useState('');
  const start = useRef(Date.now());
  const first = useRef<boolean | null>(null);
  const isDemo = mode === 'demo';
  const express = item.tier === 'express';
  const highlight = item.format === 'highlight';

  // Reset when the item changes.
  useEffect(() => {
    setHint(0); setTries(0); setSolved(null); setRubric(undefined); setNote('');
    start.current = Date.now(); first.current = null;
    if (autoRead && !isDemo) speak([...(listenOnly || item.format !== 'scene' ? passageText(passage) : []), item.prompt], 'auto-' + item.id);
    return () => stopSpeaking();
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Help button.
  const lastTick = useRef(helpTick);
  useEffect(() => {
    if (helpTick !== lastTick.current && !solved && (mode === 'auto' || mode === 'request')) setHint((h) => Math.min(3, h + 1));
    lastTick.current = helpTick;
  }, [helpTick, solved, mode]);

  // Timed hints in "together": wait, then step from light to strategy (R6). The full answer only comes after a miss or a request.
  useEffect(() => {
    if (mode !== 'auto' || solved || hint >= 2 || express) return;
    const t = setTimeout(() => setHint((h) => Math.min(2, h + 1)), hintDelay * 1000);
    return () => clearTimeout(t);
  }, [mode, solved, hint, poke, hintDelay, express]);

  const submit = (right: boolean) => {
    const t = tries + 1;
    setTries(t);
    setPoke((p) => p + 1);
    if (first.current === null) first.current = right && hint === 0;
    if (mode === 'none') { setSolved('answered'); return; }
    if (right) { setSolved('right'); sfx.good(); }
    else setHint((h) => Math.min(3, h + 1));
  };
  const finishExpress = (points: number) => { setRubric(points); setSolved('right'); first.current = true; sfx.good(); };
  const next = () => onDone?.({ correct: !!first.current, hint, tries: Math.max(1, tries), ms: Date.now() - start.current, rubric, note: note.trim() || undefined });

  // Highlight items tap the passage itself.
  const [hl, setHl] = useState<{ marks: Record<number, Mark>; words: Record<string, Mark> }>({ marks: {}, words: {} });
  useEffect(() => setHl({ marks: {}, words: {} }), [item.id]);
  const accepted = [].concat((item.answer ?? []) as never) as number[];
  const onTapPassage = (i: number, word?: string) => {
    if (solved || isDemo) return;
    const ok = item.unit === 'word' ? !!word && (item.accept ?? []).some((a) => norm(a) === word) : accepted.includes(i);
    if (item.unit === 'word' && word) setHl((s) => ({ ...s, words: { ...s.words, [word]: mode === 'none' ? 'picked' : ok ? 'right' : 'tried' } }));
    else setHl((s) => ({ ...s, marks: { ...s.marks, [i]: mode === 'none' ? 'picked' : ok ? 'right' : 'tried' } }));
    submit(ok);
  };

  // What the passage shows.
  const marks: Record<number, Mark> = { ...hl.marks };
  const words: Record<string, Mark> = { ...hl.words };
  const showEvidence = isDemo ? demo?.show ?? [] : (highlight ? hint >= 2 : hint >= 1) && !solved ? item.evidence ?? [] : [];
  for (const e of showEvidence) marks[e] ??= 'hl';
  if (highlight && ((hint >= 3 && !solved) || (isDemo && demo?.reveal))) {
    if (item.unit === 'word') words[norm(item.accept?.[0] ?? '')] = isDemo ? 'right' : 'hinted';
    else marks[accepted[0]] = isDemo ? 'right' : 'hinted';
  }

  const reveal = isDemo && !!demo?.reveal;
  const fmt: FormatProps = { item, hint: isDemo ? 0 : hint, solved: !!solved, submit, poke: () => setPoke((p) => p + 1), demo: isDemo, reveal, pictures, none: mode === 'none', finishExpress };
  let body: ReactNode = null;
  switch (item.format) {
    case 'tap': body = <Tap {...fmt} />; break;
    case 'scene': body = <Scene {...fmt} />; break;
    case 'order': body = <Order {...fmt} />; break;
    case 'storymap': case 'build': body = <Slots {...fmt} />; break;
    case 'sort': body = <Sort {...fmt} />; break;
    case 'highlight': body = <p className="muted">{item.unit === 'word' ? 'Tap the word in the text.' : item.unit === 'row' ? 'Tap the line in the text.' : 'Tap the sentence in the text.'}</p>; break;
  }

  const hintText = hint === 0 ? null
    : hint === 1 ? (highlight || !item.evidence?.length ? item.hint ?? 'Read it again, slowly.' : 'Look at the part that is lit up.')
    : hint === 2 ? `${item.hint ?? 'Read it again, slowly.'}${highlight ? ' Look at the lit-up part.' : ''}`
    : `Here is the answer. ${item.explain} ${['order', 'sort', 'storymap', 'build'].includes(item.format) ? 'Tap Check to go on.' : 'Tap it to go on.'}`;

  const showPassage = item.format !== 'scene' || passage.sentences.length > 0 || !!passage.visual;
  return <div className="lesson">
    <div className={`lesson-grid ${showPassage ? 'two' : ''}`}>
      {showPassage && <Passage passage={passage} marks={marks} wordMarks={words} focus={item.focus} pictures={pictures} listenOnly={listenOnly}
        tap={highlight && !isDemo && !solved ? { unit: item.unit ?? 'sentence', onTap: onTapPassage } : undefined} />}
      <div className="stack">
        <div className="prompt"><SpeakBtn lines={[item.prompt]} k={'q-' + item.id} label="" className="small iconbtn speak" /><span>{item.prompt}</span></div>
        {body}
        <div aria-live="polite" className="stack">
          {!isDemo && hintText && !solved && <div className="feedback hint appear" key={hint}><Guide id={guide} mood="think" size={44} /><span>{hintText}</span></div>}
          {solved === 'answered' && <div className="feedback neutral appear"><Guide id={guide} size={44} /><span>Thank you. On to the next one.</span></div>}
          {solved === 'right' && <div className="feedback good appear">
            <Guide id={guide} mood="happy" size={44} />
            <div>
              {express ? <>{(RUBRIC.slice(1, (rubric ?? 0) + 1).join(' ') || 'Thank you for sharing your ideas.')} <span className="muted">{item.explain}</span></>
                : <><b>{first.current ? '' : 'You got there. '}{praiseFor(item, praiseIndex)}</b> {item.explain}</>}
            </div>
          </div>}
          {solved === 'right' && (express || item.personal) && <div className="field appear">
            <label htmlFor={'note-' + item.id}>Add your own words, if you want to. Your grown-up will see them.</label>
            <textarea id={'note-' + item.id} className="express-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>}
        </div>
        {solved && <NextSlot><Btn className="primary big appear" autoFocus onPress={next}>Next <span aria-hidden>→</span></Btn></NextSlot>}
      </div>
    </div>
  </div>;
}

/** The "go on" button always sits in the same place: the bottom bar, when the screen has one. */
export function NextSlot({ children }: { children: ReactNode }) {
  const slot = document.getElementById('bar-next');
  return slot ? createPortal(children, slot) : <>{children}</>;
}

interface FormatProps {
  item: Item; hint: number; solved: boolean; submit: (right: boolean) => void; poke: () => void;
  demo: boolean; reveal: boolean; pictures: boolean; none: boolean; finishExpress: (points: number) => void;
}

// ---------------------------------------------------------------- tap
function Tap({ item, hint, solved, submit, demo, reveal, pictures, none }: FormatProps) {
  const order = useMemo(() => shuffled(item.options!, item.id), [item.id]);
  const [tried, setTried] = useState<Set<number>>(new Set());
  const [pick, setPick] = useState<number | null>(null);
  useEffect(() => { setTried(new Set()); setPick(null); }, [item.id]);
  const ans = item.answer as number;
  const faded = hint >= 2 && !none ? order.find((i) => i !== ans && !tried.has(i)) : undefined;
  return <div className="options" role="group" aria-label="Answers">
    {order.map((i) => {
      const right = (solved && !none && i === ans) || (reveal && i === ans);
      const cls = ['opt', tried.has(i) && 'tried', right && 'right', hint >= 3 && i === ans && !solved && 'hinted', faded === i && 'faded', none && pick === i && 'picked'].filter(Boolean).join(' ');
      return <Button key={i} className={cls} isDisabled={demo || solved || tried.has(i) || faded === i}
        onPress={() => { setPick(i); if (i === ans) submit(true); else { if (!none) setTried((t) => new Set(t).add(i)); submit(false); } }}>
        {pictures && item.pictures?.[i] && <span className="pic" aria-hidden>{item.pictures[i]}</span>}
        <span>{item.options![i]}</span>
      </Button>;
    })}
  </div>;
}

// ---------------------------------------------------------------- scene
function Scene({ item, hint, solved, submit, demo, reveal, none }: FormatProps) {
  const seq = ([] as number[]).concat(item.answer as number | number[]);
  const [k, setK] = useState(0);
  const [tried, setTried] = useState<Set<number>>(new Set());
  useEffect(() => { setK(0); setTried(new Set()); }, [item.id]);
  const done = reveal ? seq.length : solved && !none ? seq.length : k;
  const faded = hint >= 2 && seq.length === 1 && !none ? item.objects!.findIndex((_, j) => j !== seq[0] && !tried.has(j)) : -1;
  const press = (j: number) => {
    if (j === seq[k]) { if (k + 1 === seq.length) submit(true); setK(k + 1); }
    else { if (seq.length === 1 && !none) setTried((t) => new Set(t).add(j)); submit(false); }
  };
  return <div className={`scene scene-${item.scene}`} role="group" aria-label="Scene">
    {item.objects!.map((o, j) => {
      const step = seq.slice(0, done).indexOf(j);
      const cls = ['sobj', step >= 0 && 'right', tried.has(j) && 'tried', hint >= 3 && !solved && seq[k] === j && 'hinted', faded === j && 'tried'].filter(Boolean).join(' ');
      return <Button key={j} className={cls} isDisabled={demo || solved || tried.has(j) || faded === j} onPress={() => press(j)} aria-label={o.sign ? `${o.label}, sign says ${o.sign.text}` : o.label}>
        {step >= 0 && seq.length > 1 && <span className="stepn" aria-hidden>{step + 1}</span>}
        {o.sign ? <SignSvg s={o.sign} /> : <span className="semoji" aria-hidden>{o.emoji ?? '⬜'}</span>}
        {o.sign && o.emoji && <span aria-hidden style={{ fontSize: '1.8rem' }}>{o.emoji}</span>}
        <span>{o.label}</span>
      </Button>;
    })}
  </div>;
}

// ---------------------------------------------------------------- drag helpers
async function droppedKeys(items: DropItem[], type: string) {
  return Promise.all(items.filter(isTextDropItem).map((i) => i.getText(type)));
}
function useListDnD(type: string, onDrop: (keys: string[], target?: DropTarget) => void, onReorder?: (keys: Key[], target: { key: Key; dropPosition: string }) => void) {
  return useDragAndDrop({
    getItems: (keys) => [...keys].map((k) => ({ [type]: String(k), 'text/plain': String(k) })),
    acceptedDragTypes: [type],
    getDropOperation: () => 'move',
    onRootDrop: async (e) => onDrop(await droppedKeys(e.items, type)),
    onInsert: async (e) => onDrop(await droppedKeys(e.items, type), e.target),
    onReorder: onReorder ? (e) => onReorder([...e.keys], e.target as never) : undefined,
    renderDropIndicator: (t) => <DropIndicator target={t} className="drop-indicator" />,
  }).dragAndDropHooks;
}

// ---------------------------------------------------------------- order
function Order({ item, hint, solved, submit, demo, reveal, poke }: FormatProps) {
  const steps = item.steps!;
  const initial = useMemo(() => {
    const o = shuffled(steps, item.id);
    return o.every((v, i) => v === i) ? [...o.slice(1), o[0]] : o;
  }, [item.id, steps]);
  const [placed, setPlaced] = useState<number[]>([]);
  const [locked, setLocked] = useState<Set<number>>(new Set());
  useEffect(() => { setPlaced([]); setLocked(new Set()); }, [item.id]);
  useEffect(() => {
    if (solved || demo) return;
    if (hint === 2 && placed[0] !== 0) { setPlaced([0]); setLocked(new Set([0])); }
    if (hint === 3) { setPlaced(steps.map((_, i) => i)); setLocked(new Set(steps.map((_, i) => i))); }
  }, [hint]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = reveal || solved ? steps.map((_, i) => i) : placed;
  const poolIds = reveal || solved ? [] : initial.filter((i) => !placed.includes(i));
  const add = (ids: number[], at = placed.length) => { poke(); setPlaced((p) => { const rest = p.filter((x) => !ids.includes(x)); rest.splice(Math.min(at, rest.length), 0, ...ids); return rest; }); };
  const remove = (ids: number[]) => { poke(); setPlaced((p) => p.filter((x) => !ids.includes(x) || locked.has(x))); };
  const check = () => {
    const right = placed.every((v, i) => v === i) && placed.length === steps.length;
    if (!right) {
      let n = 0;
      while (placed[n] === n) n++;
      setPlaced(placed.slice(0, n));
      setLocked(new Set(placed.slice(0, n)));
    }
    submit(right);
  };
  const placedHooks = useListDnD('application/x-step', (keys, target) => {
    const ids = keys.map(Number);
    const at = target && target.type === 'item' ? placed.indexOf(Number(target.key)) + (target.dropPosition === 'after' ? 1 : 0) : placed.length;
    add(ids, at);
  }, (keys, target) => {
    const ids = keys.map(Number).filter((k) => !locked.has(k));
    const at = placed.filter((x) => !ids.includes(x)).indexOf(Number(target.key)) + (target.dropPosition === 'after' ? 1 : 0);
    if (ids.length) add(ids, Math.max(at, 0));
  });
  const poolHooks = useListDnD('application/x-step', (keys) => remove(keys.map(Number)));
  const live = !demo && !solved;

  return <div className="stack">
    <div>
      <div className="label" id={`ord-${item.id}`}>Your order</div>
      <GridList key={live ? 'dnd' : 'static'} aria-labelledby={`ord-${item.id}`} className="gl order-slots" items={shown.map((i) => ({ id: i }))} dragAndDropHooks={live ? placedHooks : undefined}
        onAction={live ? (k) => remove([Number(k)]) : undefined} renderEmptyState={() => <div className="slots-empty">Tap the steps below, in order.</div>}>
        {(it) => <GridListItem id={it.id} textValue={steps[it.id]} className={`ocard ${locked.has(it.id) || solved || reveal ? 'locked' : ''}`}>
          <span className="num">{shown.indexOf(it.id) + 1}</span>{steps[it.id]}
        </GridListItem>}
      </GridList>
    </div>
    {poolIds.length > 0 && <GridList key={live ? 'dnd' : 'static'} aria-label="Steps to place" className="gl order-pool" items={poolIds.map((i) => ({ id: i }))} dragAndDropHooks={live ? poolHooks : undefined}
      onAction={live ? (k) => add([Number(k)]) : undefined}>
      {(it) => <GridListItem id={it.id} textValue={steps[it.id]} className="ocard">{steps[it.id]}</GridListItem>}
    </GridList>}
    {live && <Btn className="primary" isDisabled={placed.length < steps.length} onPress={check}>Check my order</Btn>}
  </div>;
}

// ---------------------------------------------------------------- story map and sentence builder
function Slots({ item, hint, solved, submit, demo, reveal, poke, none, finishExpress }: FormatProps) {
  const slots = item.slots!;
  const express = item.tier === 'express';
  const [choice, setChoice] = useState<(number | undefined)[]>([]);
  const [locked, setLocked] = useState<Set<number>>(new Set());
  const [tried, setTried] = useState<Set<string>>(new Set());
  useEffect(() => { setChoice([]); setLocked(new Set()); setTried(new Set()); }, [item.id]);
  useEffect(() => {
    if (solved || demo || express) return;
    if (hint === 2) {
      const s = slots.findIndex((_, i) => !locked.has(i));
      if (s >= 0) { setChoice((c) => { const n = [...c]; n[s] = slots[s].answer![0]; return n; }); setLocked((l) => new Set(l).add(s)); }
    }
    if (hint === 3) { setChoice(slots.map((s) => s.answer![0])); setLocked(new Set(slots.map((_, i) => i))); }
  }, [hint]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = reveal && !express ? slots.map((s) => s.answer![0]) : choice;
  const ready = slots.every((s, i) => s.optional || choice[i] !== undefined);
  const pickOpt = (s: number, o: number) => {
    if (locked.has(s) || solved || demo || tried.has(`${s}:${o}`)) return;
    poke();
    setChoice((c) => { const n = [...c]; n[s] = n[s] === o ? undefined : o; return n; });
  };
  const check = () => {
    if (express) return finishExpress(new Set(slots.filter((s, i) => s.rubric && choice[i] !== undefined).map((s) => s.rubric)).size);
    const wrong = slots.map((s, i) => !s.answer!.includes(choice[i]!)).map((w, i) => (w ? i : -1)).filter((i) => i >= 0);
    if (wrong.length && !none) {
      setTried((t) => { const n = new Set(t); wrong.forEach((i) => n.add(`${i}:${choice[i]}`)); return n; });
      setChoice((c) => c.map((v, i) => (wrong.includes(i) ? undefined : v)));
      setLocked(new Set(slots.map((_, i) => i).filter((i) => !wrong.includes(i))));
    }
    submit(!wrong.length);
  };
  const chip = (s: number, o: number) => {
    const on = shown[s] === o;
    const right = on && (solved || reveal || locked.has(s)) && !express;
    return <button key={o} type="button" className={`smchoice ${on ? 'on' : ''} ${right ? 'right' : ''} ${tried.has(`${s}:${o}`) ? 'tried' : ''}`}
      aria-pressed={on} disabled={demo || solved || locked.has(s) || tried.has(`${s}:${o}`)} onClick={() => pickOpt(s, o)}>{slots[s].options[o]}</button>;
  };

  return <div className="stack">
    {item.format === 'build' && item.frame && <p className="frame" aria-label="Your sentence">
      {item.frame.split(/(\{\d\})/).map((part, k) => {
        const m = part.match(/\{(\d)\}/);
        if (!m) return <span key={k}>{part}</span>;
        const s = Number(m[1]);
        const v = shown[s];
        return <span key={k} className="blank">{v === undefined ? (slots[s].optional ? '(optional)' : '______') : slots[s].options[v]}</span>;
      })}
    </p>}
    <div className="storymap">
      {slots.map((s, i) => {
        const [ico, lab] = SLOT[s.kind] ?? ['•', s.kind];
        return <section key={i} className="smbox" aria-label={s.label ?? lab}>
          <header><span className="sico" aria-hidden>{ico}</span>{item.format === 'build' ? `Blank ${i + 1}: ` : ''}{s.label ?? lab}{s.optional ? ' (if you want)' : ''}</header>
          <div className="choices">{s.options.map((_, o) => chip(i, o))}</div>
        </section>;
      })}
    </div>
    {!demo && !solved && <Btn className="primary" isDisabled={!ready} onPress={check}>{express ? 'Done' : 'Check'}</Btn>}
  </div>;
}

// ---------------------------------------------------------------- sort
function Sort({ item, hint, solved, submit, demo, reveal, poke, none }: FormatProps) {
  const cards = item.cards!;
  const order = useMemo(() => shuffled(cards, item.id), [item.id, cards]);
  const [bin, setBin] = useState<(number | undefined)[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [locked, setLocked] = useState<Set<number>>(new Set());
  useEffect(() => { setBin([]); setSel(null); setLocked(new Set()); }, [item.id]);
  useEffect(() => {
    if (solved || demo) return;
    if (hint === 2) {
      const c = order.find((i) => !locked.has(i));
      if (c !== undefined) { setBin((b) => { const n = [...b]; n[c] = cards[c].bin; return n; }); setLocked((l) => new Set(l).add(c)); }
    }
    if (hint === 3) { setBin(cards.map((c) => c.bin)); setLocked(new Set(cards.map((_, i) => i))); }
  }, [hint]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = reveal || solved ? cards.map((c) => c.bin) : bin;
  const put = (ids: number[], b: number | undefined) => { poke(); setBin((cur) => { const n = [...cur]; ids.filter((i) => !locked.has(i)).forEach((i) => (n[i] = b)); return n; }); setSel(null); };
  const check = () => {
    const wrong = cards.map((c, i) => (c.bin !== bin[i] ? i : -1)).filter((i) => i >= 0);
    if (wrong.length && !none) {
      setBin((b) => b.map((v, i) => (wrong.includes(i) ? undefined : v)));
      setLocked(new Set(cards.map((_, i) => i).filter((i) => !wrong.includes(i))));
    }
    submit(!wrong.length);
  };
  const live = !demo && !solved;
  const card = (i: number) => <GridListItem key={i} id={i} textValue={cards[i].text} className={`scard ${sel === i ? 'on' : ''} ${locked.has(i) || solved || reveal ? 'right' : ''}`}>
    {cards[i].emoji && <span aria-hidden style={{ fontSize: '1.4rem' }}>{cards[i].emoji}</span>}{cards[i].text}
  </GridListItem>;
  const tapCard = (k: Key) => { const i = Number(k); if (!locked.has(i)) setSel(sel === i ? null : i); };
  return <div className="stack">
    {live && <p className="muted" style={{ margin: 0 }}>Tap a card, then tap “Put here” on a box. You can also drag the cards.</p>}
    <CardList label="Cards to sort" className="gl order-pool" ids={order.filter((i) => shown[i] === undefined)} live={live} render={card} onAction={tapCard}
      onDrop={(keys) => put(keys.map(Number), undefined)} empty="All cards are sorted." />
    <div className="sort-bins">{item.bins!.map((name, b) => <section key={b} className={`bin ${sel !== null ? 'armed' : ''}`} aria-label={name}>
      <h4>{name}</h4>
      {live && sel !== null && <Btn className="small" onPress={() => put([sel], b)}>Put “{cards[sel].text}” here</Btn>}
      <CardList label={name} className="gl" ids={order.filter((i) => shown[i] === b)} live={live} render={card} onAction={tapCard} onDrop={(keys) => put(keys.map(Number), b)} empty="Empty" />
    </section>)}</div>
    {live && <Btn className="primary" isDisabled={shown.filter((x) => x !== undefined).length < cards.length} onPress={check}>Check</Btn>}
  </div>;
}

function CardList({ label, className, ids, live, render, onAction, onDrop, empty }: {
  label: string; className: string; ids: number[]; live: boolean; render: (i: number) => ReactNode; onAction: (k: Key) => void; onDrop: (keys: string[]) => void; empty: string;
}) {
  const hooks = useListDnD('application/x-card', onDrop);
  // React Aria's lists may not switch drag hooks on and off in place, so a change of mode remounts the list.
  return <GridList key={live ? 'dnd' : 'static'} aria-label={label} className={className} dragAndDropHooks={live ? hooks : undefined} onAction={live ? onAction : undefined}
    renderEmptyState={() => <div className="slots-empty">{empty}</div>}>{ids.map(render)}</GridList>;
}
