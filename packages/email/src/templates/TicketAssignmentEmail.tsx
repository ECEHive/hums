import { EmailLayout } from "./EmailLayout";

export interface TicketAssignmentEmailProps {
	ticketId: string;
	ticketTypeName: string;
	submitterName: string;
	assigneeName: string;
	assignedAt: Date;
	logos?: {
		light: string;
		dark: string;
	};
}

export const TicketAssignmentEmailSubject = "You Have Been Assigned a Ticket";

export function TicketAssignmentEmail({
	ticketId,
	ticketTypeName,
	submitterName,
	assigneeName,
	assignedAt,
	logos,
}: TicketAssignmentEmailProps) {
	const formatDate = (date: Date) => {
		return date.toLocaleString("en-US", {
			weekday: "long",
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
			timeZoneName: "short",
		});
	};

	// Format ticket type name for display
	const displayTypeName = ticketTypeName
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");

	return (
		<EmailLayout
			title="Ticket Assignment"
			preheader={`You have been assigned a ${displayTypeName} ticket.`}
			logos={logos}
		>
			<p>
				Hello <strong>{assigneeName}</strong>,
			</p>

			<p>
				You have been assigned to handle a <strong>{displayTypeName}</strong>{" "}
				ticket.
			</p>

			<div
				style={{
					backgroundColor: "#eff6ff",
					border: "1px solid #bfdbfe",
					borderRadius: "6px",
					padding: "16px",
					margin: "20px 0",
				}}
			>
				<p style={{ margin: 0, fontWeight: 600, color: "#1d4ed8" }}>
					Ticket Details
				</p>
				<p style={{ margin: "8px 0 0 0", fontSize: "14px" }}>
					<strong>Ticket ID:</strong> {ticketId.slice(0, 8)}...
				</p>
				<p style={{ margin: "4px 0 0 0", fontSize: "14px" }}>
					<strong>Type:</strong> {displayTypeName}
				</p>
				<p style={{ margin: "4px 0 0 0", fontSize: "14px" }}>
					<strong>Submitted By:</strong> {submitterName}
				</p>
				<p style={{ margin: "4px 0 0 0", fontSize: "14px" }}>
					<strong>Assigned:</strong> {formatDate(assignedAt)}
				</p>
			</div>

			<p>
				You can view the ticket{" "}
				<a
					href={`${process.env.CLIENT_BASE_URL}/app/tickets/admin/${ticketId}`}
				>
					{" "}
					here
				</a>
				.
			</p>

			<p>
				Please log in to HUMS and visit the "All Tickets" section to view the
				full ticket details and take action.
			</p>

			<p style={{ marginTop: "20px", fontSize: "14px", color: "#666" }}>
				If you believe this assignment was made in error, please contact your
				team lead or The Hive staff.
			</p>
		</EmailLayout>
	);
}
