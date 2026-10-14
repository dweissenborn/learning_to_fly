import { describe, expect, it } from 'vitest';
import { pickVoice } from './media';

const v = (name: string, o: { lang?: string; local?: boolean; def?: boolean } = {}) => ({ name, lang: o.lang ?? 'en-US', localService: o.local ?? false, default: !!o.def });
// What Edge on Windows lists: the old desktop voices on the device, and Microsoft's natural voices online.
const EDGE = [
  v('Microsoft David - English (United States)', { local: true, def: true }),
  v('Microsoft Zira - English (United States)', { local: true }),
  v('Microsoft Libby Online (Natural) - English (United Kingdom)', { lang: 'en-GB' }),
  v('Microsoft Aria Online (Natural) - English (United States)'),
  v('Microsoft Ava Online (Natural) - English (United States)'),
];

describe('pickVoice', () => {
  it('picks a natural US voice over the default desktop voice', () => {
    expect(pickVoice(EDGE, '', true)?.name).toBe('Microsoft Ava Online (Natural) - English (United States)');
    expect(pickVoice(EDGE.slice(0, 4), '', true)?.name).toMatch(/Aria/); // any natural voice beats the desktop default
  });
  it('keeps the voice a grown-up chose', () => {
    expect(pickVoice(EDGE, 'Microsoft Zira - English (United States)', true)?.name).toMatch(/Zira/);
  });
  it('offline, uses a voice on the device, even if an online one was chosen', () => {
    expect(pickVoice(EDGE, 'Microsoft Aria Online (Natural) - English (United States)', false)?.name).toMatch(/David/);
  });
  it("prefers an iPad's Enhanced voice to its compact one", () => {
    expect(pickVoice([v('Samantha', { local: true, def: true }), v('Samantha (Enhanced)', { local: true })], '', false)?.name).toBe('Samantha (Enhanced)');
  });
});
