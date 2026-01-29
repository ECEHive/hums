import { findUserByCard } from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TInventoryProtectedProcedureContext } from "../../trpc";

export const ZVerifyApproverSchema = z.object({
	cardNumber: z.string().regex(/^\d+$/),
	itemIds: z.array(z.string().uuid()).min(1),
});

export type TVerifyApproverSchema = z.infer<typeof ZVerifyApproverSchema>;

export type TVerifyApproverOptions = {
	ctx: TInventoryProtectedProcedureContext;
	input: TVerifyApproverSchema;
};

export async function verifyApproverHandler(options: TVerifyApproverOptions) {
	const { cardNumber, itemIds } = options.input;

	// Find the user by their card
	const user = await findUserByCard(cardNumber);

	// Get the user's role IDs
	const userWithRoles = await prisma.user.findUnique({
		where: { id: user.id },
		include: {
			roles: {
				select: { id: true, name: true },
			},
		},
	});

	if (!userWithRoles) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "User not found",
		});
	}

	const userRoleIds = new Set(userWithRoles.roles.map((r) => r.id));

	// Fetch all items with their approval roles
	const items = await prisma.item.findMany({
		where: { id: { in: itemIds } },
		include: {
			approvalRoles: {
				select: { id: true, name: true },
			},
		},
	});

	// Check that all items with approval requirements can be approved by this user
	const itemsRequiringApproval = items.filter(
		(item) => item.approvalRoles.length > 0,
	);

	const unauthorizedItems: Array<{
		id: string;
		name: string;
		requiredRoles: string[];
	}> = [];

	for (const item of itemsRequiringApproval) {
		// Check if user has any of the required approval roles
		const hasApprovalRole = item.approvalRoles.some((role) =>
			userRoleIds.has(role.id),
		);

		if (!hasApprovalRole) {
			unauthorizedItems.push({
				id: item.id,
				name: item.name,
				requiredRoles: item.approvalRoles.map((r) => r.name),
			});
		}
	}

	if (unauthorizedItems.length > 0) {
		return {
			status: "unauthorized" as const,
			user: {
				id: userWithRoles.id,
				name: userWithRoles.name,
			},
			unauthorizedItems,
		};
	}

	return {
		status: "approved" as const,
		user: {
			id: userWithRoles.id,
			name: userWithRoles.name,
		},
	};
}
