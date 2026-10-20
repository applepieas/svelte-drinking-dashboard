import type { GlassKey } from './sprites';

/** Per-glass adjustments on top of what `LANDING_PANELS` already says. */
export interface Tune {
	/** Multiplies the glass's own scale. */
	size: number;
	/** Nudge across, in comp pixels. */
	dx: number;
	/** Nudge along, in comp pixels. */
	dy: number;
}

export type TuneSet = Record<'columns' | 'bands', Record<GlassKey, Tune>>;

const flat = (): Record<GlassKey, Tune> => ({
	beer: { size: 1, dx: 0, dy: 0 },
	wine: { size: 1, dx: 0, dy: 0 },
	shot: { size: 1, dx: 0, dy: 0 },
	soft: { size: 1, dx: 0, dy: 0 },
	mixed: { size: 1, dx: 0, dy: 0 }
});

/**
 * Wide screens need no adjustment: the sizes in `LANDING_PANELS` were set
 * against a column. A band is short and wide, so the two biggest glasses come
 * down a little and the two narrow ones go up, and the mug lifts so its foam
 * clears the top of the screen.
 *
 * The sideways nudges are not guesses. Only the top of a glass shows in a band,
 * and leaning it 25 degrees swings that part to the left, by a different amount
 * for each glass because each one carries its weight somewhere else. These were
 * measured off the rendered page: the visible slice of every glass was found and
 * its middle compared with the middle of the screen.
 */
export const DEFAULT_TUNE = (): TuneSet => ({
	columns: flat(),
	bands: {
		beer: { size: 0.88, dx: 15, dy: -14 },
		wine: { size: 1.04, dx: 46, dy: 0 },
		shot: { size: 1, dx: 93, dy: 0 },
		soft: { size: 1.04, dx: 53, dy: 0 },
		mixed: { size: 0.9, dx: 65, dy: 0 }
	}
});
