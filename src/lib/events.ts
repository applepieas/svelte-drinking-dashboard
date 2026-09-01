import type { DrinkKey } from './drinks';

/**
 * One row of the append-only log as it travels to the browser.
 *
 * Ethanol is deliberately absent: it lives on the event's `drinks` snapshot,
 * which the page already has. Sending it per entry would be a second copy of the
 * same fact and the two could drift.
 */
export interface LogEntry {
	seq: number;
	nick: string;
	kind: 'drink' | 'undo';
	drinkKey: DrinkKey | null;
	undoesSeq: number | null;
	/** ISO 8601, so the wire format and the load payload are the same shape. */
	at: string;
	/** Whether the author was kicked, as of when this row was read. */
	kicked: boolean;
}

/**
 * `entry` appends to what the screen already has. `state` means something the
 * log cannot express changed — the event closed, or somebody was kicked — and
 * the page should refetch rather than try to patch itself.
 */
export type StreamMessage = { type: 'entry'; entry: LogEntry } | { type: 'state' };
