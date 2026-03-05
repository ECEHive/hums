import { EmailLayout } from "./EmailLayout";

export interface BookingConfirmationEmailProps {
	recipientName: string;
	eventTypeName: string;
	startTime: Date;
	endTime: Date;
	schedulerNames: string[];
	/** Whether this recipient is the requestor (shows cancel + reschedule) or a scheduler (shows cancel only) */
	isRequestor: boolean;
	cancelUrl: string;
	rescheduleUrl: string | null;
	logos?: {
		light: string;
		dark: string;
	};
}

export const BookingConfirmationEmailSubject = "Booking Confirmed";

export function BookingConfirmationEmail({
	recipientName,
	eventTypeName,
	startTime,
	endTime,
	schedulerNames,
	isRequestor,
	cancelUrl,
	rescheduleUrl,
	logos,
}: BookingConfirmationEmailProps) {
	const formatDate = (date: Date) => {
		return date.toLocaleDateString("en-US", {
			weekday: "long",
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	};

	const formatTime = (date: Date) => {
		return date.toLocaleTimeString("en-US", {
			hour: "numeric",
			minute: "2-digit",
		});
	};

	return (
		<EmailLayout
			title="Booking Confirmed"
			preheader={`Your ${eventTypeName} booking on ${formatDate(startTime)} has been confirmed.`}
			logos={logos}
		>
			<p>
				Hello <strong>{recipientName}</strong>,
			</p>

			<p>
				{isRequestor
					? `Your ${eventTypeName} booking has been confirmed.`
					: `You have been assigned as a scheduler for a ${eventTypeName} booking.`}
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
					Booking Details
				</p>
				<p style={{ margin: "8px 0 0 0", fontSize: "14px" }}>
					<strong>Event:</strong> {eventTypeName}
				</p>
				<p style={{ margin: "4px 0 0 0", fontSize: "14px" }}>
					<strong>Date:</strong> {formatDate(startTime)}
				</p>
				<p style={{ margin: "4px 0 0 0", fontSize: "14px" }}>
					<strong>Time:</strong> {formatTime(startTime)} – {formatTime(endTime)}
				</p>
				{schedulerNames.length > 0 && (
					<p style={{ margin: "4px 0 0 0", fontSize: "14px" }}>
						<strong>Assigned To:</strong> {schedulerNames.join(", ")}
					</p>
				)}
			</div>

			<div style={{ margin: "24px 0", textAlign: "center" as const }}>
				{isRequestor && rescheduleUrl && (
					<a
						href={rescheduleUrl}
						style={{
							display: "inline-block",
							backgroundColor: "#2563eb",
							color: "#ffffff",
							padding: "10px 20px",
							borderRadius: "6px",
							textDecoration: "none",
							fontWeight: 600,
							fontSize: "14px",
							marginRight: "8px",
						}}
					>
						Reschedule
					</a>
				)}
				<a
					href={cancelUrl}
					style={{
						display: "inline-block",
						backgroundColor: "#dc2626",
						color: "#ffffff",
						padding: "10px 20px",
						borderRadius: "6px",
						textDecoration: "none",
						fontWeight: 600,
						fontSize: "14px",
					}}
				>
					Cancel Booking
				</a>
			</div>

			<p style={{ marginTop: "20px", fontSize: "14px", color: "#666" }}>
				If you have any questions about this booking, please contact The Hive
				staff.
			</p>
		</EmailLayout>
	);
}
