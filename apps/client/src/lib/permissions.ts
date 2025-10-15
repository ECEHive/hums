import { useRouter } from "@tanstack/react-router";
import type { JSX } from "react";
import type { AuthUser } from "@/auth";
import { useCurrentUser } from "@/auth/AuthProvider";

// Check if a given user possesses all given permissions
export function checkPermissions(
	user: AuthUser | null,
	requiredPermissions: string[],
): boolean {
	if (user?.isSystemUser) return true;
	return requiredPermissions.every((perm) => user?.permissions.includes(perm));
}

// Navigate to /app if the user does not have the required permissions to view the element
export function ExitWithoutPermissions(
	requiredPermissions: string[],
	element: JSX.Element,
) {
	const user = useCurrentUser();
	const router = useRouter();

	if (!checkPermissions(user, requiredPermissions)) {
		void router.navigate({ to: "/app" });
		return null;
	}

	return element;
}
