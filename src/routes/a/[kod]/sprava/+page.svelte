<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const active = $derived(data.participants.filter((p) => !p.kickedAt));
	const kicked = $derived(data.participants.filter((p) => p.kickedAt));
</script>

<main class="mx-auto flex max-w-2xl flex-col gap-6 p-6">
	<header class="flex flex-col gap-1">
		<h1 class="text-2xl font-semibold">Správa: {data.event.name}</h1>
		<p class="muted num">Kód: {data.event.code}</p>
	</header>

	{#if form?.error}
		<p class="alert" role="alert">{form.error}</p>
	{/if}

	<section class="card flex flex-col gap-3">
		<h2 class="font-semibold">Stav akce</h2>
		{#if data.event.closedAt}
			<p>Akce je ukončená. Nikdo nemůže zapisovat ani se připojit.</p>
			<form method="POST" action="?/otevrit">
				<button class="btn">Otevřít znovu</button>
			</form>
		{:else}
			<p>Akce běží.</p>
			<form method="POST" action="?/ukoncit">
				<button class="btn">Ukončit akci</button>
			</form>
		{/if}
	</section>

	<section class="card flex flex-col gap-3">
		<h2 class="font-semibold">Hráči ({active.length})</h2>

		{#if active.length === 0}
			<p class="muted">Zatím se nikdo nepřipojil.</p>
		{:else}
			<ul class="flex flex-col gap-2">
				{#each active as person (person.id)}
					<li class="flex items-center gap-3">
						<span class="grow">{person.nick}</span>
						<form method="POST" action="?/vykopnout">
							<input type="hidden" name="participantId" value={person.id} />
							<button class="btn btn-quiet">Vykopnout</button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}

		{#if kicked.length > 0}
			<div class="flex flex-col gap-1">
				<h3 class="muted text-sm">Vykopnutí ({kicked.length})</h3>
				<ul class="muted flex flex-col gap-1 text-sm">
					{#each kicked as person (person.id)}
						<li>{person.nick} — zápisy zůstávají v historii, přezdívka zůstává obsazená</li>
					{/each}
				</ul>
			</div>
		{/if}
	</section>

	<section class="card flex flex-col gap-3">
		<h2 class="font-semibold">Smazat akci</h2>
		<p class="muted text-sm">
			Smaže akci i všechny zápisy. Nejde to vzít zpět. Pro potvrzení opiš kód akce.
		</p>
		<form method="POST" action="?/smazat" class="flex flex-wrap items-center gap-2">
			<label class="sr-only" for="confirm">Kód akce</label>
			<input id="confirm" name="confirm" class="field num" autocomplete="off" required />
			<button class="btn">Smazat natrvalo</button>
		</form>
	</section>

	<a href={resolve('/a/[kod]', { kod: data.event.code })}>Zpět na obrazovku</a>
</main>
