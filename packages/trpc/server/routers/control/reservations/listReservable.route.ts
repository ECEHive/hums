import { prisma } from "@ecehive/prisma";
import { z } from "zod";
import type { TProtectedProcedureContext } from "../../../trpc";

export const ZListReservablePointsSchema = z.object({}).optional();

type ListReservablePointsOptions = {
	ctx: TProtectedProcedureContext;
};

export async function listReservablePointsHandler({
	ctx,
}: ListReservablePointsOptions) {
	const userId = ctx.user.id;
	const isSystemUser = ctx.user.isSystemUser;

	const points = await prisma.controlPoint.findMany({
		where: {
			isActive: true,
			canBeReserved: true,
		},
		select: {
			id: true,
			name: true,
			description: true,
			location: true,
			controlClass: true,
			maxReservationMinutes: true,
			authorizedRoles: { select: { id: true } },
			reservationRoles: { select: { id: true, name: true } },
		},
		orderBy: { name: "asc" },
	});

	if (isSystemUser) {
		return points.map(({ authorizedRoles: _a, ...rest }) => rest);
	}

	// Filter to points the user can reserve (based on authorized roles and reservation roles)
	const userRoles = await prisma.role.findMany({
		where: { users: { some: { id: userId } } },
		select: { id: true },
	});
	const userRoleIds = new Set(userRoles.map((r) => r.id));

	return points
		.filter((point) => {
			// Check authorized roles: if set, user must have at least one
			if (
				point.authorizedRoles.length > 0 &&
				!point.authorizedRoles.some((r) => userRoleIds.has(r.id))
			) {
				return false;
			}
			// Check reservation roles: if set, user must have at least one
			if (
				point.reservationRoles.length > 0 &&
				!point.reservationRoles.some((r) => userRoleIds.has(r.id))
			) {
				return false;
			}
			return true;
		})
		.map(({ authorizedRoles: _a, ...rest }) => rest);
}
