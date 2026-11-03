import { describe, expect, it } from 'vitest';
import type { DrinkDef } from './drinks';
import type { LogEntry } from './events';
import { liveDrinks, mergeBySeq, reduceLog } from './leaderboard';

const DRINKS: DrinkDef[] = [
	{ key: 'beer', label: 'Pivo', volumeMl: 500, ethanolMl: 22, color: '#000' },
	{ key: 'shot', label: 'Panák', volumeMl: 40, ethanolMl: 16, color: '#000' },
	{ key: 'soft', label: 'Nealko', volumeMl: 300, ethanolMl: 0, color: '#000' }
];

let seq = 0;
const drink = (nick: string, key: DrinkDef['key'], extra: Partial<LogEntry> = {}): LogEntry => ({
	seq: ++seq,
	nick,
	kind: 'drink',
	drinkKey: key,
	undoesSeq: null,
	at: new Date(Date.UTC(2026, 0, 1, 20, seq)).toISOString(),
	kicked: false,
	...extra
});

const undo = (nick: string, undoesSeq: number): LogEntry => ({
	seq: ++seq,
	nick,
	kind: 'undo',
	drinkKey: null,
	undoesSeq,
	at: new Date(Date.UTC(2026, 0, 1, 20, seq)).toISOString(),
	kicked: false
});

describe('liveDrinks', () => {
	it('drops a drink that has been taken back', () => {
		const beer = drink('petr', 'beer');
		expect(liveDrinks([beer, undo('petr', beer.seq)])).toEqual([]);
	});

	it('drops everything by someone who was kicked', () => {
		expect(liveDrinks([drink('petr', 'beer', { kicked: true })])).toEqual([]);
	});

	it('never counts the undo row itself as a drink', () => {
		const beer = drink('petr', 'beer');
		const entries = [beer, undo('petr', beer.seq), drink('petr', 'shot')];
		expect(liveDrinks(entries).map((item) => item.drinkKey)).toEqual(['shot']);
	});
});

describe('reduceLog', () => {
	it('is empty for an empty log', () => {
		expect(reduceLog([], DRINKS)).toEqual({
			leaderboard: [],
			recent: [],
			totalEthanolMl: 0,
			// Every drink the event offers is still listed, at zero.
			byDrink: DRINKS.map((d) => ({ key: d.key, count: 0, ethanolMl: 0 })),
			lastHour: [],
			pace: [],
			elapsedMinutes: 0
		});
	});

	// The reason the ranking is ethanol and not a tally.
	it('ranks by ethanol, so fewer stronger drinks can win', () => {
		const entries = [
			drink('hodne', 'soft'),
			drink('hodne', 'soft'),
			drink('hodne', 'soft'),
			drink('hodne', 'beer'),
			drink('panaky', 'shot'),
			drink('panaky', 'shot')
		];

		const { leaderboard } = reduceLog(entries, DRINKS);
		expect(leaderboard.map((row) => row.nick)).toEqual(['panaky', 'hodne']);
		expect(leaderboard[0]).toMatchObject({ ethanolMl: 32, drinks: 2 });
		expect(leaderboard[1]).toMatchObject({ ethanolMl: 22, drinks: 4 });
	});

	it('counts an alcohol-free drink without scoring it', () => {
		const { leaderboard } = reduceLog([drink('petr', 'soft')], DRINKS);
		expect(leaderboard[0]).toMatchObject({ ethanolMl: 0, drinks: 1 });
	});

	it('breaks a tie by nick so the order never flickers', () => {
		const entries = [drink('zuzka', 'beer'), drink('adam', 'beer')];
		expect(reduceLog(entries, DRINKS).leaderboard.map((row) => row.nick)).toEqual([
			'adam',
			'zuzka'
		]);
	});

	it('totals only what is still standing', () => {
		const beer = drink('petr', 'beer');
		const view = reduceLog([beer, drink('petr', 'shot'), undo('petr', beer.seq)], DRINKS);
		expect(view.totalEthanolMl).toBe(16);
	});

	it('scores a drink the event does not define as zero rather than crashing', () => {
		const view = reduceLog([drink('petr', 'beer')], [DRINKS[2]]);
		expect(view.leaderboard[0]).toMatchObject({ ethanolMl: 0, drinks: 1 });
	});

	it('lists recent entries newest first and honours the limit', () => {
		const entries = [drink('a', 'beer'), drink('b', 'beer'), drink('c', 'beer')];
		const view = reduceLog(entries, DRINKS, 2);
		expect(view.recent.map((item) => item.nick)).toEqual(['c', 'b']);
	});

	it('keeps taken-back drinks out of the recent list too', () => {
		const beer = drink('petr', 'beer');
		const view = reduceLog([beer, undo('petr', beer.seq)], DRINKS);
		expect(view.recent).toEqual([]);
	});
});

