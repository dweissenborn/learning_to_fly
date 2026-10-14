// New versions of the app. Look for one every 30 minutes and whenever the app comes back to the front, and switch to it only
// at a safe moment: on his island's home screen with nothing open, or while the app is in the background. Never in the
// middle of a session, where a reload would be an unexpected change (his answers are saved, but not his place).
let waiting = false;
let safeNow = () => false;
let apply: (reload?: boolean) => Promise<void> = async () => {};

/** Whether to switch to a waiting new version now. */
export const shouldSwitch = (o: { waiting: boolean; hidden: boolean; safe: boolean }) => o.waiting && (o.hidden || o.safe);

/** Switches to a waiting new version if now is a safe moment. Call it when a safe moment begins. */
export function maybeSwitch() {
  if (shouldSwitch({ waiting, hidden: document.hidden, safe: safeNow() })) void apply(true);
}

export async function startUpdates(isSafe: () => boolean) {
  safeNow = isSafe;
  if (!('serviceWorker' in navigator)) return;
  const { registerSW } = await import('virtual:pwa-register');
  apply = registerSW({
    onNeedRefresh() { waiting = true; maybeSwitch(); },
    onRegisteredSW(_url, r) {
      if (!r) return;
      // On the live site the new version needs the family sign-in; while it has expired a check fails quietly, and the
      // new version arrives after the next sign-in.
      const check = () => r.update().catch(() => {});
      setInterval(check, 30 * 60_000);
      document.addEventListener('visibilitychange', () => { if (document.hidden) maybeSwitch(); else void check(); });
    },
  });
}
