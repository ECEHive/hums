import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZGetCurrentSchema = z
	.object({
		visibleStart: z.string().optional(),
		visibleEnd: z.string().optional(),
	})
	.optional();

export type TGetCurrentInput = z.infer<typeof ZGetCurrentSchema> | undefined;

export type TGetCurrentOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input?: TGetCurrentInput;
};

/**
 * Determine the "current" period using the following priority:
 *
 * 1) A period that contains the current date (start <= now <= end). If
 *    multiple match, the one with the nearest/most-recent start is chosen.
 *
 * 2) If none match (1), the period with the start closest to now but not in
 *    the past (start >= now). (i.e. the soonest upcoming period)
 *
 * 3) If none match (2), the period with the closest start to now including
 *    past periods (the most-recent past start).
 *
 * If the caller provides a visibleStart/visibleEnd (the visible range), this
 * function will only return a period when the current date is within that
 * visible range. If the visible range is provided and `now` falls outside of
 * it, `{ period: null }` is returned.
 */
export async function getCurrentHandler(options: TGetCurrentOptions) {
	const now = new Date();
	const include = {
		roles: true,
	};

	const input = options?.input;

	// If caller supplied a visible window, ensure `now` is within it. If not,
	// don't consider any period current.
	if (input) {
		const { visibleStart, visibleEnd } = input;
		if (visibleStart || visibleEnd) {
			const vs = visibleStart ? new Date(visibleStart) : undefined;
			const ve = visibleEnd ? new Date(visibleEnd) : undefined;

			if ((vs && now < vs) || (ve && now > ve)) {
				return { period: null };
			}
		}
	}

	// 1) Periods containing `now` (choose the one with the latest start)
	const containing = await prisma.period.findFirst({
		where: {
			start: { lte: now },
			end: { gte: now },
		},
		orderBy: { start: "desc" },
		include,
	});

	if (containing) return { period: containing };

	// 2) Next upcoming period (start >= now), choose the soonest start
	const upcoming = await prisma.period.findFirst({
		where: {
			start: { gte: now },
		},
		orderBy: { start: "asc" },
		include,
	});

	if (upcoming) return { period: upcoming };

	// 3) Fallback: the most-recent past period (closest start in the past)
	const past = await prisma.period.findFirst({
		where: {
			start: { lte: now },
		},
		orderBy: { start: "desc" },
		include,
	});

	return { period: past || null };
}
