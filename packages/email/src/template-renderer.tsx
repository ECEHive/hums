import { getLogger } from "@ecehive/logger";
import { renderToStaticMarkup } from "react-dom/server";
import { getEmailLogos } from "./logo-loader";
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

// Re-export template props for external use (without logos - they're added internally)
export type {
	SessionAutoLogoutEmailProps,
	SuspensionNoticeEmailProps,
	WelcomeEmailProps,
};

// Internal types that omit the logos prop (added by renderEmail)
type WelcomeEmailData = Omit<WelcomeEmailProps, "logos">;
type SessionAutoLogoutEmailData = Omit<SessionAutoLogoutEmailProps, "logos">;
type SuspensionNoticeEmailData = Omit<SuspensionNoticeEmailProps, "logos">;

export type RenderEmailOptions =
	| {
			template: "welcome";
			data: WelcomeEmailData;
	  }
	| {
			template: "session-auto-logout";
			data: SessionAutoLogoutEmailData;
	  }
	| {
			template: "suspension-notice";
			data: SuspensionNoticeEmailData;
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
		// Load logos from the branding system
		const logos = await getEmailLogos();

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
