import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { normalizeCode } from '$lib/server/codes';

export const actions: Actions = {
	pripojit: async ({ request }) => {
		const form = await request.formData();
		const code = normalizeCode(String(form.get('code') ?? ''));
		if (!code) {
			return fail(400, { error: 'Kód má šest znaků. Zkontroluj, co jsi opsal.' });
		}
		redirect(303, `/a/${code}`);
	}
};
