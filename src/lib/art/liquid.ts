import type { DrinkKey } from '$lib/drinks';

/**
 * A pixel liquid in a glass, as a cellular automaton.
 *
 * Every cell holds one drink or nothing. Each step a cell tries to fall; if what
 * is under it is lighter it sinks through, which is the same rule seen from the
 * other side as the lighter one rising. Freshly poured cells carry momentum and
 * ignore that rule for a moment, so a light drink punches down into the glass
 * before floating back up — the way water does when poured into oil.
 *
 * No DOM here on purpose: the rules are the interesting part and they are worth
 * being able to test without a canvas.
 */

/**
 * Relative densities, which is the whole of the layering.
 *
 * Not on `DrinkDef`, because this is how a drink looks in one visualisation and
 * not something the event, the log or the standings have any opinion about.
 * Sugar sinks and alcohol floats, so the order runs soft, beer, wine, shot.
 */
const DENSITY: Record<DrinkKey, number> = {
	soft: 1.05,
	beer: 1.01,
	wine: 0.99,
	shot: 0.93
};

/** Cell is empty. Anything else is an index into `keys`, plus one. */
const EMPTY = 0;

export interface LiquidOptions {
	width?: number;
	height?: number;
	/** Per cent chance a settled cell swaps sideways, so layers are not ruled lines. */
	mixing?: number;
	/** Deterministic source for tests; defaults to Math.random. */
	random?: () => number;
}

export class Liquid {
	readonly width: number;
	readonly height: number;
	/** 1 where the glass has an inside, 0 where it has walls or air. */
	readonly mask: Uint8Array;
	readonly capacity: number;
	/** What is in each cell. Read by the renderer, written only here. */
	readonly grid: Uint8Array;

	private readonly keys: DrinkKey[];
	private readonly push: Uint8Array;
	private readonly order: Int32Array;
	private readonly mixing: number;
	private readonly random: () => number;
	private queue: { key: DrinkKey; left: number }[] = [];

	constructor(keys: DrinkKey[], options: LiquidOptions = {}) {
		this.keys = keys;
		this.width = options.width ?? 60;
		this.height = options.height ?? 104;
		this.mixing = options.mixing ?? 6;
		this.random = options.random ?? Math.random;

		const cells = this.width * this.height;
		this.mask = new Uint8Array(cells);
		this.grid = new Uint8Array(cells);
		this.push = new Uint8Array(cells);
		this.order = new Int32Array(this.width);
		for (let i = 0; i < this.width; i++) this.order[i] = i;

		let capacity = 0;
		for (let y = 0; y < this.height; y++) {
			for (let x = 0; x < this.width; x++) {
				if (this.inside(x, y)) {
					this.mask[y * this.width + x] = 1;
					capacity++;
				}
			}
		}
		this.capacity = capacity;
	}

	/** A pint: a touch narrower at the foot, with the corners taken off. */
	private inside(x: number, y: number): boolean {
		const t = y / (this.height - 1);
		const half = (this.width / 2) * (1 - 0.13 * t);
		const dx = Math.abs(x + 0.5 - this.width / 2);
		if (dx > half) return false;

		const corner = 7;
		if (y > this.height - 1 - corner) {
			const over = y - (this.height - 1 - corner);
			const cut = corner - Math.sqrt(Math.max(0, corner * corner - over * over));
			if (dx > half - cut) return false;
		}
		return true;
	}

	private code(key: DrinkKey): number {
		return this.keys.indexOf(key) + 1;
	}

	private densityAt(cell: number): number {
		return DENSITY[this.keys[cell - 1]] ?? 1;
	}

	private solid(x: number, y: number): boolean {
		return (
			x < 0 || y < 0 || x >= this.width || y >= this.height || this.mask[y * this.width + x] === 0
		);
	}

	private swap(a: number, b: number): void {
		const cell = this.grid[a];
		this.grid[a] = this.grid[b];
		this.grid[b] = cell;
		const momentum = this.push[a];
		this.push[a] = this.push[b];
		this.push[b] = momentum;
	}

	private shuffleOrder(): void {
		for (let i = this.order.length - 1; i > 0; i--) {
			const j = (this.random() * (i + 1)) | 0;
			const t = this.order[i];
			this.order[i] = this.order[j];
			this.order[j] = t;
		}
	}

	/** Queues a drink. Nothing appears until `tick` runs. */
	pour(key: DrinkKey, cells: number): void {
		if (cells > 0 && this.keys.includes(key)) this.queue.push({ key, left: Math.round(cells) });
	}

	/** Un-pours, for a drink taken back. Takes from the top, where it would be. */
	drain(key: DrinkKey, cells: number): number {
		const code = this.code(key);
		if (code === 0) return 0;

		// Anything still waiting to be poured goes first: it never arrived.
		let left = Math.round(cells);
		for (const pending of this.queue) {
			if (left <= 0) break;
			if (pending.key !== key) continue;
			const taken = Math.min(pending.left, left);
			pending.left -= taken;
			left -= taken;
		}
		this.queue = this.queue.filter((pending) => pending.left > 0);

		let removed = cells - left;
		for (let i = 0; i < this.grid.length && left > 0; i++) {
			if (this.grid[i] !== code) continue;
			this.grid[i] = EMPTY;
			this.push[i] = 0;
			left--;
			removed++;
		}
		return removed;
	}

