// Small shared pieces.
import { Button, Switch, type ButtonProps } from 'react-aria-components';
import { useEffect, useState, type ReactNode } from 'react';
import { speak, stopSpeaking, useReading, canSpeak } from './media';
import { log } from './db';
import { AMOUNT, LIKE, type Feature, type Like } from './features';

export function Btn({ className = '', ...p }: ButtonProps & { className?: string }) {
  return <Button {...p} className={`btn ${className}`} />;
}

/** The read-to-me button. Tapping again stops. */
export function SpeakBtn({ lines, k, label = 'Read to me', className = '' }: { lines: string[]; k: string; label?: string; className?: string }) {
  const r = useReading();
  if (!canSpeak) return null;
  const on = r.key === k;
  return <Btn className={`${className} ${on ? 'primary' : ''}`} aria-pressed={on} aria-label={label ? undefined : on ? 'Stop reading' : 'Read this aloud'} onPress={() => (on ? stopSpeaking() : speak(lines, k))}>
    <span className="ico" aria-hidden>{on ? '⏹️' : '🔊'}</span><span className="lbl">{on ? 'Stop reading' : label}</span>
  </Btn>;
}

export function Toggle({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return <Switch className="switch" isSelected={on} onChange={onChange}><span className="track" />{children}</Switch>;
}

export function Seg<T extends string | number>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return <div className="field"><span className="label">{label}</span>
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, text]) => <Btn key={String(v)} className={`small ${v === value ? 'on' : 'quiet'}`} aria-pressed={v === value} onPress={() => onChange(v)}>{text}</Btn>)}
    </div>
  </div>;
}

export function Lanterns({ total, lit }: { total: number; lit: number }) {
  return <div className="lanterns" role="img" aria-label={`${lit} of ${total} lanterns lit`}>
    {Array.from({ length: total }, (_, i) => <svg key={i} className={`lantern ${i < lit ? 'lit' : ''}`} viewBox="0 0 18 24" aria-hidden>
      <circle className="glow" cx="9" cy="13" r="9" fill="url(#lg)" />
      <defs><radialGradient id="lg"><stop offset="0" stopColor="#ffe08a" /><stop offset="1" stopColor="#ffe08a" stopOpacity="0" /></radialGradient></defs>
      <rect x="5" y="7" width="8" height="11" rx="3" fill={i < lit ? '#ffd56b' : '#cfc8b8'} stroke="#6b6458" />
      <rect x="6" y="4" width="6" height="3" rx="1" fill="#6b6458" />
    </svg>)}
  </div>;
}

/** Deterministic shuffle from a string, so an item's options keep their places if it is reopened. */
export function shuffled<T>(arr: readonly T[], seed: string): number[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const idx = arr.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
    const j = Math.abs(h) % (i + 1);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

/** LTF-18: a one-time "What do you think?" card on his island. The app shows at most one a visit, never mid-lesson. */
export function NewThing({ feature, answered, onShown }: { feature: Feature; answered: boolean; onShown: (id: string) => void }) {
  const [step, setStep] = useState<'like' | 'amount' | 'done' | 'gone'>(answered ? 'gone' : 'like');
  const [like, setLike] = useState<Like>('like');
  useEffect(() => onShown(feature.id), []); // eslint-disable-line react-hooks/exhaustive-deps
  if (step === 'gone') return null;
  const ask = step === 'like' ? 'Do you like it?' : step === 'amount' ? 'Is there too much of it, just the right amount, or too little?' : 'Thank you. I will tell the grown-ups.';
  return <section className="card stack" aria-labelledby="newthing">
    <h2 id="newthing" style={{ margin: 0 }}>What do you think?</h2>
    <p style={{ margin: 0 }}><b>{feature.name}.</b> {feature.say}</p>
    <p style={{ margin: 0 }}>{ask}</p>
    {step === 'like' && <div className="row">{LIKE.map(([v, emoji, text]) =>
      <Btn key={v} onPress={() => { setLike(v); setStep('amount'); }}><span className="ico" aria-hidden>{emoji}</span>{text}</Btn>)}</div>}
    {step === 'amount' && <div className="row">{AMOUNT.map(([v, text]) =>
      <Btn key={v} onPress={() => { void log({ type: 'activity', session: 'home', kind: 'opinion', feature: feature.id, like, amount: v }); setStep('done'); }}>{text}</Btn>)}</div>}
    <SpeakBtn lines={[`${feature.name}. ${feature.say}`, ask]} k={`newthing-${feature.id}-${step}`} />
  </section>;
}
