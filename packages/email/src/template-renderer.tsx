import { renderToStaticMarkup } from "react-dom/server";
import {
	getSessionAutoLogoutSubject,
	SessionAutoLogoutEmail,
	type SessionAutoLogoutEmailProps,
} from "./templates/SessionAutoLogoutEmail";
import {
	WelcomeEmail,
	type WelcomeEmailProps,
	WelcomeEmailSubject,
} from "./templates/WelcomeEmail";

// Re-export template props for external use
export type { SessionAutoLogoutEmailProps, WelcomeEmailProps };

export type RenderEmailOptions =
	| {
			template: "welcome";
			data: WelcomeEmailProps;
	  }
	| {
			template: "session-auto-logout";
			data: SessionAutoLogoutEmailProps;
	  };

export interface RenderedEmail {
	html: string;
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
		let html: string;
		let subject: string;

		switch (options.template) {
			case "welcome": {
				html = renderToStaticMarkup(<WelcomeEmail {...options.data} />);
				subject = WelcomeEmailSubject;
				break;
			}

			case "session-auto-logout": {
				html = renderToStaticMarkup(
					<SessionAutoLogoutEmail {...options.data} />,
				);
				subject = getSessionAutoLogoutSubject(options.data.sessionType);
				break;
			}
		}

		// Add DOCTYPE declaration
		html = `<!DOCTYPE html>${html}`;

		return { html, subject };
	} catch (error) {
		console.error(
			`Failed to render email template "${options.template}":`,
			error,
		);
		throw new Error(`Email template rendering failed: ${error}`);
	}
}
