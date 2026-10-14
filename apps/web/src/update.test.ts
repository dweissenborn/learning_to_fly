import { describe, expect, it } from 'vitest';
import { shouldSwitch } from './update';

describe('switching to a new version', () => {
  it('waits for a safe moment: the home screen with nothing open, or the app in the background', () => {
    expect(shouldSwitch({ waiting: true, hidden: false, safe: true })).toBe(true);
    expect(shouldSwitch({ waiting: true, hidden: true, safe: false })).toBe(true);
    expect(shouldSwitch({ waiting: true, hidden: false, safe: false })).toBe(false); // mid-session, on screen
    expect(shouldSwitch({ waiting: false, hidden: true, safe: true })).toBe(false); // nothing new
  });
});
