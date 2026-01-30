import { EmailLayout } from "./EmailLayout";

export interface TicketConfirmationEmailProps {
	ticketId: string;
	ticketTypeName: string;
	ticketTypeDescription: string | null;
	submitterName: string;
	ticketData: Record<string, unknown>;
	submittedAt: Date;
	logos?: {
		light: string;
		dark: string;
	};
}

export const TicketConfirmationEmailSubject = "Your Ticket Has Been Submitted";

export function TicketConfirmationEmail({
	ticketId,
	ticketTypeName,
	submitterName,
	submittedAt,
	logos,
}: TicketConfirmationEmailProps) {
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
			title="Ticket Confirmation"
			preheader={`Your ${displayTypeName} ticket has been submitted successfully.`}
			logos={logos}
		>
			<p>
				Hello <strong>{submitterName}</strong>,
			</p>

			<p>
				Thank you for submitting your ticket. We have received your{" "}
				<strong>{displayTypeName}</strong> and our team will review it shortly.
			</p>

			<div
				style={{
					backgroundColor: "#f0fdf4",
					border: "1px solid #bbf7d0",
					borderRadius: "6px",
					padding: "16px",
					margin: "20px 0",
				}}
			>
				<p style={{ margin: 0, fontWeight: 600, color: "#166534" }}>
					Ticket Submitted Successfully
				</p>
				<p style={{ margin: "8px 0 0 0", fontSize: "14px" }}>
					<strong>Ticket ID:</strong> {ticketId.slice(0, 8)}...
				</p>
				<p style={{ margin: "4px 0 0 0", fontSize: "14px" }}>
					<strong>Type:</strong> {displayTypeName}
				</p>
				<p style={{ margin: "4px 0 0 0", fontSize: "14px" }}>
					<strong>Submitted:</strong> {formatDate(submittedAt)}
				</p>
			</div>

			<p>
				You can track the status of your ticket by logging into HUMS and
				visiting the "My Tickets" section.
			</p>

			<p style={{ marginTop: "20px", fontSize: "14px", color: "#666" }}>
				If you have any questions about this ticket, please reply to this email
				or contact The Hive staff.
			</p>
		</EmailLayout>
	);
}
