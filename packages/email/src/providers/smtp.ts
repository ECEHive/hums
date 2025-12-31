import { env } from "@ecehive/env";
import type { Transporter } from "nodemailer";
import nodemailer from "nodemailer";
import type { EmailProvider, SendEmailParams } from "../types";

export class SMTPEmailProvider implements EmailProvider {
	private transporter: Transporter;
	private fromAddress: string;
	private fromName: string;

	constructor() {
		// Type-safe access to SMTP-specific env vars
		const smtpHost =
			"EMAIL_SMTP_HOST" in env ? env.EMAIL_SMTP_HOST : "localhost";
		const smtpPort = "EMAIL_SMTP_PORT" in env ? env.EMAIL_SMTP_PORT : 587;
		const smtpSecure =
			"EMAIL_SMTP_SECURE" in env ? env.EMAIL_SMTP_SECURE : false;
		const smtpUser = "EMAIL_SMTP_USER" in env ? env.EMAIL_SMTP_USER : undefined;
		const smtpPassword =
			"EMAIL_SMTP_PASSWORD" in env ? env.EMAIL_SMTP_PASSWORD : undefined;

		this.transporter = nodemailer.createTransport({
			host: smtpHost,
			port: smtpPort,
			secure: smtpSecure,
			...(smtpUser &&
				smtpPassword && {
					auth: {
						user: smtpUser,
						pass: smtpPassword,
					},
				}),
		});

		this.fromAddress = env.EMAIL_FROM_ADDRESS || `noreply@${smtpHost}`;
		this.fromName = env.EMAIL_FROM_NAME;
	}

	async sendEmail(params: SendEmailParams): Promise<void> {
		const from = params.from || {
			name: this.fromName,
			address: this.fromAddress,
		};

		// Validate email addresses
		const toAddresses = Array.isArray(params.to) ? params.to : [params.to];
		if (toAddresses.length === 0) {
			throw new Error("At least one recipient email address is required");
		}

		await this.transporter.sendMail({
			from: `"${from.name}" <${from.address}>`,
			to: params.to,
			subject: params.subject,
			html: params.html,
			text: params.text,
		});
	}
}
