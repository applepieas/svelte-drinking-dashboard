import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { DEMO_CODE } from '$lib/demo';
import { normalizeCode } from '$lib/server/codes';
import { maintainIfDue } from '$lib/server/demo';
import { findActiveParticipant, getEventByCode } from '$lib/server/queries';
import { hashToken } from '$lib/server/tokens';

export const load: LayoutServerLoad = async ({ params, url, locals, cookies, platform }) => {
	const code = normalizeCode(params.kod);
	// The same 404 for a malformed code and a missing event: the response must
	// not reveal which codes are taken.
	if (!code) error(404, 'Akce nenalezena');
	// Canonicalise the code without losing the sub-route we were heading for.
	if (code !== params.kod) {
		redirect(308, url.pathname.replace(`/a/${params.kod}`, `/a/${code}`) + url.search);
	}

	// The demo moves because somebody is watching it, not because a timer said
	// so. Run after the response so the reader never waits for it; what this
	// writes shows up over the stream, or on the next load.
	if (code === DEMO_CODE) {
		const ticking = maintainIfDue().catch((reason) => {
			console.error('demo tick failed', reason);
		});
		if (platform?.context?.waitUntil) platform.context.waitUntil(ticking);
	}

	const row = await getEventByCode(code);
	if (!row) error(404, 'Akce nenalezena');

	const hostToken = cookies.get(`host_${code}`);
	const isHost = hostToken ? row.hostTokenHash === (await hashToken(hostToken)) : false;

	const me = locals.cookieId ? await findActiveParticipant(row.id, locals.cookieId) : undefined;

	return {
		// The event's uuid stays server-side; whatever load returns is serialised
		// into the page.
		event: { code: row.code, name: row.name, drinks: row.drinks, closedAt: row.closedAt },
		me: me ? { nick: me.nick } : null,
		isHost
	};
};
