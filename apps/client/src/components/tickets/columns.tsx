import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import {
	AlertTriangleIcon,
	ClockIcon,
	ExternalLinkIcon,
	PackageIcon,
	UserIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Ticket type from the API response
export type Ticket = {
	id: string;
	status: string;
	data: unknown;
	notes: string | null;
	createdAt: Date;
	updatedAt: Date;
	submitterId: number | null;
	submitterName: string | null;
	submitterEmail: string | null;
	ticketType: {
		id: number;
		name: string;
		icon: string | null;
		color: string | null;
	};
	handler?: {
		id: number;
		name: string;
		email: string;
	} | null;
	submitter?: {
		id: number;
		name: string;
		email: string;
	} | null;
};

// Map ticket type names to icons
const ticketTypeIcons: Record<
	string,
	React.ComponentType<{ className?: string; style?: React.CSSProperties }>
> = {
	"inventory-request": PackageIcon,
	concern: AlertTriangleIcon,
};

// Status badge styles
export const statusStyles: Record<
	string,
	{
		variant: "default" | "secondary" | "destructive" | "outline";
		label: string;
	}
> = {
	pending: { variant: "secondary", label: "Pending" },
	in_progress: { variant: "default", label: "In Progress" },
	resolved: { variant: "outline", label: "Resolved" },
	closed: { variant: "outline", label: "Closed" },
	cancelled: { variant: "destructive", label: "Cancelled" },
};

// Format ticket type name for display
function formatTypeName(name: string): string {
	return name
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

// Extract summary from ticket data
function getTicketSummary(data: unknown): string {
	const ticketData = data as Record<string, unknown>;
	const summary =
		ticketData?.itemName || ticketData?.concernType || ticketData?.subject;
	if (typeof summary === "string") {
		return summary.charAt(0).toUpperCase() + summary.slice(1);
	}
	return "Ticket";
}

// Helper component for ticket links
function TicketLink({
	ticketId,
	linkTo,
	children,
	className,
}: {
	ticketId: string;
	linkTo: "my-tickets" | "admin";
	children: React.ReactNode;
	className?: string;
}) {
	if (linkTo === "my-tickets") {
		return (
			<Link
				to="/app/tickets/my-tickets/$ticketId"
				params={{ ticketId }}
				className={className}
			>
				{children}
			</Link>
		);
	}
	return (
		<Link
			to="/app/tickets/admin/$ticketId"
			params={{ ticketId }}
			className={className}
		>
			{children}
		</Link>
	);
}

type ColumnsOptions = {
	linkTo: "my-tickets" | "admin";
	showSubmitter?: boolean;
	showHandler?: boolean;
};

export function generateColumns(options: ColumnsOptions): ColumnDef<Ticket>[] {
	const { linkTo, showSubmitter = false, showHandler = false } = options;

	const columns: ColumnDef<Ticket>[] = [
		{
			accessorKey: "summary",
			header: "Summary",
			cell: ({ row }) => {
				const ticket = row.original;
				const Icon =
					ticketTypeIcons[ticket.ticketType.name] ?? AlertTriangleIcon;
				const summary = getTicketSummary(ticket.data);

				return (
					<div className="flex items-center gap-3">
						<div
							className="flex h-8 w-8 items-center justify-center rounded-md shrink-0"
							style={{
								backgroundColor: ticket.ticketType.color
									? `${ticket.ticketType.color}20`
									: undefined,
							}}
						>
							<Icon
								className="h-4 w-4"
								style={{
									color: ticket.ticketType.color ?? undefined,
								}}
							/>
						</div>
						<div className="min-w-0">
							<TicketLink
								ticketId={ticket.id}
								linkTo={linkTo}
								className="font-medium hover:underline truncate block"
							>
								{summary}
							</TicketLink>
							<div className="text-xs text-muted-foreground">
								{formatTypeName(ticket.ticketType.name)}
							</div>
						</div>
					</div>
				);
			},
		},
		{
			accessorKey: "status",
			header: "Status",
			cell: ({ row }) => {
				const status = row.original.status;
				const statusStyle = statusStyles[status] ?? statusStyles.pending;

				return <Badge variant={statusStyle.variant}>{statusStyle.label}</Badge>;
			},
		},
		{
			accessorKey: "createdAt",
			header: "Created",
			cell: ({ row }) => {
				const date = new Date(row.original.createdAt);
				return (
					<div className="flex items-center gap-1.5 text-muted-foreground whitespace-nowrap">
						<ClockIcon className="h-3.5 w-3.5" />
						{date.toLocaleDateString()}
					</div>
				);
			},
		},
	];

	if (showSubmitter) {
		columns.push({
			accessorKey: "submitter",
			header: "Submitter",
			cell: ({ row }) => {
				const ticket = row.original;
				const name =
					ticket.submitter?.name ||
					ticket.submitterName ||
					ticket.submitterEmail;

				if (!name) {
					return (
						<span className="text-muted-foreground text-sm">Anonymous</span>
					);
				}

				return (
					<div className="flex items-center gap-1.5">
						<UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
						<span className="truncate max-w-[150px]" title={name}>
							{name}
							{!ticket.submitter && ticket.submitterName && (
								<span className="text-muted-foreground text-xs ml-1">
									(anonymous)
								</span>
							)}
						</span>
					</div>
				);
			},
		});
	}

	if (showHandler) {
		columns.push({
			accessorKey: "handler",
			header: "Assigned To",
			cell: ({ row }) => {
				const handler = row.original.handler;

				if (!handler) {
					return (
						<span className="text-muted-foreground text-sm">Unassigned</span>
					);
				}

				return (
					<div className="flex items-center gap-1.5 text-primary">
						<UserIcon className="h-3.5 w-3.5" />
						<span className="truncate max-w-[150px]" title={handler.name}>
							{handler.name}
						</span>
					</div>
				);
			},
		});
	}

	// Actions column
	columns.push({
		id: "actions",
		header: "",
		cell: ({ row }) => {
			const ticket = row.original;

			return (
				<TicketLink ticketId={ticket.id} linkTo={linkTo}>
					<Button variant="ghost" size="icon" className="h-8 w-8">
						<ExternalLinkIcon className="h-4 w-4" />
						<span className="sr-only">View ticket</span>
					</Button>
				</TicketLink>
			);
		},
	});

	return columns;
}
