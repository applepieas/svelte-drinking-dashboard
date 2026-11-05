<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { DENSITIES } from '$lib/art/density';

	/**
	 * The board's settings, behind the V key.
	 *
	 * The event is created on the screen that shows it, so this is where the host
	 * already is. Everything Správa can do is here too; Správa stays as the same
	 * forms for a browser without JavaScript.
	 *
	 * Card size is the screen's own and anybody at the keyboard may change it.
	 * The rest changes the party for everybody, so it needs the host cookie.
	 */
	interface Person {
		id: string;
		nick: string;
		kickedAt: Date | null;
	}

	interface Props {
		code: string;
		closed: boolean;
		isHost: boolean;
		/** Whether this device has also joined as a player. */
		joined: boolean;
		softOn: boolean;
		participants: Person[];
		step: number;
		/** How many people the current size fits on small cards. */
		fitted: number;
		error?: string;
		onstep: (step: number) => void;
		onclose: () => void;
	}

	let {
		code,
		closed,
		isHost,
		joined,
		softOn,
		participants,
		step,
		fitted,
		error,
		onstep,
		onclose
	}: Props = $props();

	const active = $derived(participants.filter((p) => !p.kickedAt));
	const kicked = $derived(participants.filter((p) => p.kickedAt).length);
</script>

