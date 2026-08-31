import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { db } from '$lib/server/db';
import { event } from '$lib/server/db/schema';
import { DRINKS, isDrinkKey } from '$lib/drinks';
import { generateCode } from '$lib/server/codes';
import { hashToken, newHostToken } from '$lib/server/tokens';

const NAME_MIN = 2;
const NAME_MAX = 60;
const RETENTION_SECONDS = 30 * 24 * 60 * 60;
const CODE_ATTEMPTS = 5;

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		// Never trust form data, even from a form we wrote ourselves.
		const keys = [...new Set(form.getAll('drinks').filter(isDrinkKey))];

		if (name.length < NAME_MIN || name.length > NAME_MAX) {
			return fail(400, {
				name,
				keys,
				error: `Název akce musí mít ${NAME_MIN} až ${NAME_MAX} znaků.`
			});
		}
		if (keys.length === 0) {
			return fail(400, { name, keys, error: 'Vyber aspoň jeden typ nápoje.' });
		}

		const hostToken = newHostToken();
		const hostTokenHash = await hashToken(hostToken);
		const expiresAt = new Date(Date.now() + RETENTION_SECONDS * 1000);

		// Codes are random, so collisions are rare but possible. onConflictDoNothing
		// returns no row when the code was taken, which is the signal to try again.
		let code: string | null = null;
		for (let attempt = 0; attempt < CODE_ATTEMPTS && !code; attempt++) {
			const [row] = await db
				.insert(event)
				.values({
					code: generateCode(),
					name,
					hostTokenHash,
					// Snapshot the drinks, so changing DRINKS later cannot rewrite history.
					drinks: keys.map((key) => DRINKS[key]),
					expiresAt
				})
				.onConflictDoNothing({ target: event.code })
				.returning({ code: event.code });
			code = row?.code ?? null;
		}

		if (!code) {
			return fail(500, { name, keys, error: 'Akci se nepodařilo založit. Zkus to prosím znovu.' });
		}

		// Plain token to the browser, digest to the database — never the other way round.
		// Keyed by code so one browser can host several events at once.
		cookies.set(`host_${code}`, hostToken, { path: '/', maxAge: RETENTION_SECONDS });

		// Must stay outside any try/catch: redirect works by throwing.
		redirect(303, `/a/${code}`);
	}
};
