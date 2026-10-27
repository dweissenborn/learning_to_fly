import { describe, expect, it } from 'vitest';
import { shouldSwitch } from './update';

describe('switching to a new version', () => {
  it('waits for a safe moment: the home screen with nothing open, even when the app is in the background', () => {
    expect(shouldSwitch({ waiting: true, safe: true })).toBe(true);
    expect(shouldSwitch({ waiting: true, safe: false })).toBe(false); // mid-session, on screen or in the background: his place would be lost
    expect(shouldSwitch({ waiting: false, safe: true })).toBe(false); // nothing new
  });
});
