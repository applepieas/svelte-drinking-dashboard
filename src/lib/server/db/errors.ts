/**
 * Postgres unique violation, narrowed to one named constraint.
 *
 * The name matters: `participant` carries two unique indexes that mean two
 * completely different things — a nick someone else took, versus this device
 * having joined already.
 */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
	if (typeof error !== 'object' || error === null) return false;
	const { code, constraint: violated } = error as { code?: unknown; constraint?: unknown };
	return code === '23505' && violated === constraint;
}
