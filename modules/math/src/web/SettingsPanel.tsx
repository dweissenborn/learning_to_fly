import { saveModuleSettings, Toggle, useModuleSettings } from '@wayfinder/web/host';
import { MATH_GRAPH, MATH_ORDER } from '../engine/mathPath';
import type { MathSettings } from '../settings';
import { MATH_NAME } from './MathView';

/** LTF-41: turning math on, a start point from school if there is one, and opening a skill early. */
export function MathSettingsPanel() {
  const math = useModuleSettings<MathSettings>('math') ?? {};
  const known = math.known ?? [], opened = math.opened ?? [];
  const flip = (list: string[], s: string) => (list.includes(s) ? list.filter((x) => x !== s) : [...list, s]);
  return <div className="stack" style={{ gap: '0.5rem' }}>
    <Toggle on={!!math.enabled} onChange={(enabled) => saveModuleSettings('math', { enabled })}>Math: fractions, and the skills under them</Toggle>
    {math.enabled && <>
      <Toggle on={!!math.stories} onChange={(stories) => saveModuleSettings('math', { stories })}>Story problems (a pilot): equivalent fractions, multiplying and dividing can be read as a short story</Toggle>
      <p className="tagline">He picks where the stories happen, and every problem has a switch to plain numbers that never counts as help. With this on, those steps also need one right answer on his own in each view.</p>
      <p className="tagline">His first math session is a short scouting trip that finds where to start. If you know where he is (for example from a school assessment), tick what he already knows, and the trip only confirms those.</p>
      <div className="tiles" role="group" aria-label="What he already knows">{MATH_ORDER.map((s) => <Toggle key={s} on={known.includes(s)} onChange={() => saveModuleSettings('math', { known: flip(known, s) })}>{MATH_NAME[s]}</Toggle>)}</div>
      <p className="tagline">A step opens when the steps it rests on are done. You can open one early here.</p>
      <div className="tiles" role="group" aria-label="Open a step early">{MATH_ORDER.filter((s) => MATH_GRAPH[s].length).map((s) => <Toggle key={s} on={opened.includes(s)} onChange={() => saveModuleSettings('math', { opened: flip(opened, s) })}>Open {MATH_NAME[s]}</Toggle>)}</div>
    </>}
  </div>;
}

