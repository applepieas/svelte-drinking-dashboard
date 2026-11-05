import type { PageServerLoad } from './$types';
import { getEventByCode, getRecentEventEntries } from '$lib/server/queries';

export const load: PageServerLoad = async ({ parent }) => {
	const { event } = await parent();

	// The layout already proved this code resolves.
	const row = await getEventByCode(event.code);
	const entries = row ? await getRecentEventEntries(row.id) : [];

	// The same raw log the board gets. Both views reduce it themselves, so the
	// glass and the standings can never disagree about what was drunk.
	return { entries };
};
