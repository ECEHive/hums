import { EmailLayout } from "./EmailLayout";

export interface SessionAutoLogoutEmailProps {
	userName: string;
	sessionType: "regular" | "staffing";
	startedAt: Date;
	endedAt: Date;
	timeoutHours: number;
}

export function getSessionAutoLogoutSubject(
	sessionType: "regular" | "staffing",
): string {
	const sessionTypeDisplay =
		sessionType === "staffing" ? "Staffing" : "Regular";
	return `Your ${sessionTypeDisplay} Session Has Ended`;
}

export function SessionAutoLogoutEmail({
	userName,
	sessionType,
	timeoutHours,
}: SessionAutoLogoutEmailProps) {
	const sessionTypeDisplay =
		sessionType === "staffing" ? "Staffing" : "Regular";
	const sessionTypeLower = sessionTypeDisplay.toLowerCase();

	return (
		<EmailLayout
			title={`Your ${sessionTypeDisplay} Session Has Ended`}
			preheader={`Your ${sessionTypeLower} session was automatically ended after ${timeoutHours} hours.`}
		>
			<p>
				Hello <strong>{userName}</strong>,
			</p>

			<p>
				Your {sessionTypeLower} session was automatically ended after{" "}
				<strong>{timeoutHours} hours</strong> of inactivity.
			</p>

			<div className="warning-box">
				<p>
					<strong>⚠️ Important: Always Tap Out</strong>
				</p>
				<p style={{ marginTop: "8px" }}>
					Please remember to tap out with your Buzzcard when leaving The Hive.
					This helps us maintain accurate usage records and ensures proper
					session tracking for all makers.
				</p>
			</div>

			<div className="info-box">
				<p>
					<strong>🔄 Still in The Hive?</strong>
				</p>
				<p style={{ marginTop: "8px" }}>
					If you're still working in the space, you can safely ignore this
					email. Simply tap in again to continue your session.
				</p>
			</div>

			{sessionType === "staffing" && (
				<div className="warning-box">
					<p>
						<strong>Staff Notice:</strong> Please log out properly when shifts
						end to maintain accurate attendance records. Failure to do so may
						result in investigations regarding shift compliance.
					</p>
				</div>
			)}

			<p style={{ marginTop: "20px" }}>Questions? Feel free to reach out!</p>

			<p style={{ marginTop: "16px", marginBottom: 0 }}>
				<strong>The HUMS Team</strong>
			</p>
		</EmailLayout>
	);
}
