import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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

  await page.getByRole('button', { name: /Start reading/ }).click();
  await expect(page.getByText("Here is today's plan.")).toBeVisible();
  await axe(page, 'plan');
  await page.getByRole('button', { name: /Let's go/ }).click();
  await page.getByRole('button', { name: /Story Woods/ }).click();
  await expect(page.getByText(/Warm up · 1 of/)).toBeVisible();
  await axe(page, 'item');

  // Help climbs the hint ladder; nothing marks the learner wrong.
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Help' }).click();
  await expect(page.getByText(/^Here is the answer/)).toBeVisible();

  await page.getByRole('button', { name: 'Stop' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Stop' }).click();
  await expect(page.getByRole('button', { name: /Start reading/ })).toBeVisible();
});

test('today recount and the grown-ups area', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: /Tell about today/ }).click();
  const first = page.locator('.tcard').first();
  await first.click();
  await page.getByRole('button', { name: 'Next' }).click();
  await axe(page, 'today');
  for (let i = 0; i < 3; i++) await page.locator('.tiles .tile').first().click();
  await expect(page.getByRole('button', { name: /Save and show/ })).toBeVisible();
  await page.getByRole('button', { name: /Save and show/ }).click();
  await expect(page.getByText('For the grown-up: ask about these')).toBeVisible();
  await page.getByRole('button', { name: /Back to my island/ }).click();

  await page.getByRole('button', { name: 'Grown-ups' }).click();
  await expect(page.getByRole('heading', { name: 'Grown-ups' })).toBeVisible();
  await axe(page, 'overview');
  await page.getByRole('button', { name: 'Skills' }).click();
  await axe(page, 'skills');
});
