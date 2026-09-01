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
		expect(reduceLog([], DRINKS)).toEqual({ leaderboard: [], recent: [], totalEthanolMl: 0 });
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
