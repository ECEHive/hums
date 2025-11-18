import { TRPCError } from "@trpc/server";

export type PeriodWithRoleIds = {
	id: number;
	roles: { id: number }[];
};

export function canAccessPeriod(
	period: PeriodWithRoleIds,
	userRoleIds: Set<number>,
	options?: { isSystemUser?: boolean },
): boolean {
	if (options?.isSystemUser) {
		return true;
	}

	const requiredRoleIds = period.roles?.map((role) => role.id) ?? [];

	if (requiredRoleIds.length === 0) {
		return true;
	}

	for (const roleId of requiredRoleIds) {
		if (userRoleIds.has(roleId)) {
			return true;
		}
	}

	return false;
}

export function assertCanAccessPeriod(
	period: PeriodWithRoleIds,
	userRoleIds: Set<number>,
	options?: { isSystemUser?: boolean },
): void {
	if (canAccessPeriod(period, userRoleIds, options)) {
		return;
	}

	throw new TRPCError({
		code: "FORBIDDEN",
		message: "You do not have access to this period",
	});
}
