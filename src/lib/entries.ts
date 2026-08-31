/**
 * How long a drink stays undoable. Long enough to catch a mis-tap, short enough
 * that nobody prunes their history at the end of the night.
 */
export const UNDO_WINDOW_SECONDS = 30;

export interface LeaderboardRow {
	nick: string;
	/** Ethanol drunk so far, in millilitres. This is what the ranking is on. */
	ethanolMl: number;
	/** Number of drinks behind that figure, shown as context. */
	drinks: number;
}
