export type Sex = 'male' | 'female';

export interface BacProfile {
	weightKg: number;
	sex: Sex;
}

export interface ConsumedDrink {
	/** When it was logged, epoch milliseconds. */
	atMs: number;
	ethanolMl: number;
}

/** Grams of ethanol per millilitre. */
const ETHANOL_DENSITY = 0.789;

/**
 * Widmark's distribution factor — the share of body mass that behaves like water
 * for alcohol. These are population averages, which is one of several reasons
 * the result is an estimate and not a measurement.
 */
const R_BY_SEX: Record<Sex, number> = { male: 0.68, female: 0.55 };

/** Grams per litre cleared per hour. Real people fall roughly in 0.10–0.20. */
export const ELIMINATION_PER_HOUR = 0.15;

/**
 * Roughly when a drink is 95% absorbed. Textbook Widmark treats absorption as
 * instant, and that is exactly what makes a naive implementation snap upwards
 * the moment somebody taps a button — which is not how drinking works.
 */
const ABSORPTION_95_MINUTES = 60;
const ABSORPTION_K = 3 / ABSORPTION_95_MINUTES;

/** Past this, a drink's remaining contribution is far below display precision. */
const WINDOW_HOURS = 24;

const STEP_MINUTES = 1;
const STEP_MS = STEP_MINUTES * 60_000;

export const MIN_WEIGHT_KG = 30;
export const MAX_WEIGHT_KG = 250;

export function isValidProfile(profile: Partial<BacProfile> | null): profile is BacProfile {
	if (!profile) return false;
	const { weightKg, sex } = profile;
	if (sex !== 'male' && sex !== 'female') return false;
	return (
		typeof weightKg === 'number' &&
		Number.isFinite(weightKg) &&
		weightKg >= MIN_WEIGHT_KG &&
		weightKg <= MAX_WEIGHT_KG
	);
}

/**
 * Estimated blood alcohol in g/l (promile).
 *
 * Integrated minute by minute rather than evaluated as a single formula, which
 * buys three behaviours that matter:
 *
 *  - alcohol arrives gradually, so logging a drink makes the figure climb rather
 *    than jump;
 *  - the floor at zero sits *inside* the loop, so elimination stops when sober
 *    instead of running up a negative debt that would silently swallow the next
 *    drink;
 *  - because of that floor, a drink taken after a long dry spell starts from
 *    zero, not from some phantom leftover.
 *
 * Pure by design: the clock is an argument, never read inside. That is what
 * makes it testable.
 */
export function estimateBac(drinks: ConsumedDrink[], profile: BacProfile, nowMs: number): number {
	if (!isValidProfile(profile)) return 0;

	const relevant = drinks
		.filter((drink) => drink.ethanolMl > 0 && nowMs - drink.atMs < WINDOW_HOURS * 3_600_000)
		.sort((a, b) => a.atMs - b.atMs);
	if (relevant.length === 0) return 0;

	const start = relevant[0].atMs;
	if (nowMs <= start) return 0;

	// Litres of body water the alcohol spreads through.
	const distribution = R_BY_SEX[profile.sex] * profile.weightKg;
	const absorbed = new Array<number>(relevant.length).fill(0);
	let bac = 0;

	for (let stepStart = start; stepStart < nowMs; stepStart += STEP_MS) {
		const stepEnd = Math.min(stepStart + STEP_MS, nowMs);
		let gramsThisStep = 0;

		for (let i = 0; i < relevant.length; i++) {
			if (absorbed[i] >= 0.999) continue;
			const minutesSince = (stepEnd - relevant[i].atMs) / 60_000;
			if (minutesSince <= 0) continue;

			const fraction = 1 - Math.exp(-ABSORPTION_K * minutesSince);
			gramsThisStep += (fraction - absorbed[i]) * relevant[i].ethanolMl * ETHANOL_DENSITY;
			absorbed[i] = fraction;
		}

		bac += gramsThisStep / distribution;
		// Clamped every step, not once at the end.
		bac = Math.max(0, bac - ELIMINATION_PER_HOUR * ((stepEnd - stepStart) / 3_600_000));
	}

	return bac;
}

/** Hours until the estimate reaches zero, assuming nothing more is drunk. */
export function hoursToSober(bac: number): number {
	return bac <= 0 ? 0 : bac / ELIMINATION_PER_HOUR;
}
