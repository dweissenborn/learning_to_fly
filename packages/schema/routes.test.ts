import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { routeProblems } from './routes.mjs';

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

  it('passes on the real journey', () => {
    const journey = JSON.parse(readFileSync('content/journey.json', 'utf8'));
    expect(routeProblems(journey.stops)).toEqual([]);
  });
});
