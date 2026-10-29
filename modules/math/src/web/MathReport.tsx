// LTF-44: what the grown-ups see in math, as its own tab. Read from the event log only, like the reading tabs.
import type { LogEvent } from '@wayfinder/schema';
import { useModuleSettings } from '@wayfinder/web/host';
import { mathReport } from '../engine/mathPath';
import type { MathSettings } from '../settings';
import { MATH_NAME } from './MathView';

const share = (r: { correct: number; total: number }) => (r.total ? `${r.correct} of ${r.total} (${Math.round((100 * r.correct) / r.total)}%)` : '–');

export function MathReport({ events }: { events: LogEvent[] }) {
  const math = useModuleSettings<MathSettings>('math') ?? {};
  const r = mathReport(events, { opened: math.opened, known: math.known, stories: math.stories });
  return <section className="card stack">
    <h2>Math, step by step</h2>
    <div className="table-wrap"><table className="skills-table">
      <thead><tr><th>Step</th><th>Where he is</th><th>Right first time on his own (typed)</th>{math.stories && <th>Of those, in a story</th>}<th>Answers he needed help with</th><th>Reviews passed</th></tr></thead>
      <tbody>{r.rows.map((x) => <tr key={x.skill}>
        <td>{MATH_NAME[x.skill]}</td><td>{x.status}</td><td>{share(x.typed)}</td>{math.stories && <td>{share(x.story)}</td>}<td>{x.helped || '–'}</td><td>{x.reviews.total ? `${x.reviews.passed} of ${x.reviews.total}` : '–'}</td>
      </tr>)}</tbody>
    </table></div>
    <div className="kv">
      <span>Math sessions</span><b>{r.finished} finished of {r.started} started ({r.ofAllSessions ? Math.round((100 * r.started) / r.ofAllSessions) : 0}% of all his sessions)</b>
      <span>Ended for a break</span><b>{r.breaks}</b>
      <span>Ended after fast guesses</span><b>{r.guessStops}</b>
      <span>Guesses set aside</span><b>{r.guesses}</b>
    </div>
    <p className="tagline">A step is mastered at 80% or better on his own typed answers across two days; a missed review sends it back to practice. Choices, help and answers faster than the problem could be read never count toward it. 80% is a starting point to tune, not a proven threshold, and whether a step shows on paper at school has to be checked there.</p>
  </section>;
}
