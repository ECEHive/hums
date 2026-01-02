import { getLogger } from "@ecehive/logger";
import type { EmailProvider, SendEmailParams } from "../types";

const logger = getLogger("email:provider:none");

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

		logger.info("Email simulated (none provider)", {
			from,
			to: recipients,
			subject: params.subject,
			htmlLength: params.html.length,
			textLength: params.text?.length,
		});
	}
}
