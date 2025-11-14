import type { Period, Prisma, ShiftAttendanceStatus } from "@ecehive/prisma";

export function isWithinModifyWindow(
	period: Pick<Period, "scheduleModifyStart" | "scheduleModifyEnd">,
	referenceDate: Date = new Date(),
): boolean {
	const afterWindowStart =
		!period.scheduleModifyStart || period.scheduleModifyStart <= referenceDate;
	const beforeWindowEnd =
		!period.scheduleModifyEnd || period.scheduleModifyEnd >= referenceDate;
	return afterWindowStart && beforeWindowEnd;
}

export async function upsertAttendanceStatus(
	tx: Prisma.TransactionClient,
	shiftOccurrenceId: number,
	userId: number,
	status: ShiftAttendanceStatus,
) {
	const existingAttendance = await tx.shiftAttendance.findFirst({
		where: {
			shiftOccurrenceId,
			userId,
		},
	});

	if (existingAttendance) {
		return tx.shiftAttendance.update({
			where: { id: existingAttendance.id },
			data: {
				status,
				timeIn: null,
				timeOut: null,
			},
		});
	}

	return tx.shiftAttendance.create({
		data: {
			shiftOccurrenceId,
			userId,
			status,
		},
	});
}
