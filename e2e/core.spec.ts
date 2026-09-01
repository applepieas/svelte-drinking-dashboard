import { expect, test } from '@playwright/test';
import { createEvent, E2E_PREFIX, join, joinExpectingRejection } from './helpers';

/**
 * Runs twice: once in an ordinary browser, once with JavaScript switched off.
 *
 * That second run is the point of the architecture. Creating an event, joining,
 * logging a drink and taking it back are all plain form posts, so the whole
 * product has to work with no client-side code at all. `use:enhance` only makes
 * it quicker.
 */

test('a host can run an event from creation to closing', async ({ page }) => {
	const code = await createEvent(page, 'host');

	await expect(page.getByRole('heading', { name: `${E2E_PREFIX}host` })).toBeVisible();
	await expect(page.getByText(`Kód: ${code}`)).toBeVisible();
	// The screen must always show a way in.
	await expect(page.getByRole('img', { name: /QR kód/ })).toBeVisible();

	await page.goto(`/a/${code}/sprava`);
	await page.getByRole('button', { name: 'Ukončit akci' }).click();
	await expect(page.getByText('Akce je ukončená.')).toBeVisible();

	// A closed event turns anyone arriving into a reader of the final standings.
	await page.goto(`/a/${code}/pripojit`);
	await expect(page).toHaveURL(`/a/${code}`);
	await expect(page.getByText('Akce skončila.')).toBeVisible();
});

test('a guest joins, logs a drink and takes it back', async ({ page }) => {
	const code = await createEvent(page, 'guest');
	await join(page, code, 'pixelpetr');

	await expect(page.getByText('pixelpetr')).toBeVisible();
	await page.getByRole('button', { name: /^Pivo/ }).click();
	await expect(page.getByText(/1\s+zápis/)).toBeVisible();

	await page.getByRole('button', { name: /Vzít zpět/ }).click();
	await expect(page.getByText(/0\s+zápisů/)).toBeVisible();
});

test('the leaderboard ranks by ethanol rather than by number of drinks', async ({ page }) => {
	const code = await createEvent(page, 'ethanol');

	await join(page, code, 'nealkoholik');
	for (let i = 0; i < 3; i++) {
		await page.getByRole('button', { name: /^Nealko/ }).click();
		await expect(page.getByText(new RegExp(`${i + 1}\\s+zápis`))).toBeVisible();
	}

	// A second device: clearing cookies is what makes this a different person.
	await page.context().clearCookies();
	await join(page, code, 'panakar');
	await page.getByRole('button', { name: /^Panák/ }).click();
	await expect(page.getByText(/1\s+zápis/)).toBeVisible();

	await page.goto(`/a/${code}`);
	const rows = page.getByRole('listitem').filter({ hasText: /ml$/ });
	await expect(rows.first()).toContainText('panakar');
	await expect(rows.nth(1)).toContainText('nealkoholik');
});

test('a taken nick is refused', async ({ page }) => {
	const code = await createEvent(page, 'nicks');
	await join(page, code, 'obsazeny');

	// A different device: clearing cookies is what makes this a different person.
	await page.context().clearCookies();
	await joinExpectingRejection(page, code, 'OBSAZENY', 'už je ve hře');
});

test('an unknown code is not found', async ({ page }) => {
	const response = await page.goto('/a/ZZZZZZ');
	expect(response?.status()).toBe(404);
});

test('the host can switch between the screen and logging on one device', async ({ page }) => {
	const code = await createEvent(page, 'toggle');

	// Not joined yet, so the write side has to start at the nick form.
	await page.getByRole('link', { name: 'Zapisovat' }).click();
	await page.waitForURL(`**/a/${code}/pripojit`);

	await join(page, code, 'hostitel');
	await expect(page.getByRole('link', { name: 'Obrazovka' })).toBeVisible();

	await page.getByRole('link', { name: 'Obrazovka' }).click();
	await page.waitForURL(`**/a/${code}`);

	// Now that they are in, the toggle goes straight to logging.
	await page.getByRole('link', { name: 'Zapisovat' }).click();
	await page.waitForURL(`**/a/${code}/zapis`);
	await page.getByRole('button', { name: /^Pivo/ }).click();
	await expect(page.getByText(/1\s+zápis/)).toBeVisible();
});

test('a guest never gets a way to the standings', async ({ page }) => {
	const code = await createEvent(page, 'guestnav');

	// A different device, so no host cookie travels with it.
	await page.context().clearCookies();
	await join(page, code, 'obycejny');

	await expect(page.getByRole('link', { name: 'Obrazovka' })).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Zapisovat' })).toHaveCount(0);
});
