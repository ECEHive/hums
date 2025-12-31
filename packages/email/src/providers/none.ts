import type { EmailProvider, SendEmailParams } from "../types";

/**
 * None Email Provider
 *
 * This provider logs email sends without actually sending them.
 * Useful for testing, development, or environments where email sending is not desired.
 */
export class NoneEmailProvider implements EmailProvider {
	async sendEmail(params: SendEmailParams): Promise<void> {
		const recipients = Array.isArray(params.to)
			? params.to.join(", ")
			: params.to;
		const from = params.from
			? `${params.from.name} <${params.from.address}>`
			: "default sender";

		console.log("📧 [NONE Provider] Email would be sent:");
		console.log(`   From: ${from}`);
		console.log(`   To: ${recipients}`);
		console.log(`   Subject: ${params.subject}`);
		console.log(`   HTML Length: ${params.html.length} characters`);
		if (params.text) {
			console.log(`   Text Length: ${params.text.length} characters`);
		}
		console.log("   Status: Not sent (NONE provider active)");
	}
}