	/** Throws away a share of everything, keeping the mix, to make room. */
	thin(keep: number): void {
		for (let i = 0; i < this.grid.length; i++) {
			if (this.grid[i] !== EMPTY && this.random() > keep) {
				this.grid[i] = EMPTY;
				this.push[i] = 0;
			}
		}
		for (const pending of this.queue) pending.left = Math.round(pending.left * keep);
		this.queue = this.queue.filter((pending) => pending.left > 0);
	}

	empty(): void {
		this.grid.fill(EMPTY);
		this.push.fill(0);
		this.queue = [];
	}

	get pending(): number {
		return this.queue.reduce((sum, item) => sum + item.left, 0);
	}

	/** Drops the next few cells of whatever is being poured in at the mouth. */
	private feed(): void {
		const next = this.queue[0];
		if (!next) return;

		const cell = this.code(next.key);
		const mouth = 5;
		for (let n = 0; n < 6 && next.left > 0; n++) {
			const x = ((this.width - mouth) >> 1) + ((this.random() * mouth) | 0);
			for (let y = 0; y < 6; y++) {
				const i = y * this.width + x;
				if (this.mask[i] && this.grid[i] === EMPTY) {
					this.grid[i] = cell;
					// Enough momentum to reach the bottom of whatever is in there.
					this.push[i] = 90;
					next.left--;
					break;
				}
			}
		}
		if (next.left <= 0) this.queue.shift();
	}

	private settleOnce(): void {
		const w = this.width;
		for (let y = this.height - 2; y >= 0; y--) {
			this.shuffleOrder();
			for (let oi = 0; oi < w; oi++) {
				const x = this.order[oi];
				const i = y * w + x;
				const cell = this.grid[i];
				if (cell === EMPTY) continue;
				const mine = this.densityAt(cell);

				/** Can this cell move into that one: empty, or lighter than itself. */
				const yields = (nx: number, ny: number): boolean => {
					if (this.solid(nx, ny)) return false;
					const target = this.grid[ny * w + nx];
					return target === EMPTY || this.densityAt(target) < mine - 0.001;
				};

				const under = this.solid(x, y + 1) ? -1 : this.grid[i + w];

				if (under === EMPTY) {
					this.swap(i, i + w);
					continue;
				}

				if (under > 0) {
					// Momentum first, then buoyancy. Either way the heavier ends up lower.
					if (this.push[i] > 0) {
						this.push[i]--;
						if (cell !== under) {
							this.swap(i, i + w);
							continue;
						}
					} else if (this.densityAt(under) < mine - 0.001) {
						this.swap(i, i + w);
						continue;
					}
				}

				// Straight down is blocked. A liquid does not pile up like sand: it
				// goes round the side, through anything lighter than itself. Without
				// this the glass fills with cones instead of layers.
				const dir = this.random() < 0.5 ? -1 : 1;
				let moved = false;
				for (const d of [dir, -dir]) {
					if (yields(x + d, y + 1)) {
						this.swap(i, (y + 1) * w + x + d);
						moved = true;
						break;
					}
				}
				if (!moved) {
					for (const d of [dir, -dir]) {
						if (!this.solid(x + d, y) && this.grid[y * w + x + d] === EMPTY) {
							this.swap(i, y * w + x + d);
							moved = true;
							break;
						}
					}
				}

				// A little stirring at the boundaries, so layers are not drawn with
				// a ruler.
				if (!moved && this.mixing > 0 && this.random() * 100 < this.mixing) {
					const d = this.random() < 0.5 ? -1 : 1;
					if (!this.solid(x + d, y)) {
						const neighbour = this.grid[y * w + x + d];
						if (neighbour > 0 && neighbour !== cell) this.swap(i, y * w + x + d);
					}
				}
			}
		}
	}

	/** One frame: let a little more in, then let everything fall. */
	tick(steps = 1): void {
		for (let s = 0; s < steps; s++) {
			this.feed();
			this.settleOnce();
		}
	}

	counts(): Record<string, number> {
		const totals: Record<string, number> = {};
		for (const key of this.keys) totals[key] = 0;
		for (let i = 0; i < this.grid.length; i++) {
			const cell = this.grid[i];
			if (cell !== EMPTY) totals[this.keys[cell - 1]]++;
		}
		return totals;
	}

	/** How many cells are in the glass, poured and settled. */
	get filled(): number {
		let total = 0;
		for (let i = 0; i < this.grid.length; i++) if (this.grid[i] !== EMPTY) total++;
		return total;
	}

	/** Mean row of a drink's cells: the lower the number, the higher it floats. */
	meanRow(key: DrinkKey): number {
		const code = this.code(key);
		let sum = 0;
		let n = 0;
		for (let i = 0; i < this.grid.length; i++) {
			if (this.grid[i] !== code) continue;
			sum += Math.floor(i / this.width);
			n++;
		}
		return n === 0 ? NaN : sum / n;
	}
}

export { DENSITY };
