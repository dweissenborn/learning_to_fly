import { describe, expect, it } from 'vitest';
import { DEFAULTS } from './db';
import { forkMigration, journeyNow } from './journey';

describe('forkMigration (LTF-20)', () => {
  it('leaves a learner before the fork to choose there, and checks each fork once', () => {
    const fix = forkMigration(DEFAULTS, 3)!;
    expect(fix).toEqual({ routes: {}, forksSeen: ['gull'] });
    expect(forkMigration({ ...DEFAULTS, ...fix }, 3)).toBeNull();
  });
  it('keeps a learner already on the way to Windy Cape on that route', () => {
    expect(forkMigration(DEFAULTS, 6)).toEqual({ routes: { gull: { to: 'cape', at: 0 } }, forksSeen: ['gull'] });
  });
  it('offers the fork to a learner who has just reached Gull Island, with his interests first', () => {
    expect(forkMigration(DEFAULTS, 5)!.routes).toEqual({});
    const now = journeyNow(5, { ...DEFAULTS, interests: ['space'] });
    expect(now.fork?.options.map((o) => o.id)).toEqual(['star', 'fossil', 'reef']);
    expect(now.next).toBeUndefined();
  });
  it('a chosen route starts at its first beat and gives the airfield the route-neutral text', () => {
    const s = { ...DEFAULTS, routes: { gull: { to: 'rail', at: 1 } }, forksSeen: ['gull'], journeyAnchor: { at: 5, stop: 1, step: 0, after: 0 } };
    expect(journeyNow(5, s).next?.id).toBe('rail');
    const air = journeyNow(11, s);
    expect(air.here.id).toBe('rail');
    expect(air.beat?.text).toMatch(/Captain Ada's boat/);
  });
});
