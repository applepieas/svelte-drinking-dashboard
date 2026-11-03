import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { isDrinkKey, withDrink } from '$lib/drinks';
import { normalizeCode } from './codes';
import { closeEvent, deleteEvent, kickParticipant, reopenEvent, setEventDrinks } from './commands';
import { getEventByCode } from './queries';
import { hashToken } from './tokens';

/**
 * Everything that changes an event needs the host token. 403 rather than 404:
 * the event page is public anyway, so pretending it does not exist would only
 * confuse the host.
 */
export async function requireHost({
	params,
	cookies
}: {
	params: { kod: string };
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

type HostRequest = RequestEvent<{ kod: string }>;

/**
 * Every host action, once.
 *
 * The host reaches them through two doors: the settings panel on the board,
 * which is where the event was created and where the host already is, and the
 * management page, which is the same thing as plain forms for a browser with
 * JavaScript off. Both get these and differ only in where they land afterwards.
 */
export function hostActions(back: (code: string) => string) {
	return {
		ukoncit: async (requestEvent: HostRequest) => {
			const { code, event } = await requireHost(requestEvent);
			await closeEvent(event.id);
			redirect(303, back(code));
		},

		otevrit: async (requestEvent: HostRequest) => {
			const { code, event } = await requireHost(requestEvent);
			await reopenEvent(event.id);
			redirect(303, back(code));
		},

		napoj: async (requestEvent: HostRequest) => {
			const { code, event } = await requireHost(requestEvent);
			const form = await requestEvent.request.formData();
			const key = form.get('drink');
			if (!isDrinkKey(key)) error(400, 'Neznámý nápoj.');

			const next = withDrink(event.drinks, key, form.get('on') === '1');
			// The last drink cannot go: a phone with no buttons is a broken page.
			if (next.length > 0) await setEventDrinks(event.id, next);

			redirect(303, back(code));
		},

		vykopnout: async (requestEvent: HostRequest) => {
			const { code, event } = await requireHost(requestEvent);
			const form = await requestEvent.request.formData();
			const participantId = String(form.get('participantId') ?? '');
			if (!participantId) return fail(400, { error: 'Chybí hráč.' });

			// Scoped to this event, so a stolen id from elsewhere does nothing.
			const [kicked] = await kickParticipant(event.id, participantId);
			if (!kicked) return fail(409, { error: 'Tenhle hráč už ve hře není.' });

			redirect(303, back(code));
		},

		smazat: async (requestEvent: HostRequest) => {
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
}
