import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad, RouteParams } from './$types';
import { isDrinkKey } from '$lib/drinks';
import { UNDO_WINDOW_SECONDS } from '$lib/entries';
import { normalizeCode } from '$lib/server/codes';
import { addDrink, undoDrink } from '$lib/server/commands';
import { isUniqueViolation } from '$lib/server/db/errors';
import { checkDrinkRate } from '$lib/server/ratelimit';
import {
	findActiveParticipant,
	findLastLiveDrink,
	getEventByCode,
	getParticipantDrinks
} from '$lib/server/queries';

/**
 * Actions cannot read load() data, so both they and load() resolve the event
 * and the participant through here. Typed structurally because a load event and
 * an action event are different shapes that share only what this needs.
 */
async function requireContext({ params, locals }: { params: RouteParams; locals: App.Locals }) {
	const code = normalizeCode(params.kod);
	if (!code) error(404, 'Akce nenalezena');

	const event = await getEventByCode(code);
	if (!event) error(404, 'Akce nenalezena');
	if (event.closedAt) redirect(303, `/a/${code}`);

	const me = locals.cookieId ? await findActiveParticipant(event.id, locals.cookieId) : undefined;
	if (!me) redirect(303, `/a/${code}/pripojit`);

	return { code, event, me };
}

function isUndoable(createdAt: Date): boolean {
	return Date.now() - createdAt.getTime() <= UNDO_WINDOW_SECONDS * 1000;
}

export const load: PageServerLoad = async (event) => {
	const { me } = await requireContext(event);

	// The phone's own drinks, which are also what the blood alcohol estimate is
	// computed from — in the browser, from a profile the server never receives.
	const myDrinks = await getParticipantDrinks(me.id);
	const last = myDrinks.at(-1) ?? null;
	const undoUntil = last ? new Date(last.at).getTime() + UNDO_WINDOW_SECONDS * 1000 : 0;

	return {
		// Returned again so the page type knows a participant always exists here.
		me: { nick: me.nick },
		myDrinks,
		// One token per render. A second POST carrying the same one is ignored by
		// the database, so a double tap or a back-button resubmit costs nothing.
		submissionId: crypto.randomUUID(),
		undoable:
			last && undoUntil > Date.now()
				? { seq: last.seq, drinkKey: last.drinkKey, until: new Date(undoUntil).toISOString() }
				: null
	};
};

export const actions: Actions = {
	zapsat: async (requestEvent) => {
		const form = await requestEvent.request.formData();
		const drinkKey = form.get('drink');
		const submissionId = String(form.get('submissionId') ?? '');

		if (!isDrinkKey(drinkKey) || !submissionId) {
			return fail(400, { error: 'Neplatné odeslání. Načti stránku znovu.' });
		}

		const { code, event, me } = await requireContext(requestEvent);

		// Validated against this event's snapshot, not the global DRINKS list.
		if (!event.drinks.some((drink) => drink.key === drinkKey)) {
			return fail(400, { error: 'Tenhle nápoj se na téhle akci nepije.' });
		}

		const rate = await checkDrinkRate(me.id);
		if (!rate.allowed) {
			return fail(429, { error: `Moment, tohle bylo rychle. Zkus to za ${rate.retryAfter} s.` });
		}

		await addDrink({ eventId: event.id, participantId: me.id, drinkKey, submissionId });
		redirect(303, `/a/${code}/zapis`);
	},

	vzitZpet: async (requestEvent) => {
		const form = await requestEvent.request.formData();
		const seq = Number(form.get('seq'));
		const submissionId = String(form.get('submissionId') ?? '');

		if (!Number.isInteger(seq) || !submissionId) {
			return fail(400, { error: 'Neplatné odeslání. Načti stránku znovu.' });
		}

		const { code, event, me } = await requireContext(requestEvent);

		// Re-read rather than trusting the seq from the form: it must still be
		// this participant's own most recent live drink.
		const last = await findLastLiveDrink(me.id);
		if (!last || last.seq !== seq) {
			return fail(409, { error: 'Tenhle zápis už vzít zpět nejde.' });
		}
		if (!isUndoable(last.createdAt)) {
			return fail(409, { error: `Vzít zpět jde jen do ${UNDO_WINDOW_SECONDS} sekund.` });
		}

		try {
			await undoDrink({ eventId: event.id, participantId: me.id, undoesSeq: seq, submissionId });
		} catch (err) {
			// entry_undo_uq: someone already undid it. Same end state as success.
			if (!isUniqueViolation(err, 'entry_undo_uq')) throw err;
		}

		redirect(303, `/a/${code}/zapis`);
	}
};
