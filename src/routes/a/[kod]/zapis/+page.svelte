<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		estimateBac,
		hoursToSober,
		isValidProfile,
		MAX_WEIGHT_KG,
		MIN_WEIGHT_KG,
		type BacProfile,
		type ConsumedDrink
	} from '$lib/bac';
	import Tally from '$lib/art/Tally.svelte';
	import HostViewToggle from '$lib/components/HostViewToggle.svelte';
	import type { DrinkKey } from '$lib/drinks';
	import { ethanolByKey } from '$lib/leaderboard';
	import { readProfile, writeProfile } from '$lib/profile';
	import type { PageProps, SubmitFunction } from './$types';

	let { data, form }: PageProps = $props();

	/** Drinks tapped but not yet confirmed by the server. */
	let pending = $state<ConsumedDrink[]>([]);
	let announcement = $state('');
	let networkError = $state('');
	/**
	 * True from a tap until the server has answered it.
	 *
	 * Each form carries a submission token the server mints once per page load,
	 * and a unique index on it means a second tap arriving before the next token
	 * is treated as a retry of the first - one drink, not two. That is what keeps
	 * a fumbled double-tap from costing somebody a beer, but on its own it is
	 * silent: the tap looks accepted and then quietly is not. Closing the buttons
	 * for the length of the round trip says the same thing out loud.
	 */
	let submitting = $state(false);

	/** Ticks so the countdown and the estimate move without a reload. */
	let now = $state(Date.now());
	/** Guards against rendering a stored value during SSR, and against a flash of "0". */
	let profileLoaded = $state(false);
	let profile = $state<BacProfile | null>(null);
	let editingProfile = $state(false);

	const ethanol = $derived(ethanolByKey(data.event.drinks));
	const total = $derived(data.myDrinks.length + pending.length);

	/** Tally wants every label; the glasses on the buttons are this page's only use. */
	const labels = $derived(
		Object.fromEntries(data.event.drinks.map((drink) => [drink.key, drink.label])) as Record<
			DrinkKey,
			string
		>
	);

	const consumed = $derived<ConsumedDrink[]>([
		...data.myDrinks.map((drink) => ({
			atMs: new Date(drink.at).getTime(),
			ethanolMl: (drink.drinkKey && ethanol.get(drink.drinkKey)) || 0
		})),
		...pending
	]);

	const bac = $derived(profile ? estimateBac(consumed, profile, now) : 0);
	const soberIn = $derived(hoursToSober(bac));

	const undoSecondsLeft = $derived(
		data.undoable
			? Math.max(0, Math.ceil((new Date(data.undoable.until).getTime() - now) / 1000))
			: 0
	);

	/** 1 zápis, 2 zápisy, 0 a 5 zápisů — the shape Czech counting takes. */
	const entries = (n: number) => (n === 1 ? 'zápis' : n > 1 && n < 5 ? 'zápisy' : 'zápisů');

	/** Czech writes 0,42 — not 0.42. */
	const promile = new Intl.NumberFormat('cs-CZ', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	});

	const undoneLabel = $derived(
		data.event.drinks.find((drink) => drink.key === data.undoable?.drinkKey)?.label
	);

	$effect(() => {
		profile = readProfile();
		profileLoaded = true;
	});

	$effect(() => {
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});

	const logDrink: SubmitFunction = ({ submitter }) => {
		const key = (submitter as HTMLButtonElement | null)?.value;
		const drink = data.event.drinks.find((item) => item.key === key);
		if (drink) {
			pending.push({ atMs: Date.now(), ethanolMl: drink.ethanolMl });
			announcement = `Zapsáno: ${drink.label}`;
		}
		networkError = '';
		submitting = true;

		return async ({ result, update }) => {
			if (result.type === 'failure') {
				pending.pop();
				announcement = '';
			}
			if (result.type === 'error') {
				pending.pop();
				announcement = '';
				networkError = 'Zápis se neodeslal. Zkontroluj připojení a zkus to znovu.';
			}
			// reset:false keeps the submission token in place if the action failed.
			await update({ reset: false });
			pending = [];
			submitting = false;
		};
	};

	const takeBack: SubmitFunction = () => {
		announcement = 'Poslední zápis vzat zpět.';
		networkError = '';
		submitting = true;
		return async ({ update }) => {
			await update({ reset: false });
			pending = [];
			submitting = false;
		};
	};

	function saveProfile(formEvent: SubmitEvent) {
		formEvent.preventDefault();
		const fields = new FormData(formEvent.currentTarget as HTMLFormElement);
		const candidate = {
			weightKg: Number(fields.get('weightKg')),
			sex: String(fields.get('sex')) as BacProfile['sex']
		};
		if (!isValidProfile(candidate)) return;
		writeProfile(candidate);
		profile = candidate;
		editingProfile = false;
	}
