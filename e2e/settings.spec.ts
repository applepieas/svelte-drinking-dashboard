import { expect, test } from '@playwright/test';
import { createEvent, join } from './helpers';

/**
 * The board's settings panel is the host's whole toolbox: the event is created
 * on the screen that shows it, so nobody has to reach for a phone to run it.
 * JavaScript only - without it the same forms live on the management page,
 * which the core suite covers.
 */
test('the host runs the event from the board settings', async ({ page }) => {
	const code = await createEvent(page, 'settings');

	// A guest on another device, so there is somebody to kick.
	const host = await page.context().cookies();
	await page.context().clearCookies();
	await join(page, code, 'vyhozeny');
	await page.getByRole('button', { name: /^Pivo/ }).click();
	await expect(page.getByText(/1\s+zápis/)).toBeVisible();
	await page.context().clearCookies();
	await page.context().addCookies(host);

	await page.goto(`/a/${code}`);
	await page.getByText('Pokračovat na tabuli').click();
	const ranking = page.getByRole('list', { name: 'Žebříček' });
	await expect(ranking).toContainText('vyhozeny');

	// Wait for hydration: the plain host links leave the board once it has.
	await expect(page.getByRole('link', { name: 'Správa akce' })).toHaveCount(0);
	await page.keyboard.press('v');
	const panel = page.getByRole('complementary', { name: 'Nastavení tabule' });

	await panel.getByRole('button', { name: 'Zapnout' }).click();
	await expect(panel).toContainText('Nealko ve hře: ano');

	await panel.getByRole('button', { name: 'Vykopnout' }).click();
	await expect(panel).toContainText('Hráči (0)');
	await expect(ranking).toHaveCount(0);

	await panel.getByRole('button', { name: 'Ukončit akci' }).click();
	await expect(page.getByText('Akce skončila.')).toBeVisible();
	await panel.getByRole('button', { name: 'Otevřít znovu' }).click();
	await expect(page.getByText('Akce skončila.')).toHaveCount(0);
});

test('a guest at the board only gets the card size', async ({ page }) => {
	const code = await createEvent(page, 'settingsguest');
	await page.context().clearCookies();

	await page.goto(`/a/${code}`);
	await page.waitForLoadState('networkidle');
	await page.keyboard.press('v');
	const panel = page.getByRole('complementary', { name: 'Nastavení tabule' });

	await expect(panel.getByLabel('Velikost kartiček')).toBeVisible();
	await expect(panel.getByRole('button', { name: 'Ukončit akci' })).toHaveCount(0);
	await expect(panel).toContainText('Zbytek nastavení má jen prohlížeč');
});
