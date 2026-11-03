import type { DrinkDef, DrinkKey } from './drinks';
import type { LogEntry } from './events';

export interface LeaderboardRow {
	nick: string;
	/** Ethanol drunk so far, in millilitres. The ranking is on this. */
	ethanolMl: number;
	/** How many drinks are behind that figure, shown as context. */
	drinks: number;
	/** Which drinks those were, oldest first, so the screen can show what was
	 *  drunk and not only how much. */
	mix: DrinkKey[];
}

export interface RecentEntry {
	seq: number;
	nick: string;
	drinkKey: DrinkKey | null;
	at: string;
}

/** One drink key across the whole event. */
export interface DrinkTotal {
	key: DrinkKey;
	count: number;
	ethanolMl: number;
}

/** How many drinks landed in one clock hour, for the pace strip. */
export interface PaceBucket {
	/** Hour of the day, 0-23, in the reader's own zone. */
	hour: number;
	drinks: number;
}

export interface EventView {
	leaderboard: LeaderboardRow[];
	recent: RecentEntry[];
	totalEthanolMl: number;
	/** Which drinks the room is actually choosing, busiest first. */
	byDrink: DrinkTotal[];
	/** The same ranking over the last hour only — who is going hardest now,
	 *  which is often somebody other than whoever leads overall. */
	lastHour: LeaderboardRow[];
	/** Drinks per clock hour from the first entry to the last. */
	pace: PaceBucket[];
	/** Minutes between the first and last drink, or 0 before anything happens. */
	elapsedMinutes: number;
}

/** Window for `lastHour`, measured back from the newest drink. */
const HOUR_MS = 60 * 60 * 1000;

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
	// A drink the event has stopped offering stops counting. Its rows stay in
	// the log, so switching it back on brings them back exactly as they were.
	const live = liveDrinks(entries).filter((item) => item.drinkKey && ethanol.has(item.drinkKey));

	const totals = new Map<string, LeaderboardRow>();
	for (const item of live) {
		const row = totals.get(item.nick) ?? { nick: item.nick, ethanolMl: 0, drinks: 0, mix: [] };
		row.ethanolMl += (item.drinkKey && ethanol.get(item.drinkKey)) || 0;
		row.drinks += 1;
		if (item.drinkKey) row.mix.push(item.drinkKey);
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

	// Everything below is read off the same `live` array, so no figure on the
	// screen can disagree with another.
	const byDrink: DrinkTotal[] = drinks
		.map((drink) => {
			const matching = live.filter((item) => item.drinkKey === drink.key);
			return {
				key: drink.key,
				count: matching.length,
				ethanolMl: matching.length * drink.ethanolMl
			};
		})
		.sort((a, b) => b.count - a.count || b.ethanolMl - a.ethanolMl);

	const times = live.map((item) => Date.parse(item.at)).filter(Number.isFinite);
	const newest = times.length ? Math.max(...times) : 0;
	const oldest = times.length ? Math.min(...times) : 0;

	const recentTotals = new Map<string, LeaderboardRow>();
	for (const item of live) {
		if (Date.parse(item.at) <= newest - HOUR_MS) continue;
		const row = recentTotals.get(item.nick) ?? {
			nick: item.nick,
			ethanolMl: 0,
			drinks: 0,
			mix: []
		};
		row.ethanolMl += (item.drinkKey && ethanol.get(item.drinkKey)) || 0;
		row.drinks += 1;
		if (item.drinkKey) row.mix.push(item.drinkKey);
		recentTotals.set(item.nick, row);
	}

	const lastHour = [...recentTotals.values()].sort(
		(a, b) => b.ethanolMl - a.ethanolMl || b.drinks - a.drinks || a.nick.localeCompare(b.nick, 'cs')
	);

	const pace: PaceBucket[] = [];
	if (times.length) {
		const start = new Date(oldest);
		start.setMinutes(0, 0, 0);
		for (let at = start.getTime(); at <= newest; at += HOUR_MS) {
			const until = at + HOUR_MS;
			pace.push({
				hour: new Date(at).getHours(),
				drinks: times.filter((time) => time >= at && time < until).length
			});
		}
	}

	return {
		leaderboard,
		recent,
		totalEthanolMl: leaderboard.reduce((sum, row) => sum + row.ethanolMl, 0),
		byDrink,
		lastHour,
		pace,
		elapsedMinutes: times.length ? Math.round((newest - oldest) / 60000) : 0
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
