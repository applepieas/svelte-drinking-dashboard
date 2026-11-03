<script lang="ts">
	import Tally from '$lib/art/Tally.svelte';
	import { DRINKS, type DrinkKey } from '$lib/drinks';
	import { NICK_MAX } from '$lib/nicks';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const labels = Object.fromEntries(
		Object.values(DRINKS).map((drink) => [drink.key, drink.label])
	) as Record<DrinkKey, string>;
</script>

<main class="page">
	<div class="glasses" aria-hidden="true">
		<Tally keys={['beer', 'wine', 'shot', 'soft']} px={2} {labels} />
	</div>

	<header class="head">
		<p class="eyebrow">Přidáváš se k akci</p>
		<h1>{data.event.name}</h1>
	</header>

	{#if form?.error}
		<p class="alert" role="alert">{form.error}</p>
	{/if}

	<form method="POST" class="card join">
		<div class="stack">
			<label class="eyebrow" for="nick">Přezdívka</label>
			<input
				id="nick"
				name="nick"
				required
				maxlength={NICK_MAX}
				autocomplete="off"
				autocapitalize="off"
				spellcheck="false"
				enterkeyhint="go"
				value={form?.nick ?? ''}
				class="field nick"
			/>
		</div>
		<p class="muted small">Uvidí ji ostatní na společné obrazovce.</p>
		<button type="submit" class="btn btn-strong">Připojit se</button>
	</form>
</main>

<style>
	/* The first screen after the camera finds the code. One field, one button,
	   and the same glasses that are on the wall, so it is obvious you reached
	   the right party. */
	.page {
		margin: 0 auto;
		display: flex;
		min-height: 100dvh;
		max-width: 30rem;
		flex-direction: column;
		justify-content: center;
		gap: 20px;
		padding: 24px 16px calc(32px + env(safe-area-inset-bottom));
	}

	.glasses {
		display: flex;
		justify-content: center;
	}

	.glasses :global(.tally) {
		gap: 14px;
		justify-content: center;
	}

	.head {
		display: flex;
		flex-direction: column;
		gap: 6px;
		text-align: center;
	}

	.head h1 {
		margin: 0;
	}

	.join {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.stack {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	/* Typed once, read by everyone in the room all evening. */
	.nick {
		font-family: var(--pixel);
		font-size: 25px;
		min-height: 60px;
	}

	.small {
		margin: 0;
		font-size: 13px;
		line-height: 1.5;
	}
</style>
