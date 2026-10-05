import { GLASSES, type GlassKey, type Sprite } from './sprites';

/**
 * Turn a sprite into inline SVG. Runs of one colour within a row become a single
 * rect, which keeps the markup to a few hundred elements per glass.
 *
 * Each rect is drawn a hair wider and taller than it is. Without that overlap the
 * neighbouring rectangles leave hairline seams once the artwork is scaled by a
 * fraction and rotated, and the seams read as a grid over the pixel art.
 */
const BLEED = 0.06;

export function glassSvg(sprite: Sprite, title: string): string {
	const parts: string[] = [
		`<svg viewBox="0 0 ${sprite.w} ${sprite.h}" xmlns="http://www.w3.org/2000/svg" role="img">`,
		`<title>${title}</title>`
	];
	for (let y = 0; y < sprite.h; y++) {
		const row = sprite.rows[y];
		let x = 0;
		while (x < sprite.w) {
			const value = row[x];
			if (value < 0) {
				x++;
				continue;
			}
			let run = 1;
			while (x + run < sprite.w && row[x + run] === value) run++;
			parts.push(
				`<rect x="${x}" y="${y}" width="${(run + BLEED).toFixed(2)}" ` +
					`height="${(1 + BLEED).toFixed(2)}" fill="${sprite.palette[value]}"/>`
			);
			x += run;
		}
	}
	parts.push('</svg>');
	return parts.join('');
}

export interface LandingPanel {
	key: GlassKey;
	/** Not rendered yet — it names the panel for assistive tech. */
	label: string;
	/** The ground the glass stands against, chosen to contrast with the drink. */
	ground: string;
	sprite: Sprite;
	/** Screen pixels per sprite pixel. Each glass gets its own, so a 4cl snifter
	 *  and a half-litre mug end up roughly the same object on screen. */
	px: number;
	tiltDeg: number;
	shiftX: number;
	shiftY: number;
}

/**
 * The five panels of the landing page. Each panel clips its own glass, so what
 * spills to the right disappears under the next panel's ground.
 *
 * `mixed` has no data behind it yet: the app tracks four drinks, and the fifth
 * panel exists for the composition until a fifth drink is added.
 */
export const LANDING_PANELS: LandingPanel[] = [
	{
		key: 'beer',
		label: 'Pivo',
		ground: '#2541B2',
		sprite: GLASSES.beer,
		px: 15,
		tiltDeg: -25,
		shiftX: 82,
		shiftY: 10
	},
	{
		key: 'wine',
		label: 'Víno',
		ground: '#FF6B35',
		sprite: GLASSES.wine,
		px: 19,
		tiltDeg: -25,
		shiftX: 56,
		shiftY: 8
	},
	{
		key: 'shot',
		label: 'Panák',
		ground: '#3BBA9C',
		sprite: GLASSES.shot,
		px: 19,
		tiltDeg: -25,
		shiftX: 56,
		shiftY: -52
	},
	{
		key: 'soft',
		label: 'Nealko',
		ground: '#FFC60B',
		sprite: GLASSES.soft,
		px: 18,
		tiltDeg: -25,
		shiftX: 56,
		shiftY: 0
	},
	{
		key: 'mixed',
		label: 'Míchaný',
		ground: '#6A4C93',
		sprite: GLASSES.mixed,
		px: 17,
		tiltDeg: -25,
		shiftX: 88,
		shiftY: 6
	}
];
