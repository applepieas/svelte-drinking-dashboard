<script lang="ts">
	/**
	 * A tuning panel for the landing page artwork, for development only.
	 *
	 * Placing a glass is a judgement call that has to be made on a real screen,
	 * and the phone layout cannot be judged from a desktop. This lets the numbers
	 * be dragged on the device itself and copied back into `glass.ts`.
	 *
	 * Open it with the `d` key, or by tapping the top-left corner three times on a
	 * phone, where there is no keyboard.
	 */
	import type { Tune, TuneSet } from './tune';
	import { LANDING_PANELS } from './glass';

	interface Props {
		tune: TuneSet;
		layout: 'columns' | 'bands';
		reset: () => void;
	}

	let { tune = $bindable(), layout, reset }: Props = $props();

	let open = $state(false);
	let copied = $state('');
	let taps: number[] = [];

	const FIELDS: { key: keyof Tune; label: string; min: number; max: number; step: number }[] = [
		{ key: 'size', label: 'Velikost', min: 0.4, max: 2, step: 0.02 },
		{ key: 'dx', label: 'Posun ↔', min: -300, max: 300, step: 2 },
		{ key: 'dy', label: 'Posun ↕', min: -300, max: 300, step: 2 }
	];

	function onKey(event: KeyboardEvent) {
		const el = event.target as HTMLElement | null;
		if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
		if (event.key === 'd' || event.key === 'D') {
			open = !open;
			event.preventDefault();
		}
	}

	function onPointer(event: PointerEvent) {
		if (open || event.clientX > 70 || event.clientY > 70) return;
		const now = Date.now();
		taps = [...taps.filter((t) => now - t < 700), now];
		if (taps.length >= 3) {
			taps = [];
			open = true;
		}
	}

	async function copy() {
		const out = Object.fromEntries(
			LANDING_PANELS.map((p) => [p.label, { ...tune[layout][p.key] }])
		);
		const text = JSON.stringify(
			{ rozvrzeni: layout === 'bands' ? 'mobil' : 'desktop', sklenice: out },
			null,
			2
		);
		try {
			await navigator.clipboard.writeText(text);
			copied = 'Zkopírováno';
		} catch {
			copied = 'Schránka nejde, text je níž';
		}
		setTimeout(() => (copied = ''), 2600);
	}

	const dump = $derived(
		JSON.stringify(
			{
				rozvrzeni: layout === 'bands' ? 'mobil' : 'desktop',
				sklenice: Object.fromEntries(
					LANDING_PANELS.map((p) => [p.label, { ...tune[layout][p.key] }])
				)
			},
			null,
			2
		)
	);
</script>

<svelte:window onkeydown={onKey} onpointerdown={onPointer} />

{#if open}
	<aside class="tuner">
		<header>
			<strong>Sklenice · {layout === 'bands' ? 'mobil' : 'desktop'}</strong>
			<button type="button" onclick={() => (open = false)} aria-label="Zavřít">×</button>
		</header>

		<div class="rows">
			{#each LANDING_PANELS as panel (panel.key)}
				<fieldset>
					<legend>{panel.label}</legend>
					{#each FIELDS as field (field.key)}
						<label>
							<span>{field.label}</span>
							<input
								type="range"
								min={field.min}
								max={field.max}
								step={field.step}
								bind:value={tune[layout][panel.key][field.key]}
							/>
							<output>{tune[layout][panel.key][field.key]}</output>
						</label>
					{/each}
				</fieldset>
			{/each}
		</div>

		<footer>
			<button type="button" onclick={copy}>Zkopírovat</button>
			<button type="button" onclick={reset}>Výchozí</button>
			<span class="flash">{copied}</span>
		</footer>

		<textarea readonly value={dump}></textarea>
	</aside>
{/if}

<style>
	.tuner {
		position: fixed;
		inset: auto 0 0 0;
		z-index: 90;
		max-height: 72dvh;
		overflow-y: auto;
		background: #17150f;
		color: #ede6d4;
		border-top: 2px solid #3a3529;
		font:
			12px/1.4 ui-monospace,
			SFMono-Regular,
			Menlo,
			monospace;
		padding: 10px 12px calc(12px + env(safe-area-inset-bottom, 0px));
		display: grid;
		gap: 10px;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	header button {
		background: none;
		border: 0;
		color: #9b9176;
		font: inherit;
		font-size: 20px;
		line-height: 1;
		padding: 2px 8px;
		cursor: pointer;
	}

	.rows {
		display: grid;
		gap: 8px;
	}

	fieldset {
		border: 1px solid #3a3529;
		border-radius: 3px;
		padding: 6px 9px 8px;
		margin: 0;
		display: grid;
		gap: 4px;
	}

	legend {
		padding: 0 5px;
		color: #e8a317;
		font-weight: 600;
	}

	label {
		display: grid;
		grid-template-columns: 62px 1fr 52px;
		align-items: center;
		gap: 8px;
	}

	label span {
		color: #9b9176;
	}

	input[type='range'] {
		width: 100%;
		accent-color: #e8a317;
		margin: 0;
	}

	output {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	footer {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	footer button {
		font: inherit;
		padding: 7px 11px;
		border: 1px solid #3a3529;
		border-radius: 3px;
		background: #221f17;
		color: #ede6d4;
		cursor: pointer;
	}

	.flash {
		color: #e8a317;
	}

	textarea {
		width: 100%;
		min-height: 108px;
		resize: vertical;
		font: inherit;
		background: #0f0d09;
		color: #ede6d4;
		border: 1px solid #3a3529;
		border-radius: 3px;
		padding: 7px;
	}

	:focus-visible {
		outline: 2px solid #e8a317;
		outline-offset: 2px;
	}
</style>
