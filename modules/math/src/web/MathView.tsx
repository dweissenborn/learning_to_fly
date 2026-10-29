// LTF-40: typed math answers on an on-screen keypad, judged by exact arithmetic in the engine. Tapping only: the answer
// always shows its shape (a whole number, a fraction, a mixed number, or a quotient and remainder), never a blank box.
import { useMemo, useState } from 'react';
import { Dialog, Heading, Modal, ModalOverlay, ToggleButton } from 'react-aria-components';
import { mulberry32 } from '@wayfinder/engine';
import { Btn } from '@wayfinder/web/host';
import { judge, makeProblem, MATH_SKILLS, type Entry, type Judged, type MathError, type MathProblem } from '../engine/math';

type Box = keyof Entry;
const BOXES: Record<MathProblem['shape'], Box[]> = { whole: ['whole'], fraction: ['num', 'den'], mixed: ['whole', 'num', 'den'], remainder: ['whole', 'rem'] };

export const MATH_NAME: Record<string, string> = {
  'math:MF1': 'Multiplication and division facts', 'math:MF2': 'Factors and common factors', 'math:DV1': 'Division with remainders', 'math:FR1': 'Fractions of a whole',
  'math:FR2': 'Equivalent fractions', 'math:FR3': 'Simplifying fractions', 'math:FR4': 'Mixed numbers and improper fractions',
  'math:FR5': 'Multiplying fractions', 'math:FR6': 'Dividing fractions',
};

/** What to do next, by the mistake the answer shows. */
export const MATH_HINT: Record<MathError, string> = {
  'not-simplest': 'That is equal, but it can be simpler. Find a number that divides the top and the bottom.',
  'not-mixed': 'That is the right amount. Now write it as a whole number and a fraction.',
  'not-improper': 'That is the right amount. Now write it as one fraction, with the top bigger than the bottom.',
  'added-whole': 'Multiply the whole number by the bottom number first, then add the top.',
  'no-flip': 'To divide: keep the first fraction, change ÷ to ×, and flip the second fraction.',
  'flipped-first': 'Keep the first fraction as it is. Flip only the second one.',
  'added-across': 'To multiply fractions, multiply the tops and multiply the bottoms. Do not add them.',
  'cross-multiplied': 'Multiply top by top, and bottom by bottom.',
  'added-not-multiplied': 'What was the bottom multiplied by? Multiply the top by the same number.',
  'remainder-too-big': 'The remainder must be smaller than the number you divide by. Can one more group fit?',
  'neighbour-fact': 'Close! That is the fact next to this one. Check it with the Times table button.',
  'not-greatest': 'That is a common factor. Is there a bigger one that divides both numbers?',
  'counted-unshaded': 'The top number counts the shaded parts, not the white ones.',
  'part-over-part': 'The bottom number counts all the equal parts, shaded or not.',
  'upside-down': 'The top number is the shaded parts. The bottom number is all the parts.',
  'no-remainder': 'Something is left over. How many are left after the groups?',
  'divided-one': 'Divide the top and the bottom by the same number.',
  'common-multiple': 'That is a common multiple. A factor divides into both numbers.',
  'kept-top': 'The bottom was multiplied. Multiply the top by the same number.',
  'multiplied-top-only': 'Multiply the bottoms too, not only the tops.',
  'flipped-both': 'Keep the first fraction as it is. Flip only the second one.',
};

export function Keypad({ shape, value, onChange, onCheck, wholeOptional }: { shape: MathProblem['shape']; value: Entry; onChange: (e: Entry) => void; onCheck: () => void; wholeOptional?: boolean }) {
  const boxes = BOXES[shape];
  const [at, setAt] = useState<Box>(shape === 'mixed' ? 'num' : boxes[0]);
  const name: Record<Box, string> = { whole: shape === 'remainder' || shape === 'whole' ? 'Answer' : wholeOptional ? 'Whole number, if there is one' : 'Whole number', num: 'Top number', den: 'Bottom number', rem: 'Remainder' };
  const type = (k: string) => onChange({ ...value, [at]: ((value[at] ?? '') + k).slice(0, 3) });
  const del = () => onChange({ ...value, [at]: (value[at] ?? '').slice(0, -1) });
  const optional = (b: Box) => b === 'whole' && shape === 'mixed' && wholeOptional; // only the extra box beside a fraction
  const box = (b: Box) => <ToggleButton key={b} className={`kp-box ${b} ${optional(b) ? 'optional' : ''}`} isSelected={at === b} onChange={() => setAt(b)} aria-label={`${name[b]}: ${value[b] || 'empty'}`}>
    {value[b] || (!optional(b) && <span aria-hidden className="kp-empty">?</span>)}</ToggleButton>;
  return <div className="stack keypad">
    <div className="kp-answer" role="group" aria-label="Your answer">
      {boxes.includes('whole') && box('whole')}
      {shape === 'remainder' && <><span className="kp-r" aria-hidden>r</span>{box('rem')}</>}
      {boxes.includes('num') && <span className="kp-frac">{box('num')}<span className="kp-bar" aria-hidden />{box('den')}</span>}
    </div>
    <div className="kp-keys" role="group" aria-label="Keypad">
      {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map((k) => <Btn key={k} className="kp-key" onPress={() => type(k)}>{k}</Btn>)}
      <Btn className="kp-key" aria-label="Delete" onPress={del}>⌫</Btn>
      <Btn className="kp-key" onPress={() => type('0')}>0</Btn>
      <Btn className="kp-key" aria-label="Next box" onPress={() => setAt(boxes[(boxes.indexOf(at) + 1) % boxes.length])}>→</Btn>
    </div>
    <Btn className="primary big" onPress={onCheck}>Check</Btn>
  </div>;
}

