import { type Prisma, prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZStatsSchema = z.object({});

export type TStatsSchema = z.infer<typeof ZStatsSchema>;

export type TStatsOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TStatsSchema;
};

export async function statsHandler() {
	// Count currently active sessions (endedAt is null)
	const baseWhere: Prisma.SessionWhereInput = { endedAt: null };

	// Get counts
	const [totalActive, activeRegular, activeStaffing] = await Promise.all([
		prisma.session.count({ where: baseWhere }),
		prisma.session.count({ where: { ...baseWhere, sessionType: "regular" } }),
		prisma.session.count({ where: { ...baseWhere, sessionType: "staffing" } }),
	]);

	return {
		totalActive,
		activeRegular,
		activeStaffing,
	};
}
