import { getLogger } from "@ecehive/logger";
import { renderToStaticMarkup } from "react-dom/server";
import { getEmailLogosAsync } from "./logo-loader";
import {
	getSessionAutoLogoutSubject,
	SessionAutoLogoutEmail,
	type SessionAutoLogoutEmailProps,
} from "./templates/SessionAutoLogoutEmail";
import {
	SuspensionNoticeEmail,
	type SuspensionNoticeEmailProps,
	SuspensionNoticeEmailSubject,
} from "./templates/SuspensionNoticeEmail";
import {
	TicketAssignmentEmail,
	type TicketAssignmentEmailProps,
	TicketAssignmentEmailSubject,
} from "./templates/TicketAssignmentEmail";
import {
	TicketConfirmationEmail,
	type TicketConfirmationEmailProps,
	TicketConfirmationEmailSubject,
} from "./templates/TicketConfirmationEmail";
import {
	TicketStatusUpdateEmail,
	type TicketStatusUpdateEmailProps,
	TicketStatusUpdateEmailSubject,
} from "./templates/TicketStatusUpdateEmail";
import {
	WelcomeEmail,
	type WelcomeEmailProps,
	WelcomeEmailSubject,
} from "./templates/WelcomeEmail";
import { htmlToPlainText } from "./text-generator";

const logger = getLogger("email:renderer");

// Re-export template props for external use
export type {
	SessionAutoLogoutEmailProps,
	SuspensionNoticeEmailProps,
	TicketAssignmentEmailProps,
	TicketConfirmationEmailProps,
	TicketStatusUpdateEmailProps,
	WelcomeEmailProps,
};

export type RenderEmailOptions =
	| {
			template: "welcome";
			data: WelcomeEmailProps;
	  }
	| {
			template: "session-auto-logout";
			data: SessionAutoLogoutEmailProps;
	  }
	| {
			template: "suspension-notice";
			data: SuspensionNoticeEmailProps;
	  }
	| {
			template: "ticket-assignment";
			data: TicketAssignmentEmailProps;
	  }
	| {
			template: "ticket-confirmation";
			data: TicketConfirmationEmailProps;
	  }
	| {
			template: "ticket-status-update";
			data: TicketStatusUpdateEmailProps;
	  };

export interface RenderedEmail {
	html: string;
	text: string;
	subject: string;
}

/**
 * Render an email template using TSX
 * @param options Template name and data
 * @returns Rendered HTML and subject
 */
export async function renderEmail(
	options: RenderEmailOptions,
): Promise<RenderedEmail> {
	try {
		// Load logos from branding config
		const logos = await getEmailLogosAsync();

		let html: string;
		let subject: string;

		switch (options.template) {
			case "welcome": {
				html = renderToStaticMarkup(
					<WelcomeEmail {...options.data} logos={logos} />,
				);
				subject = WelcomeEmailSubject;
				break;
			}

			case "session-auto-logout": {
				html = renderToStaticMarkup(
					<SessionAutoLogoutEmail {...options.data} logos={logos} />,
				);
				subject = getSessionAutoLogoutSubject(options.data.sessionType);
				break;
			}

			case "suspension-notice": {
				html = renderToStaticMarkup(
					<SuspensionNoticeEmail {...options.data} logos={logos} />,
				);
				subject = SuspensionNoticeEmailSubject;
				break;
			}

			case "ticket-assignment": {
				html = renderToStaticMarkup(
					<TicketAssignmentEmail {...options.data} logos={logos} />,
				);
				subject = TicketAssignmentEmailSubject;
				break;
			}

			case "ticket-confirmation": {
				html = renderToStaticMarkup(
					<TicketConfirmationEmail {...options.data} logos={logos} />,
				);
				subject = TicketConfirmationEmailSubject;
				break;
			}

			case "ticket-status-update": {
				html = renderToStaticMarkup(
					<TicketStatusUpdateEmail {...options.data} logos={logos} />,
				);
				subject = TicketStatusUpdateEmailSubject;
				break;
			}
		}

		// Add DOCTYPE declaration
		html = `<!DOCTYPE html>${html}`;

		// Generate plain-text version
		const text = htmlToPlainText(html);

		return { html, text, subject };
	} catch (error) {
		logger.error("Failed to render email template", {
			template: options.template,
			error: error instanceof Error ? error.message : String(error),
		});
		throw new Error(`Email template rendering failed: ${error}`);
	}
}
