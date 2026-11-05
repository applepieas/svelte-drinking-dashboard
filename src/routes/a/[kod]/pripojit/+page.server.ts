import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { participant } from '$lib/server/db/schema';
import { isUniqueViolation } from '$lib/server/db/errors';
import { NICK_MAX, NICK_MIN, normalizeNick } from '$lib/nicks';
import { normalizeCode } from '$lib/server/codes';
import { ensureCookieId } from '$lib/server/identity';
import { findActiveParticipant, findNickHolder, getEventByCode } from '$lib/server/queries';
import { isEventFull, MAX_PARTICIPANTS } from '$lib/server/ratelimit';

export const load: PageServerLoad = async ({ parent, params, request }) => {
	const { event, me } = await parent();
	if (event.closedAt) redirect(303, `/a/${params.kod}`);
	// The nick is fixed once you are in. Getting a new one means being kicked first.
	// Not after a POST, though: load runs again behind a failed action, and the
	// failure that says this browser is already somebody has to stay on screen.
	if (me && request.method !== 'POST') redirect(303, `/a/${params.kod}/zapis`);
	return {};
};

export const actions: Actions = {
	default: async (requestEvent) => {
		const { request, params } = requestEvent;
		const form = await request.formData();
		const submitted = String(form.get('nick') ?? '');
		const nick = normalizeNick(submitted);

		if (!nick) {
			return fail(400, {
				nick: submitted,
				error: `Přezdívka musí mít ${NICK_MIN} až ${NICK_MAX} znaků a nesmí obsahovat neviditelné znaky.`
			});
		}

		// Actions do not receive load() data, so the event is fetched again here.
		const code = normalizeCode(params.kod);
		if (!code) error(404, 'Akce nenalezena');
		const row = await getEventByCode(code);
		if (!row) error(404, 'Akce nenalezena');
		if (row.closedAt) redirect(303, `/a/${code}`);

		const cookieId = ensureCookieId(requestEvent);
		const already = await findActiveParticipant(row.id, cookieId);
		if (already) {
			// The same nick twice is a double tap or a resubmit: they are in, carry on.
			if (already.nick === nick) redirect(303, `/a/${code}/zapis`);
			// A different nick means another tab of this browser joined first. Every
			// tab shares the one cookie, so quietly continuing would hand this person
			// somebody else's drinks.
			return fail(409, {
				nick: submitted,
				already: already.nick,
				error: `Tenhle prohlížeč už hraje za ${already.nick}. Všechny záložky jednoho prohlížeče jsou jeden hráč.`
			});
		}

		if (await isEventFull(row.id)) {
			return fail(409, {
				nick: submitted,
				error: `Akce je plná, víc než ${MAX_PARTICIPANTS} lidí do žebříčku nepustíme.`
			});
		}

		// Checked for the person's benefit. The unique index below is what actually
		// protects the data — this lookup only exists to produce a decent message.
		if (await findNickHolder(row.id, nick)) {
			return fail(409, { nick: submitted, error: `Přezdívka ${nick} už je ve hře.` });
		}

		try {
			await db.insert(participant).values({ eventId: row.id, cookieId, nick });
		} catch (err) {
			if (isUniqueViolation(err, 'participant_nick_uq')) {
				return fail(409, { nick: submitted, error: `Přezdívka ${nick} už je ve hře.` });
			}
			// participant_cookie_uq: this device joined between the check and the
			// insert. The outcome is the same as success, so fall through.
			if (!isUniqueViolation(err, 'participant_cookie_uq')) throw err;
		}

		redirect(303, `/a/${code}/zapis`);
	}
};
