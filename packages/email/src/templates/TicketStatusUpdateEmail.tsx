import { EmailLayout } from "./EmailLayout";

export interface TicketStatusUpdateEmailProps {
	ticketId: string;
	ticketTypeName: string;
	submitterName: string;
	previousStatus: string | null;
	newStatus: string;
	notes?: string;
	updatedAt: Date;
	logos?: {
		light: string;
		dark: string;
	};
}

export const TicketStatusUpdateEmailSubject =
	"Your Ticket Status Has Been Updated";

/**
 * Get a human-readable status label
 */
function getStatusLabel(status: string): string {
	const labels: Record<string, string> = {
		pending: "Pending",
		in_progress: "In Progress",
		resolved: "Resolved",
		closed: "Closed",
		cancelled: "Cancelled",
	};
	return labels[status] || status;
}

/**
 * Get status-specific styling
 */
function getStatusStyle(status: string): {
	backgroundColor: string;
	borderColor: string;
	textColor: string;
} {
	const styles: Record<
		string,
		{ backgroundColor: string; borderColor: string; textColor: string }
	> = {
		pending: {
			backgroundColor: "#fffbeb",
			borderColor: "#fef08a",
			textColor: "#b45309",
		},
		in_progress: {
			backgroundColor: "#eff6ff",
			borderColor: "#bfdbfe",
			textColor: "#1d4ed8",
		},
		resolved: {
			backgroundColor: "#f0fdf4",
			borderColor: "#bbf7d0",
			textColor: "#166534",
		},
		closed: {
			backgroundColor: "#f9fafb",
			borderColor: "#e5e7eb",
			textColor: "#374151",
		},
		cancelled: {
			backgroundColor: "#fef2f2",
			borderColor: "#fecaca",
			textColor: "#dc2626",
		},
	};
	return styles[status] || styles.pending;
}

export function TicketStatusUpdateEmail({
	ticketId,
	ticketTypeName,
	submitterName,
	previousStatus,
	newStatus,
	notes,
	updatedAt,
	logos,
}: TicketStatusUpdateEmailProps) {
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

	const statusStyle = getStatusStyle(newStatus);

	return (
		<EmailLayout
			title="Ticket Status Update"
			preheader={`Your ${displayTypeName} ticket status has changed to ${getStatusLabel(newStatus)}.`}
			logos={logos}
		>
			<p>
				Hello <strong>{submitterName}</strong>,
			</p>

			<p>
				The status of your <strong>{displayTypeName}</strong> ticket has been
				updated.
			</p>

			<div
				style={{
					backgroundColor: statusStyle.backgroundColor,
					border: `1px solid ${statusStyle.borderColor}`,
					borderRadius: "6px",
					padding: "16px",
					margin: "20px 0",
				}}
			>
				<p style={{ margin: 0, fontWeight: 600, color: statusStyle.textColor }}>
					Status Update
				</p>
				<p style={{ margin: "8px 0 0 0", fontSize: "14px" }}>
					<strong>Ticket ID:</strong> {ticketId.slice(0, 8)}...
				</p>
				{previousStatus && (
					<p style={{ margin: "4px 0 0 0", fontSize: "14px" }}>
						<strong>Previous Status:</strong> {getStatusLabel(previousStatus)}
					</p>
				)}
				<p style={{ margin: "4px 0 0 0", fontSize: "14px" }}>
					<strong>New Status:</strong>{" "}
					<span style={{ color: statusStyle.textColor, fontWeight: 600 }}>
						{getStatusLabel(newStatus)}
					</span>
				</p>
				<p style={{ margin: "4px 0 0 0", fontSize: "14px" }}>
					<strong>Updated:</strong> {formatDate(updatedAt)}
				</p>
			</div>

			{notes && (
				<div
					style={{
						backgroundColor: "#f9fafb",
						border: "1px solid #e5e7eb",
						borderRadius: "6px",
						padding: "16px",
						margin: "20px 0",
					}}
				>
					<p style={{ margin: 0, fontWeight: 600 }}>Notes from Staff</p>
					<p style={{ margin: "8px 0 0 0", whiteSpace: "pre-wrap" }}>{notes}</p>
				</div>
			)}

			{newStatus === "resolved" && (
				<p>
					Your ticket has been marked as resolved. If you have any follow-up
					questions or concerns, please feel free to submit a new ticket or
					reply to this email.
				</p>
			)}

			{newStatus === "in_progress" && (
				<p>
					Our team is actively working on your ticket. We'll notify you when
					there are further updates.
				</p>
			)}

			<p>
				You can view the full details of your ticket by logging into HUMS and
				visiting the "My Tickets" section.
			</p>

			<p style={{ marginTop: "20px", fontSize: "14px", color: "#666" }}>
				If you have any questions about this update, please reply to this email
				or contact The Hive staff.
			</p>
		</EmailLayout>
	);
}
