import { error, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { event } from '$lib/server/db/schema';
import { normalizeCode } from '$lib/server/codes';
import { hashToken } from '$lib/server/tokens';

export const load: PageServerLoad = async ({ params, cookies }) => {
	const code = normalizeCode(params.kod);
	// Same 404 for a malformed code and a missing event: the response must not
	// reveal which codes are taken.
	if (!code) error(404, 'Akce nenalezena');
	if (code !== params.kod) redirect(308, `/a/${code}`);

	const row = await db.query.event.findFirst({ where: eq(event.code, code) });
	if (!row) error(404, 'Akce nenalezena');

	const hostToken = cookies.get(`host_${code}`);
	const isHost = hostToken ? row.hostTokenHash === (await hashToken(hostToken)) : false;

	return {
		code: row.code,
		name: row.name,
		drinks: row.drinks,
		closedAt: row.closedAt,
		isHost
	};
};
