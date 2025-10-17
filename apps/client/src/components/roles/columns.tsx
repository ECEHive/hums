import type { ColumnDef } from "@tanstack/react-table";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@ecehive/trpc/server";

type RouterOutput = inferRouterOutputs<AppRouter>;
type Role = RouterOutput['roles']['list'];

export const columns: ColumnDef<Role>[] = [
	{
		accessorKey: "name",
		header: "Role",
	},
	{
		accessorKey: "userCount",
		header: "User Count",
	},
	{
		accessorKey: "permissions",
		header: "Permissions",
	},
];
