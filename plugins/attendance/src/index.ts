// Import the event declarations so they are registered at module load time.
// This must be a side-effect import (no exports used from it).
import "./events";
// Import session event type declarations so the compiler knows about
// session:started and session:ended when subscribing via ctx.events.on().
import "@ecehive/plugin-sessions/events";

import type { HumsPlugin } from "@ecehive/core";
import {
	handleTapInAttendance,
	handleTapOutAttendance,
} from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { attendanceClientManifest } from "./client/index";
import { registerAttendanceRouters } from "./server/trpc/index";
import { updateShiftAttendanceWorker } from "./server/workers/update-shift-attendance";

/**
 * Attendance plugin for HUMS.
 *
 * Contributes:
 * - tRPC sub-routers: shiftSchedules, shiftTypes, shiftOccurrences,
 *   shiftAttendances, periods, periodExceptions, reports, globalReports, overview
 * - `updateShiftAttendance` background worker (reconciles attendance every minute)
 * - Attendance domain events (`attendance:marked-present`, `attendance:marked-absent`)
 * - Reacts to `session:started` / `session:ended` to record tap-in / tap-out attendance
 *   for staffing sessions (decoupled from the sessions plugin via event bus)
 */
const attendancePlugin: HumsPlugin = {
	name: "attendance",
	optionalDependencies: ["sessions"],

	server: {
		async register(ctx) {
			registerAttendanceRouters(ctx);

			// --- Event subscriptions ---
			// These handlers run in their own transactions after the session
			// transaction has committed, keeping attendance decoupled from sessions.
			// The `updateShiftAttendance` worker provides eventual-consistency
			// guarantees if an event handler fails transiently.

			ctx.events.on(
				"session:started",
				async ({ userId, sessionType, startedAt }) => {
					if (sessionType !== "staffing") return;
					try {
						await prisma.$transaction(async (tx) => {
							await handleTapInAttendance(tx, userId, startedAt);
						});
					} catch (err) {
						ctx.logger.error(
							"[attendance] Failed to handle tap-in attendance",
							{ userId, startedAt, error: err },
						);
					}
				},
			);

			ctx.events.on(
				"session:ended",
				async ({ userId, sessionType, endedAt }) => {
					if (sessionType !== "staffing") return;
					try {
						await prisma.$transaction(async (tx) => {
							await handleTapOutAttendance(tx, userId, endedAt);
						});
					} catch (err) {
						ctx.logger.error(
							"[attendance] Failed to handle tap-out attendance",
							{ userId, endedAt, error: err },
						);
					}
				},
			);

			ctx.logger.info("Attendance plugin registered");
		},

		workers: [updateShiftAttendanceWorker],
	},

	client: attendanceClientManifest,
};

export default attendancePlugin;
