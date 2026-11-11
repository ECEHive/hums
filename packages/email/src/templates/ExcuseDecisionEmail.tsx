import { env } from "@ecehive/env";
import { EmailLayout } from "./EmailLayout";

export interface ExcuseDecisionEmailProps {
	userName: string;
	shiftTypeName: string;
	shiftStart: Date;
	shiftEnd: Date;
	decision: "granted" | "denied";
	requestReason: string;
	staffNotes: string | null;
	logos?: {
		light: string;
		dark: string;
	};
}

export function getExcuseDecisionSubject(
	decision: "granted" | "denied",
): string {
	return decision === "granted"
		? "Your Excuse Request Was Granted"
		: "Your Excuse Request Was Denied";
}

export function ExcuseDecisionEmail({
	userName,
	shiftTypeName,
	shiftStart,
	shiftEnd,
	decision,
	requestReason,
	staffNotes,
	logos,
}: ExcuseDecisionEmailProps) {
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

	const isGranted = decision === "granted";

	return (
		<EmailLayout
			title={getExcuseDecisionSubject(decision)}
			preheader={`Your excuse request for your ${shiftTypeName} shift was ${decision}.`}
			logos={logos}
		>
			<p>
				Hello <strong>{userName}</strong>,
			</p>

			<p>
				A staff member has reviewed your excuse request for the shift below.
			</p>

			<div className={isGranted ? "success-box" : "destructive-box"}>
				<p>
					<strong>{isGranted ? "Excuse Granted" : "Excuse Denied"}</strong>
				</p>
				<p style={{ marginTop: "8px" }}>
					<strong>{shiftTypeName}:</strong> {formatDateTime(shiftStart)} –{" "}
					{formatTime(shiftEnd)}
				</p>
			</div>

			<p>
				{isGranted
					? "This shift will now count as full credit toward your attendance."
					: "This shift will continue to count against your attendance."}
			</p>

			<div className="info-box">
				<p>
					<strong>Your reason</strong>
				</p>
				<p style={{ marginTop: "8px", whiteSpace: "pre-wrap" }}>
					{requestReason}
				</p>
				{staffNotes && (
					<>
						<p style={{ marginTop: "12px" }}>
							<strong>Staff notes</strong>
						</p>
						<p style={{ marginTop: "8px", whiteSpace: "pre-wrap" }}>
							{staffNotes}
						</p>
					</>
				)}
			</div>

			<p>
				You can view your attendance history at{" "}
				<a href={`${env.CLIENT_BASE_URL}/app/shifts/attendance`}>
					{`${env.CLIENT_BASE_URL}/app/shifts/attendance`}
				</a>
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
