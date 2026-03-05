import { useCurrentUser } from "@/auth/AuthProvider";
import { checkPermissions, type RequiredPermissions } from "@/lib/permissions";

/**
 * Hook to check if the current user has a specific permission.
 * Accepts a single permission string or a RequiredPermissions descriptor.
 */
export function useCheckPermission(
	permission: string | RequiredPermissions,
): boolean {
	const user = useCurrentUser();
	const perms: RequiredPermissions =
		typeof permission === "string" ? [permission] : permission;
	return checkPermissions(user, perms);
}
