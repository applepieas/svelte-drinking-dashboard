import { expect, test } from '@playwright/test';
import { createEvent, join } from './helpers';

/** Everything here needs a browser that runs the client, so it is chromium only. */

test('the screen updates without being reloaded', async ({ browser }) => {
	const host = await browser.newContext();
	const screen = await host.newPage();

	const code = await createEvent(screen, 'live');

	await expect(screen.getByText('Zatím nikdo nic nezapsal.')).toBeVisible();

	// A separate context is a separate device, with its own cookies.
	const phone = await (await browser.newContext()).newPage();
	await join(phone, code, 'telefon');
	await phone.getByRole('button', { name: /^Pivo/ }).click();

	// No reload anywhere: this can only arrive over the stream. Scoped to the
	// leaderboard, because the nick also shows up in the list of recent entries.
	const board = screen.locator('ol');
	await expect(board.getByText('telefon')).toBeVisible({ timeout: 10_000 });
	await expect(screen.getByText('celkem 22 ml etanolu')).toBeVisible();

	await phone.getByRole('button', { name: /Vzít zpět/ }).click();
	await expect(screen.getByText('Zatím nikdo nic nezapsal.')).toBeVisible({ timeout: 10_000 });
});

test('the estimate needs a profile and never goes negative', async ({ page }) => {
	const code = await createEvent(page, 'bac');
	await join(page, code, 'promile');

	// Nothing is shown until the person volunteers a weight.
	await expect(page.getByLabel('Váha v kg')).toBeVisible();
	await page.getByLabel('Váha v kg').fill('80');
	await page.getByRole('button', { name: 'Uložit' }).click();

	// Sober, and no drink can make that a negative number.
	await expect(page.getByText('0,00 ‰')).toBeVisible();

	await page.getByRole('button', { name: /^Panák/ }).click();
	// Climbing from zero rather than jumping, and never below it.
	await expect(page.getByText(/^0,\d\d ‰$/)).toBeVisible();
});
