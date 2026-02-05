import type { ControlProviderType } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";
import { getControlProvider } from "./providers";

export interface AutoTurnOffResult {
	pointId: string;
	pointName: string;
	username: string;
	success: boolean;
	errorMessage?: string;
}

/**
 * Finds control points that have auto turn-off enabled and have been on
 * for longer than their configured duration.
 *
 * Returns control points that:
 * - Are active
 * - Have autoTurnOffEnabled = true
 * - Have autoTurnOffMinutes configured
 * - Currently have currentState = true (on)
 * - Were turned on more than autoTurnOffMinutes ago
 */
export async function findControlPointsToAutoTurnOff() {
	const now = new Date();

	// Find all control points that are candidates for auto turn-off
	const controlPoints = await prisma.controlPoint.findMany({
		where: {
			isActive: true,
			autoTurnOffEnabled: true,
			autoTurnOffMinutes: { not: null },
			currentState: true,
			controlClass: "SWITCH", // Only switches can be turned off
		},
		include: {
			provider: true,
		},
	});

	// For each control point, check if it's been on for too long
	const pointsToTurnOff: typeof controlPoints = [];

	for (const point of controlPoints) {
		if (!point.autoTurnOffMinutes) continue;

		// Find the last TURN_ON log for this control point
		const lastTurnOnLog = await prisma.controlLog.findFirst({
			where: {
				controlPointId: point.id,
				action: "TURN_ON",
				success: true,
			},
			orderBy: {
				createdAt: "desc",
			},
			include: {
				user: {
					select: {
						username: true,
					},
				},
			},
		});

		if (!lastTurnOnLog) {
			// No turn on record found, can't determine when it was turned on
			continue;
		}

		const turnedOnAt = lastTurnOnLog.createdAt;
		const turnOffThreshold = new Date(
			turnedOnAt.getTime() + point.autoTurnOffMinutes * 60 * 1000,
		);

		if (now >= turnOffThreshold) {
			// This point has been on too long, needs to be turned off
			// Store the username from the last turn on log for use in turn off
			(
				point as typeof point & { lastTurnOnUsername: string }
			).lastTurnOnUsername = lastTurnOnLog.user?.username ?? "system";
			pointsToTurnOff.push(point);
		}
	}

	return pointsToTurnOff;
}

/**
 * Auto turn off a single control point.
 * Uses the username of the user who originally turned it on for logging.
 */
export async function autoTurnOffControlPoint(
	point: Awaited<ReturnType<typeof findControlPointsToAutoTurnOff>>[0] & {
		lastTurnOnUsername?: string;
	},
): Promise<AutoTurnOffResult> {
	const username = point.lastTurnOnUsername ?? "system";

	try {
		// Get the user who turned it on (for logging purposes)
		const user = await prisma.user.findUnique({
			where: { username },
			select: { id: true, username: true },
		});

		// If we can't find the user, use the system user
		const systemUser = await prisma.user.findFirst({
			where: { isSystemUser: true },
			select: { id: true, username: true },
		});

		const effectiveUser = user ?? systemUser;
		if (!effectiveUser) {
			return {
				pointId: point.id,
				pointName: point.name,
				username,
				success: false,
				errorMessage: "Could not find user or system user for logging",
			};
		}

		// Get the provider and turn off the control point
		const provider = getControlProvider(
			point.provider.providerType as ControlProviderType,
		);

		const operationResult = await provider.writeState(
			point.provider.config,
			point.providerConfig,
			false, // Turn off
			username,
		);

		// Log the auto turn off action
		await prisma.controlLog.create({
			data: {
				controlPointId: point.id,
				userId: effectiveUser.id,
				action: "TURN_OFF",
				previousState: point.currentState,
				newState: operationResult.success ? false : null,
				success: operationResult.success,
				errorMessage: operationResult.success
					? `Auto turn-off after ${point.autoTurnOffMinutes} minutes`
					: operationResult.errorMessage,
			},
		});

		// Update the control point state if successful
		if (operationResult.success) {
			await prisma.controlPoint.update({
				where: { id: point.id },
				data: { currentState: false },
			});
		}

		return {
			pointId: point.id,
			pointName: point.name,
			username: effectiveUser.username,
			success: operationResult.success,
			errorMessage: operationResult.errorMessage,
		};
	} catch (err) {
		return {
			pointId: point.id,
			pointName: point.name,
			username,
			success: false,
			errorMessage: err instanceof Error ? err.message : String(err),
		};
	}
}

/**
 * Process all control points that need to be auto turned off.
 * Returns the results of each turn off operation.
 */
export async function processAutoTurnOff(): Promise<AutoTurnOffResult[]> {
	const pointsToTurnOff = await findControlPointsToAutoTurnOff();
	const results: AutoTurnOffResult[] = [];

	for (const point of pointsToTurnOff) {
		const result = await autoTurnOffControlPoint(point);
		results.push(result);
	}

	return results;
}
