import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createLearner, deleteLearner, learners, sync } from '../api/src/store.js';
import { memoryRepo } from '../api/src/memory.js';
import { readdirSync, readFileSync } from 'node:fs';

// Every bank item, so a test can tap the right choice on purpose (LTF-38: points and the success look depend on it).
const ITEMS: { prompt: string; format: string; options?: string[]; objects?: { label: string }[]; answer?: unknown }[] = readdirSync('content/bank').filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(`content/bank/${f}`, 'utf8')).items);
const exactStart = (s: string) => new RegExp('^' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(,|$)');

/** The question on screen (three choices or a scene with one answer): the button for its answer, and for each wrong choice. */
async function choicesHere(page: Page) {
  const prompt = (await page.locator('.prompt > span').last().textContent()) ?? '';
  const it = ITEMS.find((i) => i.prompt === prompt && (i.format === 'tap' || (i.format === 'scene' && typeof i.answer === 'number')));
  if (!it) throw new Error(`no three-choice or one-answer scene item with the prompt: ${prompt}`);
  const group = page.getByRole('group', { name: /^(Answers|Scene)$/ });
  const labels = it.format === 'tap' ? it.options! : it.objects!.map((o) => o.label);
  const button = (l: string) => (it.format === 'tap' ? group.getByRole('button', { name: l, exact: true }) : group.getByRole('button', { name: exactStart(l) }));
  return { right: button(labels[it.answer as number]), wrong: labels.filter((_, k) => k !== it.answer).map(button) };
}

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

async function setSettings(page: Page, patch: Record<string, unknown>) {
  await page.evaluate(async (patch) => {
    const db = await new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open('wayfinder'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const st = db.transaction('kv', 'readwrite').objectStore('kv');
    const g = st.get('settings');
    await new Promise((r) => { g.onsuccess = () => { g.result.value = { ...g.result.value, ...patch }; st.put(g.result).onsuccess = r; }; });
    db.close();
  }, patch);
}

/** Taps the right answer on the first try, found by the question's prompt in the bank. */
async function answerRight(page: Page) {
  await (await choicesHere(page)).right.click();
}

async function seedFinished(page: Page, n: number) {
  await page.evaluate(async (n) => {
    const db = await new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open('wayfinder'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const tx = db.transaction('events', 'readwrite');
    const t0 = Date.now() - 20 * 86_400_000;
    for (let k = 0; k < n; k++) {
      tx.objectStore('events').put({ id: `seed-s${k}`, ts: t0 + k * 86_400_000, type: 'session', session: `seed-${k}`, action: 'start', strand: 'functional', skill: 'F1' });
      tx.objectStore('events').put({ id: `seed-f${k}`, ts: t0 + k * 86_400_000 + 60_000, type: 'session', session: `seed-${k}`, action: 'finish' });
    }
    await new Promise((r) => { tx.oncomplete = r; });
    db.close();
  }, n);
  await page.reload();
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

  // On a phone the bar shows icons only, but every button still has a name, and nothing scrolls sideways.
  const sideways = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 812 });
    await expect.poll(sideways, { message: `sideways scroll at ${width}px` }).toBeLessThanOrEqual(1);
  }
  await axe(page, 'item on a phone');
  await page.setViewportSize({ width: 1280, height: 800 });

  // Help climbs the hint ladder; nothing marks the learner wrong.
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Help' }).click();
  await expect(page.getByText(/^Here is the answer/)).toBeVisible();
  // Once answered, Next stays fully on screen, even on the narrowest phone. (Story maps and the like need Check first.)
  const check = page.getByRole('button', { name: /^Check/ });
  if (await check.isVisible()) await check.click();
  await answer(page, { press: false });
  await expect(page.getByRole('button', { name: /^Next( →)?$/ })).toBeVisible();
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 640 });
    await expect.poll(sideways, { message: `sideways scroll with Next showing at ${width}px` }).toBeLessThanOrEqual(1);
    const box = await page.getByRole('button', { name: /^Next( →)?$/ }).boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 1280, height: 800 });

  // "I need a break" is honoured at once: no "Keep going" question, straight to the lounge (LTF-38).
  await page.getByRole('button', { name: 'I need a break' }).click();
  await expect(page.getByText('Good idea to take a break. Everything you did is saved.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Back to my island' }).click();
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
  await expect(second.getByRole('link', { name: 'The research behind Learning to Fly' })).toHaveAttribute('href', 'https://dweissenborn.github.io/learning_to_fly/');
  await axe(second, 'cloud card');
});

/** Answers the question on screen by trying each answer, or each line of the text, until one is right. */
async function answer(page: Page, o: { press?: boolean } = {}) {
  const next = page.getByRole('button', { name: /^Next( →)?$/ });
  for (const opts of [page.getByRole('group', { name: /^(Answers|Scene)$/ }).getByRole('button'), page.locator('main [role=button]:is(.sentence, .vrow, .word)')])
    for (let k = 0; k < (await opts.count()) && !(await next.isVisible()); k++) if (await opts.nth(k).isEnabled()) await opts.nth(k).click();
  // Sort, order and story-map questions: Help until the answer is filled in, then Check.
  const help = page.getByRole('button', { name: 'Help' });
  for (let k = 0; k < 3 && !(await next.isVisible()) && (await help.count()) && (await help.isEnabled()); k++) await help.click();
  const check = page.getByRole('button', { name: 'Check', exact: true });
  if (!(await next.isVisible()) && (await check.isVisible())) await check.click();
  if (o.press !== false) await next.click();
}

