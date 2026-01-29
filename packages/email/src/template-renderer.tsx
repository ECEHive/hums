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
