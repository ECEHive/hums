import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";

/**
 * Fetches a single control point by ID with all related data.
 *
 * @param id - The UUID of the control point
 * @returns The control point with provider, authorized roles, and authorized users
 * @throws TRPCError if the control point is not found
 */
export async function getControlPoint(id: string) {
	const point = await prisma.controlPoint.findUnique({
		where: { id },
		include: {
			provider: {
				select: {
					id: true,
					name: true,
					providerType: true,
					isActive: true,
				},
			},
			authorizedRoles: {
				select: { id: true, name: true },
			},
			authorizedUsers: {
				select: { id: true, name: true, username: true, email: true },
			},
		},
	});

	if (!point) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Control point not found",
		});
	}

	return point;
}

/**
 * Fetches a single control point by ID, returning null if not found (no throw).
 *
 * @param id - The UUID of the control point
 * @returns The control point or null if not found
 */
export async function findControlPoint(id: string) {
	return prisma.controlPoint.findUnique({
		where: { id },
		include: {
			provider: {
				select: {
					id: true,
					name: true,
					providerType: true,
					isActive: true,
				},
			},
			authorizedRoles: {
				select: { id: true, name: true },
			},
			authorizedUsers: {
				select: { id: true, name: true, username: true, email: true },
			},
		},
	});
}

export type ControlPointWithRelations = NonNullable<
	Awaited<ReturnType<typeof getControlPoint>>
>;
