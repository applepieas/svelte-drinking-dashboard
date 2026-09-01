import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { runMaintenance } from '$lib/server/demo';
import { sha256Hex } from '$lib/server/tokens';

/**
 * Scheduled housekeeping: delete events past their retention window, and keep
 * the public demo running.
 *
 * It is an HTTP endpoint rather than a Worker `scheduled` handler because
 * adapter-cloudflare only emits `fetch`. A cron trigger calls this instead,
 * which has the side benefit of working the same way locally and in CI.
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
