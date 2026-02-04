/**
 * Control Kiosk Routes - Check User Permissions
 *
 * This route checks what control points a user (by card number) is authorized to control.
 * Also returns session info and staffing permissions for the control kiosk session management.
 */

import {
	checkStaffingPermission,
	findUserByCard,
	getCurrentSession,
} from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { z } from "zod";
import type { TControlProtectedProcedureContext } from "../../trpc";

export const ZCheckUserPermissionsSchema = z.object({
	cardNumber: z.string().regex(/^\d+$/),
});

type CheckUserPermissionsOptions = {
	ctx: TControlProtectedProcedureContext;
	input: z.infer<typeof ZCheckUserPermissionsSchema>;
};

export async function checkUserPermissionsHandler({
	ctx,
	input,
}: CheckUserPermissionsOptions) {
	const { cardNumber } = input;

	// Find the user by card number using findUserByCard for consistency
	const user = await findUserByCard(cardNumber);

	// Get user's roles for authorization checks
	const userWithRoles = await prisma.user.findUniqueOrThrow({
		where: { id: user.id },
		include: {
			roles: { select: { id: true } },
		},
	});

	// Get the control points assigned to this device
	const deviceControlPointIds = ctx.device.controlPoints.map((cp) => cp.id);
	const deviceControlPoints = await prisma.controlPoint.findMany({
		where: {
			id: { in: deviceControlPointIds },
			isActive: true,
		},
		select: {
			id: true,
			name: true,
			description: true,
			location: true,
			controlClass: true,
			currentState: true,
			authorizedRoles: { select: { id: true } },
			authorizedUsers: { select: { id: true } },
		},
	});

	// Check which control points the user can control
	const userRoleIds = userWithRoles.roles.map((r) => r.id);
	const isSystemUser = userWithRoles.isSystemUser;

	const authorizedControlPoints = deviceControlPoints.filter((point) => {
		// System users can control everything
		if (isSystemUser) return true;

		// If no restrictions, anyone can use it
		if (
			point.authorizedUsers.length === 0 &&
			point.authorizedRoles.length === 0
		) {
			return true;
		}

		// Check direct authorization
		if (point.authorizedUsers.some((u) => u.id === user.id)) {
			return true;
		}

		// Check role authorization
		if (point.authorizedRoles.some((r) => userRoleIds.includes(r.id))) {
			return true;
		}

		return false;
	});

	return {
		user: {
			id: user.id,
			name: user.name,
			username: user.username,
		},
		authorizedControlPoints: authorizedControlPoints.map((cp) => ({
			id: cp.id,
			name: cp.name,
			description: cp.description,
			location: cp.location,
			controlClass: cp.controlClass,
			currentState: cp.currentState,
		})),
		// Include session and permission info for the control kiosk
		hasStaffingPermission: await checkStaffingPermission(
			prisma,
			user.id,
			user.isSystemUser,
		),
		currentSession: await getCurrentSession(prisma, user.id),
	};
}
