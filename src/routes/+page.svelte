<script lang="ts">
	import { onMount } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { LANDING_PANELS, glassSvg } from '$lib/art/glass';
	import { INTRO, playIntro } from '$lib/art/intro';

	const panelEls: HTMLElement[] = [];
	const glassEls: HTMLElement[] = [];

	onMount(() => {
		// With reduced motion the CSS never offsets anything, so there is nothing
		// to play and nothing to undo.
		if (prefersReducedMotion.current) return;
		const timeline = playIntro(panelEls, glassEls);
		return () => timeline.kill();
	});
</script>

<svelte:head>
	<title>Na ex</title>
	<meta
		name="description"
		content="Lidé zapisují z telefonu, společná obrazovka to ukazuje živě."
	/>
</svelte:head>

<!--
	The landing page so far: five grounds, one glass each. The join window that
	belongs in the middle is not built yet, so this page currently offers no way
	into an event — /nova still works directly.

	The panels are not five columns side by side. Each one reaches from its own
	left edge to the right of the screen and the next one lies on top of it, so
	the finished page looks like five columns while the opening can slide each
	panel in as a full sheet with nothing showing through between them.

	Everything is sized from `--u`, one unit of the 1512px wide comp, so the whole
	composition scales with the viewport instead of reflowing. A real layout for
	narrow screens is still to be designed.
-->
<main class="stage">
	{#each LANDING_PANELS as panel, i (panel.key)}
		<section class="panel" style="--ground: {panel.ground}; --i: {i}" bind:this={panelEls[i]}>
			<div class="col">
				<div class="art-intro" style="--travel: {INTRO.glassTravel}" bind:this={glassEls[i]}>
					<div
						class="art"
						style="--w: {panel.sprite.w}; --h: {panel.sprite
							.h}; --px: {panel.px}; --tilt: {panel.tiltDeg}deg; --x: {panel.shiftX}; --y: {panel.shiftY}"
					>
						<!-- eslint-disable-next-line svelte/no-at-html-tags -- built from static sprite data in this repo, never from input -->
						{@html glassSvg(panel.sprite, panel.label)}
					</div>
				</div>
			</div>
		</section>
	{/each}
</main>

<style>
	.stage {
		--u: calc(100vw / 1512);
		--col: calc(100vw / 5);
		position: fixed;
		inset: 0;
		overflow: hidden;
		/* Only ever seen in the half second before the first panel lands. */
		background: #15120c;
	}

	/* Each panel runs from its own column to the right edge, and the next panel
	   covers it. */
	.panel {
		position: absolute;
		top: 0;
		bottom: 0;
		/* Hanging over the right edge so the overshoot at the end of the slide
		   cannot open a gap there. The stage clips it away. */
		right: -4vw;
		left: calc(var(--i) * var(--col));
		z-index: calc(var(--i) + 1);
		background: var(--ground);
	}

	/* A glass belongs to one column, not to the whole sheet its panel covers.
	   This is what cuts the part that spills right — the cut lands exactly where
	   the next panel begins — and it is also what keeps a glass out of sight while
	   its own panel is still flying in. */
	.col {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		width: var(--col);
		overflow: hidden;
	}

	/* Two layers on purpose: the intro owns this transform, the artwork keeps its
	   own placement and tilt, and neither overwrites the other. */
	.art-intro {
		position: absolute;
		inset: 0;
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

	/* The starting positions. Declaring them in CSS rather than in script means
	   the finished page never flashes before the intro begins — and that a reader
	   with scripting off, or with reduced motion asked for, simply gets the page
	   already assembled. */
	@media (scripting: enabled) {
		@media not (prefers-reduced-motion: reduce) {
			.panel {
				transform: translateX(100vw);
			}

			.art-intro {
				transform: translateX(calc(var(--travel) * var(--u)));
			}
		}
	}
</style>
