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
  await axe(second, 'cloud card');
});
