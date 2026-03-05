import { EmailLayout } from "./EmailLayout";

export interface BookingCancellationEmailProps {
	recipientName: string;
	eventTypeName: string;
	startTime: Date;
	endTime: Date;
	reason: string | null;
	/** Whether to show the "Book Again" button (only for requestors) */
	showBookAgain: boolean;
	bookAgainUrl: string | null;
	logos?: {
		light: string;
		dark: string;
	};
}

export const BookingCancellationEmailSubject = "Booking Cancelled";

export function BookingCancellationEmail({
	recipientName,
	eventTypeName,
	startTime,
	endTime,
	reason,
	showBookAgain,
	bookAgainUrl,
	logos,
}: BookingCancellationEmailProps) {
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
			title="Booking Cancelled"
			preheader={`Your ${eventTypeName} booking on ${formatDate(startTime)} has been cancelled.`}
			logos={logos}
		>
			<p>
				Hello <strong>{recipientName}</strong>,
			</p>

			<p>The following booking has been cancelled.</p>

			<div
				style={{
					backgroundColor: "#fef2f2",
					border: "1px solid #fecaca",
					borderRadius: "6px",
					padding: "16px",
					margin: "20px 0",
				}}
			>
				<p style={{ margin: 0, fontWeight: 600, color: "#dc2626" }}>
					Booking Cancelled
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
			</div>

			{reason && (
				<div
					style={{
						backgroundColor: "#f9fafb",
						border: "1px solid #e5e7eb",
						borderRadius: "6px",
						padding: "16px",
						margin: "20px 0",
					}}
				>
					<p style={{ margin: 0, fontWeight: 600, color: "#374151" }}>
						Reason for Cancellation
					</p>
					<p style={{ margin: "8px 0 0 0", fontSize: "14px" }}>{reason}</p>
				</div>
			)}

			{showBookAgain && bookAgainUrl && (
				<div style={{ margin: "24px 0", textAlign: "center" as const }}>
					<a
						href={bookAgainUrl}
						style={{
							display: "inline-block",
							backgroundColor: "#2563eb",
							color: "#ffffff",
							padding: "10px 20px",
							borderRadius: "6px",
							textDecoration: "none",
							fontWeight: 600,
							fontSize: "14px",
						}}
					>
						Book a New Time
					</a>
				</div>
			)}

			<p style={{ marginTop: "20px", fontSize: "14px", color: "#666" }}>
				If you have any questions about this cancellation, please contact The
				Hive staff.
			</p>
		</EmailLayout>
	);
}
