import type { PageServerLoad } from './$types';
import { getEventByCode, getLeaderboard, getRecentEntries } from '$lib/server/queries';

export const load: PageServerLoad = async ({ parent }) => {
	const { event } = await parent();
	// The layout already proved this code resolves, so no 404 handling here.
	const row = await getEventByCode(event.code);
	if (!row) return { leaderboard: [], recent: [], totalEthanolMl: 0 };

	const [leaderboard, recent] = await Promise.all([
		getLeaderboard(row.id, row.drinks),
		getRecentEntries(row.id)
	]);

	return {
		leaderboard,
		recent,
		totalEthanolMl: leaderboard.reduce((sum, entry) => sum + entry.ethanolMl, 0)
	};
};
