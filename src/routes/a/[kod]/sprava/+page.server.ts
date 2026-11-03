import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { normalizeCode } from '$lib/server/codes';
import { closeEvent, deleteEvent, kickParticipant, reopenEvent } from '$lib/server/commands';
import { requireHost, switchDrink } from '$lib/server/host';
import { listParticipants } from '$lib/server/queries';

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

	napoj: (requestEvent) => switchDrink(requestEvent, (code) => `/a/${code}/sprava`),

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
