import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListForExportSchema = z.object({
	periodId: z.number().min(1),
	shiftTypeIds: z.array(z.number().min(1)).optional(),
	daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
});

export type TListForExportSchema = z.infer<typeof ZListForExportSchema>;

export type TListForExportOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TListForExportSchema;
};

export async function listForExportHandler(options: TListForExportOptions) {
	const { periodId, shiftTypeIds, daysOfWeek } = options.input;

	// Get the period for validation and name
	const period = await prisma.period.findUnique({
		where: { id: periodId },
		select: { id: true, name: true },
	});

	if (!period) {
		throw new Error("Period not found");
	}

	// Build the where clause
	const where: {
		shiftType: { periodId: number; id?: { in: number[] } };
		dayOfWeek?: { in: number[] };
	} = {
		shiftType: { periodId },
	};

	if (shiftTypeIds && shiftTypeIds.length > 0) {
		where.shiftType.id = { in: shiftTypeIds };
	}

	if (daysOfWeek && daysOfWeek.length > 0) {
		where.dayOfWeek = { in: daysOfWeek };
	}

	// Fetch all shift types for the period (for filtering UI)
	const shiftTypes = await prisma.shiftType.findMany({
		where: { periodId },
		select: {
			id: true,
			name: true,
			location: true,
			color: true,
		},
		orderBy: { name: "asc" },
	});

	// Fetch all schedules with assigned users
	const schedules = await prisma.shiftSchedule.findMany({
		where,
		include: {
			shiftType: {
				select: {
					id: true,
					name: true,
					location: true,
					color: true,
				},
			},
			users: {
				select: {
					id: true,
					name: true,
					username: true,
				},
				orderBy: { name: "asc" },
			},
		},
		orderBy: [
			{ dayOfWeek: "asc" },
			{ startTime: "asc" },
			{ shiftType: { name: "asc" } },
		],
	});

	// Transform schedules into a format better suited for the table view
	const exportData = schedules.map((schedule) => ({
		id: schedule.id,
		dayOfWeek: schedule.dayOfWeek,
		startTime: schedule.startTime,
		endTime: schedule.endTime,
		slots: schedule.slots,
		shiftType: {
			id: schedule.shiftType.id,
			name: schedule.shiftType.name,
			location: schedule.shiftType.location,
		},
		users: schedule.users.map((user) => ({
			id: user.id,
			name: user.name ?? user.username,
		})),
	}));

	return {
		period,
		shiftTypes,
		schedules: exportData,
	};
}
