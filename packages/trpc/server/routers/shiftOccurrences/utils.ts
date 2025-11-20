import type { Period, Prisma, ShiftAttendanceStatus } from "@ecehive/prisma";

export function isWithinModifyWindow(
	period: Pick<Period, "scheduleModifyStart" | "scheduleModifyEnd">,
	referenceDate: Date = new Date(),
): boolean {
	const referenceTime = referenceDate.getTime();
	return (
		period.scheduleModifyStart.getTime() <= referenceTime &&
		period.scheduleModifyEnd.getTime() >= referenceTime
	);
}

type UpsertAttendanceStatusOptions = {
	isMakeup?: boolean;
	droppedNotes?: string | null;
};

export async function upsertAttendanceStatus(
	tx: Prisma.TransactionClient,
	shiftOccurrenceId: number,
	userId: number,
	status: ShiftAttendanceStatus,
	options: UpsertAttendanceStatusOptions = {},
) {
	const existingAttendance = await tx.shiftAttendance.findFirst({
		where: {
			shiftOccurrenceId,
			userId,
		},
	});

	const updateData: Prisma.ShiftAttendanceUpdateInput = {
		status,
		timeIn: null,
		timeOut: null,
		didArriveLate: false,
		didLeaveEarly: false,
	};

	if (options.isMakeup !== undefined) {
		updateData.isMakeup = options.isMakeup;
	}

	if (options.droppedNotes !== undefined) {
		updateData.droppedNotes = options.droppedNotes;
	}

	if (existingAttendance) {
		return tx.shiftAttendance.update({
			where: { id: existingAttendance.id },
			data: updateData,
		});
	}

	return tx.shiftAttendance.create({
		data: {
			shiftOccurrenceId,
			userId,
			status,
			isMakeup: options.isMakeup ?? false,
			didArriveLate: false,
			didLeaveEarly: false,
			droppedNotes: options.droppedNotes ?? null,
		},
	});
}
