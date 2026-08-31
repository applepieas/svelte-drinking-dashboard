import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, params }) => {
	const { event, me } = await parent();
	if (event.closedAt) redirect(303, `/a/${params.kod}`);
	if (!me) redirect(303, `/a/${params.kod}/pripojit`);
	// Returned again so the type is narrowed for the page: past this point
	// there is always a participant.
	return { me };
};
