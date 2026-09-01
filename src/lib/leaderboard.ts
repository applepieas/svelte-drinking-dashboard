import type { DrinkDef, DrinkKey } from './drinks';
import type { LogEntry } from './events';

export interface LeaderboardRow {
	nick: string;
	/** Ethanol drunk so far, in millilitres. The ranking is on this. */
	ethanolMl: number;
	/** How many drinks are behind that figure, shown as context. */
	drinks: number;
}

export interface RecentEntry {
	seq: number;
	nick: string;
	drinkKey: DrinkKey | null;
	at: string;
}

export interface EventView {
	leaderboard: LeaderboardRow[];
	recent: RecentEntry[];
	totalEthanolMl: number;
}

/** Millilitres of ethanol per drink key, taken from this event's own snapshot. */
export function ethanolByKey(drinks: DrinkDef[]): Map<DrinkKey, number> {
	return new Map(drinks.map((drink) => [drink.key, drink.ethanolMl]));
}

/**
 * Drinks that are still standing: not taken back, and not by someone who has
 * been kicked.
 */
export function liveDrinks(entries: LogEntry[]): LogEntry[] {
	const undone = new Set<number>();
	for (const item of entries) {
		if (item.kind === 'undo' && item.undoesSeq !== null) undone.add(item.undoesSeq);
	}
	return entries.filter((item) => item.kind === 'drink' && !item.kicked && !undone.has(item.seq));
}

/**
 * Turns the raw log into everything the screen shows.
 *
 * This runs on the server during SSR and again in the browser as events stream
 * in, which is the point: one implementation, so a live screen and a reloaded
 * one can never disagree.
 */
export function reduceLog(entries: LogEntry[], drinks: DrinkDef[], recentLimit = 10): EventView {
	const ethanol = ethanolByKey(drinks);
	const live = liveDrinks(entries);

	const totals = new Map<string, LeaderboardRow>();
	for (const item of live) {
		const row = totals.get(item.nick) ?? { nick: item.nick, ethanolMl: 0, drinks: 0 };
		row.ethanolMl += (item.drinkKey && ethanol.get(item.drinkKey)) || 0;
		row.drinks += 1;
		totals.set(item.nick, row);
	}

	const leaderboard = [...totals.values()].sort(
		(a, b) => b.ethanolMl - a.ethanolMl || a.nick.localeCompare(b.nick, 'cs')
	);

	const recent = live
		.slice()
		.sort((a, b) => b.seq - a.seq)
		.slice(0, recentLimit)
		.map(({ seq, nick, drinkKey, at }) => ({ seq, nick, drinkKey, at }));

	return {
		leaderboard,
		recent,
		totalEthanolMl: leaderboard.reduce((sum, row) => sum + row.ethanolMl, 0)
	};
}

/**
 * Combines the server snapshot with rows that arrived over the stream. Both can
 * legitimately contain the same row, so `seq` decides identity.
 */
export function mergeBySeq(...groups: LogEntry[][]): LogEntry[] {
	const bySeq = new Map<number, LogEntry>();
	for (const group of groups) {
		for (const item of group) bySeq.set(item.seq, item);
	}
	return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}
