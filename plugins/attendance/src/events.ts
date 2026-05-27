/**
 * Attendance domain events contributed by the attendance plugin.
 *
 * These events are emitted by the attendance plugin after shift attendance
 * records are created or updated. Other plugins can subscribe to these events
 * to react to attendance lifecycle changes.
 *
 * Usage — subscribe in another plugin's server.register():
 * ```typescript
 * ctx.events.on("attendance:marked-present", ({ userId, shiftOccurrenceId }) => {
 *   // handle attendance side effects
 * });
 * ```
 */
declare module "@ecehive/core" {
	interface HumsEventMap {
		/**
		 * Emitted after a user's shift attendance record is created or updated to
		 * "present" status (either via tap-in or the reconciliation worker).
		 */
		"attendance:marked-present": {
			userId: number;
			shiftOccurrenceId: number;
			timeIn: Date;
			didArriveLate: boolean;
		};

		/**
		 * Emitted after a user's shift attendance record is set to "absent" status.
		 * This occurs when a shift starts but the user has no active staffing session.
		 */
		"attendance:marked-absent": {
			userId: number;
			shiftOccurrenceId: number;
		};
	}
}

export {};
