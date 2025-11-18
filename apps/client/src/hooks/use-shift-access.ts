import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useCurrentUser } from "@/auth";
import { checkPermissions } from "@/lib/permissions";

const SHIFT_PERMISSION_NAMES = [
	"shift_schedules.list",
	"shift_schedules.create",
	"shift_schedules.update",
	"shift_schedules.delete",
	"shift_occurrences.list",
	"shift_occurrences.get",
];

export function useShiftAccess() {
	const user = useCurrentUser();

	const hasExplicitPermission = useMemo(
		() => checkPermissions(user, { any: SHIFT_PERMISSION_NAMES }),
		[user],
	);

	const { data, isLoading } = useQuery({
		queryKey: ["periods", "listVisible", { limit: 1 }],
		queryFn: async () => trpc.periods.listVisible.query({ limit: 1 }),
		enabled: Boolean(user) && !hasExplicitPermission,
	});

	const hasVisiblePeriodAccess = Boolean(data?.periods?.length);

	return {
		canAccessShifts: hasExplicitPermission || hasVisiblePeriodAccess,
		hasExplicitPermission,
		hasVisiblePeriodAccess,
		isLoading: isLoading && !hasExplicitPermission,
	};
}
