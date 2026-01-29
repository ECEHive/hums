import type { ColumnDef } from "@tanstack/react-table";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { formatInAppTimezone } from "@/lib/timezone";

type Transaction = {
	id: string;
	itemId: string;
	userId: number;
	action: "CHECK_IN" | "CHECK_OUT";
	quantity: number;
	notes: string | null;
	createdAt: Date;
	item: {
		id: string;
		name: string;
		sku: string | null;
	};
	user: {
		id: number;
		name: string;
		username: string;
	};
};

type MyTransaction = {
	id: string;
	itemId: string;
	userId: number;
	action: "CHECK_IN" | "CHECK_OUT";
	quantity: number;
	notes: string | null;
	createdAt: Date;
	item: {
		id: string;
		name: string;
		sku: string | null;
	};
};

const formatDate = (date: Date) => formatInAppTimezone(date);

function getActionBadge(action: "CHECK_IN" | "CHECK_OUT") {
	return action === "CHECK_IN" ? (
		<Badge
			variant="default"
			className="bg-green-600 hover:bg-green-700 text-foreground"
		>
			Check In
		</Badge>
	) : (
		<Badge
			variant="default"
			className="bg-blue-600 hover:bg-blue-700 text-foreground"
		>
			Check Out
		</Badge>
	);
}

export function generateColumns(): ColumnDef<Transaction>[] {
	return [
		{
			accessorKey: "createdAt",
			header: "Date",
			cell: ({ row }) => {
				const date = row.original.createdAt;
				return (
					<div className="flex flex-col">
						<span>{formatDate(date)}</span>
						<span className="text-xs text-muted-foreground">
							{formatDistanceToNow(new Date(date), { addSuffix: true })}
						</span>
					</div>
				);
			},
		},
		{
			accessorKey: "action",
			header: "Action",
			cell: ({ row }) => getActionBadge(row.original.action),
		},
		{
			accessorKey: "item.name",
			header: "Item",
			cell: ({ row }) => {
				const item = row.original.item;
				return (
					<div className="flex flex-col">
						<span>{item.name}</span>
						{item.sku && (
							<span className="text-xs text-muted-foreground">{item.sku}</span>
						)}
					</div>
				);
			},
		},
		{
			accessorKey: "quantity",
			header: "Quantity",
			cell: ({ row }) => {
				const quantity = row.original.quantity;
				const action = row.original.action;
				const displayQuantity =
					action === "CHECK_IN" ? `+${quantity}` : `-${Math.abs(quantity)}`;
				return (
					<span
						className={
							action === "CHECK_IN" ? "text-green-600" : "text-blue-600"
						}
					>
						{displayQuantity}
					</span>
				);
			},
		},
		{
			accessorKey: "user.name",
			header: "User",
			cell: ({ row }) => {
				const user = row.original.user;
				return (
					<div className="flex flex-col">
						<span>{user.name}</span>
						<span className="text-xs text-muted-foreground">
							{user.username}
						</span>
					</div>
				);
			},
		},
		{
			accessorKey: "notes",
			header: "Notes",
			cell: ({ row }) => {
				const notes = row.original.notes;
				return notes ? (
					<span className="text-sm">{notes}</span>
				) : (
					<span className="text-sm text-muted-foreground">—</span>
				);
			},
		},
	];
}

export function generateMyTransactionColumns(): ColumnDef<MyTransaction>[] {
	return [
		{
			accessorKey: "createdAt",
			header: "Date",
			cell: ({ row }) => {
				const date = row.original.createdAt;
				return (
					<div className="flex flex-col">
						<span>{formatDate(date)}</span>
						<span className="text-xs text-muted-foreground">
							{formatDistanceToNow(new Date(date), { addSuffix: true })}
						</span>
					</div>
				);
			},
		},
		{
			accessorKey: "action",
			header: "Action",
			cell: ({ row }) => getActionBadge(row.original.action),
		},
		{
			accessorKey: "item.name",
			header: "Item",
			cell: ({ row }) => {
				const item = row.original.item;
				return (
					<div className="flex flex-col">
						<span>{item.name}</span>
						{item.sku && (
							<span className="text-xs text-muted-foreground">{item.sku}</span>
						)}
					</div>
				);
			},
		},
		{
			accessorKey: "quantity",
			header: "Quantity",
			cell: ({ row }) => {
				const quantity = row.original.quantity;
				const action = row.original.action;
				const displayQuantity =
					action === "CHECK_IN" ? `+${quantity}` : `-${Math.abs(quantity)}`;
				return (
					<span
						className={
							action === "CHECK_IN" ? "text-green-600" : "text-blue-600"
						}
					>
						{displayQuantity}
					</span>
				);
			},
		},
		{
			accessorKey: "notes",
			header: "Notes",
			cell: ({ row }) => {
				const notes = row.original.notes;
				return notes ? (
					<span className="text-sm">{notes}</span>
				) : (
					<span className="text-sm text-muted-foreground">—</span>
				);
			},
		},
	];
}