test('flight gear: points in a session, a celebration, the kit, and the activity the grown-ups see', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-14T16:00:00') }); // the same warm-ups every run
  await onboard(page);
  // Two points already, from one scouting answer given before LTF-38 (they earned two each).
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
  await answerRight(page); // right on the first tap: four points, so the cap arrives
  await expect(page.locator('.feedback.good')).toBeVisible(); // and it looks like a success
  await page.getByRole('button', { name: /^Next( →)?$/ }).click();
  await expect(page.getByRole('dialog', { name: 'New flight gear: Flight cap' })).toBeVisible();
  await axe(page, 'gear celebration');
  await page.getByRole('button', { name: /Keep going/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'I need a break' }).click();
  await page.getByRole('button', { name: 'Back to my island' }).click();
  await page.getByRole('button', { name: /Flight kit · 1 of 12/ }).click();
  await expect(page.getByText('Right the first time: four points.', { exact: false })).toBeVisible();
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

test('a gentle nudge when he goes quiet, and no bonus for pushing past his usual stopping point (LTF-38)', async ({ page }) => {
  await page.addLocatorHandler(page.getByRole('dialog', { name: /New flight gear/ }), async (d) => {
    await d.getByRole('button', { name: /Keep going/ }).click({ timeout: 5000 }).catch(() => {});
  });
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
  await expect(page.getByText(/Warm up · \d of/)).toHaveCount(0);
  await expect(page.getByText(/You kept going past/)).toHaveCount(0);
});

test('the clue shows at once on the first guided question of a new skill, then waits as usual (LTF-01)', async ({ page }) => {
  await page.addLocatorHandler(page.getByRole('dialog', { name: /New flight gear/ }), async (d) => {
    await d.getByRole('button', { name: /Keep going/ }).click({ timeout: 5000 }).catch(() => {});
  });
  await page.clock.install({ time: new Date('2026-10-14T16:00:00') });
  await onboard(page);
  await page.getByRole('button', { name: /Start reading/ }).click();
  await page.getByRole('button', { name: /Let's go/ }).click();
  await page.getByRole('button', { name: /Harbor Town/ }).click();
  for (let i = 0; i < 4 && (await page.getByText(/Warm up · \d of/).isVisible()); i++) await answer(page);
  await page.getByRole('button', { name: /Keep going/ }).click({ timeout: 2000 }).catch(() => {}); // the first flight gear, if it arrived
  await page.getByRole('button', { name: 'Got it, skip' }).click();
  await expect(page.getByText(/Together · 1 of/)).toBeVisible();
  await expect(page.locator('.feedback.hint')).toBeVisible(); // no wait on a new skill's first guided item
  await answer(page);
  await expect(page.getByText(/Together · 2 of/)).toBeVisible();
  await expect(page.locator('.feedback.hint')).toHaveCount(0);
  await page.clock.fastForward(8_100);
  await expect(page.locator('.feedback.hint')).toBeVisible(); // the usual wait from the second item on
});

test('telling about something hard asks what happened after, and the grown-up gets it (LTF-05)', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: /Tell about today/ }).click();
  await page.getByRole('button', { name: 'My day' }).click();
  await page.locator('.tcard').first().click();
  await page.getByRole('button', { name: 'Next' }).click();
  for (let i = 0; i < 3; i++) await page.locator('.tiles .tile').first().click(); // who, what, how he felt
  await page.getByRole('button', { name: 'I got stuck' }).click();
  await expect(page.locator('.bubble', { hasText: 'What happened after that?' })).toBeVisible();
  await axe(page, 'what happened after');
  await page.getByRole('button', { name: 'I asked for help' }).click();
  await expect(page.getByText('After that, I asked for help.')).toBeVisible();
  await page.getByRole('button', { name: /Save and show/ }).click();
  await expect(page.getByText('You said: I got stuck. After that, I asked for help. How did that go?')).toBeVisible();
  // LTF-08: the grown-ups see how his telling is growing.
  await page.getByRole('button', { name: /Back to my island/ }).click();
  await page.getByRole('button', { name: 'Grown-ups' }).click();
  await page.getByRole('button', { name: 'Today recounts' }).click();
  const card = page.locator('section', { has: page.getByRole('heading', { name: 'How his telling is growing' }) });
  await expect(card.getByRole('row').nth(1)).toContainText('Yes');
  await axe(page, 'telling card');
});

