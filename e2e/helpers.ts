// Helpers every e2e spec shares: the app's own (e2e/) and each module's (modules/*/e2e/).
import { expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** No speech during tests. */
export async function quiet({ page }: { page: Page }) {
  await page.addInitScript(() => { window.speechSynthesis.speak = () => {}; });
}

// WCAG 2.2 AA is the plan's baseline: accessibility regressions fail the build.
export async function axe(page: Page, where: string) {
  await page.waitForTimeout(400); // let colour transitions settle before measuring contrast
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(violations.map((v) => `${where}: ${v.id} (${v.nodes.length}) ${v.nodes.map((n) => n.html.slice(0, 120) + " :: " + (n.failureSummary ?? "").replace(/\s+/g, " ").slice(0, 160)).join(" || ")}`)).toEqual([]);
}

export async function onboard(page: Page) {
  await page.goto('/');
  await page.getByLabel("The learner's nickname").fill('Tester');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: /Rook/ }).click();
  await page.getByRole('button', { name: /it is/ }).click();
  await page.getByRole('button', { name: 'Space', exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Skip, start at step 1' }).click();
  await page.getByRole('button', { name: /Go to my island/ }).click();
  await expect(page.getByRole('button', { name: /Start reading/ })).toBeVisible();
  // LTF-20: a new learner's forks are checked once on the first screen; tests that seed sessions need that saved first.
  await expect.poll(() => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open('wayfinder'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const row = await new Promise<{ value?: { forksSeen?: string[] } } | undefined>((res) => { const g = db.transaction('kv').objectStore('kv').get('settings'); g.onsuccess = () => res(g.result); });
    db.close();
    return row?.value?.forksSeen ?? [];
  })).toContain('gull');
  await setSettings(page, { guessCheck: false });
  await page.reload(); // the app reads settings through Dexie, which does not see a write made straight to IndexedDB
  await expect(page.getByRole('button', { name: /Start reading/ })).toBeVisible();
}

export async function setSettings(page: Page, patch: Record<string, unknown>) {
  await page.evaluate(async (patch) => {
    const db = await new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open('wayfinder'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const st = db.transaction('kv', 'readwrite').objectStore('kv');
    const g = st.get('settings');
    await new Promise((r) => { g.onsuccess = () => { g.result.value = { ...g.result.value, ...patch }; st.put(g.result).onsuccess = r; }; });
    db.close();
  }, patch);
}
