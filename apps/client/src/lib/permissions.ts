import type { AuthUser } from "@/auth";

/**
 * Ensure the provided user has all given permissions.
 *
 * System users bypass permission checks.
 * Returns true if user has all required permissions, false otherwise.
 *
 * @param user The authenticated user or null.
 * @param requiredPermissions List of permissions to check.
 * @returns boolean indicating if user has all required permissions.
 */
export function checkPermissions(
	user: AuthUser | null,
	requiredPermissions: string[],
): boolean {
	if (user?.isSystemUser) return true;
	return requiredPermissions.every((perm) => user?.permissions.includes(perm));
}