describe('mergeBySeq', () => {
	it('keeps one copy when the snapshot and the stream overlap', () => {
		const shared = drink('petr', 'beer');
		expect(mergeBySeq([shared], [shared]).length).toBe(1);
	});

	it('returns everything in sequence order regardless of arrival order', () => {
		const first = drink('petr', 'beer');
		const second = drink('petr', 'shot');
		expect(mergeBySeq([second], [first]).map((item) => item.seq)).toEqual([first.seq, second.seq]);
	});
});

describe('reduceLog: co se pilo', () => {
	it('counts every drink key the event offers, busiest first', () => {
		const view = reduceLog([drink('a', 'shot'), drink('b', 'shot'), drink('a', 'beer')], DRINKS);
		expect(view.byDrink.map((d) => [d.key, d.count, d.ethanolMl])).toEqual([
			['shot', 2, 32],
			['beer', 1, 22],
			['soft', 0, 0]
		]);
	});

	it('leaves out drinks that were taken back', () => {
		const taken = drink('a', 'beer');
		const view = reduceLog([taken, drink('a', 'beer'), undo('a', taken.seq)], DRINKS);
		expect(view.byDrink.find((d) => d.key === 'beer')).toEqual({
			key: 'beer',
			count: 1,
			ethanolMl: 22
		});
	});
});

describe('reduceLog: posledni hodina', () => {
	const at = (hour: number, minute: number) =>
		new Date(Date.UTC(2026, 0, 1, hour, minute)).toISOString();

	it('counts only the hour before the newest drink, not the clock hour', () => {
		const view = reduceLog(
			[
				drink('stary', 'beer', { at: at(20, 0) }),
				drink('cerstvy', 'shot', { at: at(21, 30) }),
				drink('cerstvy', 'shot', { at: at(21, 50) })
			],
			DRINKS
		);
		expect(view.lastHour.map((r) => r.nick)).toEqual(['cerstvy']);
		expect(view.lastHour[0]).toMatchObject({ drinks: 2, ethanolMl: 32 });
	});

	it('can put somebody other than the overall leader on top', () => {
		const view = reduceLog(
			[
				drink('vede', 'beer', { at: at(18, 0) }),
				drink('vede', 'beer', { at: at(18, 5) }),
				drink('vede', 'beer', { at: at(18, 10) }),
				drink('dotahuje', 'beer', { at: at(21, 40) })
			],
			DRINKS
		);
		expect(view.leaderboard[0].nick).toBe('vede');
		expect(view.lastHour[0].nick).toBe('dotahuje');
	});
});

describe('reduceLog: tempo', () => {
	const at = (hour: number, minute: number) =>
		new Date(Date.UTC(2026, 0, 1, hour, minute)).toISOString();

	it('gives one bucket per clock hour from the first drink to the last', () => {
		const view = reduceLog(
			[
				drink('a', 'beer', { at: at(19, 50) }),
				drink('a', 'beer', { at: at(20, 10) }),
				drink('a', 'beer', { at: at(20, 40) }),
				drink('a', 'beer', { at: at(21, 5) })
			],
			DRINKS
		);
		expect(view.pace.map((p) => p.drinks)).toEqual([1, 2, 1]);
		expect(view.elapsedMinutes).toBe(75);
	});

	it('stays empty before anybody drinks anything', () => {
		const view = reduceLog([], DRINKS);
		expect(view.pace).toEqual([]);
		expect(view.elapsedMinutes).toBe(0);
		expect(view.lastHour).toEqual([]);
	});
});
