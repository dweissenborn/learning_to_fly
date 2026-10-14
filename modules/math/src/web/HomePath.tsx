import type { LogEvent } from '@wayfinder/schema';
import { useModuleSettings } from '@wayfinder/web/host';
import { deriveMath, MATH_ORDER } from '../engine/mathPath';
import type { MathSettings } from '../settings';
import { MATH_NAME } from './MathView';

/** The math path on his island: a step that waits for what it rests on shows as coming up. */
export function MathPath({ events }: { events: LogEvent[] }) {
  const math = useModuleSettings<MathSettings>('math');
  if (!math) return null;
  const ms = deriveMath(events, { opened: math.opened, known: math.known });
  const done = MATH_ORDER.filter((x) => ms.skills[x].mastered || ms.skills[x].placed).length;
  return <div className="path strand-math">
    <span className="pico" aria-hidden>🧮</span>
    <div>
      <div className="pname">Math</div>
      <div className="stones" role="img" aria-label={`${done} of ${MATH_ORDER.length} math steps done`}>
        {MATH_ORDER.map((x, i) => <span key={x} className={`stone ${ms.skills[x].mastered || ms.skills[x].placed ? 'lit' : ''} ${ms.focus === x ? 'here' : ''} ${ms.skills[x].open ? '' : 'later'}`} aria-hidden>{i + 1}</span>)}
      </div>
      <div className="tagline">{!ms.checkin.done ? 'Next: a math scouting trip' : ms.focus ? `Next: ${MATH_NAME[ms.focus]}` : 'All steps done. Reviews keep them strong.'}</div>
    </div>
  </div>;
}
