import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { arcProblems, homeProblems, routeProblems } from './routes.mjs';

const stop = (id: string, next?: string[], topics?: string[]) => ({ id, ...(next ? { next } : {}), ...(topics ? { topics } : {}) });

describe('journey routes in the content (LTF-20)', () => {
  it('accepts a fork whose routes rejoin and all reach Australia in the same number of stops', () => {
    expect(routeProblems([stop('home', ['gull']), stop('gull', ['fossil', 'reef']), stop('fossil', ['airfield'], ['dinosaurs']), stop('reef', ['airfield']), stop('airfield', ['australia']), stop('australia')], ['dinosaurs'])).toEqual([]);
  });

  it('finds a dead end, an unreachable stop, a missing stop, a bad topic and an uneven route', () => {
    expect(routeProblems([stop('home', ['gull']), stop('gull'), stop('australia')])).toContain('gull: a route ends here, before australia');
    expect(routeProblems([stop('home', ['australia']), stop('island', ['australia']), stop('australia')])).toContain('island: no route reaches it');
    expect(routeProblems([stop('home', ['nowhere']), stop('australia')])).toContain('home: next stop "nowhere" does not exist');
    expect(routeProblems([stop('home', ['australia'], ['kites']), stop('australia')], ['space'])).toContain('home: unknown topic "kites"');
    expect(routeProblems([stop('home', ['a', 'australia']), stop('a', ['australia']), stop('australia')])[0]).toMatch(/different numbers of stops/);
  });

  it('checks a stop reached by flight paths: one kept for learners already on it, and the same number of beats on each (LTF-25)', () => {
    const beats = (n: number) => Array.from({ length: n }, (_, i) => ({ text: `b${i}` }));
    const au = (paths: object[]) => ({ id: 'australia', beats: beats(5), paths });
    const ok = [{ id: 'island', name: 'I', emoji: 'x', legacy: true }, { id: 'reef', name: 'R', emoji: 'y', beats: beats(5) }];
    expect(routeProblems([stop('home', ['australia']), au(ok)])).toEqual([]);
    expect(routeProblems([stop('home', ['australia']), au([{ ...ok[0], legacy: false }, ok[1]])])).toContain('australia: paths need exactly one kept for learners already on the way (legacy)');
    expect(routeProblems([stop('home', ['australia']), au([ok[0], { ...ok[1], beats: beats(4) }])])).toContain('australia: path "reef" has 4 beats, not 5');
  });

  it('checks the keeper arc is one line of stops, each leading to the next, with five beats (LTF-30)', () => {
    const beats = Array.from({ length: 5 }, (_, i) => ({ text: `b${i}` }));
    const ok = { stops: [{ id: 'a', next: ['b'], beats }, { id: 'b', beats }] };
    expect(arcProblems(ok)).toEqual([]);
    expect(arcProblems({ stops: [{ id: 'a', next: ['c'], beats }, { id: 'b', beats }] })).toContain('arc: a should lead to b');
    expect(arcProblems({ stops: [{ id: 'a', next: ['b'], beats }, { id: 'b', next: ['a'], beats }] })).toContain('arc: b is the last stop and leads nowhere');
    expect(arcProblems({ stops: [{ id: 'a', beats: beats.slice(1) }] })).toContain('arc: a has 4 beats, not 5');
  });

  it('checks the way home: five beats a stop, real places, and the four themed islands to choose from (LTF-27)', () => {
    const beats = Array.from({ length: 5 }, (_, i) => ({ text: `b${i}` }));
    const stops = ['home', 'gull', 'fossil', 'reef', 'star', 'rail', 'airfield'].map((id) => ({ id }));
    const leg = (place: string) => ({ id: `back-${place}`, place, beats });
    const ok = { stops: [leg('airfield'), leg('fossil'), leg('reef'), leg('star'), leg('rail'), leg('gull'), leg('home')] };
    expect(homeProblems(ok, stops)).toEqual([]);
    expect(homeProblems({ stops: [...ok.stops.slice(0, 6), { ...leg('home'), beats: beats.slice(2) }] }, stops)).toContain('home: back-home has 3 beats, not 5');
    expect(homeProblems({ stops: [leg('airfield'), leg('fossil'), leg('gull'), leg('home')] }, stops)).toContain('home: no way-home stop for reef');
    expect(homeProblems({ stops: [...ok.stops, leg('mars')] }, stops)).toContain('home: back-mars visits "mars", which is not a stop');
  });

  it('passes on the real journey', () => {
    const journey = JSON.parse(readFileSync('content/journey.json', 'utf8'));
    expect(routeProblems(journey.stops)).toEqual([]);
    expect(arcProblems(journey.arc)).toEqual([]);
    expect(homeProblems(journey.home, journey.stops)).toEqual([]);
  });
});
