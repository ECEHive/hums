/**
 * EventBus — typed pub/sub event system for inter-plugin communication.
 *
 * Plugins communicate through events rather than direct imports, keeping
 * them loosely coupled. The event map is open for extension via TypeScript
 * declaration merging in {@link HumsEventMap}.
 *
 * @example
 * ```typescript
 * const bus = new EventBus<HumsEventMap>();
 *
 * // Subscribe
 * const unsubscribe = bus.on("user:created", ({ userId }) => {
 *   console.log("New user:", userId);
 * });
 *
 * // Publish
 * bus.emit("user:created", { userId: 1, username: "alice", name: "Alice", email: "alice@example.com" });
 *
 * // Unsubscribe
 * unsubscribe();
 * ```
 */

type EventHandler<T> = (payload: T) => void;

// TEventMap is intentionally unconstrained so that both `interface` (needed
// for declaration merging) and `type` aliases can be used as event maps.
// The per-method constraints (`K extends keyof TEventMap`) provide all the
// type safety needed without an index signature requirement.
// biome-ignore lint/suspicious/noExplicitAny: intentional open generic
export class EventBus<TEventMap = Record<string, any>> {
	// Store handlers as `unknown` internally and cast at the call sites
	// so we can use a single Map without per-key generics.
	private readonly listeners = new Map<
		keyof TEventMap,
		Set<EventHandler<unknown>>
	>();

	/**
	 * Publish an event to all registered listeners.
	 *
	 * Errors thrown by individual handlers are caught and logged so that
	 * one bad handler cannot prevent others from receiving the event.
	 */
	emit<K extends keyof TEventMap>(event: K, payload: TEventMap[K]): void {
		const handlers = this.listeners.get(event);
		if (!handlers || handlers.size === 0) {
			return;
		}

		for (const handler of handlers) {
			try {
				handler(payload as unknown);
			} catch (err) {
				// Individual handler failures must not poison sibling handlers.
				console.error(
					`[EventBus] Unhandled error in handler for event "${String(event)}":`,
					err,
				);
			}
		}
	}

	/**
	 * Subscribe to an event.
	 *
	 * @returns An unsubscribe function. Call it to remove the handler.
	 */
	on<K extends keyof TEventMap>(
		event: K,
		handler: EventHandler<TEventMap[K]>,
	): () => void {
		let bucket = this.listeners.get(event);
		if (!bucket) {
			bucket = new Set();
			this.listeners.set(event, bucket);
		}
		// biome-ignore lint/suspicious/noExplicitAny: Generic mapped-type storage requires casting
		bucket.add(handler as EventHandler<any>);
		return () => this.off(event, handler);
	}

	/**
	 * Unsubscribe a previously registered handler.
	 *
	 * No-op if the handler was never registered.
	 */
	off<K extends keyof TEventMap>(
		event: K,
		handler: EventHandler<TEventMap[K]>,
	): void {
		// biome-ignore lint/suspicious/noExplicitAny: Generic mapped-type storage requires casting
		this.listeners.get(event)?.delete(handler as EventHandler<any>);
	}

	/**
	 * Subscribe to an event exactly once.
	 *
	 * The handler is automatically removed after its first invocation.
	 *
	 * @returns An unsubscribe function. Call it to remove the handler before
	 *   the first invocation.
	 */
	once<K extends keyof TEventMap>(
		event: K,
		handler: EventHandler<TEventMap[K]>,
	): () => void {
		const wrapper: EventHandler<TEventMap[K]> = (payload) => {
			this.off(event, wrapper);
			handler(payload);
		};
		return this.on(event, wrapper);
	}

	/**
	 * Remove all handlers for a specific event, or all handlers if no event
	 * is specified.
	 */
	clear(event?: keyof TEventMap): void {
		if (event !== undefined) {
			this.listeners.delete(event);
		} else {
			this.listeners.clear();
		}
	}

	/**
	 * Returns the number of handlers currently registered for an event.
	 * Useful for debugging and tests.
	 */
	listenerCount(event: keyof TEventMap): number {
		return this.listeners.get(event)?.size ?? 0;
	}
}
