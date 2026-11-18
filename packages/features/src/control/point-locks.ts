/**
 * In-process locks keyed by control point id.
 *
 * Only serializes callers in this server process; a second server instance
 * would need a database lock instead.
 */

const tails = new Map<string, Promise<void>>();

/**
 * Runs fn while holding the lock for every id. Locks are taken in sorted
 * order, so two callers with overlapping ids can't deadlock.
 */
export async function withPointLocks<T>(
	ids: string[],
	fn: () => Promise<T>,
): Promise<T> {
	const releases: (() => void)[] = [];
	try {
		for (const id of [...new Set(ids)].sort()) {
			releases.push(await acquire(id));
		}
		return await fn();
	} finally {
		for (const release of releases) release();
	}
}

function acquire(id: string): Promise<() => void> {
	const previous = tails.get(id) ?? Promise.resolve();
	let release!: () => void;
	const held = new Promise<void>((resolve) => {
		release = resolve;
	});
	const tail = previous.then(() => held);
	tails.set(id, tail);
	return previous.then(() => () => {
		release();
		if (tails.get(id) === tail) tails.delete(id);
	});
}
