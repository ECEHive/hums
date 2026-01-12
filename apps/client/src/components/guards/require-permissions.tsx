import type { ReactNode } from "react";
import { useCurrentUser } from "@/auth/AuthProvider";
import { MissingPermissions } from "@/components/guards/missing-permissions";
import { Spinner } from "@/components/ui/spinner";
import { checkPermissions, type RequiredPermissions } from "@/lib/permissions";

interface RequirePermissionsProps {
	permissions: RequiredPermissions;
	children: ReactNode;
	fallback?: ReactNode;
}

export function RequirePermissions({
	permissions,
	children,
	fallback,
}: RequirePermissionsProps) {
	const user = useCurrentUser();

	// Show loading while user is being fetched
	if (user === null) {
		return (
			<div className="flex w-full items-center justify-center py-10">
				<Spinner className="h-5 w-5" />
			</div>
		);
	}

	if (!checkPermissions(user, permissions)) {
		return <>{fallback ?? <MissingPermissions />}</>;
	}

	return <>{children}</>;
}
