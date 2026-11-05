<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { prefersReducedMotion } from 'svelte/motion';
	import { LANDING_PANELS, glassSvg } from '$lib/art/glass';
	import { INTRO, playIntro } from '$lib/art/intro';
	import { DEFAULT_TUNE } from '$lib/art/tune';
	import Tuner from '$lib/art/Tuner.svelte';
	import { dev } from '$app/environment';
	import { DEMO_CODE } from '$lib/demo';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();

	const panelEls: HTMLElement[] = [];
	const glassEls: HTMLElement[] = [];
	let veilEl: HTMLElement;
	let boardEl: HTMLElement;

	// Placing a glass is a judgement call made on a real screen, so the numbers
	// stay adjustable in development and get written back into tune.ts.
	let tune = $state(DEFAULT_TUNE());
	let layout = $state<'columns' | 'bands'>('columns');

	onMount(() => {
		// With reduced motion the CSS never offsets or hides anything, so there is
		// nothing to play and nothing to undo.
		if (prefersReducedMotion.current) return;
		const lines = [...boardEl.querySelectorAll<HTMLElement>('[data-line]')];
		// Columns travel across the screen; the stacked bands on a phone travel up it.
		const wide = window.matchMedia('(min-width: 768px)');
		layout = wide.matches ? 'columns' : 'bands';
		const onChange = () => (layout = wide.matches ? 'columns' : 'bands');
		wide.addEventListener('change', onChange);

		const timeline = playIntro(
			panelEls,
			glassEls,
			{ veil: veilEl, lines },
			wide.matches ? 'x' : 'y'
		);
		return () => {
			wide.removeEventListener('change', onChange);
			timeline.kill();
		};
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
							.h}; --px: {panel.px}; --tilt: {panel.tiltDeg}deg; --x: {panel.shiftX}; --y: {panel.shiftY}; --size: {tune[
							layout
						][panel.key].size}; --dx: {tune[layout][panel.key].dx}; --dy: {tune[layout][panel.key]
							.dy}"
					>
						<!-- eslint-disable-next-line svelte/no-at-html-tags -- built from static sprite data in this repo, never from input -->
						{@html glassSvg(panel.sprite, panel.label)}
					</div>
				</div>
			</div>
		</section>
	{/each}

	<!-- Dropped over the panels so the words can be read on them. It arrives last. -->
	<div class="veil" bind:this={veilEl}></div>

	<div class="board" bind:this={boardEl}>
		<p class="kicker" data-line>Párty v přímém přenosu</p>
		<h1 data-line>Na ex</h1>
		<p class="lede" data-line>Lidé zapisují z telefonu, společná obrazovka to ukazuje živě.</p>

		<div class="row" data-line>
			<a class="cta" href={resolve('/nova')}>Založit novou akci</a>

			<form class="joinbox" method="POST" action="?/pripojit" use:enhance>
				<label class="sr-only" for="code">Kód akce</label>
				<input
					id="code"
					name="code"
					class="code"
					required
					maxlength="6"
					autocomplete="off"
					autocapitalize="characters"
					spellcheck="false"
					placeholder="62NW5Q"
				/>
				<button type="submit" class="join">Připojit</button>
			</form>
		</div>

		<p class="err" data-line aria-live="polite">{form?.error ?? ''}</p>

		<a class="demo" data-line href={resolve('/a/[kod]', { kod: DEMO_CODE })}>Zkusit ukázku</a>
	</div>
</main>

{#if dev}
	<Tuner bind:tune {layout} reset={() => (tune = DEFAULT_TUNE())} />
{/if}

<style>
	.stage {
		--u: calc(100vw / 1512);
		--col: calc(100vw / 5);
		/* The artwork gets its own unit: on a phone it answers to the height of a
		   band, not to the width of the page. */
		--art-u: var(--u);
		--ink: #15120c;
		--paper: #fff8e8;
		--amber: #ffc60b;
		position: fixed;
		inset: 0;
		overflow: hidden;
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
		/* The shove that pushes a glass toward the panel covering it is --sx here
		   and --sy on a phone, where the covering panel lies below rather than to
		   the right. One set of numbers, turned a quarter turn. */
		--sx: calc((var(--x) + var(--dx)) * var(--art-u));
		--sy: calc((var(--y) + var(--dy)) * var(--art-u));
		/* Centred in a column that is taller than the glass; hung from the top of
		   a band that is shorter than it. */
		--oy: -50%;
		width: calc(var(--w) * var(--px) * var(--size) * var(--art-u));
		height: calc(var(--h) * var(--px) * var(--size) * var(--art-u));
		transform: translate(calc(-50% + var(--sx)), calc(var(--oy) + var(--sy))) rotate(var(--tilt));
	}

	.art :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
	}

	/* An even sheet rather than a panel behind the text: it measured 5.06:1
	   against white on the lightest pixel under the wordmark, where the plain
	   outline measured 1.03:1. */
	.veil {
		position: absolute;
		inset: 0;
		z-index: 20;
		background: rgba(10, 8, 4, 0.58);
		pointer-events: none;
	}

	/* ---------- the board ---------- */
	.board {
		position: absolute;
		inset: 0;
		z-index: 30;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		color: #fff;
		padding-inline: 16px;
	}

	.kicker {
		margin: 0;
		font-size: max(10px, calc(12 * var(--u)));
		letter-spacing: 0.22em;
		text-transform: uppercase;
	}

	.board h1 {
		margin: max(6px, calc(8 * var(--u))) 0 0;
		font-family: 'Pixelify Sans', ui-monospace, 'Courier New', monospace;
		font-weight: 700;
		font-size: max(54px, calc(140 * var(--u)));
		line-height: 0.9;
		letter-spacing: -0.03em;
		text-shadow: calc(6 * var(--u)) calc(6 * var(--u)) 0 rgba(10, 8, 4, 0.45);
	}

	.lede {
		margin: max(13px, calc(18 * var(--u))) 0 0;
		max-width: 38ch;
		font-size: max(13px, calc(19 * var(--u)));
		font-weight: 600;
		line-height: 1.5;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: max(12px, calc(14 * var(--u)));
		justify-content: center;
		align-items: stretch;
		margin-top: max(22px, calc(32 * var(--u)));
	}

	.cta,
	.join {
		font-family: 'Pixelify Sans', ui-monospace, 'Courier New', monospace;
		font-weight: 600;
		cursor: pointer;
	}

	.cta {
		display: flex;
		align-items: center;
		font-size: max(15px, calc(22 * var(--u)));
		padding: calc(17 * var(--u)) calc(32 * var(--u));
		background: var(--amber);
		color: var(--ink);
		border: calc(3 * var(--u)) solid var(--ink);
		box-shadow: calc(6 * var(--u)) calc(6 * var(--u)) 0 rgba(10, 8, 4, 0.5);
		text-decoration: none;
	}

	.joinbox {
		display: flex;
		align-items: stretch;
		border: calc(3 * var(--u)) solid var(--ink);
		background: var(--paper);
		box-shadow: calc(6 * var(--u)) calc(6 * var(--u)) 0 rgba(10, 8, 4, 0.5);
	}

	/* One field, six slots. Both the dividers and the field's width are derived
	   from one character's advance, so a character always lands in the middle of
	   a slot — tying the slots to a percentage of the field instead let the two
	   drift apart as soon as the font hit its floor on a narrow screen. */
	.code {
		--glyph: 0.6em; /* IBM Plex Mono advance */
		--slot: 1.708em; /* glyph plus the letter spacing below */
		width: calc(6 * var(--slot));
		border: 0;
		background: transparent;
		background-image: repeating-linear-gradient(
			90deg,
			transparent 0 calc(var(--slot) - 2px),
			rgba(21, 18, 12, 0.2) calc(var(--slot) - 2px) var(--slot)
		);
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: max(17px, calc(24 * var(--u)));
		color: var(--ink);
		text-transform: uppercase;
		letter-spacing: 1.108em;
		text-indent: calc((var(--slot) - var(--glyph)) / 2);
	}

	.code::placeholder {
		color: rgba(21, 18, 12, 0.32);
	}

	.code:focus-visible {
		outline: calc(3 * var(--u)) solid var(--amber);
		outline-offset: calc(-3 * var(--u));
	}

	.join {
		font-size: max(14px, calc(19 * var(--u)));
		padding: 0 calc(24 * var(--u));
		background: var(--ink);
		color: var(--paper);
		border: 0;
	}

	.err {
		margin: max(11px, calc(14 * var(--u))) 0 0;
		min-height: 1.4em;
		font-size: max(12px, calc(15 * var(--u)));
		font-weight: 600;
		color: #ffd2c4;
	}

	.demo {
		margin-top: max(6px, calc(8 * var(--u)));
		font-size: max(12px, calc(15 * var(--u)));
		color: #fff;
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
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

			.veil {
				opacity: 0;
			}

			.board [data-line] {
				opacity: 0;
				transform: translateY(calc(18 * var(--u)));
			}
		}
	}

	/* ---------- phone: the same page turned a quarter turn ----------
	   Five bands stacked down the screen instead of five columns across it. Each
	   band reaches from its own top edge to the bottom, the next one covers it,
	   and everything arrives from below rather than from the right. Tablets and
	   up keep the columns. */
	@media (max-width: 767px) {
		.stage {
			/* Big enough to overrun the band, the way a glass overruns its column on
			   a wide screen. Roughly twice the height of a band, so the band below
			   cuts it off and only the top of the glass is left showing. */
			--art-u: calc(20dvh / 250);
		}

		.panel {
			left: 0;
			right: 0;
			top: calc(var(--i) * 20%);
			bottom: -4%;
		}

		.row {
			/* The row wraps here, so this is the air under the first button. */
			row-gap: 22px;
		}

		.col {
			left: 0;
			right: 0;
			top: 0;
			width: auto;
			/* A fifth of the page, not of the panel: a panel reaches past the
			   bottom edge, so a percentage here would measure the wrong box. */
			height: 20dvh;
		}

		.art {
			top: 0;
			--oy: 0%;
			/* Only the top of a glass shows in a band, and leaning it left swings
			   that part left too, by a different amount for each one. The nudges
			   that wind them back onto the middle of the screen live in tune.ts and
			   were measured off the rendered page rather than worked out on paper. */
			--sx: calc((var(--y) + var(--dx)) * var(--art-u));
			/* The shove toward the covering panel now points down, halved because at
			   this size the full value would push the glass clean out of its band.
			   The flat 3dvh buys back what the tilt steals from the first glass,
			   whose foam was being cut by the top of the screen. */
			--sy: calc(var(--x) * var(--art-u) * 0.5 + var(--dy) * var(--art-u) + 3dvh);
		}

		@media (scripting: enabled) {
			@media not (prefers-reduced-motion: reduce) {
				.panel {
					transform: translateY(100dvh);
				}

				.art-intro {
					/* Far enough that a glass hanging from the top of its band, tilted,
					   still starts out of sight below it. */
					transform: translateY(30dvh);
				}
			}
		}
	}
</style>
