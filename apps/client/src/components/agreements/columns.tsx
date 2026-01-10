import type { ColumnDef } from "@tanstack/react-table";
import type { AuthUser } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { checkPermissions } from "@/lib/permissions";
import { DeleteDialog } from "./delete-dialog";
import { EditDialog } from "./edit-dialog";

export type Agreement = {
	id: number;
	title: string;
	content: string;
	confirmationText: string;
	isEnabled: boolean;
	createdAt: Date;
	updatedAt: Date;
};

export function generateColumns(user: AuthUser | null): ColumnDef<Agreement>[] {
	if (user === null) return [];
	const canEdit = checkPermissions(user, ["agreements.update"]);
	const canDelete = checkPermissions(user, ["agreements.delete"]);

	return [
		{
			accessorKey: "title",
			header: "Title",
		},
		{
			accessorKey: "isEnabled",
			header: "Status",
			cell: ({ row }) => {
				return row.original.isEnabled ? (
					<Badge variant="default">Enabled</Badge>
				) : (
					<Badge variant="secondary">Disabled</Badge>
				);
			},
		},
		{
			accessorKey: "content",
			header: "Content Preview",
			cell: ({ row }) => {
				const preview =
					row.original.content.substring(0, 80) +
					(row.original.content.length > 80 ? "..." : "");
				return <span className="text-sm text-muted-foreground">{preview}</span>;
			},
		},
		{
			id: "actions",
			header: () => <span className="sr-only">Actions</span>,
			cell: ({ row }) => {
				return (
					<div className="flex gap-2 items-center justify-end">
						{canEdit && <EditDialog agreement={row.original} />}
						{canDelete && (
							<DeleteDialog
								agreementId={row.original.id}
								agreementTitle={row.original.title}
							/>
						)}
					</div>
				);
			},
		},
	];
}
