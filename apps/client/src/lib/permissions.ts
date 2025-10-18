import type { AuthUser } from "@/auth";
import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import type { SelectPermission } from "@ecehive/drizzle";

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

export function getAllPermissions(): Map<string, SelectPermission[]> {
	const permissionsMap = new Map<string, SelectPermission[]>();

	const { data } = useQuery({
		queryKey: ["permissions"],
		queryFn: async () => {
			const res = await trpc.permissions.list.query({});
			return res;
		},
		retry: false,
	});

	data?.permissions?.forEach((perm) => {
		const [type, ] = perm.name.split(".");
		if (!permissionsMap.has(type)) {
			permissionsMap.set(type, []);
		}
		permissionsMap.get(type)?.push(perm);
	});

	return permissionsMap;
}
