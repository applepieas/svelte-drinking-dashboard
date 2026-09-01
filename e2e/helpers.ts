import { expect, type Page } from '@playwright/test';

/** Every event these tests create is named with this prefix so teardown finds it. */
export const E2E_PREFIX = 'E2E ';

/**
 * Fills a form and submits it, retrying the whole interaction rather than each
 * step.
 *
 * A page can be reloaded out from under a half-filled form — Vite does exactly
 * that on a cold start once it has pre-bundled dependencies. Asserting the value
 * before clicking is not enough, because the reload can land between the two.
 * Retrying fill-and-submit together converges, since a reload only happens once.
 */
async function submitForm(
	page: Page,
	fields: Record<string, string>,
	button: string,
	verify: () => Promise<void>
) {
	await expect(async () => {
		for (const [label, value] of Object.entries(fields)) {
			await page.getByLabel(label).fill(value);
			await expect(page.getByLabel(label)).toHaveValue(value);
		}
		await page.getByRole('button', { name: button }).click();
		await verify();
	}).toPass({ timeout: 25_000 });
}

export async function createEvent(page: Page, suffix: string): Promise<string> {
	await page.goto('/nova');
	await submitForm(page, { 'Název akce': `${E2E_PREFIX}${suffix}` }, 'Založit akci', () =>
		page.waitForURL(/\/a\/[A-Z0-9]{6}$/, { timeout: 5_000 })
	);
	return page.url().split('/a/')[1];
}

export async function join(page: Page, code: string, nick: string): Promise<void> {
	await page.goto(`/a/${code}/pripojit`);
	await submitForm(page, { Přezdívka: nick }, 'Připojit se', () =>
		page.waitForURL(`**/a/${code}/zapis`, { timeout: 5_000 })
	);
}

/** Same retry reasoning, for a submission that is supposed to be refused. */
export async function joinExpectingRejection(
	page: Page,
	code: string,
	nick: string,
	reason: string
) {
	await page.goto(`/a/${code}/pripojit`);
	await submitForm(page, { Přezdívka: nick }, 'Připojit se', () =>
		expect(page.getByRole('alert')).toContainText(reason, { timeout: 5_000 })
	);
}
