import { expect, test } from '@playwright/test';
import { MAINTENANCE_SECRET } from '../playwright.config';

/**
 * The public demo is what a first-time visitor lands on, so the thing worth
 * proving is that the short link resolves and the board is not empty.
 */
test('the demo link lands on a populated board', async ({ page, request }) => {
	const maintenance = await request.post('/api/udrzba', {
		headers: { authorization: `Bearer ${MAINTENANCE_SECRET}` }
	});
	expect(maintenance.ok()).toBe(true);

	await page.goto('/demo');
	await expect(page).toHaveURL(/\/a\/[A-Z0-9]{6}$/);

	// Seeded with history, so nobody arrives at "nothing has happened yet".
	await expect(page.getByText('Zatím nikdo nic nezapsal.')).toHaveCount(0);
	await expect(page.getByRole('heading', { name: 'Žebříček' })).toBeVisible();
	await expect(page.getByText(/celkem \d+ ml etanolu/)).toBeVisible();
});

test('maintenance refuses to run without the right key', async ({ request }) => {
	expect((await request.post('/api/udrzba')).status()).toBe(401);
	expect(
		(await request.post('/api/udrzba', { headers: { authorization: 'Bearer wrong' } })).status()
	).toBe(401);
});
