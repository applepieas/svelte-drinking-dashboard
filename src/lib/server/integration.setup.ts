/**
 * Runs before any integration test module is imported, which is the only moment
 * that works: `$env/dynamic/private` snapshots `process.env` when it is first
 * imported, and a project-level `env` setting loses to a DATABASE_URL loaded
 * from `.env`.
 *
 * The equality check is the real safeguard. Without it a misconfigured run
 * quietly points the whole suite — inserts, deletes and cascades — at whatever
 * database happens to be in `.env`.
 */
const developmentUrl = process.env.DATABASE_URL;
const testUrl = process.env.TEST_DATABASE_URL;

if (!testUrl) {
	throw new Error('Integration tests need TEST_DATABASE_URL.');
}

if (testUrl === developmentUrl) {
	throw new Error(
		'TEST_DATABASE_URL is the same as DATABASE_URL. These tests write and delete rows; point them at a separate database or a Neon branch.'
	);
}

process.env.DATABASE_URL = testUrl;
