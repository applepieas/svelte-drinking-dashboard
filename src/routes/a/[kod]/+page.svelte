<script lang="ts">
	import { resolve } from '$app/paths';
	import type { DrinkKey } from '$lib/drinks';
	import HostViewToggle from '$lib/components/HostViewToggle.svelte';
	import Tally from '$lib/art/Tally.svelte';
	import {
		clampStep,
		DEFAULT_DENSITY,
		DENSITIES,
		others,
		rowsThatFit,
		split
	} from '$lib/art/density';
	import { reduceLog } from '$lib/leaderboard';
	import { liveLog } from '$lib/liveLog.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const log = liveLog(
		() => data.event.code,
		() => data.entries
	);

	const view = $derived(reduceLog(log.entries, data.event.drinks));

	const labels = $derived(
		Object.fromEntries(data.event.drinks.map((drink) => [drink.key, drink.label])) as Record<
			DrinkKey,
			string
		>
	);
	const colours = $derived(
		Object.fromEntries(data.event.drinks.map((drink) => [drink.key, drink.color])) as Record<
			DrinkKey,
			string
		>
	);

	const labelFor = (key: string | null) => labels[key as DrinkKey] ?? '?';

	// The mat grid puts the leader on a double tile, which only reads as a
	// podium once there are a few people to stand above.
	const podium = $derived(view.leaderboard.length >= 4);

	/**
	 * How tightly the board packs everybody below the top few.
	 *
	 * It belongs to the screen rather than to the party: a laptop on the table
	 * and a television across the room want different answers, and both may be
	 * showing the same event. So it lives in this browser and nowhere else.
	 */
	const SETTING = 'na-ex-hustota';
	let step = $state(DEFAULT_DENSITY);
	let dialOpen = $state(false);

	const density = $derived(DENSITIES[step]);

	/**
	 * Measured rather than assumed: the dial picks how big a card is, and the
	 * screen decides how many of them it has room for. One row is assumed until
	 * a card exists to measure, which is enough to get the first one drawn.
	 */
	let shellHeight = $state(0);
	let cardHeight = $state(0);
	const rows = $derived(cardHeight > 0 ? rowsThatFit(shellHeight, cardHeight) : 1);
	const tiers = $derived(split(view.leaderboard.length, density.columns, rows));
	const topRows = $derived(view.leaderboard.slice(0, tiers.top));
	const smallRows = $derived(view.leaderboard.slice(tiers.top, tiers.top + tiers.small));

	$effect(() => {
		try {
			const saved = localStorage.getItem(SETTING);
			if (saved !== null) step = clampStep(Number(saved));
		} catch {
			// Private windows and blocked storage both land here; the default is fine.
		}
	});

	// Hidden on purpose: the board spends the evening on a wall, where a visible
	// control is clutter that anybody walking past can lean on.
	$effect(() => {
		/**
		 * Only a field somebody is typing into may swallow the key. Insisting the
		 * body had focus meant that clicking any link on the board - or the dial's
		 * own slider - quietly switched the shortcut off, which is indistinguishable
		 * from it not existing.
		 */
		const typing = (target: EventTarget | null) => {
			const node = target as HTMLElement | null;
			if (!node) return false;
			if (node.isContentEditable || node.tagName === 'TEXTAREA') return true;
			if (node.tagName !== 'INPUT') return false;
			const kind = (node as HTMLInputElement).type;
			return !['range', 'checkbox', 'radio', 'button', 'submit', 'color'].includes(kind);
		};

		const onKey = (event: KeyboardEvent) => {
			if (typing(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
			if (event.key === 'v' || event.key === 'V') dialOpen = !dialOpen;
			if (event.key === 'Escape') dialOpen = false;
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	function setStep(value: number) {
		step = clampStep(value);
		try {
			localStorage.setItem(SETTING, String(step));
		} catch {
			// Not being able to remember it is survivable; the dial still works.
		}
	}
	const busiestDrink = $derived(Math.max(1, ...view.byDrink.map((d) => d.count)));
	const busiestHour = $derived(Math.max(1, ...view.pace.map((p) => p.drinks)));

	const hours = $derived(Math.floor(view.elapsedMinutes / 60));
	const mins = $derived(view.elapsedMinutes % 60);

	/** 1 nápoj, 2 nápoje, 0 a 5 nápojů — the shape Czech counting takes. */
	const drinks = (n: number) => `${n} ${n === 1 ? 'nápoj' : n > 1 && n < 5 ? 'nápoje' : 'nápojů'}`;

	const time = new Intl.DateTimeFormat('cs-CZ', { hour: '2-digit', minute: '2-digit' });
	const pad = (n: number) => String(n).padStart(2, '0');
</script>

<main class="board">
	<header class="top">
		<h1>{data.event.name}</h1>
		<div class="meta">
			<span><b>{view.totalEthanolMl} ml</b> etanolu</span>
			{#if view.elapsedMinutes > 0}
				<span>jede <b>{hours} h {pad(mins)} min</b></span>
			{/if}
			<a class="swap" href={resolve('/a/[kod]/nadoba', { kod: data.event.code })}>Nádoba ⟶</a>
			<span class="code">kód {data.event.code}</span>
		</div>
	</header>

	{#if data.isHost && !data.event.closedAt}
		<HostViewToggle code={data.event.code} current="obrazovka" joined={Boolean(data.me)} />
	{/if}

	{#if log.everConnected && !log.connected}
		<p class="alert" role="status">Spojení vypadlo, připojuji se znovu. Data zůstávají.</p>
	{/if}

	{#if data.event.closedAt}
		<p class="alert">Akce skončila. Tohle je konečné pořadí.</p>
	{/if}

	{#if view.leaderboard.length === 0}
		<section class="empty">
			<div class="startmat">
				{#if !data.event.closedAt}
					<img
						class="qr"
						src={resolve('/a/[kod]/qr', { kod: data.event.code })}
						alt="QR kód pro připojení k akci {data.event.code}"
					/>
				{/if}
				<div class="startwords">
					<p class="lbl">Přidej se</p>
					<p class="code-huge">{data.event.code}</p>
					<p class="lbl">{data.joinUrl.split('/a/')[0].replace(/^https?:\/\//, '')}</p>
				</div>
			</div>
			<p class="waiting">Zatím nikdo nic nezapsal.</p>
		</section>
	{:else}
		<div class="wrap">
			<div class="left">
				<div class="mats">
					<ol class="ranking" role="list" aria-label="Žebříček">
						{#each topRows as row, i (row.nick)}
							<li
								class="mat"
								class:lead={i === 0 && podium}
								class:silver={i === 1 && podium}
								class:bronze={i === 2 && podium}
							>
								<div>
									<h2 class="nick">{row.nick}</h2>
									<p class="cnt">{drinks(row.drinks)}</p>
								</div>
								<p class="ml">{row.ethanolMl} ml</p>
								<Tally keys={row.mix} px={i === 0 && podium ? 1.4 : 0.95} {labels} />
							</li>
						{/each}
					</ol>

					{#if !data.event.closedAt}
						<aside class="joinmat">
							<img
								class="qr"
								src={resolve('/a/[kod]/qr', { kod: data.event.code })}
								alt="QR kód pro připojení k akci {data.event.code}"
							/>
							<p class="lbl">Přidej se</p>
						</aside>
					{/if}
				</div>

				{#if view.leaderboard.length > tiers.top}
					<div class="shell" bind:clientHeight={shellHeight}>
						<ol
							class="smalls"
							role="list"
							aria-label="Dál v pořadí"
							style="--cols: {density.columns}; --scale: {density.scale}"
						>
							{#each smallRows as row, i (row.nick)}
								<li class="small" bind:clientHeight={cardHeight}>
									<span class="place">{tiers.top + i + 1}</span>
									<span class="sname">{row.nick}</span>
									<span class="sml">{row.ethanolMl} ml</span>
								</li>
							{/each}
						</ol>
					</div>
				{/if}

				{#if tiers.rest > 0}
					<p class="more">{others(tiers.rest)}</p>
				{/if}
			</div>

			<div class="side">
				<section class="tile">
					<h2>Co se pilo</h2>
					{#each view.byDrink as drink (drink.key)}
						<div class="mixrow">
							<Tally keys={[drink.key]} px={0.9} {labels} />
							<span class="lbl2">{labels[drink.key]}</span>
							<span class="n">{drink.count}<small>{drink.ethanolMl} ml</small></span>
							<span class="bar">
								<span
									style="width: {Math.round(
										(drink.count / busiestDrink) * 100
									)}%; background: {colours[drink.key]}"
								></span>
							</span>
						</div>
					{/each}
				</section>

				{#if view.lastHour.length > 0}
					<section class="tile">
						<h2>Poslední hodina</h2>
						<p class="hour">
							<span class="who">{view.lastHour[0].nick}</span>
							<span class="num"
								>{drinks(view.lastHour[0].drinks)} · {view.lastHour[0].ethanolMl} ml</span
							>
						</p>
						<ul class="chase">
							{#each view.lastHour.slice(1, 4) as row (row.nick)}
								<li><b>{row.nick}</b> {row.drinks} · {row.ethanolMl} ml</li>
							{/each}
						</ul>
					</section>
				{/if}

				{#if view.pace.length > 1}
					<section class="tile grow">
						<h2>Tempo po hodinách</h2>
						<div class="pace">
							{#each view.pace as bucket, i (i)}
								<div class:now={i === view.pace.length - 1}>
									<i style="height: {Math.round((bucket.drinks / busiestHour) * 100)}%"></i>
									<em>{pad(bucket.hour)}</em>
								</div>
							{/each}
						</div>
					</section>
				{/if}
			</div>
		</div>

		{#if view.recent.length > 0}
			<footer class="feed">
				{#each view.recent.slice(0, 7) as item (item.seq)}
					<span>
						{time.format(new Date(item.at))}
						<b>{item.nick}</b>
						{labelFor(item.drinkKey)}
					</span>
				{/each}
			</footer>
		{/if}
	{/if}

	{#if data.isHost}
		<a class="admin" href={resolve('/a/[kod]/sprava', { kod: data.event.code })}>Správa akce</a>
	{/if}

	{#if dialOpen}
		<aside class="dial">
			<label for="hustota">Velikost kartiček</label>
			<input
				id="hustota"
				type="range"
				min="0"
				max={DENSITIES.length - 1}
				step="1"
				value={step}
				oninput={(event) => setStep(Number(event.currentTarget.value))}
			/>
			<p><b>{density.label}</b> &middot; {tiers.small} lidí pod medailemi</p>
			<p class="dim">Zavře se klávesou V. Platí pro tuhle obrazovku.</p>
		</aside>
	{/if}
</main>

<style>
	/* A screen hung in a room and read from across it, not a page anybody leans
	   into. Everything is sized so the ranking carries at a distance. */
	.board {
		--ink: #15120c;
		--paper: #fff8e8;
		--amber: #ffc60b;
		--ground: #f4eddc;
		--quiet: #6b5b33;
		min-height: 100dvh;
		background: var(--ground);
		color: var(--ink);
		padding: clamp(14px, 2.2vw, 30px);
		display: flex;
		flex-direction: column;
		gap: clamp(10px, 1.4vw, 18px);
		overflow: hidden;
	}

	/* A screen on a wall has no scrollbar and nobody to reach it, so the board
	   is exactly the window and the cards underneath take what is left. A phone
	   is held and scrolled, so there it keeps growing. */
	@media (min-width: 901px) {
		.board {
			height: 100dvh;
		}
	}

	.top {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px 22px;
	}

	.top h1 {
		margin: 0;
		font-family: 'Pixelify Sans', ui-monospace, monospace;
		font-size: clamp(26px, 2.8vw, 40px);
		font-weight: 700;
		line-height: 1;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 22px;
		align-items: baseline;
		font-size: clamp(12px, 1vw, 15px);
		color: var(--quiet);
	}

	.meta b {
		font-family: 'Pixelify Sans', ui-monospace, monospace;
		font-size: clamp(18px, 1.8vw, 27px);
		color: var(--ink);
	}

	/* The other way of looking at the same evening. */
	.swap {
		color: var(--ink);
		text-decoration: none;
		border-bottom: 2px solid var(--ink);
	}

	.alert {
		margin: 0;
		border: 3px solid var(--ink);
		background: var(--amber);
		padding: 10px 14px;
		font-weight: 600;
	}

	.wrap {
		flex: 1;
		display: grid;
		grid-template-columns: minmax(0, 1fr) clamp(280px, 26vw, 400px);
		gap: clamp(10px, 1.1vw, 16px);
		min-height: 0;
	}

	.ranking {
		display: contents;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.left {
		display: flex;
		flex-direction: column;
		gap: clamp(8px, 1vw, 14px);
		min-height: 0;
	}

	.mats {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: clamp(9px, 1vw, 14px);
		align-content: start;
		min-height: 0;
	}

	.mat,
	.joinmat,
	.tile {
		border: 4px solid var(--ink);
		background: var(--paper);
		box-shadow: 6px 6px 0 rgba(21, 18, 12, 0.18);
		min-width: 0;
	}

	.mat {
		padding: 14px 16px 12px;
		display: flex;
		flex-direction: column;
		gap: 7px;
	}

	.mat.lead {
		background: var(--amber);
		grid-row: span 2;
		justify-content: space-between;
	}

	.mat.silver {
		background: #c8cedc;
	}

	.mat.bronze {
		background: #c98a1c;
	}

	.nick {
		margin: 0;
		font-size: clamp(16px, 1.5vw, 21px);
		font-weight: 700;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.mat.lead .nick {
		font-size: clamp(20px, 2.1vw, 31px);
	}

	.cnt {
		margin: 0;
		font-size: clamp(10px, 0.78vw, 12px);
		color: var(--quiet);
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.ml {
		margin: 0;
		font-family: 'Pixelify Sans', ui-monospace, monospace;
		font-size: clamp(26px, 2.6vw, 38px);
		line-height: 0.9;
	}

	.mat.lead .ml {
		font-size: clamp(44px, 5.4vw, 80px);
	}

	/* The glasses sit on the bottom edge of the mat, under a tear line. */
	/* The glasses say what somebody drank; the number above them says how much.
	   At twenty-five people with a dozen rounds each the glasses would wrap into
	   a wall of their own and push everybody below off the screen, so they get
	   a fixed strip: one row on a mat, two on the leader's. */
	.mat :global(.tally) {
		margin-top: auto;
		padding-top: 6px;
		border-top: 2px dashed rgba(21, 18, 12, 0.22);
		max-height: calc(var(--rows, 1) * clamp(26px, 2.4vw, 38px));
		overflow: hidden;
	}

	.mat.lead :global(.tally) {
		--rows: 2;
	}

	.joinmat {
		background: var(--ink);
		color: var(--paper);
		padding: clamp(7px, 0.7vw, 11px);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: clamp(8px, 1vw, 14px);
	}

	.joinmat .qr {
		width: clamp(62px, 6vw, 96px);
		height: auto;
		flex: none;
		background: #fff;
		padding: 5px;
	}

	.lbl {
		margin: 0;
		font-size: clamp(9px, 0.75vw, 11px);
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #9b8f6e;
	}

	/* Everybody who is not on a medal. Same mat, printed small: a rank, a name
	   and a number, because at this size a glass would be a smudge. */
	/* Takes whatever the medals leave and never more, so the board as a whole
	   stays the size of the screen it hangs on. */
	.shell {
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.smalls {
		display: grid;
		grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
		gap: clamp(5px, 0.6vw, 10px);
		margin: 0;
		padding: 0;
		list-style: none;
		align-content: start;
		min-height: 0;
	}

	.small {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: baseline;
		column-gap: calc(7px * var(--scale));
		border: 3px solid var(--ink);
		background: var(--paper);
		box-shadow: 3px 3px 0 rgb(21 18 12 / 0.16);
		padding: calc(7px * var(--scale)) calc(9px * var(--scale));
	}

	.small .place {
		font-family: 'Pixelify Sans', ui-monospace, monospace;
		font-size: calc(clamp(13px, 1.1vw, 18px) * var(--scale));
		color: var(--quiet);
		line-height: 1;
	}

	.small .sname {
		font-family: 'Pixelify Sans', ui-monospace, monospace;
		font-size: calc(clamp(15px, 1.35vw, 23px) * var(--scale));
		line-height: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.small .sml {
		grid-column: 2;
		font-size: calc(clamp(11px, 0.95vw, 15px) * var(--scale));
		font-variant-numeric: tabular-nums;
		color: var(--quiet);
	}

	/* The tail of a long party. A card each would cost more room than the fact
	   is worth, and a name nobody can read is worse than no name. */
	.more {
		margin: 0;
		font-size: clamp(12px, 1.05vw, 16px);
		color: var(--quiet);
	}

	/* Hidden until somebody presses V, and then it sits over the corner rather
	   than pushing the board around while it is being set. */
	.dial {
		position: fixed;
		right: clamp(10px, 1.6vw, 24px);
		bottom: clamp(10px, 1.6vw, 24px);
		z-index: 40;
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: min(300px, 80vw);
		border: 4px solid var(--ink);
		background: var(--paper);
		box-shadow: 6px 6px 0 rgb(21 18 12 / 0.18);
		padding: 14px 16px;
		font-size: 13px;
	}

	.dial label {
		font-size: 10px;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--quiet);
	}

	.dial input {
		width: 100%;
		accent-color: var(--ink);
		margin: 0;
	}

	.dial p {
		margin: 0;
	}

	.dial .dim {
		color: var(--quiet);
		font-size: 11.5px;
		line-height: 1.5;
	}

	/* The column beside the board keeps to the window too, or its last tile
	   slides under the feed along the bottom. */
	.side {
		min-height: 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		gap: clamp(9px, 1vw, 14px);
		min-height: 0;
	}

	.tile {
		padding: 13px 15px 12px;
		display: flex;
		flex-direction: column;
		gap: 9px;
	}

	.tile.grow {
		flex: 1;
	}

	.tile h2 {
		margin: 0;
		font-size: clamp(9px, 0.76vw, 11px);
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--quiet);
		font-weight: 600;
	}

	.mixrow {
		display: grid;
		grid-template-columns: 34px minmax(0, 1fr) auto;
		gap: 10px;
		align-items: center;
	}

	.mixrow :global(.tally) {
		justify-content: center;
	}

	.lbl2 {
		font-size: clamp(12px, 1.05vw, 15px);
		font-weight: 600;
	}

	.n {
		font-family: 'Pixelify Sans', ui-monospace, monospace;
		font-size: clamp(16px, 1.5vw, 21px);
		text-align: right;
	}

	.n small {
		display: block;
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: 11px;
		color: var(--quiet);
	}

	.bar {
		grid-column: 2;
		height: 7px;
		background: rgba(21, 18, 12, 0.12);
		margin-top: -4px;
	}

	.bar span {
		display: block;
		height: 100%;
	}

	.hour {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 10px;
	}

	.who {
		font-family: 'Pixelify Sans', ui-monospace, monospace;
		font-size: clamp(20px, 2.1vw, 31px);
	}

	.num {
		font-size: clamp(11px, 0.95vw, 14px);
		color: var(--quiet);
	}

	.chase {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: clamp(11px, 0.9vw, 13px);
		color: var(--quiet);
	}

	.chase b {
		color: var(--ink);
	}

	.pace {
		display: flex;
		align-items: flex-end;
		gap: 7px;
		flex: 1;
		min-height: 70px;
	}

	.pace div {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		align-items: center;
		gap: 5px;
		height: 100%;
	}

	.pace i {
		display: block;
		width: 100%;
		background: var(--ink);
	}

	.pace div.now i {
		background: var(--amber);
		outline: 2px solid var(--ink);
	}

	.pace em {
		font-style: normal;
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: 11px;
		color: var(--quiet);
	}

	.feed {
		display: flex;
		gap: clamp(12px, 1.6vw, 24px);
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: clamp(11px, 0.95vw, 14px);
		color: var(--quiet);
		border-top: 3px solid var(--ink);
		padding-top: 10px;
		overflow: hidden;
		white-space: nowrap;
	}

	.feed b {
		color: var(--ink);
	}

	/* Before anybody has drunk anything the screen has one job: get people in.
	   So the invitation is the board - the same mat the populated screen keeps
	   in the corner, grown to fill the room. */
	.empty {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: clamp(14px, 2vw, 26px);
	}

	.startmat {
		display: flex;
		align-items: center;
		gap: clamp(16px, 2.4vw, 38px);
		border: 4px solid var(--ink);
		background: var(--ink);
		color: var(--paper);
		box-shadow: 6px 6px 0 rgb(21 18 12 / 0.18);
		padding: clamp(16px, 2vw, 30px);
	}

	.startwords {
		display: flex;
		flex-direction: column;
	}

	.empty .qr {
		width: clamp(120px, 16vw, 220px);
		height: auto;
		flex: none;
		background: #fff;
		padding: 6px;
	}

	.code-huge {
		margin: 4px 0;
		font-family: 'Pixelify Sans', ui-monospace, monospace;
		font-size: clamp(40px, 6vw, 92px);
		letter-spacing: 0.08em;
		line-height: 1;
	}

	.waiting {
		margin: 0;
		color: var(--quiet);
		font-size: clamp(13px, 1.2vw, 18px);
	}

	/* A phone turns the invitation into a column. */
	@media (max-width: 640px) {
		.startmat {
			flex-direction: column;
			text-align: center;
		}
	}

	.admin {
		color: var(--quiet);
		font-size: 13px;
	}

	/* Narrow screens get one column of mats and the tiles below them. The screen
	   this is really for is a wide one, so this is a fallback rather than a
	   design of its own. */
	@media (max-width: 900px) {
		.wrap {
			grid-template-columns: minmax(0, 1fr);
		}

		.mats {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.mat.lead {
			grid-row: auto;
			grid-column: span 2;
		}

		.joinmat {
			grid-column: span 2;
		}
	}
</style>