test('"What do you think?" asks once per new thing, on any device (LTF-18)', async ({ browser }) => {
  const repo = memoryRepo();
  const first = await (await browser.newContext()).newPage();
  await familyDevice(first, repo);
  await onboard(first);
  // He tells about a show, so he has met that new thing.
  await first.getByRole('button', { name: /Tell about today/ }).click();
  await first.getByRole('button', { name: 'A show or video' }).click();
  await first.getByRole('button', { name: 'a movie' }).click();
  await first.getByRole('button', { name: 'an adventure' }).click();
  await first.locator('.tiles .tile').first().click();
  await first.getByRole('button', { name: 'someone helped' }).click();
  await first.getByRole('button', { name: 'Next' }).click();
  await first.getByRole('button', { name: 'they fixed it' }).click();
  await first.getByRole('button', { name: /Save and show/ }).click();
  await first.getByRole('button', { name: /Back to my island/ }).click();

  const card = first.getByRole('region', { name: 'What do you think?' });
  await expect(card).toContainText('Telling about a show');
  await axe(first, 'what do you think');
  await card.getByRole('button', { name: /I like it/ }).click();
  await card.getByRole('button', { name: /Just right/ }).click();
  await expect(card).toContainText('Thank you');
  await first.reload();
  await expect(first.getByRole('button', { name: /Start reading/ })).toBeVisible();
  await expect(first.getByRole('region', { name: 'What do you think?' })).toHaveCount(0); // asked once
  const [saved] = await learners(repo);
  await expect.poll(async () => (await sync(repo, { learner: saved.id, since: 0 })).events.some((e: { kind?: string }) => e.kind === 'opinion'), { timeout: 15_000 }).toBe(true);

  // Another device for the same learner is not asked again.
  const second = await (await browser.newContext()).newPage();
  await familyDevice(second, repo);
  await second.goto('/');
  await second.getByRole('button', { name: 'Tester' }).click();
  // The grown-ups see his vote next to the feature, which also shows this device has his events.
  await second.getByRole('button', { name: 'Grown-ups' }).click();
  const votes = second.locator('section', { has: second.getByRole('heading', { name: 'What he thinks of new things' }) });
  await expect(votes).toContainText('Telling about a show');
  await expect(votes).toContainText('I like it · Just right'); // his only vote
  await axe(second, 'votes');
  await second.getByRole('button', { name: 'Back to the island' }).click();
  await expect(second.getByRole('button', { name: /Start reading/ })).toBeVisible();
  await expect(second.getByRole('region', { name: 'What do you think?' })).toHaveCount(0);
});

test('his day as a four-panel strip: a skipped panel shows quietly, and tapping a panel changes it (LTF-06)', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: /Tell about today/ }).click();
  await page.getByRole('button', { name: 'My day' }).click();
  await page.locator('.tcard').first().click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Skip this one' }).click(); // who
  await page.locator('.tiles .tile').first().click(); // what
  await page.getByRole('button', { name: 'calm' }).click();
  await page.getByRole('button', { name: 'I got stuck' }).click();
  await page.getByRole('button', { name: 'I asked for help' }).click();

  const strip = page.getByRole('list', { name: /in four parts/ });
  await expect(strip.getByRole('listitem')).toHaveCount(4);
  await expect(strip.getByRole('listitem').nth(0)).toContainText('skipped');
  await expect(strip.getByRole('listitem').nth(2)).toContainText('After that, I asked for help.');
  await axe(page, 'four-panel strip');

  await strip.getByRole('button', { name: /How I felt/ }).click();
  await expect(page.locator('.bubble', { hasText: 'How did you feel?' })).toBeVisible();
  await page.getByRole('button', { name: 'proud' }).click();
  await expect(strip.getByRole('listitem').nth(3)).toContainText('I felt proud.'); // straight back to the strip
  await page.getByRole('button', { name: /Save and show/ }).click();
  await expect(page.getByText('I felt proud.')).toBeVisible();
  await expect(page.getByText('I felt calm.')).toHaveCount(0);
});

test('from stage 3 the tiles wait behind "Show me ideas", and the grown-ups see answers given without them (LTF-07)', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'Grown-ups' }).click();
  await page.getByRole('button', { name: 'Today recounts' }).click();
  await page.getByRole('button', { name: /^Three parts/ }).click();
  await page.getByRole('button', { name: 'Back to the island' }).click();

  await page.getByRole('button', { name: /Tell about today/ }).click();
  await page.getByRole('button', { name: 'My day' }).click();
  await page.locator('.tcard').first().click();
  await page.getByRole('button', { name: 'Next' }).click();
  // Who: a sentence starter, his own words, and no tiles until he asks.
  await expect(page.locator('.tiles .tile')).toHaveCount(0);
  await axe(page, 'sentence starter');
  await page.getByLabel('I was with').fill('my cousin');
  await page.getByRole('button', { name: 'Next' }).click();
  // What: he asks for ideas this time.
  await page.getByRole('button', { name: 'Show me ideas' }).click();
  await page.locator('.tiles .tile').first().click();
  await page.getByRole('button', { name: 'Skip this one' }).click(); // what happened after
  await page.getByLabel('I felt').fill('happy');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Skip this one' }).click(); // why
  await page.getByRole('button', { name: 'Show me ideas' }).click();
  await page.getByRole('button', { name: 'nothing was hard' }).click();

  const strip = page.getByRole('list', { name: /in four parts/ });
  await expect(strip.getByRole('listitem').nth(0)).toContainText('I was with my cousin.');
  await expect(strip.getByRole('listitem').nth(3)).toContainText('I felt happy.');
  await page.getByRole('button', { name: /Save and show/ }).click();
  await page.getByRole('button', { name: /Back to my island/ }).click();
  await page.getByRole('button', { name: 'Grown-ups' }).click();
  await page.getByRole('button', { name: 'Today recounts' }).click();
  await expect(page.getByText('2 of 4 questions this week')).toBeVisible();
  await axe(page, 'ideas card');
});

