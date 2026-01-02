import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { env } from "@ecehive/env";
import type { EmailProvider, SendEmailParams } from "../types";

export class SESEmailProvider implements EmailProvider {
	private client: SESClient;
	private fromAddress: string;
	private fromName: string;

	constructor() {
		// Type-safe access to SES-specific env vars
		const sesAccessKeyId =
			"EMAIL_SES_ACCESS_KEY_ID" in env
				? env.EMAIL_SES_ACCESS_KEY_ID
				: undefined;
		const sesSecretAccessKey =
			"EMAIL_SES_SECRET_ACCESS_KEY" in env
				? env.EMAIL_SES_SECRET_ACCESS_KEY
				: undefined;
		const sesRegion =
			"EMAIL_SES_REGION" in env ? env.EMAIL_SES_REGION : "us-east-1";

		const config =
			sesAccessKeyId && sesSecretAccessKey
				? {
						region: sesRegion,
						credentials: {
							accessKeyId: sesAccessKeyId,
							secretAccessKey: sesSecretAccessKey,
						},
					}
				: {
						region: sesRegion,
					};

		this.client = new SESClient(config);
		this.fromAddress =
			env.EMAIL_FROM_ADDRESS || `noreply@${sesRegion}.amazonses.com`;
		this.fromName = env.EMAIL_FROM_NAME;
	}

	async sendEmail(params: SendEmailParams): Promise<void> {
		const from = params.from || {
			name: this.fromName,
			address: this.fromAddress,
		};

		const toAddresses = Array.isArray(params.to) ? params.to : [params.to];

		// Validate email addresses
		if (toAddresses.length === 0) {
			throw new Error("At least one recipient email address is required");
		}

		const command = new SendEmailCommand({
			Source: `"${from.name}" <${from.address}>`,
			Destination: {
				ToAddresses: toAddresses,
			},
			Message: {
				Subject: {
					Data: params.subject,
					Charset: "UTF-8",
				},
				Body: {
					Html: {
						Data: params.html,
						Charset: "UTF-8",
					},
					...(params.text && {
						Text: {
							Data: params.text,
							Charset: "UTF-8",
						},
					}),
				},
			},
		});

		await this.client.send(command);
	}
}
