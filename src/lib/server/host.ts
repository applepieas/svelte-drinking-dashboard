import { error, redirect } from '@sveltejs/kit';
import { isDrinkKey, withDrink } from '$lib/drinks';
import { normalizeCode } from './codes';
import { setEventDrinks } from './commands';
import { getEventByCode } from './queries';
import { hashToken } from './tokens';

/**
 * Everything that changes an event needs the host token. 403 rather than 404:
 * the event page is public anyway, so pretending it does not exist would only
 * confuse the host.
 */
export async function requireHost({
	params,
	cookies
}: {
	params: { kod: string };
	cookies: { get(name: string): string | undefined };
}) {
	const code = normalizeCode(params.kod);
	if (!code) error(404, 'Akce nenalezena');

	const row = await getEventByCode(code);
	if (!row) error(404, 'Akce nenalezena');

	const token = cookies.get(`host_${code}`);
	const isHost = token ? row.hostTokenHash === (await hashToken(token)) : false;
	if (!isHost) error(403, 'Tuhle akci spravovat nemůžeš.');

	return { code, event: row };
}

/**
 * Switches one drink on or off for a running event, then sends the browser back
 * to `back`. Shared by the board's hidden dial and the management page, which
 * are two doors to the same switch.
 */
export async function switchDrink(
	requestEvent: Parameters<typeof requireHost>[0] & { request: Request },
	back: (code: string) => string
) {
	const { code, event } = await requireHost(requestEvent);
	const form = await requestEvent.request.formData();
	const key = form.get('drink');
	if (!isDrinkKey(key)) error(400, 'Neznámý nápoj.');

	const next = withDrink(event.drinks, key, form.get('on') === '1');
	// The last drink cannot go: a phone with no buttons is a broken page.
	if (next.length > 0) await setEventDrinks(event.id, next);

	redirect(303, back(code));
}
