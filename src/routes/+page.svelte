<script lang="ts">
	import { LANDING_PANELS, glassSvg } from '$lib/art/glass';
</script>

<svelte:head>
	<title>Na ex</title>
	<meta
		name="description"
		content="Lidé zapisují z telefonu, společná obrazovka to ukazuje živě."
	/>
</svelte:head>

<!--
	The landing page so far: five full-height grounds, one glass each. The join
	window that belongs in the middle is not built yet, so this page currently
	offers no way into an event — /nova still works directly.

	Everything is sized from `--u`, one unit of the 1512px wide comp, so the whole
	composition scales with the viewport instead of reflowing. A real layout for
	narrow screens is still to be designed.
-->
<main class="stage">
	{#each LANDING_PANELS as panel (panel.key)}
		<section class="panel" style="--ground: {panel.ground}">
			<div
				class="art"
				style="--w: {panel.sprite.w}; --h: {panel.sprite
					.h}; --px: {panel.px}; --tilt: {panel.tiltDeg}deg; --x: {panel.shiftX}; --y: {panel.shiftY}"
			>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- built from static sprite data in this repo, never from input -->
				{@html glassSvg(panel.sprite, panel.label)}
			</div>
		</section>
	{/each}
</main>

<style>
	.stage {
		--u: calc(100vw / 1512);
		position: fixed;
		inset: 0;
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		overflow: hidden;
	}

	/* Each panel clips its own glass, so what spills right disappears under the
	   next panel's ground. */
	.panel {
		position: relative;
		background: var(--ground);
		overflow: hidden;
	}

	.art {
		position: absolute;
		left: 50%;
		top: 50%;
		width: calc(var(--w) * var(--px) * var(--u));
		height: calc(var(--h) * var(--px) * var(--u));
		transform: translate(calc(-50% + var(--x) * var(--u)), calc(-50% + var(--y) * var(--u)))
			rotate(var(--tilt));
	}

	.art :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
