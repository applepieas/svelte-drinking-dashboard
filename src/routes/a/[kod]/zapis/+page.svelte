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
	import HostViewToggle from '$lib/components/HostViewToggle.svelte';
	import { ethanolByKey } from '$lib/leaderboard';
	import { readProfile, writeProfile } from '$lib/profile';
	import type { PageProps, SubmitFunction } from './$types';

	let { data, form }: PageProps = $props();

	/** Drinks tapped but not yet confirmed by the server. */
	let pending = $state<ConsumedDrink[]>([]);
	let announcement = $state('');
	let networkError = $state('');

	/** Ticks so the countdown and the estimate move without a reload. */
	let now = $state(Date.now());
	/** Guards against rendering a stored value during SSR, and against a flash of "0". */
	let profileLoaded = $state(false);
	let profile = $state<BacProfile | null>(null);
	let editingProfile = $state(false);

	const ethanol = $derived(ethanolByKey(data.event.drinks));
	const total = $derived(data.myDrinks.length + pending.length);

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
		};
	};

	const takeBack: SubmitFunction = () => {
		announcement = 'Poslední zápis vzat zpět.';
		networkError = '';
		return async ({ update }) => {
			await update({ reset: false });
			pending = [];
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

<main class="mx-auto flex max-w-md flex-col gap-6 p-6">
	<header class="flex flex-col gap-1">
		<h1 class="text-xl font-semibold">{data.event.name}</h1>
		<p class="muted text-sm">
			{data.me.nick} &middot; <span class="num">{total}</span>
			{total === 1 ? 'zápis' : 'zápisů'}
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

	<form method="POST" action="?/zapsat" use:enhance={logDrink} class="flex flex-col gap-2">
		<input type="hidden" name="submissionId" value={data.submissionId} />
		{#each data.event.drinks as drink (drink.key)}
			<button class="btn justify-between" name="drink" value={drink.key}>
				<span>{drink.label}</span>
				<span class="muted num text-sm">{drink.volumeMl} ml</span>
			</button>
		{/each}
	</form>

	{#if data.undoable && undoSecondsLeft > 0}
		<form method="POST" action="?/vzitZpet" use:enhance={takeBack} class="flex flex-col gap-1">
			<input type="hidden" name="submissionId" value={data.submissionId} />
			<input type="hidden" name="seq" value={data.undoable.seq} />
			<button class="btn btn-quiet">
				Vzít zpět: {undoneLabel ?? 'poslední zápis'}
				<span class="muted num">({undoSecondsLeft} s)</span>
			</button>
		</form>
	{/if}

	<section class="card flex flex-col gap-2">
		<h2 class="font-semibold">Odhad promile</h2>

		{#if !profileLoaded}
			<p class="muted text-sm">Načítám&hellip;</p>
		{:else if !profile || editingProfile}
			<p class="muted text-sm">
				Váha a pohlaví zůstávají v tomhle telefonu. Na server se neodesílají.
			</p>
			<form onsubmit={saveProfile} class="flex flex-col gap-3">
				<div class="flex flex-col gap-1">
					<label for="weightKg">Váha v kg</label>
					<input
						id="weightKg"
						name="weightKg"
						type="number"
						class="field num"
						required
						min={MIN_WEIGHT_KG}
						max={MAX_WEIGHT_KG}
						value={profile?.weightKg ?? ''}
					/>
				</div>
				<fieldset class="flex gap-4">
					<legend class="mb-1">Pohlaví</legend>
					<label class="flex gap-2">
						<input type="radio" name="sex" value="male" checked={profile?.sex !== 'female'} /> muž
					</label>
					<label class="flex gap-2">
						<input type="radio" name="sex" value="female" checked={profile?.sex === 'female'} /> žena
					</label>
				</fieldset>
				<button class="btn">Uložit</button>
			</form>
		{:else}
			<p class="num text-3xl">{promile.format(bac)} &permil;</p>
			{#if bac > 0}
				<p class="muted text-sm">
					Na nule zhruba za {soberIn < 1
						? `${Math.ceil(soberIn * 60)} min`
						: `${soberIn.toFixed(1)} h`}.
				</p>
			{/if}
			<p class="muted text-xs">
				Hrubý odhad podle váhy a času, ne měření. Neříká nic o tom, jestli jsi schopný řídit.
			</p>
			<button class="btn btn-quiet self-start" onclick={() => (editingProfile = true)}>
				Změnit údaje
			</button>
		{/if}
	</section>

	<noscript>
		<p class="muted text-sm">
			Zapisování funguje i bez JavaScriptu. Odhad promile ne — počítá se v prohlížeči.
		</p>
	</noscript>
</main>
