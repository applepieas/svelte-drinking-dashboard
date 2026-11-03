<script lang="ts">
	/**
	 * The glasses somebody actually drank, one sprite each.
	 *
	 * A number says how much; this says what. It is the same artwork as the
	 * landing page, drawn small enough to count.
	 */
	import type { DrinkKey } from '$lib/drinks';
	import { GLASSES } from './sprites';
	import { glassSvg } from './glass';

	interface Props {
		keys: DrinkKey[];
		/** Screen pixels per sprite pixel. */
		px?: number;
		labels: Record<DrinkKey, string>;
	}

	let { keys, px = 1, labels }: Props = $props();

	const mark = (key: DrinkKey) => {
		const sprite = GLASSES[key as keyof typeof GLASSES];
		if (!sprite) return '';
		return glassSvg(sprite, labels[key] ?? key).replace(
			'<svg ',
			`<svg width="${Math.round(sprite.w * px)}" height="${Math.round(sprite.h * px)}" `
		);
	};
</script>

<div class="tally">
	{#each keys as key, i (i)}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- built from static sprite data in this repo, never from input -->
		{@html mark(key)}
	{/each}
</div>

<style>
	.tally {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		align-items: flex-end;
	}

	.tally :global(svg) {
		display: block;
	}
</style>
