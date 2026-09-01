import { chromium, type FullConfig } from '@playwright/test';
import { E2E_PREFIX } from './helpers';

/**
 * Walks every route once before any test runs.
 *
 * On a cold start Vite discovers and pre-bundles dependencies as a page is being
 * served, then reloads that page. A reload mid-test wipes whatever has been
 * typed into a form, which surfaces as a few unrelated tests failing at the
 * start of a run and passing when run alone.
 *
 * It has to be a real browser, and it has to reach every route: the optimisation
 * is triggered by the client requesting modules, and each route pulls its own.
 */
export default async function warmup(config: FullConfig) {
	const baseURL = config.projects[0]?.use?.baseURL;
	if (!baseURL) return;

	const browser = await chromium.launch();
	const page = await browser.newPage({ baseURL });

	try {
		await page.goto('/', { waitUntil: 'networkidle' });

		await page.goto('/nova', { waitUntil: 'networkidle' });
		await page.getByLabel('Název akce').fill(`${E2E_PREFIX}warmup`);
		await page.getByRole('button', { name: 'Založit akci' }).click();
		await page.waitForURL(/\/a\/[A-Z0-9]{6}$/);
		const code = page.url().split('/a/')[1];

		await page.goto(`/a/${code}/pripojit`, { waitUntil: 'networkidle' });
		await page.getByLabel('Přezdívka').fill('warmup');
		await page.getByRole('button', { name: 'Připojit se' }).click();
		await page.waitForURL(`**/a/${code}/zapis`);
		await page.waitForLoadState('networkidle');

		await page.goto(`/a/${code}/sprava`, { waitUntil: 'networkidle' });
		// The error page pulls its own modules too.
		await page.goto('/a/AAAAAA', { waitUntil: 'networkidle' });
	} finally {
		await browser.close();
	}
}
