import { prisma } from "@ecehive/prisma";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export type TGetCurrentOptions = {
	ctx?: TPermissionProtectedProcedureContext;
};

/**
 * Get the current period based on today's date.
 * Returns the period where today falls between start and end dates.
 */
export async function getCurrentHandler(_options: TGetCurrentOptions) {
	const now = new Date();

	const period = await prisma.period.findFirst({
		where: {
			start: { lte: now },
			end: { gte: now },
		},
		orderBy: {
			start: "desc",
		},
	});

	return { period };
}