test('a printable paper story map for the grown-up (LTF-15)', async ({ page }) => {
  await page.goto('/story-map.html');
  await expect(page.getByRole('heading', { name: 'Story map' })).toBeVisible();
  await expect(page.getByText('What was it mostly about?')).toBeVisible();
  await axe(page, 'paper story map');
});

test('a whole story session to the finish, with the paper story map for the grown-up (LTF-15)', async ({ page }) => {
  test.setTimeout(120_000);
  await onboard(page);
  await page.getByRole('button', { name: /Start reading/ }).click();
  await page.getByRole('button', { name: /Let's go/ }).click();
  await page.getByRole('button', { name: /Story Woods/ }).click();
  // Each question: the full hint, then the answer (or Check), then Next. Demos are skipped, and gear celebrations,
  // which can open after any answer, are closed before the next action.
  await page.addLocatorHandler(page.getByRole('dialog', { name: /New flight gear/ }), async (d) => {
    await d.getByRole('button', { name: /Keep going/ }).click({ timeout: 5000 }).catch(() => {}); // it may close by itself
  });
  const pick = page.getByRole('heading', { name: 'Pick one new thing for your island' });
  for (let i = 0; i < 30 && !(await pick.isVisible()); i++) {
    const skip = page.getByRole('button', { name: 'Got it, skip' });
    if (await skip.isVisible()) { await skip.click(); continue; }
    const help = page.getByRole('button', { name: 'Help' });
    for (let h = 0; h < 3; h++) if (await help.isVisible() && await help.isEnabled()) await help.click();
    const check = page.getByRole('button', { name: /^Check/ });
    if (await check.isVisible() && await check.isEnabled()) await check.click();
    const next = page.getByRole('button', { name: /^Next( →)?$/ });
    for (const opts of [page.getByRole('group', { name: /^(Answers|Scene)$/ }).getByRole('button'), page.locator('main [role=button]:is(.sentence, .vrow, .word)')])
      for (let k = 0; k < (await opts.count()) && !(await next.isVisible()); k++) if (await opts.nth(k).isEnabled()) await opts.nth(k).click();
    if (await next.isVisible()) await next.click();
  }
  await page.locator('.piece').first().click();
  await page.getByRole('button', { name: 'Choose a spot for me' }).click();
  await expect(page.getByText('All done for today.')).toBeVisible();
  await expect(page.getByRole('link', { name: /Print a paper story map/ })).toHaveAttribute('href', '/story-map.html');
  await axe(page, 'finish');
});

test('the second hint on a feelings question is a three-box card, and "So" stays his to work out (LTF-02)', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'Grown-ups' }).click();
  await page.getByRole('button', { name: 'Content library' }).click();
  await page.getByLabel('Skill').selectOption('N5');
  await page.locator('summary', { hasText: 'The Last Stamp' }).click();
  const entry = page.locator('.lib-item', { hasText: 'n5-i174' }).last();
  await entry.getByRole('button', { name: 'Try it' }).click();
  const dialog = page.getByRole('dialog', { name: 'Try an item' });
  const card = dialog.getByRole('region', { name: 'Thinking it through' });
  await dialog.getByRole('button', { name: /Show a hint/ }).click();
  await expect(card).toHaveCount(0); // the first hint only lights up the text
  await dialog.getByRole('button', { name: /Show a hint/ }).click();
  await expect(card).toContainText('He put it back in his bag slowly.');
  await expect(card).toContainText('People move slowly and go quiet when a hope does not happen.');
  await expect(card).toContainText('What does that tell you?');
  await expect(card).not.toContainText('So Sam felt disappointed.');
  await axe(page, 'reasoning card');
  await dialog.getByRole('button', { name: /Show a hint/ }).click();
  await expect(card).toContainText('So Sam felt disappointed.'); // with the answer
});

