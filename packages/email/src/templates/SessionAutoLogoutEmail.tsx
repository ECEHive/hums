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
	return `Your Hive ${sessionTypeDisplay} Session Automatically Ended`;
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
			title={`Your ${sessionTypeDisplay} Session Automatically Ended`}
			preheader={`Your ${sessionTypeLower} session was automatically ended after ${timeoutHours} hours.`}
		>
			<p>
				Hello <strong>{userName}</strong>,
			</p>

			<p>
				Your {sessionTypeLower} session was automatically ended after{" "}
				<strong>{timeoutHours} hours</strong> of inactivity.
			</p>

			{sessionType === "staffing" && (
				<div className="warning-box">
					<p>
						<strong>Staffing Notice</strong>
					</p>
					<p>
						Please remember to log out properly when shifts end to maintain
						accurate attendance records.
					</p>
				</div>
			)}

			<div className="warning-box">
				<p>
					<strong>Always Tap Out!</strong>
				</p>
				<p style={{ marginTop: "8px" }}>
					Please remember to tap out with your Buzzcard when leaving The Hive.
					This helps us maintain accurate usage records and ensures proper
					session tracking for all makers.
				</p>
			</div>

			<p>
				Still in the space? You can safely ignore this email. Simply tap-in
				again to continue your session.
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
