import { trpc } from "@ecehive/trpc/client";
import type { AuthUser } from "@/auth";

/**
 * Permissions descriptor accepted by helpers.
 * - passing a plain string[] keeps the existing "all" behavior (every permission required)
 * - passing { any: [...] } will return true if the user has any of the listed permissions
 * - passing { all: [...] } will return true only if the user has all of the listed permissions
 * - passing { any: [...], all: [...] } will return true only if both conditions are satisfied
 */
export type RequiredPermissions = string[] | { any?: string[]; all?: string[] };

/**
 * Evaluate whether the provided user satisfies the required permissions.
 *
 * System users bypass permission checks.
 *
 * Backwards compatible: passing a string[] behaves as "all" (every permission required).
 *
 * When both `any` and `all` are provided, both conditions must be satisfied.
 */
export function checkPermissions(
	user: AuthUser | null,
	requiredPermissions: RequiredPermissions,
): boolean {
	if (user?.isSystemUser) return true;

	// normalize to object form
	let any: string[] | undefined;
	let all: string[] | undefined;

	if (Array.isArray(requiredPermissions)) {
		all = requiredPermissions;
	} else {
		any = requiredPermissions.any;
		all = requiredPermissions.all;
	}

	// Check `all` condition - user must have ALL listed permissions
	const allSatisfied =
		!all ||
		all.length === 0 ||
		all.every((perm) => user?.permissions.includes(perm));

	// Check `any` condition - user must have at least ONE listed permission
	const anySatisfied =
		!any ||
		any.length === 0 ||
		any.some((perm) => user?.permissions.includes(perm));

	// Both conditions must be satisfied
	return allSatisfied && anySatisfied;
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
