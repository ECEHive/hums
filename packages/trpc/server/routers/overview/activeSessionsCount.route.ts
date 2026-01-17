import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { Context } from "../../context";

export const ZActiveSessionsCountSchema = z.object({});

export type TActiveSessionsCountSchema = z.infer<
	typeof ZActiveSessionsCountSchema
>;

export type TActiveSessionsCountOptions = {
	ctx: Context;
	input: TActiveSessionsCountSchema;
};

export async function activeSessionsCountHandler(
	_options: TActiveSessionsCountOptions,
) {
	const [totalActive, regularActive, staffingActive] = await Promise.all([
		prisma.session.count({
			where: { endedAt: null },
		}),
		prisma.session.count({
			where: { endedAt: null, sessionType: "regular" },
		}),
		prisma.session.count({
			where: { endedAt: null, sessionType: "staffing" },
		}),
	]);

	return {
		total: totalActive,
		regular: regularActive,
		staffing: staffingActive,
	};
}
