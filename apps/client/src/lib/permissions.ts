import { trpc } from "@ecehive/trpc/client";
import type { AuthUser } from "@/auth";

/**
 * Permissions descriptor accepted by helpers.
 * - passing a plain string[] keeps the existing "all" behavior (every permission required)
 * - passing { any: [...] } will return true if the user has any of the listed permissions
 * - passing { all: [...] } will return true only if the user has all of the listed permissions
 */
export type RequiredPermissions = string[] | { any?: string[]; all?: string[] };

/**
 * Evaluate whether the provided user satisfies the required permissions.
 *
 * System users bypass permission checks.
 *
 * Backwards compatible: passing a string[] behaves as "all" (every permission required).
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

	// If `any` provided, require at least one match
	if (any && any.length > 0) {
		return any.some((perm) => user?.permissions.includes(perm));
	}

	// Default to `all` behaviour (including when passed as plain array)
	if (all && all.length > 0) {
		return all.every((perm) => user?.permissions.includes(perm));
	}

	// No permissions required
	return true;
}

export async function getAllPermissions(): Promise<
	Map<string, { id: number; name: string }[]>
> {
	const permissionsMap = new Map<string, { id: number; name: string }[]>();

	const data = await trpc.permissions.list.query({});

	data?.permissions?.forEach((perm) => {
		const parts = perm.name.split(".");
		// Group most permissions by their top-level namespace (e.g., "users").
		// Special-case `inventory` to group by its sub-directories (e.g., "inventory.items").
		const type =
			parts[0] === "inventory" && parts.length >= 2
				? `${parts[0]}.${parts[1]}`
				: parts[0];
		if (!permissionsMap.has(type)) {
			permissionsMap.set(type, []);
		}
		permissionsMap.get(type)?.push(perm);
	});

	// Sort permissions within each type and return a map whose keys are
	// inserted in sorted order for a stable UI ordering.
	const sortedTypes = Array.from(permissionsMap.keys()).sort();
	const sortedMap = new Map<string, { id: number; name: string }[]>();
	for (const type of sortedTypes) {
		sortedMap.set(
			type,
			(permissionsMap.get(type) ?? []).sort((a, b) =>
				a.name.localeCompare(b.name),
			),
		);
	}

	return sortedMap;
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
	// If we grouped by namespace.subnamespace (e.g., "inventory.items"),
	// show the subnamespace as the section title ("Items"). Otherwise show
	// the top-level namespace ("Users", "Devices", etc.).
	const parts = type.split(".");
	if (parts[0] === "inventory" && parts.length >= 2) {
		// Show the full context for inventory sub-sections to avoid ambiguity
		// (e.g., "Inventory Items", "Inventory Requests").
		return humanizeIdentifier(`${parts[0]} ${parts[1]}`);
	}
	return humanizeIdentifier(parts[0]);
}

/**
 * Format a permission full name like "users.create" or "shiftTypes.read"
 * into a human-friendly action label like "Create" or "Read" (uses last segment).
 */
export function formatPermissionName(name: string): string {
	const last = (name?.split(".").pop() ?? name) || "";
	return humanizeIdentifier(last);
}
