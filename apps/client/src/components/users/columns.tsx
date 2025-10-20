import type { ColumnDef } from "@tanstack/react-table";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "../ui/button";
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

export function generateColumns(): ColumnDef<User>[] {
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
								>
									<Pencil />
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
			accessorKey: "modify",
			header: "Modify",
			cell: ({ row }) => {
				return (
					<div className="flex gap-2 items-center">
						<UserUpdateDialog user={row.original} />
					</div>
				);
			},
		},
	];
}
