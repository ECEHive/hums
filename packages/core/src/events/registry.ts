/**
 * Core HUMS event map.
 *
 * Plugins extend this interface via TypeScript declaration merging to
 * contribute their own domain events. This keeps the event map fully typed
 * while allowing plugins to remain decoupled from one another.
 *
 * @example — how a plugin extends the map:
 * ```typescript
 * // plugins/sessions/src/events.ts
 * declare module "@ecehive/core" {
 *   interface HumsEventMap {
 *     "session:started": { sessionId: number; userId: number; sessionType: "regular" | "staffing" };
 *     "session:ended":   { sessionId: number; userId: number };
 *   }
 * }
 * ```
 */
export interface HumsEventMap {
	/** Emitted after a new user record is persisted for the first time. */
	"user:created": {
		userId: number;
		username: string;
		name: string;
		email: string;
	};

	/** Emitted after an existing user's profile fields are updated. */
	"user:updated": {
		userId: number;
	};

	/**
	 * Emitted when a card scan is successfully resolved to a known user.
	 * The `cardNumber` value is the normalized (9-digit, zero-padded) form.
	 */
	"user:card-scanned": {
		userId: number;
		cardNumber: string;
	};
}