<aside class="settings" aria-label="Nastavení tabule">
	<header>
		<h2>Nastavení</h2>
		<button type="button" class="close" onclick={onclose} aria-label="Zavřít">×</button>
	</header>

	{#if error}
		<p class="alert" role="alert">{error}</p>
	{/if}

	<section>
		<label class="eyebrow" for="hustota">Velikost kartiček</label>
		<input
			id="hustota"
			type="range"
			min="0"
			max={DENSITIES.length - 1}
			step="1"
			value={step}
			oninput={(event) => onstep(Number(event.currentTarget.value))}
		/>
		<p><b>{DENSITIES[step].label}</b> &middot; {fitted} lidí pod medailemi</p>
		<p class="dim">Platí jen pro tuhle obrazovku.</p>
	</section>

	{#if isHost}
		<section>
			<h3 class="eyebrow">Akce</h3>
			<form method="POST" action={closed ? '?/otevrit' : '?/ukoncit'} class="row" use:enhance>
				<span>{closed ? 'Ukončená, nikdo nezapisuje.' : 'Běží.'}</span>
				<button class="btn">{closed ? 'Otevřít znovu' : 'Ukončit akci'}</button>
			</form>
		</section>

		<section>
			<h3 class="eyebrow">Nápoje</h3>
			<form method="POST" action="?/napoj" class="row" use:enhance>
				<input type="hidden" name="drink" value="soft" />
				<input type="hidden" name="on" value={softOn ? '0' : '1'} />
				<span>Nealko ve hře: <b>{softOn ? 'ano' : 'ne'}</b></span>
				<button class="btn">{softOn ? 'Vypnout' : 'Zapnout'}</button>
			</form>
			<p class="dim">Telefony změnu uvidí po dalším načtení.</p>
		</section>

		<section>
			<h3 class="eyebrow">Hráči ({active.length})</h3>
			{#if active.length === 0}
				<p class="dim">Zatím se nikdo nepřipojil.</p>
			{:else}
				<ul class="people">
					{#each active as person (person.id)}
						<li>
							<span class="nick">{person.nick}</span>
							<form method="POST" action="?/vykopnout" use:enhance>
								<input type="hidden" name="participantId" value={person.id} />
								<button class="btn quiet">Vykopnout</button>
							</form>
						</li>
					{/each}
				</ul>
			{/if}
			{#if kicked > 0}
				<p class="dim">Vykopnutí: {kicked}. Jejich zápisy zůstávají v historii.</p>
			{/if}
		</section>

		{#if !closed}
			<section>
				<h3 class="eyebrow">Tohle zařízení</h3>
				<a
					class="link"
					href={joined
						? resolve('/a/[kod]/zapis', { kod: code })
						: resolve('/a/[kod]/pripojit', { kod: code })}
				>
					{joined ? 'Zapisovat odsud' : 'Připojit se odsud'} ⟶
				</a>
				{#if joined}
					<form method="POST" action="?/novyhrac">
						<button class="btn quiet">Připojit dalšího hráče</button>
					</form>
					<p class="dim">
						Tenhle prohlížeč pak bude za nového hráče. Ten dosavadní zůstává ve hře i se zápisy, jen
						odsud už za něj zapisovat nepůjde.
					</p>
				{/if}
			</section>
		{/if}

		<section class="danger">
			<h3 class="eyebrow">Smazat akci</h3>
			<p class="dim">Smaže akci i všechny zápisy, natrvalo. Pro potvrzení opiš kód akce.</p>
			<form method="POST" action="?/smazat" class="row" use:enhance>
				<label class="sr-only" for="confirm">Kód akce</label>
				<input id="confirm" name="confirm" autocomplete="off" required placeholder={code} />
				<button class="btn red">Smazat</button>
			</form>
		</section>
	{:else}
		<p class="dim">Zbytek nastavení má jen prohlížeč, ve kterém byla akce založena.</p>
	{/if}

	<p class="dim foot">Zavře se klávesou V nebo Esc.</p>
</aside>

<style>
	/* A drawer over the right-hand column, not a page of its own: the board keeps
	   running beside it, so the host sees the effect of every switch. */
	.settings {
		position: fixed;
		top: clamp(10px, 1.6vw, 24px);
		right: clamp(10px, 1.6vw, 24px);
		bottom: clamp(10px, 1.6vw, 24px);
		z-index: 70;
		width: min(400px, calc(100vw - 20px));
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 16px;
		border: 4px solid var(--ink);
		background: var(--paper);
		box-shadow: 6px 6px 0 rgb(21 18 12 / 0.18);
		padding: 16px 18px;
		font-size: 13px;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	h2 {
		margin: 0;
		font-family: 'Pixelify Sans', ui-monospace, monospace;
		font-size: 22px;
	}

	.close {
		border: 0;
		background: none;
		font: inherit;
		font-size: 24px;
		line-height: 1;
		color: var(--quiet);
		cursor: pointer;
		padding: 0 4px;
	}

	section {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-top: 14px;
		border-top: 2px dashed rgb(21 18 12 / 0.22);
	}

	.eyebrow {
		margin: 0;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--quiet);
	}

	p {
		margin: 0;
	}

	.dim {
		color: var(--quiet);
		font-size: 11.5px;
		line-height: 1.5;
	}

	.foot {
		margin-top: auto;
	}

	input[type='range'] {
		width: 100%;
		accent-color: var(--ink);
		margin: 0;
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}

	.btn {
		flex: none;
		font: inherit;
		font-weight: 600;
		border: 3px solid var(--ink);
		background: var(--amber);
		color: var(--ink);
		padding: 4px 10px;
		cursor: pointer;
	}

	.btn.quiet {
		background: var(--paper);
		font-weight: 500;
	}

	.btn.red {
		background: #d94b3d;
		color: var(--paper);
	}

	.people {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
	}

	.people li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 5px 0;
		border-bottom: 1px dotted rgb(21 18 12 / 0.25);
	}

	.nick {
		font-family: 'Pixelify Sans', ui-monospace, monospace;
		font-size: 16px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.danger input {
		flex: 1;
		min-width: 0;
		font: inherit;
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		text-transform: uppercase;
		border: 3px solid var(--ink);
		background: #fff;
		padding: 4px 8px;
	}

	.link {
		color: var(--ink);
		font-weight: 600;
	}

	.alert {
		border: 3px solid var(--ink);
		background: var(--amber);
		padding: 8px 10px;
		font-weight: 600;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
</style>
