import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { runMaintenance } from '$lib/server/demo';
import { sha256Hex } from '$lib/server/tokens';

/**
 * Housekeeping on demand: delete events past their retention window, and keep
 * the public demo running.
 *
 * Nothing calls this on a timer. The demo is advanced by its own page loads
 * (see `maintainIfDue`), because a request every couple of minutes kept the
 * database's compute awake around the clock and spent a month of it in a week.
 * This endpoint is the manual handle on the same job - for a deploy, a wipe, or
 * the end-to-end suite, which needs the demo seeded before it can look at it.
 */
export const POST: RequestHandler = async ({ request }) => {
	const secret = env.MAINTENANCE_SECRET;
	if (!secret) {
		// Refuse rather than run unprotected: this endpoint deletes rows.
		error(503, 'Údržba není nakonfigurovaná.');
	}

	const offered = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
	// Compared as digests so the check does not leak the secret's length.
	if ((await sha256Hex(offered)) !== (await sha256Hex(secret))) {
		error(401, 'Neplatný klíč.');
	}

	return json(await runMaintenance());
};
