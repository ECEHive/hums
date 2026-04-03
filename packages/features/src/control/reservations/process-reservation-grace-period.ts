import type { ReservationStatus } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";
import { ConfigService } from "../../config";

export interface GracePeriodResult {
	reservationId: string;
	controlPointName: string;
	userName: string;
	action: "no_show" | "completed";
}

/**
 * Process reservations that have exceeded their grace period or have ended.
 *
 * 1. PENDING reservations past startTime + gracePeriod → mark NO_SHOW
 * 2. ACTIVE reservations past endTime → mark COMPLETED
 * 3. PENDING reservations past endTime → mark NO_SHOW (even without grace period)
 */
export async function processReservationGracePeriod(): Promise<
	GracePeriodResult[]
> {
	const now = new Date();
	const results: GracePeriodResult[] = [];

	const gracePeriodMinutes = await ConfigService.get<number>(
		"reservations.grace_period_minutes",
	);
	const gracePeriod = (gracePeriodMinutes ?? 15) * 60 * 1000;

	// 1. Find PENDING reservations where grace period has expired
	const pendingStatuses: ReservationStatus[] = ["PENDING"];
	const pendingReservations = await prisma.reservation.findMany({
		where: {
			status: { in: pendingStatuses },
			startTime: { lte: new Date(now.getTime() - gracePeriod) },
		},
		include: {
			controlPoint: { select: { name: true } },
			user: { select: { name: true } },
		},
	});

	for (const reservation of pendingReservations) {
		await prisma.reservation.update({
			where: { id: reservation.id },
			data: { status: "NO_SHOW" },
		});
		results.push({
			reservationId: reservation.id,
			controlPointName: reservation.controlPoint.name,
			userName: reservation.user.name,
			action: "no_show",
		});
	}

	// 2. Find ACTIVE reservations past endTime → COMPLETED
	const activeStatuses: ReservationStatus[] = ["ACTIVE"];
	const expiredActive = await prisma.reservation.findMany({
		where: {
			status: { in: activeStatuses },
			endTime: { lte: now },
		},
		include: {
			controlPoint: { select: { name: true } },
			user: { select: { name: true } },
		},
	});

	for (const reservation of expiredActive) {
		await prisma.reservation.update({
			where: { id: reservation.id },
			data: { status: "COMPLETED" },
		});
		results.push({
			reservationId: reservation.id,
			controlPointName: reservation.controlPoint.name,
			userName: reservation.user.name,
			action: "completed",
		});
	}

	return results;
}
