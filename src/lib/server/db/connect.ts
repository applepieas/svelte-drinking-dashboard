import { dev } from '$app/environment';
import { drizzle } from 'drizzle-orm/neon-http';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

/**
 * The local handle is presented as the Neon one because that is the smaller of
 * the two surfaces - no `transaction`, for instance. Code that satisfies this
 * type cannot ask the deployed database for something it does not have.
 */
export type Database = NeonHttpDatabase<typeof schema>;

/**
 * Neon over HTTP is the only thing that works from a Worker: no sockets to
 * open, no pool to hold between requests. It is also metered, and a database
 * you can run out of is a poor place to develop against.
 *
 * So in development an address that is not Neon's gets the ordinary wire
 * protocol instead, and the app runs on a local PostgreSQL - no network, no
 * quota, the same engine. `dev` is a constant once the build has run, so the
 * whole branch is dropped from the Worker along with the driver it imports;
 * checking the host alone would ship a TCP driver that production never calls.
 */
export async function connect(url: string): Promise<Database> {
	if (!dev || /\.neon\.tech$/.test(new URL(url).hostname)) {
		return drizzle(neon(url), { schema });
	}

	const [{ default: postgres }, { drizzle: drizzlePg }] = await Promise.all([
		import('postgres'),
		import('drizzle-orm/postgres-js')
	]);
	// Room for the streams. Every open board holds a request for minutes and
	// polls down it, so a single connection would put the phones' writes in a
	// queue behind them - which is exactly what a party does not need.
	return drizzlePg(postgres(url, { max: 10 }), { schema }) as unknown as Database;
}

/**
 * A handle for the build and nothing else.
 *
 * Analysing the routes imports every server module, and some of them assemble
 * query fragments as they load, so a builder has to exist. Connecting is a
 * separate matter: at that moment DATABASE_URL is whatever `.env` holds, which
 * on a developer's machine is a local address the deployed driver will not
 * parse. The HTTP driver opens nothing until a query runs, so the build gets a
 * builder addressed to a host no request will ever reach.
 */
export function buildTimeOnly(): Database {
	return drizzle(neon('postgresql://build:build@build.neon.tech/build'), { schema });
}