test('scouting has a "Who did it?" stop, and Starting point can run it on its own (LTF-13)', async ({ page }) => {
  // Scouting answers earn flight points too, so a gear celebration can open on the island.
  await page.addLocatorHandler(page.getByRole('dialog', { name: /New flight gear/ }), async (d) => {
    await d.getByRole('button', { name: /Keep going/ }).click({ timeout: 5000 }).catch(() => {});
  });
  await page.goto('/');
  await page.getByLabel("The learner's nickname").fill('Tester');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: /Rook/ }).click();
  await page.getByRole('button', { name: /it is/ }).click();
  await page.getByRole('button', { name: 'Space', exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: /Start scouting/ }).click();
  // Words, the reading story and the listening story: any answer will do here.
  const grammar = page.getByRole('heading', { name: 'Who did it?' });
  for (let i = 0; i < 40 && !(await grammar.isVisible()); i++) {
    const opt = page.locator('main .tcard, main .opt').first();
    if (await opt.isVisible()) await opt.click();
    const next = page.getByRole('button', { name: /^Next( →)?$/ });
    if (await next.isVisible()) await next.click();
  }
  await expect(grammar).toBeVisible();
  await axe(page, 'who did it');
  const firstRun = await page.locator('main .card.center').innerText();
  for (let i = 0; i < 6; i++) await page.locator('main .tcard').first().click(); // six one-sentence items
  await expect(page.getByRole('heading', { name: 'Halfway there.' })).toBeVisible();
  await page.getByRole('button', { name: 'Finish later' }).click();
  await page.getByRole('button', { name: /Go to my island/ }).click();

  await page.getByRole('button', { name: 'Grown-ups' }).click();
  await expect(page.getByText('Sentence grammar')).toBeVisible();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Run the "Who did it?" stop' }).click();
  await expect(grammar).toBeVisible();
  expect(await page.locator('main .card.center').innerText()).not.toBe(firstRun); // a second run uses sentences he has not seen
  for (let i = 0; i < 6; i++) await page.locator('main .tcard').nth(1).click();
  await page.getByRole('button', { name: /Go to my island/ }).click();
  await page.getByRole('button', { name: 'Grown-ups' }).click();
  await expect(page.getByText('Sentence grammar')).toBeVisible();
});

test('word help: tap an underlined word for a plain meaning, and a tapped word comes back as a word for today (LTF-04)', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'Grown-ups' }).click();
  await page.getByRole('button', { name: 'Content library' }).click();
  await page.getByLabel('Skill').selectOption('N1');
  await page.locator('summary', { hasText: 'Tide Pool Morning' }).click();
  await page.locator('.lib-item', { hasText: 'n1-i37' }).last().getByRole('button', { name: 'Try it' }).click();
  const dialog = page.getByRole('dialog', { name: 'Try an item' });
  await dialog.locator('.word.gloss', { hasText: /^tide/i }).first().click();
  await expect(dialog.locator('.gloss-card')).toContainText('the rise and fall of the sea each day');
  await axe(page, 'word help');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Back to the island' }).click();

  // The word he tapped comes back at the start of a later warm-up.
  await page.getByRole('button', { name: /Start reading/ }).click();
  await page.getByRole('button', { name: /Let's go/ }).click();
  await page.getByRole('button', { name: /Story Woods/ }).click();
  await expect(page.locator('.bubble', { hasText: 'A word for today: tide' })).toBeVisible();
  await axe(page, 'word for today');
  await page.getByRole('group', { name: 'Meanings' }).getByRole('button', { name: 'the rise and fall of the sea each day' }).click();
  await expect(page.getByText(/tide means the rise and fall/i)).toBeVisible();
  await page.getByRole('button', { name: /^Next( →)?$/ }).click();
  await expect(page.getByText(/Warm up · 1 of/)).toBeVisible();
});

test('the metaphor map: it is like, what they share, so it means (LTF-11)', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'Grown-ups' }).click();
  await page.getByRole('button', { name: 'Content library' }).click();
  await page.getByLabel('Skill').selectOption('N6');
  await page.locator('summary', { hasText: 'Down the Big Hill' }).click();
  await page.locator('.lib-item', { hasText: 'n6-i184' }).last().getByRole('button', { name: 'Try it' }).click();
  const dialog = page.getByRole('dialog', { name: 'Try an item' });
  for (const box of ['The skateboard was like…', 'What do they share?', 'So the skateboard…']) await expect(dialog.getByText(box)).toBeVisible();
  await axe(page, 'metaphor map');
});

