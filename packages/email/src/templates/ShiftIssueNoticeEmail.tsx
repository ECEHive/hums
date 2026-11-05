import { env } from "@ecehive/env";
import { EmailLayout } from "./EmailLayout";

export interface ShiftIssueNoticeEmailProps {
	userName: string;
	attendanceId: number;
	shiftTypeName: string;
	shiftStart: Date;
	shiftEnd: Date;
	issues: string[];
	timeIn: Date | null;
	timeOut: Date | null;
	requestDeadline: Date;
	logos?: {
		light: string;
		dark: string;
	};
}

export const ShiftIssueNoticeEmailSubject =
	"Attendance Issue on a Recent Shift";

export function ShiftIssueNoticeEmail({
	userName,
	attendanceId,
	shiftTypeName,
	shiftStart,
	shiftEnd,
	issues,
	timeIn,
	timeOut,
	requestDeadline,
	logos,
}: ShiftIssueNoticeEmailProps) {
	const formatDateTime = (date: Date) => {
		return date.toLocaleString("en-US", {
			weekday: "long",
			month: "long",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
			timeZoneName: "short",
		});
	};

	const formatTime = (date: Date) => {
		return date.toLocaleTimeString("en-US", {
			hour: "numeric",
			minute: "2-digit",
		});
	};

	const requestUrl = `${env.CLIENT_BASE_URL}/app/shifts/attendance?excuse=${attendanceId}`;

	return (
		<EmailLayout
			title="Attendance Issue on a Recent Shift"
			preheader={`An attendance issue was recorded for your ${shiftTypeName} shift.`}
			logos={logos}
		>
			<p>
				Hello <strong>{userName}</strong>,
			</p>

			<p>
				An attendance issue was recorded for one of your recent shifts. If there
				was a valid reason (illness, emergency, etc) or an issue tapping in, you
				can request an excuse and a staff member will review it.
			</p>

			<div className="warning-box">
				<p>
					<strong>{shiftTypeName}</strong>
				</p>
				<p style={{ marginTop: "8px" }}>
					<strong>Scheduled:</strong> {formatDateTime(shiftStart)} –{" "}
					{formatTime(shiftEnd)}
				</p>
				<p style={{ marginTop: "4px" }}>
					<strong>Issue:</strong> {issues.join(", ")}
				</p>
				<p style={{ marginTop: "4px" }}>
					<strong>Tapped in:</strong> {timeIn ? formatTime(timeIn) : "—"}
					{" · "}
					<strong>Tapped out:</strong> {timeOut ? formatTime(timeOut) : "—"}
				</p>
			</div>

			<p>
				<a href={requestUrl} className="button">
					Request an Excuse
				</a>
			</p>

			<p>
				Excuse requests for this shift must be submitted by{" "}
				<strong>{formatDateTime(requestDeadline)}</strong>.
			</p>

			<p style={{ marginTop: "20px" }}>
				Questions? Visit The Hive front desk or email us at{" "}
				<a href="mailto:hive@ece.gatech.edu">hive@ece.gatech.edu</a>
			</p>

			<p style={{ marginTop: "16px", marginBottom: 0 }}>
				<strong>The Hive Team</strong>
			</p>
		</EmailLayout>
	);
}
