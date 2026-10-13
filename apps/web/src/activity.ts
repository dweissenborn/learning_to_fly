// Moment-to-moment logging for a session: which step he is on, idle spells, and leaving the app.
// It records timing only, never anything he typed. The grown-ups' Activity tab reads it back through the engine.
import { useEffect, useRef, useState } from 'react';
import { IDLE_MS, type StepName } from '@wayfinder/engine';
import { log } from './db';

const speaking = () => typeof window !== 'undefined' && !!window.speechSynthesis?.speaking;

/** Logs step changes, idle spells and absences once the session has started. Returns whether he is idle right now. */
export function useActivity(session: string, step: StepName, item: string | undefined, on: boolean) {
  const [idle, setIdle] = useState(false);
  const where = useRef({ step, item });
  where.current = { step, item };

  useEffect(() => {
    if (on) void log({ type: 'activity', session, kind: 'step', step });
  }, [on, session, step]);

  useEffect(() => {
    if (!on) return;
    let last = Date.now(), idleAt = 0, awayAt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => { clearTimeout(timer); timer = setTimeout(fire, IDLE_MS); };
    const fire = () => {
      if (speaking() || document.hidden) return arm(); // listening to read-aloud is not idle
      idleAt = Date.now();
      void log({ type: 'activity', session, kind: 'idle', step: where.current.step, ...(where.current.item ? { item: where.current.item } : {}), ms: idleAt - last });
      setIdle(true);
    };
    const active = () => {
      if (idleAt) { void log({ type: 'activity', session, kind: 'back', from: 'idle', ms: Date.now() - last }); idleAt = 0; setIdle(false); }
      last = Date.now();
      arm();
    };
    const visibility = () => {
      if (document.hidden) {
        awayAt = Date.now();
        clearTimeout(timer);
        void log({ type: 'activity', session, kind: 'away', step: where.current.step });
      } else if (awayAt) {
        void log({ type: 'activity', session, kind: 'back', from: 'away', ms: Date.now() - awayAt });
        awayAt = 0;
        active();
      }
    };
    const opts = { passive: true, capture: true } as const;
    for (const t of ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const) window.addEventListener(t, active, opts);
    document.addEventListener('visibilitychange', visibility);
    arm();
    return () => {
      clearTimeout(timer);
      for (const t of ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const) window.removeEventListener(t, active, opts);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [on, session]);

  return idle;
}
