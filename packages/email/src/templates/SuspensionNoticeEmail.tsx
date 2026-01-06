import { EmailLayout } from "./EmailLayout";

export interface SuspensionNoticeEmailProps {
	userName: string;
	startDate: Date;
	endDate: Date;
	externalNotes: string | null;
}

export const SuspensionNoticeEmailSubject =
	"Important: Your Hive Access Has Been Suspended";

export function SuspensionNoticeEmail({
	userName,
	startDate,
	endDate,
	externalNotes,
}: SuspensionNoticeEmailProps) {
	const formatDate = (date: Date) => {
		return date.toLocaleDateString("en-US", {
			weekday: "long",
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
			timeZoneName: "short",
		});
	};

	return (
		<EmailLayout
			title="Your Hive Access Has Been Suspended"
			preheader="Your access to The Hive has been temporarily suspended."
		>
			<p>
				Hello <strong>{userName}</strong>,
			</p>

			<p>
				This email is to notify you that your access to The Hive has been
				temporarily suspended.
			</p>

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
					Suspension Period
				</p>
				<p style={{ margin: "8px 0 0 0" }}>
					<strong>Start:</strong> {formatDate(startDate)}
				</p>
				<p style={{ margin: "4px 0 0 0" }}>
					<strong>End:</strong> {formatDate(endDate)}
				</p>
			</div>

			<p>
				During this suspension period, you will not be able visit or utilize The
				Hive.
			</p>

			{externalNotes && (
				<div
					style={{
						backgroundColor: "#f3f4f6",
						border: "1px solid #d1d5db",
						borderRadius: "6px",
						padding: "16px",
						margin: "20px 0",
					}}
				>
					<p style={{ margin: 0, fontWeight: 600 }}>Additional Information</p>
					<p style={{ margin: "8px 0 0 0", whiteSpace: "pre-wrap" }}>
						{externalNotes}
					</p>
				</div>
			)}

			<p>
				Your account access to the HUMS web portal remains active, and you can
				view your suspension details and history there.
			</p>

			<p style={{ marginTop: "20px" }}>
				If you have questions about this suspension, please reply to this email
				or contact The Hive staff at{" "}
				<a href="mailto:hive@ece.gatech.edu">hive@ece.gatech.edu</a>
			</p>

			<p style={{ marginTop: "16px", marginBottom: 0 }}>
				<strong>The Hive Team</strong>
			</p>
		</EmailLayout>
	);
}