</script>

<main class="page">
	<header class="head">
		<h1>{data.event.name}</h1>
		<p class="who">
			{data.me.nick} &middot; <span class="num">{total}</span>
			{entries(total)}
		</p>
	</header>

	{#if data.isHost}
		<HostViewToggle code={data.event.code} current="zapis" joined={true} />
	{/if}

	<p class="sr-only" role="status" aria-live="polite">{announcement}</p>

	{#if form?.error}
		<p class="alert" role="alert">{form.error}</p>
	{/if}
	{#if networkError}
		<p class="alert" role="alert">{networkError}</p>
	{/if}

	<form method="POST" action="?/zapsat" use:enhance={logDrink} class="pours">
		<input type="hidden" name="submissionId" value={data.submissionId} />
		{#each data.event.drinks as drink (drink.key)}
			<button
				class="pour"
				style="--tint: {drink.color}"
				name="drink"
				value={drink.key}
				disabled={submitting}
			>
				<span class="pour-name">{drink.label}</span>
				<span class="pour-vol num">{drink.volumeMl} ml</span>
				<span class="pour-glass" aria-hidden="true">
					<Tally keys={[drink.key]} px={2} {labels} />
				</span>
			</button>
		{/each}
	</form>

	{#if data.undoable && undoSecondsLeft > 0}
		<form method="POST" action="?/vzitZpet" use:enhance={takeBack} class="undo">
			<input type="hidden" name="submissionId" value={data.submissionId} />
			<input type="hidden" name="seq" value={data.undoable.seq} />
			<button class="btn undo-btn" disabled={submitting}>
				Vzít zpět: {undoneLabel ?? 'poslední zápis'}
				<span class="num undo-left">({undoSecondsLeft} s)</span>
			</button>
		</form>
	{/if}

	<section class="card bac">
		<h2>Odhad promile</h2>

		{#if !profileLoaded}
			<p class="muted small">Načítám&hellip;</p>
		{:else if !profile || editingProfile}
			<p class="muted small">
				Váha a pohlaví zůstávají v tomhle telefonu. Na server se neodesílají.
			</p>
			<form onsubmit={saveProfile} class="profile">
				<div class="stack">
					<label class="eyebrow" for="weightKg">Váha v kg</label>
					<input
						id="weightKg"
						name="weightKg"
						type="number"
						inputmode="numeric"
						class="field num"
						required
						min={MIN_WEIGHT_KG}
						max={MAX_WEIGHT_KG}
						value={profile?.weightKg ?? ''}
					/>
				</div>
				<fieldset class="sexes">
					<legend class="eyebrow">Pohlaví</legend>
					<label class="pick">
						<input type="radio" name="sex" value="male" checked={profile?.sex !== 'female'} />
						<span>muž</span>
					</label>
					<label class="pick">
						<input type="radio" name="sex" value="female" checked={profile?.sex === 'female'} />
						<span>žena</span>
					</label>
				</fieldset>
				<button class="btn btn-strong">Uložit</button>
			</form>
		{:else}
			<p class="promile display">{promile.format(bac)} &permil;</p>
			{#if bac > 0}
				<p class="muted small">
					Na nule zhruba za {soberIn < 1
						? `${Math.ceil(soberIn * 60)} min`
						: `${soberIn.toFixed(1)} h`}.
				</p>
			{/if}
			<p class="muted tiny">
				Hrubý odhad podle váhy a času, ne měření. Neříká nic o tom, jestli jsi schopný řídit.
			</p>
			<button class="btn btn-quiet change" onclick={() => (editingProfile = true)}>
				Změnit údaje
			</button>
		{/if}
	</section>

	<noscript>
		<p class="muted small">
			Zapisování funguje i bez JavaScriptu. Odhad promile ne — počítá se v prohlížeči.
		</p>
	</noscript>
</main>

<style>
	/* One thumb, one hand, a dark room. Everything that gets tapped all evening
	   is in the top half and oversized; everything that gets read once is below
	   it and quiet. */
	.page {
		margin: 0 auto;
		display: flex;
		max-width: 30rem;
		flex-direction: column;
		gap: 18px;
		padding: 20px 16px calc(28px + env(safe-area-inset-bottom));
	}

	.head {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.who {
		margin: 0;
		color: var(--quiet);
		font-size: 14px;
	}

	.who .num {
		color: var(--ink);
		font-weight: 600;
	}

	.pours {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}

	/* The only control that matters. A mat the size of a coaster, in the drink's
	   own colour, with the glass from the board printed on it - so it is picked
	   by colour and shape before the word is read. */
	.pour {
		position: relative;
		display: grid;
		grid-template-areas:
			'name glass'
			'vol glass';
		grid-template-columns: 1fr auto;
		align-items: start;
		gap: 2px 8px;
		min-height: 104px;
		border: var(--line) solid var(--ink);
		background: var(--tint);
		color: var(--ink);
		box-shadow: var(--lift) var(--lift) 0 rgb(21 18 12 / 0.16);
		padding: 12px 12px 10px;
		cursor: pointer;
		text-align: left;
		transition:
			transform 80ms ease-out,
			box-shadow 80ms ease-out;
	}

	.pour:active:not(:disabled) {
		transform: translate(var(--lift), var(--lift));
		box-shadow: 0 0 0 rgb(21 18 12 / 0.16);
	}

	/* Held shut while the last tap is still in the air. Pressed-in rather than
	   greyed out: the tap landed, it is just not finished. */
	.pour:disabled,
	.undo-btn:disabled {
		cursor: default;
		transform: translate(var(--lift), var(--lift));
		box-shadow: 0 0 0 rgb(21 18 12 / 0.16);
	}

	.pour-name {
		grid-area: name;
		font-family: var(--pixel);
		font-size: 25px;
		font-weight: 700;
		line-height: 1;
	}

	.pour-vol {
		grid-area: vol;
		font-size: 13px;
		opacity: 0.75;
	}

	.pour-glass {
		grid-area: glass;
		align-self: end;
		display: block;
	}

	.undo {
		display: flex;
	}

	/* Temporary by design: it carries its own countdown and then it is gone. */
	.undo-btn {
		width: 100%;
		justify-content: space-between;
		min-height: 48px;
		font-weight: 500;
	}

	.undo-left {
		color: var(--quiet);
	}

	.bac {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.promile {
		margin: 0;
		font-size: 46px;
		line-height: 1;
	}

	.small {
		font-size: 13px;
		line-height: 1.5;
		margin: 0;
	}

	.tiny {
		font-size: 11.5px;
		line-height: 1.5;
		margin: 0;
	}

	.profile {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.stack {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.sexes {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 18px;
	}

	.sexes legend {
		margin-bottom: 6px;
	}

	/* A radio is a 13px target; the label around it is the real one. */
	.pick {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
		cursor: pointer;
	}

	.pick input {
		width: 20px;
		height: 20px;
		accent-color: var(--ink);
	}

	.change {
		align-self: flex-start;
	}
</style>
