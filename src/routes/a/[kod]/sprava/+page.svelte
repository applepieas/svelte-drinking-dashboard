<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const active = $derived(data.participants.filter((p) => !p.kickedAt));
	const kicked = $derived(data.participants.filter((p) => p.kickedAt));
	const softOn = $derived(data.event.drinks.some((drink) => drink.key === 'soft'));
</script>

<main class="page">
	<header class="head">
		<h1>Správa: {data.event.name}</h1>
		<p class="code num">Kód: {data.event.code}</p>
	</header>

	{#if form?.error}
		<p class="alert" role="alert">{form.error}</p>
	{/if}

	<section class="card sect">
		<h2>Stav akce</h2>
		{#if data.event.closedAt}
			<p class="line">Akce je ukončená. Nikdo nemůže zapisovat ani se připojit.</p>
			<form method="POST" action="?/otevrit">
				<button class="btn btn-strong">Otevřít znovu</button>
			</form>
		{:else}
			<p class="line"><span class="dot" aria-hidden="true"></span>Akce běží.</p>
			<form method="POST" action="?/ukoncit">
				<button class="btn">Ukončit akci</button>
			</form>
		{/if}
	</section>

	<section class="card sect">
		<h2>Hráči ({active.length})</h2>

		{#if active.length === 0}
			<p class="muted line">Zatím se nikdo nepřipojil.</p>
		{:else}
			<ul class="people">
				{#each active as person (person.id)}
					<li class="person">
						<span class="nick">{person.nick}</span>
						<form method="POST" action="?/vykopnout">
							<input type="hidden" name="participantId" value={person.id} />
							<button class="btn btn-quiet">Vykopnout</button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}

		{#if kicked.length > 0}
			<div class="gone">
				<h3 class="eyebrow">Vykopnutí ({kicked.length})</h3>
				<ul class="gone-list">
					{#each kicked as person (person.id)}
						<li>{person.nick} — zápisy zůstávají v historii, přezdívka zůstává obsazená</li>
					{/each}
				</ul>
			</div>
		{/if}
	</section>

	<section class="card sect">
		<h2>Nealko</h2>
		{#if softOn}
			<p class="line">Nealko je ve hře. Na telefonech má vlastní tlačítko a počítá se do nápojů.</p>
		{:else}
			<p class="line muted">
				Nealko ve hře není. Když ho zapneš, objeví se na telefonech po dalším načtení.
			</p>
		{/if}
		<form method="POST" action="?/napoj">
			<input type="hidden" name="drink" value="soft" />
			<input type="hidden" name="on" value={softOn ? '0' : '1'} />
			<button class="btn">{softOn ? 'Vypnout nealko' : 'Zapnout nealko'}</button>
		</form>
	</section>

	<section class="card sect">
		<h2>Obrazovka</h2>
		<p class="muted line">
			Všechno z téhle stránky je i přímo na tabuli: zmáčkni na ní klávesu <b>V</b>. Funguje to v
			prohlížeči, ve kterém byla akce založena. Velikost kartiček si pamatuje ta obrazovka.
		</p>
	</section>

	<section class="card sect danger">
		<h2>Smazat akci</h2>
		<p class="muted line">
			Smaže akci i všechny zápisy. Nejde to vzít zpět. Pro potvrzení opiš kód akce.
		</p>
		<form method="POST" action="?/smazat" class="wipe">
			<label class="sr-only" for="confirm">Kód akce</label>
			<input id="confirm" name="confirm" class="field num confirm" autocomplete="off" required />
			<button class="btn btn-danger">Smazat natrvalo</button>
		</form>
	</section>

	<a class="back" href={resolve('/a/[kod]', { kod: data.event.code })}>Zpět na obrazovku</a>
</main>

<style>
	/* The host's page, usually opened once on a phone while the screen is
	   already on the wall. Nothing here is tapped in a hurry, so it reads as a
	   stack of mats rather than a control panel. */
	.page {
		margin: 0 auto;
		display: flex;
		max-width: 42rem;
		flex-direction: column;
		gap: 18px;
		padding: 24px 16px calc(32px + env(safe-area-inset-bottom));
	}

	.head {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.head h1 {
		margin: 0;
		font-size: clamp(23px, 6vw, 31px);
	}

	.code {
		margin: 0;
		color: var(--quiet);
		font-size: 15px;
		letter-spacing: 0.06em;
	}

	.sect {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.sect h2 {
		margin: 0;
	}

	.line b {
		font-family: var(--pixel);
		font-size: 1.15em;
		color: var(--ink);
	}

	.line {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		line-height: 1.5;
	}

	.dot {
		width: 10px;
		height: 10px;
		flex: none;
		background: var(--amber);
		border: 2px solid var(--ink);
	}

	.people {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.person {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		border-bottom: 2px dotted rgb(21 18 12 / 0.25);
		padding-bottom: 8px;
	}

	.person:last-child {
		border-bottom: 0;
		padding-bottom: 0;
	}

	.nick {
		font-family: var(--pixel);
		font-size: 21px;
		line-height: 1;
		overflow-wrap: anywhere;
	}

	.gone {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.gone h3 {
		margin: 0;
	}

	.gone-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin: 0;
		padding: 0;
		list-style: none;
		color: var(--quiet);
		font-size: 12.5px;
		line-height: 1.5;
	}

	/* Irreversible, so it is walled off rather than coloured in: the one black
	   button on the phone, behind a code you have to copy out by hand. */
	.danger {
		border-width: var(--line);
		background: var(--ground);
	}

	.wipe {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.confirm {
		flex: 1 1 10rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.btn-danger {
		background: var(--ink);
		color: var(--paper);
	}

	.back {
		align-self: flex-start;
	}
</style>
