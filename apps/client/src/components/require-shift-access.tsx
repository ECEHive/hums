import type { ReactNode } from "react";
import { MissingPermissions } from "@/components/missing-permissions";
import { Spinner } from "@/components/ui/spinner";
import { useShiftAccess } from "@/hooks/use-shift-access";

interface RequireShiftAccessProps {
	children: ReactNode;
	fallback?: ReactNode;
}

export function RequireShiftAccess({
	children,
	fallback,
}: RequireShiftAccessProps) {
	const { canAccessShifts, isLoading } = useShiftAccess();

	if (isLoading) {
		return (
			<div className="flex w-full items-center justify-center py-10">
				<Spinner className="h-5 w-5" />
			</div>
		);
	}

	if (!canAccessShifts) {
		return <>{fallback ?? <MissingPermissions />}</>;
	}

	return <>{children}</>;
}
