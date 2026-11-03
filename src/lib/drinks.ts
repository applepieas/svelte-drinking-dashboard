export type DrinkKey = 'beer' | 'wine' | 'shot' | 'liqueur' | 'mixed' | 'soft';

export interface DrinkDef {
	key: DrinkKey;
	label: string;
	volumeMl: number;
	ethanolMl: number;
	color: string;
}

/**
 * Ethanol is the volume times the strength, worked out once here rather than at
 * every reading: a half-litre at 4.4 %, two deci of wine at 12 %, a shot at 40 %.
 *
 * Two shots, because parties pour two: something hard, and something sweeter
 * that goes down easier and is half the strength. Counting them as one drink
 * made the second kind look twice as costly as it is.
 */
export const DRINKS: Record<DrinkKey, DrinkDef> = {
	beer: { key: 'beer', label: 'Pivo', volumeMl: 500, ethanolMl: 22, color: '#F2B33D' },
	wine: { key: 'wine', label: 'Víno', volumeMl: 200, ethanolMl: 24, color: '#D2607F' },
	shot: { key: 'shot', label: 'Tvrdý 40 %', volumeMl: 40, ethanolMl: 16, color: '#8C7BF0' },
	liqueur: {
		key: 'liqueur',
		// A non-breaking space, so the sign stays with its number and the label
		// never wraps onto two lines inside a tile.
		label: 'Slabší 20 %',
		volumeMl: 40,
		ethanolMl: 8,
		color: '#3BBA9C'
	},
	mixed: { key: 'mixed', label: 'Míchaný', volumeMl: 250, ethanolMl: 16, color: '#FF6B35' },
	soft: { key: 'soft', label: 'Nealko', volumeMl: 300, ethanolMl: 0, color: '#45C6E0' }
};

export const isDrinkKey = (v: unknown): v is DrinkKey => typeof v === 'string' && v in DRINKS;

/**
 * Left unticked on a new event. A drinks board where the water counts as a
 * round reads as padding, so the host has to ask for it - on the board's hidden
 * dial or on the management page.
 */
export const OFF_BY_DEFAULT: DrinkKey[] = ['soft'];

/**
 * An event's drinks with one switched on or off.
 *
 * The drinks that stay keep the event's own snapshot, so switching something
 * else does not quietly move them to today's definitions. One that comes back
 * takes today's, because there is no other to take. Order follows `DRINKS`, so
 * the phone's buttons do not shuffle every time.
 */
export function withDrink(current: DrinkDef[], key: DrinkKey, on: boolean): DrinkDef[] {
	const kept = new Map(current.map((drink) => [drink.key, drink]));
	if (on && !kept.has(key)) kept.set(key, DRINKS[key]);
	if (!on) kept.delete(key);
	return (Object.keys(DRINKS) as DrinkKey[]).flatMap((k) => kept.get(k) ?? []);
}