/** FR1: a bar cut into equal parts, some shaded. */
export function FractionBar({ parts, shaded }: { parts: number; shaded: number }) {
  return <svg viewBox={`0 0 ${parts * 40} 44`} className="frac-bar" role="img" aria-label={`A bar cut into ${parts} equal parts, ${shaded} of them shaded`}>
    {Array.from({ length: parts }, (_, i) => <rect key={i} x={i * 40 + 1} y="1" width="38" height="42" rx="3" fill={i < shaded ? '#3f88c5' : '#fffdf6'} stroke="#1d2b3a" strokeWidth="2" />)}
  </svg>;
}

const said = (r: Judged) => (r.right ? 'Right.' : r.incomplete ? 'Fill in every box first.' : r.error ? MATH_HINT[r.error] : 'Not this time. Look at the problem again.');

/** The grown-ups' preview of the math module: a fresh plain problem for any skill, on the keypad. */
export function MathPreview() {
  const rng = useMemo(() => mulberry32(Date.now() % 2147483647), []);
  const [p, setP] = useState<MathProblem | null>(null);
  const [v, setV] = useState<Entry>({});
  const [res, setRes] = useState<Judged | null>(null);
  const open = (skill: string) => { setP(makeProblem(skill, rng)); setV({}); setRes(null); };
  return <section className="card stack" aria-labelledby="math-h">
    <h2 id="math-h" style={{ margin: 0 }}>Math (preview)</h2>
    <p className="tagline">Plain problems are made fresh for every try, so an answer cannot be remembered. He types the answer on a keypad, and code checks it exactly: an equal fraction counts unless the problem asks for one form, and the usual mistakes get their own next step. Dividing fractions follows keep, change, flip.</p>
    <div className="tiles">{MATH_SKILLS.map((s) => <Btn key={s} onPress={() => open(s)}>{MATH_NAME[s]}</Btn>)}</div>
    <ModalOverlay className="overlay" isOpen={!!p} onOpenChange={(o) => !o && setP(null)} isDismissable>
      <Modal><Dialog className="dialog" aria-label="Try a math problem">
        {p && <div className="stack">
          <Heading slot="title" style={{ margin: 0 }}>{MATH_NAME[p.skill]}</Heading>
          <p className="math-prompt">{p.prompt}</p>
          {p.bar && <FractionBar {...p.bar} />}
          <Keypad key={p.prompt} shape={p.shape} wholeOptional={p.form !== 'mixed'} value={v} onChange={(x) => { setV(x); setRes(null); }} onCheck={() => setRes(judge(p, v))} />
          <div aria-live="polite">{res && <p className={`feedback ${res.right ? 'good' : 'neutral'}`} style={{ margin: 0 }}>{said(res)}</p>}</div>
          <div className="row"><Btn className="small" onPress={() => open(p.skill)}>New problem</Btn><Btn className="small" onPress={() => { setV(p.answer!); setRes(null); }}>Show the answer</Btn>
            <span className="spacer" /><Btn className="quiet" onPress={() => setP(null)}>Close</Btn></div>
        </div>}
      </Dialog></Modal>
    </ModalOverlay>
  </section>;
}

/** LTF-40: the multiplication chart, one tap away on every lesson problem. Looking at it never counts as help. */
export function TimesTable() {
  const [open, setOpen] = useState(false);
  const n = Array.from({ length: 12 }, (_, i) => i + 1);
  return <>
    <Btn className="small" onPress={() => setOpen(true)}><span aria-hidden>✖️</span> Times table</Btn>
    <ModalOverlay className="overlay" isOpen={open} onOpenChange={setOpen} isDismissable>
      <Modal><Dialog className="dialog" aria-label="Times table">
        <div className="stack">
          <Heading slot="title" style={{ margin: 0 }}>Times table</Heading>
          <div className="table-wrap"><table className="times-table">
            <thead><tr><th scope="col"><span aria-hidden>×</span><span className="sr-only">times</span></th>{n.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
            <tbody>{n.map((r) => <tr key={r}><th scope="row">{r}</th>{n.map((c) => <td key={c}>{r * c}</td>)}</tr>)}</tbody>
          </table></div>
          <div className="row"><span className="spacer" /><Btn className="primary" autoFocus onPress={() => setOpen(false)}>Done</Btn></div>
        </div>
      </Dialog></Modal>
    </ModalOverlay>
  </>;
}
