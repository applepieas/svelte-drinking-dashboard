import { defineConfig, devices } from '@playwright/test';

const PORT = 4174;

/**
 * End-to-end tests write to the database, so they get the same isolated one the
 * integration tests use. An explicit variable beats `.env` in the dev server,
 * which is what keeps them off the development database.
 */
const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
	throw new Error('End-to-end tests need TEST_DATABASE_URL. See .env.example.');
}
if (databaseUrl === process.env.DATABASE_URL) {
	throw new Error('TEST_DATABASE_URL must not be the development database.');
}

/** Shared with the demo test, which seeds the demo through the same endpoint. */
export const MAINTENANCE_SECRET = 'e2e-maintenance-secret';

export default defineConfig({
	testDir: 'e2e',
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	globalSetup: './e2e/warmup.ts',
	globalTeardown: './e2e/teardown.ts',
	use: { baseURL: `http://localhost:${PORT}` },

	webServer: {
		command: `pnpm vite dev --port ${PORT}`,
		port: PORT,
		reuseExistingServer: false,
		env: {
			DATABASE_URL: databaseUrl,
			// The suite creates an event per test from a single address, which is
			// exactly what the production limit is there to stop.
			MAX_EVENTS_PER_HOUR: '1000',
			// The demo test drives the maintenance endpoint the way cron will.
			MAINTENANCE_SECRET: MAINTENANCE_SECRET
		}
	},

	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },

		/**
		 * The point of the whole suite. Every write path is an ordinary form post,
		 * and this project proves it by turning JavaScript off entirely.
		 */
		{
			name: 'no-js',
			testMatch: /core\.spec\.ts/,
			use: { ...devices['Desktop Chrome'], javaScriptEnabled: false }
		}
	]
});
