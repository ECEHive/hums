import { prisma } from "@ecehive/prisma";

import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZGetSchema = z.object({ id: z.number().min(1) });
export type TGetSchema = z.infer<typeof ZGetSchema>;

export type TGetOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TGetSchema;
};

export async function getHandler(options: TGetOptions) {
	const { id } = options.input;

	console.log("Fetching shift schedule with ID:", id);

	const shiftSchedule = await prisma.shiftSchedule.findUnique({
		where: { id },
		include: {
			shiftOccurrences: {
				orderBy: { timestamp: "asc" },
			},
			users: true,
		},
	});

	if (!shiftSchedule) {
		return { shiftSchedule: undefined, occurrences: [], assignedUsers: [] };
	}

	const {
		shiftOccurrences: occurrences,
		users: assignedUsers,
		...schedule
	} = shiftSchedule;

	return {
		shiftSchedule: schedule,
		occurrences,
		assignedUsers,
	};
}
