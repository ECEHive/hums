import type { ColumnDef } from "@tanstack/react-table";
import { TagsIcon } from "lucide-react";
import type { AuthUser } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { checkPermissions } from "@/lib/permissions";
import { Button } from "../ui/button";
import { ImpersonateUserButton } from "./impersonate-button";
import { RolesDialog } from "./roles-dialog";
import { UserUpdateDialog } from "./update-dialog";

type User = {
	id: number;
	name: string;
	username: string;
	email: string;
	isSystemUser: boolean;
	createdAt: Date;
	updatedAt: Date;
	roles: {
		id: number;
		name: string;
	}[];
};

export function generateColumns(user: AuthUser | null): ColumnDef<User>[] {
	if (user === null) return [];

	const canManageRoles = checkPermissions(user, ["users.update"]);
	const canImpersonateUsers = checkPermissions(user, ["users.impersonate"]);

	return [
		{
			accessorKey: "name",
			header: "Name",
		},
		{
			accessorKey: "username",
			header: "Username",
		},
		{
			accessorKey: "email",
			header: "Email",
		},
		{
			accessorKey: "slackUsername",
			header: "Slack Username",
		},
		{
			accessorKey: "roles",
			header: "Roles",
			cell: ({ row }) => {
				const user = row.original;
				const roles = user.roles ?? [];
				const display = roles.slice(0, 2);
				const remainder = Math.max(0, roles.length - display.length);

				return (
					<div className="flex items-center gap-2">
						<RolesDialog
							user={user}
							trigger={
								<Button
									variant="ghost"
									size="icon"
									aria-label={`Edit roles for ${user.username}`}
									title={`Edit roles for ${user.username}`}
									disabled={!canManageRoles}
								>
									<TagsIcon />
								</Button>
							}
						/>
						<div className="flex flex-wrap gap-1 items-center">
							{roles.length === 0 ? (
								<span className="text-sm text-muted-foreground">None</span>
							) : (
								<>
									{display.map((r) => (
										<Badge
											key={r.id}
											variant="secondary"
											className="inline-flex items-center gap-1"
										>
											{r.name}
										</Badge>
									))}
									{remainder > 0 && (
										<span className="text-sm text-muted-foreground">…</span>
									)}
								</>
							)}
						</div>
					</div>
				);
			},
		},
		{
			accessorKey: "actions",
			header: "",
			cell: ({ row }) => {
				return (
					<div className="flex gap-2 items-center justify-end">
						<UserUpdateDialog user={row.original} />
						{canImpersonateUsers && (
							<ImpersonateUserButton
								userId={row.original.id}
								userName={row.original.name || row.original.username}
							/>
						)}
					</div>
				);
			},
		},
	];
}
