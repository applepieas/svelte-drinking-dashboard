import { neon } from '@neondatabase/serverless';
import postgres from 'postgres';
import { E2E_PREFIX } from './helpers';

/**
 * Same rule as the application: a Neon host speaks HTTP, anything else speaks
 * the wire protocol, so the suite runs against a local PostgreSQL without a
 * second code path.
 */
export default async function teardown() {
	const url = process.env.TEST_DATABASE_URL;
	if (!url) return;

	const gone = `delete from event where name like '${E2E_PREFIX}%'`;

	if (/\.neon\.tech$/.test(new URL(url).hostname)) {
		await neon(url)(gone);
		return;
	}

	const sql = postgres(url, { max: 1 });
	try {
		await sql.unsafe(gone);
	} finally {
		// Playwright waits for the process to be idle before it exits.
		await sql.end();
	}
}
