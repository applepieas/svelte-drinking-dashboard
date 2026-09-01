import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad, RouteParams } from './$types';
import { normalizeCode } from '$lib/server/codes';
import { closeEvent, deleteEvent, kickParticipant, reopenEvent } from '$lib/server/commands';
import { getEventByCode, listParticipants } from '$lib/server/queries';
import { hashToken } from '$lib/server/tokens';

/**
 * The management page is the only place that needs the host token, so the check
 * lives here rather than in the layout. 403 rather than 404: the event page is
 * public anyway, so pretending it does not exist would only confuse the host.
 */
async function requireHost({
	params,
	cookies
}: {
	params: RouteParams;
	cookies: { get(name: string): string | undefined };
}) {
	const code = normalizeCode(params.kod);
	if (!code) error(404, 'Akce nenalezena');

	const row = await getEventByCode(code);
	if (!row) error(404, 'Akce nenalezena');

	const token = cookies.get(`host_${code}`);
	const isHost = token ? row.hostTokenHash === (await hashToken(token)) : false;
	if (!isHost) error(403, 'Tuhle akci spravovat nemůžeš.');

	return { code, event: row };
}

export const load: PageServerLoad = async (loadEvent) => {
	const { event } = await requireHost(loadEvent);
	return { participants: await listParticipants(event.id) };
};

export const actions: Actions = {
	ukoncit: async (requestEvent) => {
		const { code, event } = await requireHost(requestEvent);
		await closeEvent(event.id);
		redirect(303, `/a/${code}/sprava`);
	},

	otevrit: async (requestEvent) => {
		const { code, event } = await requireHost(requestEvent);
		await reopenEvent(event.id);
		redirect(303, `/a/${code}/sprava`);
	},

	vykopnout: async (requestEvent) => {
		const { code, event } = await requireHost(requestEvent);
		const form = await requestEvent.request.formData();
		const participantId = String(form.get('participantId') ?? '');
		if (!participantId) return fail(400, { error: 'Chybí hráč.' });

		// Scoped to this event, so a stolen id from elsewhere does nothing.
		const [kicked] = await kickParticipant(event.id, participantId);
		if (!kicked) return fail(409, { error: 'Tenhle hráč už ve hře není.' });

		redirect(303, `/a/${code}/sprava`);
	},

	smazat: async (requestEvent) => {
		const { code, event } = await requireHost(requestEvent);
		const form = await requestEvent.request.formData();

		// Typing the code is the confirmation. No dialog, so it also works without
		// JavaScript, and it cannot be triggered by a stray tap.
		if (normalizeCode(String(form.get('confirm') ?? '')) !== code) {
			return fail(400, { error: 'Pro smazání opiš kód akce přesně.' });
		}

		await deleteEvent(event.id);
		requestEvent.cookies.delete(`host_${code}`, { path: '/' });
		redirect(303, '/');
	}
};
