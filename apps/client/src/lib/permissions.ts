import { trpc } from "@ecehive/trpc/client";
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

export async function getAllPermissions(): Promise<
	Map<string, { id: number; name: string }[]>
> {
	const permissionsMap = new Map<string, { id: number; name: string }[]>();

	const data = await trpc.permissions.list.query({});

	data?.permissions?.forEach((perm) => {
		const [type] = perm.name.split(".");
		if (!permissionsMap.has(type)) {
			permissionsMap.set(type, []);
		}
		permissionsMap.get(type)?.push(perm);
	});

	return permissionsMap;
}

/**
 * Convert identifiers like "userRoles", "user_roles", or "user-roles" to a
 * human-friendly form like "User Roles".
 */
export function humanizeIdentifier(input: string): string {
	if (!input) return "";
	const spaced = input
		.replace(/[_-]/g, " ")
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
	return spaced
		.split(/\s+/)
		.filter(Boolean)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
}

/**
 * Format a permission type key (the prefix before the dot) for display.
 */
export function formatPermissionType(type: string): string {
	return humanizeIdentifier(type);
}

/**
 * Format a permission full name like "users.create" or "shiftTypes.read"
 * into a human-friendly action label like "Create" or "Read" (uses last segment).
 */
export function formatPermissionName(name: string): string {
	const last = (name?.split(".").pop() ?? name) || "";
	return humanizeIdentifier(last);
}
