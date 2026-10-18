// LTF-51: a picture reward. He types what he would like drawn and pays for it with flight points; Claude draws it as
// SVG through the family API. The picture shows as an image, so nothing in it can run. His pictures stay in his log.
import { useState } from 'react';
import type { LogEvent, PictureEvent } from '@wayfinder/schema';
import { PICTURE_COST, pictureBalance, dayKey } from '@wayfinder/engine';
import { Guide } from './art';
import { Btn } from './ui';
import { log, type Settings } from './db';
import { CloudError, drawPicture, isFamily, useCloudStatus, useLink } from './cloud';

export const pictureSrc = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
export const picturesOf = (events: readonly LogEvent[]) => events.filter((e): e is PictureEvent => e.type === 'picture');

export function PicturePanel({ events, settings }: { events: LogEvent[]; settings: Settings }) {
  const cloud = useCloudStatus(), link = useLink();
  const [ask, setAsk] = useState('');
  const [state, setState] = useState<{ step: 'ask' | 'drawing' | 'done' | 'note'; text?: string; svg?: string }>({ step: 'ask' });
  const balance = pictureBalance(events), mine = picturesOf(events).reverse();
  const ready = !!link && isFamily(cloud.me);
  const draw = async () => {
    const what = ask.trim();
    if (!what || !link) return;
    setState({ step: 'drawing' });
    try {
      const r = await drawPicture({ learner: link.learner, ask: what, day: dayKey(Date.now()) });
      if (!r.svg) return setState({ step: 'note', text: "Let's draw something else. Try another idea. Your points are still here." });
      await log({ type: 'picture', ask: what, svg: r.svg, cost: PICTURE_COST });
      setAsk('');
      setState({ step: 'done', text: what, svg: r.svg });
    } catch (e) {
      const s = e instanceof CloudError ? e.status : 0;
      setState({ step: 'note', text: s === 429 ? "That's all the pictures for today. You can draw more tomorrow."
        : s === 503 ? "Pictures are not set up yet. Ask a grown-up." : "The drawing did not work this time. Your points are still here. Try again in a little while." });
    }
  };

  return <div className="stack">
    <p style={{ margin: 0 }}>A picture costs {PICTURE_COST} flight points. You have <b>{balance}</b> to spend.</p>
    {!ready ? <p className="tagline" style={{ margin: 0 }}>Pictures need your family's copy. A grown-up can set it up in Grown-ups, under Data.</p>
      : state.step === 'drawing' ? <div className="guide-row" role="status"><Guide id={settings.guide} mood="think" size={56} /><div className="bubble">Drawing your picture… This can take up to half a minute.</div></div>
      : state.step === 'done' ? <div className="stack" role="status">
          <img className="picture" src={pictureSrc(state.svg!)} alt={`Your picture: ${state.text}`} />
          <p style={{ margin: 0 }}>Here is your picture: {state.text}. It is in My pictures.</p>
          <Btn onPress={() => setState({ step: 'ask' })}>Draw another</Btn>
        </div>
      : balance < PICTURE_COST ? <p className="tagline" style={{ margin: 0 }}>Earn {PICTURE_COST - balance} more points to draw a picture. Every answer and every finished session earns points.</p>
      : <form className="stack" onSubmit={(e) => { e.preventDefault(); void draw(); }}>
          {state.step === 'note' && <p role="status" className="feedback neutral" style={{ margin: 0 }}>{state.text}</p>}
          <label className="field" htmlFor="ask"><span className="label">What should I draw?</span>
            <input id="ask" className="input" maxLength={100} value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="For example: a dragon reading a book" autoComplete="off" /></label>
          <Btn type="submit" className="primary" isDisabled={!ask.trim()}><span aria-hidden>🎨</span> Draw it ({PICTURE_COST} points)</Btn>
        </form>}
    {mine.length > 0 && <section className="stack" aria-label="My pictures">
      <h3 style={{ margin: 0 }}>My pictures</h3>
      <ul className="pictures">{mine.map((p) => <li key={p.id}><img className="picture" src={pictureSrc(p.svg)} alt={p.ask} /><span>{p.ask}</span></li>)}</ul>
    </section>}
  </div>;
}
