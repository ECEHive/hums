/**
 * Session domain events contributed by the sessions plugin.
 *
 * These events are emitted by the sessions plugin tRPC route handlers
 * after successful database commits so that other plugins can react to
 * session lifecycle changes without directly coupling to sessions internals.
 *
 * Usage — subscribe in another plugin's server.register():
 * ```typescript
 * ctx.events.on("session:started", ({ sessionId, userId, sessionType }) => {
 *   // handle tap-in side effects (e.g. create attendance records)
 * });
 * ```
 */
declare module "@ecehive/core" {
	interface HumsEventMap {
		/**
		 * Emitted after a new session has been persisted and the transaction
		 * has committed successfully.
		 *
		 * `startedAt` is included so that listeners can record the precise
		 * tap-in time without an extra DB lookup.
		 */
		"session:started": {
			sessionId: number;
			userId: number;
			sessionType: "regular" | "staffing";
			startedAt: Date;
		};

		/**
		 * Emitted after a session's `endedAt` has been set and the transaction
		 * has committed successfully.
		 *
		 * `startedAt` and `endedAt` are included so that listeners can compute
		 * durations without an extra DB lookup.
		 */
		"session:ended": {
			sessionId: number;
			userId: number;
			sessionType: "regular" | "staffing";
			startedAt: Date;
			endedAt: Date;
		};

		/**
		 * Emitted when a user's session type is switched (regular ↔ staffing).
		 *
		 * A switch is modelled as two atomic operations: the old session is
		 * ended and a new session is started within the same transaction.
		 * Both individual events (`session:ended`, `session:started`) are also
		 * emitted so that listeners do not need to handle this event specially
		 * if they only care about starts or ends.
		 */
		"session:type-switched": {
			previousSessionId: number;
			newSessionId: number;
			userId: number;
			previousType: "regular" | "staffing";
			newType: "regular" | "staffing";
		};
	}
}

export {};
