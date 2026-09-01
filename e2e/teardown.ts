import { neon } from '@neondatabase/serverless';
import { E2E_PREFIX } from './helpers';

export default async function teardown() {
	const url = process.env.TEST_DATABASE_URL;
	if (!url) return;

	const sql = neon(url);
	// Participants and entries go with it through the cascade.
	await sql`delete from event where name like ${E2E_PREFIX + '%'}`;
}
