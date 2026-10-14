// LTF-39: modules as add-ons. Reading is a module like any other, and the day's sessions are counted across all of them.
import { describe, expect, it } from 'vitest';
import type { LogEvent } from '@wayfinder/schema';
import { moduleOf, sessionsToday } from './index';

describe('modules (LTF-39)', () => {
  it("a skill's module is its prefix; today's reading skills have none, so nothing stored needs migrating", () => {
    expect(moduleOf('math:FR3')).toBe('math');
    expect(moduleOf('N5')).toBe('reading');
  });
  it("counts today's finished sessions across every module, and only today's", () => {
    const now = new Date('2026-10-14T18:00:00').getTime();
    const fin = (id: string, ts: number, module?: string) => ({ id, ts, type: 'session', session: id, action: 'finish', ...(module ? { module } : {}) }) as unknown as LogEvent;
    const es = [fin('a', now - 3_600_000), fin('b', now - 1_800_000, 'math'), fin('c', now - 86_400_000),
      { id: 'd', ts: now - 60_000, type: 'session', session: 'd', action: 'start' } as unknown as LogEvent];
    expect(sessionsToday(es, now)).toBe(2);
  });
});
