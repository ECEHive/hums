import { env } from "@ecehive/env";
import { EmailLayout } from "./EmailLayout";

export interface WelcomeEmailProps {
	userName: string;
	username: string;
	email: string;
	logos?: {
		light: string;
		dark: string;
	};
}

export const WelcomeEmailSubject = "Welcome to The Hive!";

export function WelcomeEmail({ userName, logos }: WelcomeEmailProps) {
	const websiteUrl = env.CLIENT_BASE_URL;

	return (
		<EmailLayout
			title="Welcome to The Hive!"
			preheader="Your account has been created successfully."
			logos={logos}
		>
			<p>
				Hello <strong>{userName}</strong>,
			</p>

			<p>
				Welcome to The Hive! Your HUMS account has been created successfully.
			</p>

			<p>
				HUMS tracks your makerspace sessions and helps manage access to The
				Hive. You can use your Buzzcard at any kiosk to tap in and out of the
				space, and access your session history online anytime.
			</p>

			<p>
				You can access HUMS and manage your account here:{" "}
				<a href={websiteUrl}>{websiteUrl}</a>
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
