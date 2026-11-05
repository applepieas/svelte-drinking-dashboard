<script lang="ts">
	/**
	 * The party in one glass.
	 *
	 * Every millilitre the room has drunk becomes cells of pixel liquid, and the
	 * liquids settle by density, so the glass reads as a cross-section of the
	 * evening: what was drunk, in what proportion, stacked in layers.
	 *
	 * The canvas is the simulation's own size - sixty-odd pixels across - and CSS
	 * blows it up. Nothing is ever drawn at a fraction of a pixel that way, and a
	 * frame is one `putImageData` rather than thousands of rectangles.
	 */
	import { prefersReducedMotion } from 'svelte/motion';
	import type { DrinkDef, DrinkKey } from '$lib/drinks';
	import type { DrinkTotal } from '$lib/leaderboard';
	import { Liquid } from './liquid';

	interface Props {
		/** The event's drinks, for volumes and colours. */
		drinks: DrinkDef[];
		/** Live totals per drink, straight off the same reduction the board uses. */
		byDrink: DrinkTotal[];
		/** Simulation steps per animation frame. */
		speed?: number;
	}

	let { drinks, byDrink, speed = 2 }: Props = $props();

	/** Cells per millilitre before the glass has to start economising. */
	const BASE_SCALE = 0.5;
	/** How full the glass is allowed to get before everything is scaled down. */
	const BRIM = 0.88;
	/** Frame budget when motion is switched off and it all happens at once. */
	const SETTLE_STEPS = 500;

	const PAD = 4;

	const keys = $derived(drinks.map((drink) => drink.key));
	const volume = $derived(
		Object.fromEntries(drinks.map((d) => [d.key, d.volumeMl])) as Record<DrinkKey, number>
	);

	let canvas = $state<HTMLCanvasElement | null>(null);

	let liquid: Liquid | null = null;
	let base: Uint8ClampedArray | null = null;
	let pixels: ImageData | null = null;
	let shades: Record<string, [number[], number[], number[]]> = {};
	/** Cells handed to the simulation so far, per drink, net of anything undone. */
	let issued: Record<string, number> = {};
	let scale = BASE_SCALE;
	let frame = 0;
	/** A fixed shade pick per cell, so the texture does not crawl between frames. */
	let grain: Uint8Array | null = null;

	function rgb(hex: string): number[] {
		const value = parseInt(hex.replace('#', ''), 16);
		return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
	}

	const mix = (a: number[], b: number[], t: number) =>
		a.map((v, i) => Math.round(v + (b[i] - v) * t));

	/** The glass: a pale keyline growing outwards from the liquid's edge. */
	function drawGlass(sim: Liquid, width: number): Uint8ClampedArray {
		const height = sim.height + PAD * 2;
		const data = new Uint8ClampedArray(width * height * 4);

		const near = (x: number, y: number, r: number) => {
			for (let dy = -r; dy <= r; dy++) {
				for (let dx = -r; dx <= r; dx++) {
					const nx = x + dx;
					const ny = y + dy;
					if (nx < 0 || ny < 0 || nx >= sim.width || ny >= sim.height) continue;
					if (sim.mask[ny * sim.width + nx]) return true;
				}
			}
			return false;
		};

		const tones: [number, number[]][] = [
			[2, rgb('#C8CEDC')],
			[3, rgb('#8E9BAE')],
			[4, rgb('#15120C')]
		];

		for (let y = -PAD; y < sim.height + PAD; y++) {
			for (let x = -PAD; x < sim.width + PAD; x++) {
				const insideGlass =
					x >= 0 && y >= 0 && x < sim.width && y < sim.height && sim.mask[y * sim.width + x];
				// Open at the top: no rim is drawn above the mouth.
				if (insideGlass || y < 0) continue;

				const tone = tones.find(([r]) => near(x, y, r));
				if (!tone) continue;

				const i = ((y + PAD) * width + (x + PAD)) * 4;
				data[i] = tone[1][0];
				data[i + 1] = tone[1][1];
				data[i + 2] = tone[1][2];
				data[i + 3] = 255;
			}
		}
		return data;
	}

	function paint() {
		if (!liquid || !canvas || !base || !pixels) return;
		const width = liquid.width + PAD * 2;
		pixels.data.set(base);

		for (let y = 0; y < liquid.height; y++) {
			for (let x = 0; x < liquid.width; x++) {
				const cell = liquid.grid[y * liquid.width + x];
				if (cell === 0) continue;
				const tone = shades[keys[cell - 1]];
				if (!tone) continue;

				// A lit top edge and a scattering of darker cells, so a block of one
				// colour still looks like liquid rather than a swatch.
				const surface = y === 0 || liquid.grid[(y - 1) * liquid.width + x] === 0;
				const shade = surface ? tone[2] : grain?.[y * liquid.width + x] ? tone[1] : tone[0];

				const i = ((y + PAD) * width + (x + PAD)) * 4;
				pixels.data[i] = shade[0];
				pixels.data[i + 1] = shade[1];
				pixels.data[i + 2] = shade[2];
				pixels.data[i + 3] = 255;
			}
		}
		canvas.getContext('2d')?.putImageData(pixels, 0, 0);
	}

	/** Brings the glass in line with the log, pouring or un-pouring the difference. */
	function reconcile(totals: DrinkTotal[]) {
		if (!liquid) return;

		const wanted: Record<string, number> = {};
		let cells = 0;
		for (const total of totals) {
			const ml = (volume[total.key] ?? 0) * total.count;
			wanted[total.key] = ml;
			cells += ml * scale;
		}

		// A long party would otherwise pour straight over the rim. Everything in
		// the glass is thinned by the same fraction, so the layers keep their
		// proportions and only the scale underneath them changes.
		const room = liquid.capacity * BRIM;
		if (cells > room) {
			const next = (room / cells) * scale;
			liquid.thin(next / scale);
			for (const key of Object.keys(issued)) issued[key] *= next / scale;
			scale = next;
		}

		for (const key of keys) {
			const target = Math.round((wanted[key] ?? 0) * scale);
			const have = Math.round(issued[key] ?? 0);
			if (target > have) {
				liquid.pour(key, target - have);
				issued[key] = target;
			} else if (target < have) {
				liquid.drain(key, have - target);
				issued[key] = target;
			}
		}
	}

	$effect(() => {
		const sim = new Liquid(keys, {});
		liquid = sim;
		issued = {};
		scale = BASE_SCALE;

		shades = Object.fromEntries(
			drinks.map((drink) => {
				const body = rgb(drink.color);
				return [drink.key, [body, mix(body, [0, 0, 0], 0.3), mix(body, [255, 255, 255], 0.55)]];
			})
		);

		grain = new Uint8Array(sim.width * sim.height);
		for (let i = 0; i < grain.length; i++) grain[i] = Math.random() < 0.22 ? 1 : 0;

		const width = sim.width + PAD * 2;
		const height = sim.height + PAD * 2;
		if (canvas) {
			canvas.width = width;
			canvas.height = height;
			pixels = canvas.getContext('2d')?.createImageData(width, height) ?? null;
		}
		base = drawGlass(sim, width);

		return () => {
			liquid = null;
		};
	});

	$effect(() => {
		// Depend on the totals; everything else is read without subscribing.
		const totals = byDrink.map((item) => ({ ...item }));
		if (!liquid) return;
		reconcile(totals);

		// With motion switched off the glass is a still life: settle it in one go
		// and draw the result, rather than running a loop nobody asked for.
		if (prefersReducedMotion.current) {
			liquid.tick(SETTLE_STEPS);
			paint();
		}
	});

	$effect(() => {
		if (prefersReducedMotion.current) return;

		const loop = () => {
			liquid?.tick(speed);
			paint();
			frame = requestAnimationFrame(loop);
		};
		frame = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(frame);
	});
</script>

<canvas bind:this={canvas} class="vessel" aria-hidden="true"></canvas>

<style>
	/* The simulation's own resolution, blown up by whole pixels and centred in
	   whatever space the parent gives it. Absolutely placed, so there is always
	   a definite box to fit into; the parent needs a position for that. */
	.vessel {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
		image-rendering: pixelated;
	}
</style>
