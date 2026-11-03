import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { buildTimeOnly, connect, type Database } from './connect';

/** Connects on import, except during the build - see `buildTimeOnly`. */
export const db: Database = building ? buildTimeOnly() : await open();

async function open(): Promise<Database> {
	if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
	return connect(env.DATABASE_URL);
}