test('who\'s who: in N4 guided practice, tapping a dotted pronoun shows who it means (LTF-03)', async ({ page }) => {
  await page.addLocatorHandler(page.getByRole('dialog', { name: /New flight gear/ }), async (d) => {
    await d.getByRole('button', { name: /Keep going/ }).click({ timeout: 5000 }).catch(() => {});
  });
  await onboard(page);
  await page.getByRole('button', { name: 'Grown-ups' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('group', { name: 'Narrative starting step' }).getByRole('button', { name: '4', exact: true }).click();
  await page.getByRole('button', { name: 'Apply starting steps' }).click();
  await page.getByRole('button', { name: 'Back to the island' }).click();
  await page.getByRole('button', { name: /Start reading/ }).click();
  await page.getByRole('button', { name: /Let's go/ }).click();
  await page.getByRole('button', { name: /Story Woods/ }).click();
  // Through the warm-up and the demo to guided practice.
  const together = page.getByText(/Together · 1 of/);
  for (let i = 0; i < 24 && !(await together.isVisible()); i++) {
    const skip = page.getByRole('button', { name: 'Got it, skip' });
    if (await skip.isVisible()) { await skip.click(); continue; }
    const help = page.getByRole('button', { name: 'Help' });
    for (let k = 0; k < 3; k++) if (await help.isVisible() && await help.isEnabled()) await help.click();
    const check = page.getByRole('button', { name: /^Check/ });
    if (await check.isVisible() && await check.isEnabled()) await check.click();
    // Never wait on Next here: a story map fills in only after the last hint, so the next pass checks again.
    const next = page.getByRole('button', { name: /^Next( →)?$/ });
    for (const opts of [page.getByRole('group', { name: /^(Answers|Scene)$/ }).getByRole('button'), page.locator('main [role=button]:is(.sentence, .vrow, .word)')])
      for (let k = 0; k < (await opts.count()) && !(await next.isVisible()); k++) if (await opts.nth(k).isEnabled()) await opts.nth(k).click();
    if (await next.isVisible()) await next.click();
  }
  await expect(together).toBeVisible();
  const dot = page.locator('main .word.ref').first();
  await expect(dot).toBeVisible();
  const pronoun = (await dot.innerText()).trim();
  await dot.click();
  await expect(page.locator('.gloss-card')).toContainText(`${pronoun} =`);
  await axe(page, 'who is who');
});

test('a check-up flight every ten sessions: six new texts from where he is, no hints, results for the grown-ups (LTF-14)', async ({ page }) => {
  await page.addLocatorHandler(page.getByRole('dialog', { name: /New flight gear/ }), async (d) => {
    await d.getByRole('button', { name: /Keep going/ }).click({ timeout: 5000 }).catch(() => {});
  });
  await onboard(page);
  // Ten finished sessions, so a check-up is due (and the journey waits at Gull Island, where the sea routes leave).
  await seedFinished(page, 10);
  await page.getByRole('button', { name: /Start reading/ }).click();
  await page.getByRole('button', { name: /Let's go/ }).click();
  await axe(page, 'choose with a check-up');
  await page.getByRole('button', { name: /Check-up flight/ }).click();
  for (let k = 1; k <= 6; k++) {
    await expect(page.getByText(`Check-up flight · ${k} of 6`)).toBeVisible();
    await expect(page.getByText('no hints this time')).toBeVisible();
    await answer(page);
  }
  await expect(page.getByRole('heading', { name: 'Pick one new thing for your island' })).toBeVisible();
  await page.locator('.piece').first().click();
  await page.getByRole('button', { name: 'Choose a spot for me' }).click();
  await page.getByRole('button', { name: /Back to my island/ }).click();
  await page.getByRole('button', { name: 'Grown-ups' }).click();
  const card = page.locator('section', { has: page.getByRole('heading', { name: 'Check-up flights' }) });
  await expect(card).toContainText(/of 6 right first time/);
  await expect(card).toContainText('Gull Island');
});

test('at Gull Island he chooses a sea route: three islands that match his interests, and the story follows his pick (LTF-20)', async ({ page }) => {
  await page.addLocatorHandler(page.getByRole('dialog', { name: /New flight gear/ }), async (d) => {
    await d.getByRole('button', { name: /Keep going/ }).click({ timeout: 5000 }).catch(() => {});
  });
  await onboard(page); // his interest is Space
  await seedFinished(page, 5); // five sessions: at Gull Island
  await expect(page.getByText(/Sea routes leave Gull Island/)).toBeVisible();
  await page.getByRole('button', { name: /My journey/ }).click();
  const fork = page.getByRole('region', { name: 'Choose your sea route' });
  await expect(fork).toBeVisible();
  const options = fork.locator('.ccard');
  await expect(options).toHaveCount(3);
  await expect(options.first()).toContainText('Star Point');
  await expect(fork).not.toContainText('Windy Cape');
  await axe(page, 'sea route choice');
  await options.first().click();
  await expect(fork).toBeHidden();
  await expect(page.getByText(/white dome on a point of land to the north/).first()).toBeVisible();
  await page.getByRole('button', { name: /Back to island/ }).click();
  await page.getByRole('button', { name: 'Grown-ups' }).click();
  await expect(page.getByText('Gull Island, 5 more to Star Point')).toBeVisible();
});

test('names instead of he and she in the easiest texts, never inside what a character says (LTF-03)', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'Grown-ups' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByText('Names instead of he and she in the easiest texts').click();
  await expect(page.getByRole('switch', { name: 'Names instead of he and she in the easiest texts' })).toBeChecked();
  await page.getByRole('button', { name: 'Content library' }).click();
  await page.getByLabel('Skill').selectOption('N1');
  await page.locator('summary', { hasText: 'Maya Plays Her Flute' }).click();
  await page.locator('.lib-item', { hasText: 'n1-i57' }).last().getByRole('button', { name: 'Try it' }).click();
  const passage = page.getByRole('dialog', { name: 'Try an item' }).locator('article.passage');
  await expect(passage).toContainText("Maya took Maya's flute out of the flute's case.");
  await expect(passage).not.toContainText('She took her flute');
  await axe(page, 'names instead of pronouns');
});

test('a new island at each stop: its own look, a quest that opens places one session at a time, and Home Island to go back to (LTF-36)', async ({ page }) => {
  await page.addLocatorHandler(page.getByRole('dialog', { name: /New flight gear/ }), async (d) => {
    await d.getByRole('button', { name: /Keep going/ }).click({ timeout: 5000 }).catch(() => {});
  });
  await onboard(page);
  await seedFinished(page, 5); // five sessions: ashore on Gull Island
  await expect(page.getByRole('img', { name: /^Gull Island\./ })).toBeVisible();
  const quest = page.getByRole('region', { name: 'Gull Island quest' });
  await expect(quest).toContainText('Count the gull nests with Ranger Jo.');
  await expect(quest).not.toContainText('Done');
  await expect(quest).toContainText('opens when lantern 2 is lit on the Harbor Town path');
  await axe(page, 'Gull Island');
  // The app remembers when he came ashore; one more finished session there does the first step and opens its place.
  await expect.poll(() => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open('wayfinder'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const row = await new Promise<{ value?: { islandsSeen?: Record<string, number> } } | undefined>((res) => { const g = db.transaction('kv').objectStore('kv').get('settings'); g.onsuccess = () => res(g.result); });
    db.close();
    return row?.value?.islandsSeen?.gull;
  })).toBe(5);
  await seedFinished(page, 6);
  await expect(quest).toContainText('Done: The gull nests is open.');
  await expect(page.getByRole('img', { name: /Still closed: Seal Rocks, The rock pools, The ranger hut\./ })).toBeVisible();
  await page.getByRole('button', { name: 'Home Island' }).click();
  await expect(page.getByRole('img', { name: /^Your island\./ })).toBeVisible();
  await expect(page.getByRole('region', { name: /quest/ })).toHaveCount(0);
});

test('a wrong tap opens the clue for one more try, a second shows the answer, and only a first-tap answer looks like a success (LTF-38)', async ({ page }) => {
  await page.addLocatorHandler(page.getByRole('dialog', { name: /New flight gear/ }), async (d) => {
    await d.getByRole('button', { name: /Keep going/ }).click({ timeout: 5000 }).catch(() => {});
  });
  await page.clock.setFixedTime(new Date('2026-10-14T16:00:00')); // the same questions every run
  await onboard(page);
  await page.getByRole('button', { name: /Start reading/ }).click();
  await page.getByRole('button', { name: /Let's go/ }).click();
  await page.getByRole('button', { name: /Harbor Town/ }).click();
  await expect(page.getByText(/Warm up · 1 of/)).toBeVisible();
  const { wrong } = await choicesHere(page);
  await wrong[0].click();
  await expect(page.locator('.feedback.hint')).toBeVisible(); // the clue
  await expect(page.getByRole('button', { name: /^Next( →)?$/ })).toHaveCount(0);
  await expect(wrong[1]).toBeEnabled(); // a real second try, not one choice left
  await wrong[1].click();
  await expect(page.getByText('Now you have seen how.')).toBeVisible();
  await expect(page.locator('.feedback.good')).toHaveCount(0);
  await axe(page, 'answer shown');
  await page.getByRole('button', { name: /^Next( →)?$/ }).click();
  await expect(page.getByText(/Warm up · 2 of/)).toBeVisible();
});

test('two fast wrong answers in a row end the session kindly, in the lounge, and the grown-ups see it (LTF-38)', async ({ page }) => {
  await page.addLocatorHandler(page.getByRole('dialog', { name: /New flight gear/ }), async (d) => {
    await d.getByRole('button', { name: /Keep going/ }).click({ timeout: 5000 }).catch(() => {});
  });
  await page.clock.setFixedTime(new Date('2026-10-14T16:00:00')); // the same questions every run, and every answer instant
  await onboard(page);
  await setSettings(page, { guessCheck: true });
  await page.reload();
  await page.getByRole('button', { name: /Start reading/ }).click();
  await page.getByRole('button', { name: /Let's go/ }).click();
  await page.getByRole('button', { name: /Harbor Town/ }).click();
  for (let k = 0; k < 2; k++) {
    const { wrong } = await choicesHere(page);
    for (const w of wrong.slice(0, 2)) await w.click();
    if (k === 0) await page.getByRole('button', { name: /^Next( →)?$/ }).click();
  }
  await page.getByRole('button', { name: /^Next( →)?$/ }).click();
  await expect(page.getByText('Good place to stop. Your progress is saved.', { exact: false })).toBeVisible();
  await expect(page.getByRole('group', { name: /Fly a kite/ })).toBeVisible();
  await axe(page, 'lounge');
  await page.getByRole('group', { name: /Fly a kite/ }).press('ArrowLeft'); // the kite also flies by keyboard
  await page.getByRole('button', { name: 'Back to my island' }).click();
  await page.getByRole('button', { name: 'Grown-ups' }).click();
  await page.getByRole('button', { name: 'Activity' }).click();
  const card = page.locator('section', { has: page.getByRole('heading', { name: 'Guessing and breaks' }) });
  await expect(card).toContainText(/Answers set aside as guesses\s*2/);
  await expect(card).toContainText(/Sessions stopped kindly for guessing\s*1/);
  await axe(page, 'guessing card');
});

test('a reached island has a day trip on its postcard; Gull Island has none (LTF-26)', async ({ page }) => {
  await page.addLocatorHandler(page.getByRole('dialog', { name: /New flight gear/ }), async (d) => {
    await d.getByRole('button', { name: /Keep going/ }).click({ timeout: 5000 }).catch(() => {});
  });
  await onboard(page);
  await setSettings(page, { routes: { gull: { to: 'fossil', at: 1 } }, journeyAnchor: { at: 5, stop: 1, step: 0, after: 0 } });
  await seedFinished(page, 10); // ashore at Fossil Bay
  await page.getByRole('button', { name: /My journey/ }).click();
  await page.getByRole('button', { name: 'Open the postcard from Gull Island' }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: /Day trip/ })).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Open the postcard from Fossil Bay' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Day trip/ }).click();
  await expect(page.getByRole('region', { name: 'Day trip on Fossil Bay' })).toContainText('A quarry is a place where rock was cut out of the ground.');
  await axe(page, 'day trip');
  await page.getByRole('button', { name: /Back to the postcard/ }).click();
  await expect(page.getByRole('region', { name: 'Postcard from Fossil Bay' })).toBeVisible();
});

test('at Take-off Captain Ada offers two flight paths, and the reef way has its own story (LTF-25)', async ({ page }) => {
  await page.addLocatorHandler(page.getByRole('dialog', { name: /New flight gear/ }), async (d) => {
    await d.getByRole('button', { name: /Keep going/ }).click({ timeout: 5000 }).catch(() => {});
  });
  await onboard(page);
  await setSettings(page, { routes: { gull: { to: 'star', at: 1 } }, journeyAnchor: { at: 5, stop: 1, step: 0, after: 0 } });
  await seedFinished(page, 20); // at Take-off
  await expect(page.getByText(/Captain Ada has two flight paths to Australia/)).toBeVisible();
  await page.getByRole('button', { name: /My journey/ }).click();
  const fork = page.getByRole('region', { name: 'Choose your flight path' });
  await expect(fork.locator('.ccard')).toHaveCount(2);
  await expect(fork).toContainText('The island way');
  await expect(fork).toContainText('The reef way');
  await axe(page, 'flight paths');
  await fork.locator('.ccard', { hasText: 'The reef way' }).click();
  await expect(page.getByText('You take the reef way.', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: /Back to island/ }).click();
  await page.getByRole('button', { name: 'Grown-ups' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByText(/Route from Take-off: The reef way/)).toBeVisible();
});

test('after the eighth koala, the keeper arc at Bluegum: its first beat, its stops, and their postcards (LTF-30)', async ({ page }) => {
  await page.addLocatorHandler(page.getByRole('dialog', { name: /New flight gear/ }), async (d) => {
    await d.getByRole('button', { name: /Keep going/ }).click({ timeout: 5000 }).catch(() => {});
  });
  await onboard(page);
  await setSettings(page, { routes: { gull: { to: 'star', at: 1 }, takeoff: { to: 'island', at: 1 } }, journeyAnchor: { at: 5, stop: 1, step: 0, after: 0 } });
  await seedFinished(page, 33); // landed after 25, then eight koalas
  await expect(page.getByText(/Ranger Tess asks for your help this week/).first()).toBeVisible();
  await page.getByRole('button', { name: /My journey/ }).click();
  await expect(page.getByRole('region', { name: 'On the way to The Tree Nursery' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Bluegum Koala Sanctuary' })).toContainText('Opening Day');
  await axe(page, 'keeper arc');
  await page.getByRole('button', { name: /Back to island/ }).click();
  await seedFinished(page, 38); // one leg on: the Tree Nursery
  await page.getByRole('button', { name: /My journey/ }).click();
  await expect(page.getByRole('region', { name: 'On the way to Junior Keeper Day' })).toBeVisible();
  await page.getByRole('button', { name: /The Tree Nursery/ }).click();
  await expect(page.getByRole('region', { name: 'Postcard from The Tree Nursery' })).toContainText('On planting day');
  await axe(page, 'arc postcard');
});

test('after Opening Day he can fly home, visit an island he skipped, and his island view follows him (LTF-27)', async ({ page }) => {
  await page.addLocatorHandler(page.getByRole('dialog', { name: /New flight gear/ }), async (d) => {
    await d.getByRole('button', { name: /Keep going/ }).click({ timeout: 5000 }).catch(() => {});
  });
  await onboard(page);
  await setSettings(page, { routes: { gull: { to: 'star', at: 1 }, takeoff: { to: 'island', at: 1 } }, journeyAnchor: { at: 5, stop: 1, step: 0, after: 0 } });
  await seedFinished(page, 58); // the keeper arc is done
  await page.getByRole('button', { name: /My journey/ }).click();
  await expect(page.getByText('Captain Ada says the Kookaburra can fly you home.', { exact: false }).first()).toBeVisible();
  await axe(page, 'way home offer');
  await page.getByRole('button', { name: /Fly home/ }).click();
  await expect(page.getByRole('region', { name: 'On the way to Cloud Hill' })).toBeVisible();
  await page.getByRole('button', { name: /Back to island/ }).click();
  await seedFinished(page, 63); // one leg: at Cloud Hill
  await expect(page.getByRole('img', { name: /^Cloud Hill\./ })).toBeVisible();
  await page.getByRole('button', { name: /My journey/ }).click();
  const fork = page.getByRole('region', { name: 'Choose an island on the way home' });
  await expect(fork).not.toContainText('Star Point'); // he has been there
  await expect(fork.locator('.ccard')).toHaveCount(3);
  await axe(page, 'way home fork');
  await fork.locator('.ccard', { hasText: 'Fossil Bay' }).click();
  await expect(page.getByRole('region', { name: 'On the way to Fossil Bay' })).toBeVisible();
});
