import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createLearner, deleteLearner, learners, sync } from '../api/src/store.js';
import { memoryRepo } from '../api/src/memory.js';

// WCAG 2.2 AA is the plan's baseline: accessibility regressions fail the build.
async function axe(page: Page, where: string) {
  await page.waitForTimeout(400); // let colour transitions settle before measuring contrast
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(violations.map((v) => `${where}: ${v.id} (${v.nodes.length}) ${v.nodes.map((n) => n.html.slice(0, 120) + " :: " + (n.failureSummary ?? "").replace(/\s+/g, " ").slice(0, 160)).join(" || ")}`)).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  // Quiet: no speech during tests.
  await page.addInitScript(() => { window.speechSynthesis.speak = () => {}; });
});

async function onboard(page: Page) {
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
}

test('first run, a session item, and stopping without penalty', async ({ page }) => {
  await onboard(page);
  await axe(page, 'home');

  // The journey map: where he is, the next stop, and postcards from places reached.
  await page.getByRole('button', { name: /My journey/ }).click();
  await expect(page.getByText('On the way to Gull Island')).toBeVisible();
  await axe(page, 'journey');
  await page.getByRole('button', { name: /Home Island/ }).last().click();
  await expect(page.getByRole('dialog').getByText('This is Home Island.', { exact: false })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: /Back to island/ }).click();

  await page.getByRole('button', { name: /Start reading/ }).click();
  await expect(page.getByText("Here is today's plan.")).toBeVisible();
  await axe(page, 'plan');
  await page.getByRole('button', { name: /Let's go/ }).click();
  await page.getByRole('button', { name: /Story Woods/ }).click();
  await expect(page.getByText(/Warm up · 1 of/)).toBeVisible();
  await axe(page, 'item');

  // On a phone the bar shows icons only, but every button still has a name.
  await page.setViewportSize({ width: 375, height: 812 });
  await axe(page, 'item on a phone');
  await page.setViewportSize({ width: 1280, height: 800 });

  // Help climbs the hint ladder; nothing marks the learner wrong.
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Help' }).click();
  await expect(page.getByText(/^Here is the answer/)).toBeVisible();

  await page.getByRole('button', { name: 'Stop' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Stop' }).click();
  await expect(page.getByRole('button', { name: /Start reading/ })).toBeVisible();
});

test('today recount and the grown-ups area', async ({ page }) => {
  await onboard(page);
  // Telling about his day: tiles only, then a card of specific questions for the grown-up.
  await page.getByRole('button', { name: /Tell about today/ }).click();
  await page.getByRole('button', { name: 'My day' }).click();
  await page.locator('.tcard').first().click();
  await page.getByRole('button', { name: 'Next' }).click();
  await axe(page, 'today');
  const save = page.getByRole('button', { name: /Save and show/ });
  for (let i = 0; i < 8 && !(await save.isVisible()); i++) await page.locator('.tiles .tile').first().click();
  await save.click();
  await expect(page.getByText('For the grown-up: ask about these')).toBeVisible();
  await page.getByRole('button', { name: /Back to my island/ }).click();

  // Telling about a show: what it was mostly about, the problem, important things, the ending (school's routine).
  await page.getByRole('button', { name: /Tell about today/ }).click();
  await page.getByRole('button', { name: 'A show or video' }).click();
  await page.getByRole('button', { name: 'a movie' }).click();
  await page.getByRole('button', { name: 'an adventure' }).click();
  await page.locator('.tiles .tile').first().click();
  await page.getByRole('button', { name: 'someone made a plan' }).click();
  await page.getByRole('button', { name: 'someone helped' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await axe(page, 'show recount');
  await page.getByRole('button', { name: 'they fixed it' }).click();
  await expect(page.getByText('It was mostly about an adventure.')).toBeVisible();
  await expect(page.getByText('Important things that happened: someone made a plan and someone helped.')).toBeVisible();
  await save.click();
  await expect(page.getByText('Tell me three important things that happened.')).toBeVisible();
  await page.getByRole('button', { name: /Back to my island/ }).click();

  await page.getByRole('button', { name: 'Grown-ups' }).click();
  await expect(page.getByRole('heading', { name: 'Grown-ups' })).toBeVisible();
  await axe(page, 'overview');
  await page.getByRole('button', { name: 'Skills' }).click();
  await axe(page, 'skills');
});

/** A signed-in family member, and the real API logic over an in-memory store in place of Cosmos DB. */
async function familyDevice(page: Page, repo: ReturnType<typeof memoryRepo>) {
  await page.addInitScript(() => { window.speechSynthesis.speak = () => {}; });
  await page.route('**/.auth/me', (r) => r.fulfill({ json: { clientPrincipal: { userDetails: 'grown-up@example.com', userRoles: ['anonymous', 'authenticated', 'family'] } } }));
  await page.route('**/api/**', async (r) => {
    const path = new URL(r.request().url()).pathname, method = r.request().method(), body = r.request().postDataJSON();
    try {
      const out = path === '/api/sync' ? await sync(repo, body)
        : path === '/api/learners' ? (method === 'GET' ? await learners(repo) : await createLearner(repo, body))
        : await deleteLearner(repo, path.split('/').pop());
      await r.fulfill({ json: out });
    } catch (e) { await r.fulfill({ status: (e as { status?: number }).status ?? 500, json: { error: String(e) } }); }
  });
}

test('a device that already has a learner saves it by itself when the cloud copy is empty', async ({ page }) => {
  await onboard(page); // set up before the cloud copy existed: no sign-in on the dev server
  const repo = memoryRepo();
  await familyDevice(page, repo); // then a family member signs in
  await page.reload();
  await expect.poll(async () => (await learners(repo)).map((l) => l.name), { timeout: 15_000 }).toEqual(['Tester']);
  const [saved] = await learners(repo);
  await expect.poll(async () => (await sync(repo, { learner: saved.id, since: 0 })).events.some((e: { type: string }) => e.type === 'placement'), { timeout: 15_000 }).toBe(true);
  await expect(page.getByRole('button', { name: /Start reading/ })).toBeVisible(); // he never sees any of this
});

test('the family cloud copy: a second device carries on as the same learner', async ({ browser }) => {
  const repo = memoryRepo();
  const first = await (await browser.newContext()).newPage();
  await familyDevice(first, repo);
  await onboard(first); // nobody saved yet, so setup starts straight away and saves the new learner
  const [saved] = await learners(repo);
  expect(saved.name).toBe('Tester');
  await expect.poll(async () => (await sync(repo, { learner: saved.id, since: 0 })).settings?.onboarded, { timeout: 15_000 }).toBe(true);
  await expect.poll(async () => (await sync(repo, { learner: saved.id, since: 0 })).events.some((e: { type: string }) => e.type === 'placement'), { timeout: 15_000 }).toBe(true);

  const second = await (await browser.newContext()).newPage();
  await familyDevice(second, repo);
  await second.goto('/');
  await expect(second.getByRole('heading', { name: 'Who is learning on this device?' })).toBeVisible();
  await axe(second, 'who is learning');
  await second.getByRole('button', { name: 'Tester' }).click();
  await expect(second.getByRole('button', { name: /Start reading/ })).toBeVisible(); // straight home: no setup, no scouting again

  await second.getByRole('button', { name: 'Grown-ups' }).click();
  await second.getByRole('button', { name: 'Data and report' }).click();
  await expect(second.getByText("Tester's progress is saved on this device and in your family's cloud copy.", { exact: false })).toBeVisible();
  await expect(second.getByRole('link', { name: 'Why it works' })).toHaveAttribute('href', /docs\/why-it-works\.md$/);
  await axe(second, 'cloud card');
});

/** Answers the question on screen by trying each answer, or each line of the text, until one is right. */
async function answer(page: Page) {
  const next = page.getByRole('button', { name: /^Next/ });
  for (const opts of [page.getByRole('group', { name: /^(Answers|Scene)$/ }).getByRole('button'), page.locator('main [role=button]:is(.sentence, .vrow, .word)')])
    for (let k = 0; k < (await opts.count()) && !(await next.isVisible()); k++) if (await opts.nth(k).isEnabled()) await opts.nth(k).click();
  await next.click();
}

test('flight gear: points in a session, a celebration, the kit, and the activity the grown-ups see', async ({ page }) => {
  await onboard(page);
  // Two points already, from one scouting answer. Every answer earns two, right or not.
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open('wayfinder'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const tx = db.transaction('events', 'readwrite');
    const base = { type: 'answer', session: 'placement', skill: 'N1', phase: 'placement', hint: 0, tries: 1, ms: 1000, format: 'tap' };
    tx.objectStore('events').put({ ...base, id: 'seed-1', ts: Date.now() - 9000, item: 'pl-r1', correct: true });
    await new Promise((r) => { tx.oncomplete = r; });
    db.close();
  });
  await page.reload();
  await expect(page.getByRole('button', { name: /Flight kit · 0 of 12/ })).toBeVisible();

  await page.getByRole('button', { name: /Start reading/ }).click();
  await page.getByRole('button', { name: /Let's go/ }).click();
  await page.getByRole('button', { name: /Harbor Town/ }).click();
  await expect(page.getByRole('progressbar', { name: 'Flight kit: 2 more points to the flight cap' })).toBeVisible();
  await answer(page); // any answer earns two points, so the cap arrives
  await expect(page.getByRole('dialog', { name: 'New flight gear: Flight cap' })).toBeVisible();
  await axe(page, 'gear celebration');
  await page.getByRole('button', { name: /Keep going/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'Stop' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Stop' }).click();
  await page.getByRole('button', { name: /Flight kit · 1 of 12/ }).click();
  await expect(page.getByText('Every answer is two points, right or not.', { exact: false })).toBeVisible();
  await axe(page, 'flight kit');
  await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();

  await page.getByRole('button', { name: 'Grown-ups' }).click();
  await page.getByRole('button', { name: 'Activity' }).click();
  await expect(page.getByRole('heading', { name: 'What his sessions tell us' })).toBeVisible();
  await expect(page.getByText(/Stopped at the (warm-up|demo)/)).toBeVisible();
  // Fresh content: the question he answered is no longer new, and nothing he answered was a repeat.
  const fresh = page.locator('section', { has: page.getByRole('heading', { name: 'Fresh content' }) }).getByRole('row', { name: /^F1 Signs and symbols/ });
  await expect(fresh).toContainText(/\d+ of \d+/);
  await expect(page.getByRole('heading', { name: 'Fresh content' })).toBeVisible();
  await expect(fresh.getByRole('cell').nth(5)).toHaveText('0 of 1');
  await axe(page, 'activity');
});

test('a gentle nudge when he goes quiet, and a bonus for getting past his usual stopping point', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-14T16:00:00') }); // a fixed time, so the same warm-ups come up every run
  await onboard(page);
  // Two earlier sessions that both ended in the warm-up.
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open('wayfinder'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const tx = db.transaction('events', 'readwrite');
    const put = (e: object) => tx.objectStore('events').put(e);
    for (const [k, t] of [[1, Date.now() - 7_200_000], [2, Date.now() - 3_600_000]] as const) {
      put({ id: `s${k}a`, ts: t, type: 'session', session: `old${k}`, action: 'start', strand: 'functional', skill: 'F1' });
      put({ id: `s${k}b`, ts: t + 1, type: 'activity', session: `old${k}`, kind: 'step', step: 'warmup' });
      put({ id: `s${k}c`, ts: t + 60_000, type: 'session', session: `old${k}`, action: 'stop' });
    }
    await new Promise((r) => { tx.oncomplete = r; });
    db.close();
  });
  await page.reload();
  await page.getByRole('button', { name: /Start reading/ }).click();
  await page.getByRole('button', { name: /Let's go/ }).click();
  await page.getByRole('button', { name: /Harbor Town/ }).click();
  await expect(page.getByText(/Warm up · 1 of/)).toBeVisible();

  await page.clock.fastForward(46_000);
  await expect(page.getByText('Still with me?', { exact: false })).toBeVisible();
  await axe(page, 'idle nudge');

  for (let i = 0; i < 4 && (await page.getByText(/Warm up · \d of/).isVisible()); i++) await answer(page);
  await expect(page.getByText('You kept going past Warm up. +3 flight points!')).toBeVisible();
});
